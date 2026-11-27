/**
 * scrapeFetch — salida alternativa para los sitios de anime.
 *
 * Los proveedores (JKAnime, AnimeFLV, TioAnime…) bloquean o ponen el desafío de
 * Cloudflare a las IPs de datacenter como la de Railway. La app móvil y la de PC
 * no sufren esto porque hacen las peticiones desde la IP de casa del usuario.
 *
 * Variables de entorno (Railway → Variables), todas opcionales:
 *   SCRAPE_RELAY_URL     https://iziff-auth.josearaneda2025.workers.dev/v1/relay
 *   SCRAPE_RELAY_KEY     la misma clave que el secreto RELAY_KEY del Worker
 *   SCRAPE_API_TEMPLATE  API de scraping con {url}, p. ej.
 *                        https://api.scraperapi.com/?api_key=XXXX&url={url}
 *                        (se usa si el relay también falla o no está configurado)
 *
 * Sin variables se comporta igual que fetch normal.
 */

const RELAY_URL = process.env.SCRAPE_RELAY_URL?.trim() || ""
const RELAY_KEY = process.env.SCRAPE_RELAY_KEY?.trim() || ""
const API_TEMPLATE = process.env.SCRAPE_API_TEMPLATE?.trim() || ""

/** Solo los sitios de anime pasan por la salida alternativa (AniList, etc. van directo). */
const RELAY_HOSTS = [
    "anipub.xyz",
    "animeav1.eu",
    "animeav1.com",
    "animeflv.com.im",
    "animeflv.net",
    "jkanime.net",
    "tioanime.com",
    "animefenix.vip",
    "animefenix.tv",
    "latanime.org",
]

const BLOCK_STATUSES = new Set([403, 429, 503, 520, 521, 522, 523, 524, 525, 526])
/** Recuerda por host que el acceso directo está bloqueado para no perder tiempo. */
const BLOCK_MEMO_MS = 30 * 60_000
const directBlockedUntil = new Map<string, number>()

type Route = "direct" | "relay" | "api"
const routeStats = new Map<string, Record<Route, { ok: number; fail: number }>>()

function bump(host: string, route: Route, ok: boolean) {
    let entry = routeStats.get(host)
    if (!entry) {
        entry = { direct: { ok: 0, fail: 0 }, relay: { ok: 0, fail: 0 }, api: { ok: 0, fail: 0 } }
        routeStats.set(host, entry)
    }
    entry[route][ok ? "ok" : "fail"] += 1
}

function hostOf(url: string): string {
    try { return new URL(url).hostname.toLowerCase() } catch { return "" }
}

export function isRelayHost(url: string): boolean {
    const host = hostOf(url)
    return RELAY_HOSTS.some(h => host === h || host.endsWith(`.${h}`))
}

export function relayConfig() {
    return { relay: Boolean(RELAY_URL && RELAY_KEY), api: Boolean(API_TEMPLATE) }
}

export function getScrapeRouteStats() {
    const now = Date.now()
    return Object.fromEntries([...routeStats.entries()].map(([host, stats]) => [
        host,
        { ...stats, directBlocked: (directBlockedUntil.get(host) ?? 0) > now },
    ]))
}

/** ¿La respuesta es un bloqueo / desafío de Cloudflare? */
export function looksBlocked(response: Response): boolean {
    if (BLOCK_STATUSES.has(response.status)) return true
    if (response.headers.get("cf-mitigated") === "challenge") return true
    return false
}

function pickHeaders(init: RequestInit): Record<string, string> {
    const out: Record<string, string> = {}
    new Headers(init.headers).forEach((value, key) => { out[key] = value })
    return out
}

async function viaRelay(url: string, init: RequestInit): Promise<Response> {
    const headers = pickHeaders(init)
    headers["x-relay-key"] = RELAY_KEY
    return fetch(`${RELAY_URL}?url=${encodeURIComponent(url)}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body,
        signal: init.signal,
    })
}

async function viaApi(url: string, init: RequestInit): Promise<Response> {
    return fetch(API_TEMPLATE.replace("{url}", encodeURIComponent(url)), {
        method: init.method ?? "GET",
        headers: pickHeaders(init),
        body: init.body,
        signal: init.signal,
    })
}

/**
 * fetch con salida alternativa: intenta directo; si el sitio bloquea la IP del
 * servidor, reintenta por el relay del Worker y luego por la API de scraping.
 */
export async function scrapeFetch(url: string, init: RequestInit = {}): Promise<Response> {
    if (!isRelayHost(url)) return fetch(url, init)
    const { relay, api } = relayConfig()
    if (!relay && !api) return fetch(url, init)

    const host = hostOf(url)
    const routes: Route[] = []
    if ((directBlockedUntil.get(host) ?? 0) <= Date.now()) routes.push("direct")
    if (relay) routes.push("relay")
    if (api) routes.push("api")

    let last: Response | undefined
    let lastError: unknown
    for (const route of routes) {
        if (init.signal?.aborted) break
        try {
            const response = route === "direct" ? await fetch(url, init)
                : route === "relay" ? await viaRelay(url, init)
                    : await viaApi(url, init)
            if (!looksBlocked(response)) {
                bump(host, route, true)
                return response
            }
            bump(host, route, false)
            if (route === "direct") directBlockedUntil.set(host, Date.now() + BLOCK_MEMO_MS)
            last = response
        } catch (error) {
            bump(host, route, false)
            if (route === "direct" && !init.signal?.aborted) directBlockedUntil.set(host, Date.now() + BLOCK_MEMO_MS)
            lastError = error
        }
    }
    if (last) return last
    throw lastError instanceof Error ? lastError : new Error("scrape fetch failed")
}

/** Prueba cada proveedor por cada ruta disponible (para /api/anime/providers-probe). */
export async function probeProviders(): Promise<Array<Record<string, unknown>>> {
    const targets: Array<[string, string]> = [
        ["AnimeFLV", "https://animeflv.com.im/"],
        ["JKAnime", "https://jkanime.net/"],
        ["AnimeAV1", "https://animeav1.eu/"],
        ["AniPub", "https://www.anipub.xyz/"],
        ["TioAnime", "https://tioanime.com/"],
        ["AnimeFenix", "https://ww1.animefenix.vip/"],
        ["Latanime", "https://latanime.org/"],
    ]
    const { relay, api } = relayConfig()
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    const init = { headers: { "User-Agent": ua, Accept: "text/html,*/*" } }

    const one = async (route: Route, url: string) => {
        const started = Date.now()
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12_000)
        try {
            const r = route === "direct" ? await fetch(url, { ...init, signal: controller.signal })
                : route === "relay" ? await viaRelay(url, { ...init, signal: controller.signal })
                    : await viaApi(url, { ...init, signal: controller.signal })
            const text = await r.text().catch(() => "")
            const challenge = /Just a moment|cf-chl|challenge-platform|Attention Required/i.test(text.slice(0, 4000))
            return { status: r.status, ok: r.ok && !challenge, challenge, ms: Date.now() - started }
        } catch (error) {
            return { status: 0, ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started }
        } finally {
            clearTimeout(timer)
        }
    }

    return Promise.all(targets.map(async ([name, url]) => ({
        provider: name,
        url,
        direct: await one("direct", url),
        ...(relay ? { relay: await one("relay", url) } : {}),
        ...(api ? { api: await one("api", url) } : {}),
    })))
}
