export type Onlinestream_Subtitle = {
    id: string
    url: string
    lang: string
}

export type Onlinestream_VideoSource = {
    server: string
    headers?: Record<string, string>
    url: string
    label?: string
    quality: string
    type?: string
    subtitles?: Array<Onlinestream_Subtitle>
}

export type Onlinestream_EpisodeSource = {
    number: number
    videoSources?: Array<Onlinestream_VideoSource>
}

export type AL_BaseAnime = any
export type AL_BaseManga = any
export type Anime_ScheduleItem = any
export type Anime_Entry = any
export type HibikeManga_ChapterDetails = any
export type Manga_ChapterContainer = any
export type Manga_Entry = any
export type Manga_PageContainer = any
export type Onlinestream_EpisodeListResponse = any

export const ANIMEFLEX_API_BASE_URL = (
    process.env.EXPO_PUBLIC_ANIMEFLEX_API_URL
    ?? "https://animeflexweb-production.up.railway.app/api"
).replace(/\/$/, "")

const REQUEST_TIMEOUT_MS = 60_000
const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"
const JIKAN_API_URL = "https://api.jikan.moe/v4"
const ANIZIP_API_URL = "https://api.ani.zip"
const MANGADEX_API_URL = "https://api.mangadex.org"
const MANGADEX_UPLOADS_URL = "https://uploads.mangadex.org"
const ANIPUB_BASE_URL = "https://www.anipub.xyz"
const ANIMEAV1_BASE_URL = "https://animeav1.eu"
const ANIMEFLV_ES_BASE_URL = "https://animeflv.com.im"
const JKANIME_BASE_URL = "https://jkanime.net"
const TIOANIME_BASE_URL = "https://tioanime.com"
const ANIME_FENIX_BASE_URL = "https://ww1.animefenix.vip"
const LATANIME_BASE_URL = "https://latanime.org"

// Series slug caches avoid repeating expensive search lookups across episodes
const jkAnimeSeriesUrlCache = new Map<string, string>()
const jkAnimeSeriesLookupInFlight = new Map<string, Promise<string>>()
const latanimeSeriesUrlCache = new Map<string, string>()
const latanimeSeriesLookupInFlight = new Map<string, Promise<string>>()
export const mangaCoverCache = new Map<string, string>()

export type AnimeflexTitle = {
    english?: string
    romaji?: string
    native?: string
    userPreferred?: string
}

export type AnimeflexAnime = {
    id: string
    title: string | AnimeflexTitle
    image: string
    cover?: string
    releaseDate?: string | number
    type?: string
    status?: string
    totalEpisodes?: number
    currentEpisode?: number
    rating?: number
    duration?: string | number
    genres?: string[]
    description?: string
    color?: string
}

export type AnimeflexSearchResult = {
    currentPage: number
    hasNextPage: boolean
    results: AnimeflexAnime[]
}

export type AnimeflexAnimeInfo = AnimeflexAnime & {
    studios?: string[]
    episodes?: AnimeflexEpisode[]
    recommendations?: AnimeflexAnime[]
}

export type AniListVoiceActor = {
    id: number
    name?: {
        full?: string
        native?: string
    }
    image?: {
        extraLarge?: string
        large?: string
        medium?: string
    }
}

export type AniListCharacterEdge = {
    id: number
    role?: "MAIN" | "SUPPORTING" | "BACKGROUND" | string
    node?: {
        id: number
        name?: {
            full?: string
            native?: string
        }
        image?: {
            extraLarge?: string
            large?: string
            medium?: string
        }
    }
    voiceActors?: AniListVoiceActor[]
}

export type AniListRelationEdge = {
    id: number
    relationType?: string
    node?: {
        id: number
        title?: {
            userPreferred?: string
            romaji?: string
            english?: string
        }
        format?: string
        type?: "ANIME" | "MANGA"
        status?: string
        coverImage?: {
            extraLarge?: string
            large?: string
            medium?: string
        }
        meanScore?: number
        episodes?: number
    }
}

export type AniListExtendedDetails = {
    id: number
    studios?: {
        nodes?: Array<{ id: number; name: string }>
    }
    characters?: {
        edges?: AniListCharacterEdge[]
    }
    relations?: {
        edges?: AniListRelationEdge[]
    }
}

export type AnimeflexEpisode = {
    id: string
    number: number
    title?: string
    description?: string
    image?: string
    isFiller?: boolean
}

export type AnimeflexEpisodeList = {
    id: string
    episodes?: AnimeflexEpisode[]
}

export type AnimeflexManga = {
    id: string
    title: string | AnimeflexTitle
    image?: string
    cover?: string
    description?: string
    status?: string | null
    genres?: string[]
    rating?: number | null
    chapters?: number
    source?: string
}

export type AnimeflexMangaChapter = {
    id: string
    chapterNumber?: string | number
    volumeNumber?: string | number | null
    title?: string | null
    lang?: string
    releaseDate?: string | null
}

export type AnimeflexMangaInfo = Omit<AnimeflexManga, "chapters"> & {
    authors?: Array<{ name: string }>
    chapters?: AnimeflexMangaChapter[]
}

export type AnimeflexMangaSearchResult = {
    currentPage: number
    hasNextPage: boolean
    total?: number
    results: AnimeflexManga[]
}

export type AnimeflexMangaPage = {
    img: string
    page: number
}

type MangaDexRelationship = {
    id: string
    type: string
    attributes?: { fileName?: string; name?: string }
}

type MangaDexManga = {
    id: string
    attributes: {
        title?: Record<string, string>
        altTitles?: Array<Record<string, string>>
        description?: Record<string, string>
        status?: string
        year?: number | null
        originalLanguage?: string
        lastChapter?: string | null
        tags?: Array<{ attributes?: { name?: Record<string, string> } }>
    }
    relationships?: MangaDexRelationship[]
}

type MangaDexChapter = {
    id: string
    attributes: {
        chapter?: string | null
        volume?: string | null
        title?: string | null
        translatedLanguage?: string
        publishAt?: string | null
    }
    relationships?: MangaDexRelationship[]
}

type MangaDexCollection<T> = { data?: T[]; total?: number; limit?: number; offset?: number }
type MangaDexEntity<T> = { data?: T }

function mangaDexId(id: string) {
    return `mangadex:${id}`
}

function resolveMangaDexId(id: string | number): string | null {
    const value = String(id)
    return value.startsWith("mangadex:") ? value.slice("mangadex:".length) : null
}

function getMangaDexLocalizedText(values: Record<string, string> | undefined): string {
    if (!values) return ""
    return values.es ?? values["es-la"] ?? values.en ?? values.ja ?? Object.values(values)[0] ?? ""
}

function mangaDexToAnimeflexManga(manga: MangaDexManga): AnimeflexManga {
    const cover = manga.relationships?.find(relation => relation.type === "cover_art")?.attributes?.fileName
    const image = cover ? `${MANGADEX_UPLOADS_URL}/covers/${manga.id}/${cover}.512.jpg` : undefined
    const title = getMangaDexLocalizedText(manga.attributes.title)
    const genres = (manga.attributes.tags ?? [])
        .map(tag => getMangaDexLocalizedText(tag.attributes?.name))
        .filter(Boolean)

    return {
        id: mangaDexId(manga.id),
        title,
        image,
        cover: image,
        description: getMangaDexLocalizedText(manga.attributes.description),
        status: manga.attributes.status,
        genres,
        chapters: Number(manga.attributes.lastChapter) || undefined,
        source: manga.attributes.originalLanguage === "ko"
            ? "manhwa"
            : manga.attributes.originalLanguage === "zh" || manga.attributes.originalLanguage === "zh-hk"
                ? "manhua"
                : "manga",
    }
}

async function searchMangaDex(query: string, page: number, signal?: AbortSignal): Promise<AnimeflexMangaSearchResult> {
    const limit = 24
    const params = new URLSearchParams({
        title: query,
        limit: String(limit),
        offset: String((Math.max(1, page) - 1) * limit),
        "order[relevance]": "desc",
    })
    params.append("includes[]", "cover_art")
    params.append("contentRating[]", "safe")
    params.append("contentRating[]", "suggestive")
    const response = await getExternalJson<MangaDexCollection<MangaDexManga>>(
        `${MANGADEX_API_URL}/manga?${params.toString()}`,
        { headers: { Accept: "application/json" } },
        signal,
    )
    const results = (response.data ?? []).map(mangaDexToAnimeflexManga)
    const offset = (Math.max(1, page) - 1) * limit
    return {
        currentPage: page,
        hasNextPage: offset + results.length < (response.total ?? 0),
        total: response.total,
        results,
    }
}

async function getMangaDexInfo(id: string, signal?: AbortSignal): Promise<AnimeflexMangaInfo> {
    const params = new URLSearchParams()
    params.append("includes[]", "cover_art")
    params.append("includes[]", "author")
    params.append("includes[]", "artist")
    const mangaResponse = await getExternalJson<MangaDexEntity<MangaDexManga>>(
        `${MANGADEX_API_URL}/manga/${encodeURIComponent(id)}?${params.toString()}`,
        { headers: { Accept: "application/json" } },
        signal,
    )
    if (!mangaResponse.data) throw new AnimeflexApiError("MangaDex no devolvió información", 404)

    const feedParams = new URLSearchParams({ limit: "500", offset: "0", "order[chapter]": "asc" })
    feedParams.append("translatedLanguage[]", "es")
    feedParams.append("translatedLanguage[]", "en")
    feedParams.append("contentRating[]", "safe")
    feedParams.append("contentRating[]", "suggestive")
    feedParams.append("includes[]", "scanlation_group")
    const feed = await getExternalJson<MangaDexCollection<MangaDexChapter>>(
        `${MANGADEX_API_URL}/manga/${encodeURIComponent(id)}/feed?${feedParams.toString()}`,
        { headers: { Accept: "application/json" } },
        signal,
    )
    const base = mangaDexToAnimeflexManga(mangaResponse.data)
    const seen = new Set<string>()
    const chapters = (feed.data ?? []).flatMap(chapter => {
        const number = chapter.attributes.chapter?.trim()
        if (!number) return []
        const identity = `${number}:${chapter.attributes.translatedLanguage ?? ""}`
        if (seen.has(identity)) return []
        seen.add(identity)
        return [{
            id: mangaDexId(chapter.id),
            chapterNumber: number,
            volumeNumber: chapter.attributes.volume,
            title: chapter.attributes.title,
            lang: chapter.attributes.translatedLanguage ?? "es",
            releaseDate: chapter.attributes.publishAt,
        }]
    })
    const authors = (mangaResponse.data.relationships ?? [])
        .filter(relation => relation.type === "author" || relation.type === "artist")
        .flatMap(relation => relation.attributes?.name ? [{ name: relation.attributes.name }] : [])

    return { ...base, authors, chapters }
}

async function getMangaDexPages(
    mediaId: string | number,
    chapterId: string,
    signal?: AbortSignal,
): Promise<Manga_PageContainer> {
    const resolvedChapterId = resolveMangaDexId(chapterId)
    if (!resolvedChapterId) throw new AnimeflexApiError("Capítulo de MangaDex inválido", 400)
    const response = await getExternalJson<{
        baseUrl?: string
        chapter?: { hash?: string; data?: string[]; dataSaver?: string[] }
    }>(
        `${MANGADEX_API_URL}/at-home/server/${encodeURIComponent(resolvedChapterId)}`,
        { headers: { Accept: "application/json" } },
        signal,
    )
    const baseUrl = response.baseUrl
    const hash = response.chapter?.hash
    const files = response.chapter?.dataSaver?.length ? response.chapter.dataSaver : response.chapter?.data
    if (!baseUrl || !hash || !files?.length) throw new AnimeflexApiError("MangaDex no devolvió páginas")
    return {
        mediaId: getAnimeflexMangaNumericId(String(mediaId)),
        provider: "mangadex",
        chapterId,
        pages: files.map((file, index) => ({
            provider: "mangadex",
            url: `${baseUrl}/data-saver/${hash}/${file}`,
            index,
        })),
        isDownloaded: false,
    }
}

const mangaSlugByNumericId = new Map<number, string>()
let mangaSlugStore: { getString: (k: string) => string | undefined; set: (k: string, v: string) => void } | null = null

function getMangaSlugStore() {
    if (!mangaSlugStore) {
        try {
            // Lazy load for React Native runtime without breaking Node unit tests
            const { createMMKV } = require("react-native-mmkv")
            mangaSlugStore = createMMKV({ id: "iziff-manga-slugs" })
        } catch {
            mangaSlugStore = {
                getString: () => undefined,
                set: () => {},
            }
        }
    }
    return mangaSlugStore
}

export function getAnimeflexMangaNumericId(slug: string): number {
    if (!slug) return 1
    if (/^\d+$/.test(slug)) {
        return Number(slug)
    }
    let hash = 2166136261
    for (let index = 0; index < slug.length; index += 1) {
        hash ^= slug.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    const numericId = (hash >>> 0) || 1
    mangaSlugByNumericId.set(numericId, slug)
    try {
        const store = getMangaSlugStore()
        store?.set(String(numericId), slug)
        store?.set(slug, String(numericId))
    } catch {}
    return numericId
}

export function resolveAnimeflexMangaSlug(id: string | number): string {
    if (typeof id === "string" && !/^\d+$/.test(id)) return id
    const numId = Number(id)
    if (mangaSlugByNumericId.has(numId)) {
        return mangaSlugByNumericId.get(numId)!
    }
    try {
        const store = getMangaSlugStore()
        const stored = store?.getString(String(id))
        if (stored) {
            mangaSlugByNumericId.set(numId, stored)
            return stored
        }
    } catch {}
    return String(id)
}

export type AnimeflexStreamSource = {
    url: string
    quality?: string
    isM3U8?: boolean
    isDub?: boolean
    lang?: string
    referer?: string
}

export type AnimeflexStreamingData = {
    slug?: string
    headers?: Record<string, string>
    sources?: AnimeflexStreamSource[]
    subtitles?: Array<{ url: string; lang?: string; language?: string }>
}

type AnipubSearchResult = {
    Name?: string
    Id?: number
    finder?: string
}

type AnipubStreamingDetails = {
    local?: {
        link?: string
        ep?: Array<{ link?: string }>
    }
}

type AnimeAv1SearchResult = {
    title?: string
    url?: string
    subtype?: string
}

const SPANISH_EMBED_HOSTS = new Set([
    "player.zilla-networks.com",
    "animeav1.uns.bio",
    "www.mp4upload.com",
    "voe.sx",
    "byselapuix.com",
])

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&amp;/gi, "&")
        .replace(/&#0*38;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#0*39;|&apos;/gi, "'")
}

function decodeBase64Url(value: string): string | undefined {
    try {
        if (typeof globalThis.atob === "function") {
            return globalThis.atob(value).trim()
        }
        return Buffer.from(value, "base64").toString("utf8").trim()
    } catch {
        return undefined
    }
}

export function getSpanishEmbedUrls(html: string): URL[] {
    const rawUrls = [
        ...Array.from(html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi), match => match[1]),
        ...Array.from(html.matchAll(/\bdata-src=["']([A-Za-z0-9+/=\r\n]+)["']/gi), match => decodeBase64Url(match[1])),
    ]
    const unique = new Map<string, URL>()
    for (const rawUrl of rawUrls) {
        if (!rawUrl) continue
        try {
            const parsed = new URL(decodeHtmlEntities(rawUrl))
            if (parsed.protocol !== "https:" || !SPANISH_EMBED_HOSTS.has(parsed.hostname)) continue
            unique.set(parsed.href, parsed)
        } catch {
            // Ignore malformed or untrusted embed URLs.
        }
    }
    const hostPriority = new Map([
        ["animeav1.uns.bio", 0],
        ["www.mp4upload.com", 1],
        ["byselapuix.com", 2],
        ["voe.sx", 3],
        ["player.zilla-networks.com", 4],
    ])
    return [...unique.values()].sort((left, right) => (
        (hostPriority.get(left.hostname) ?? 99) - (hostPriority.get(right.hostname) ?? 99)
    ))
}

function makeSpanishSiteSlug(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

export function getAnimeAv1PlayerUrls(html: string): URL[] {
    const rawUrls = [
        ...Array.from(html.matchAll(/\bdata-url=["']([^"']+)["']/gi), match => match[1]),
        ...Array.from(html.matchAll(/<iframe\b[^>]*\bid=["']main-video-player["'][^>]*\bsrc=["']([^"']+)["']/gi), match => match[1]),
        ...Array.from(html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*\bid=["']main-video-player["']/gi), match => match[1]),
    ]
    const allowedHosts = new Set([
        "animeav1.eu",
        "animeav1.uns.bio",
        "player.zilla-networks.com",
        "voe.sx",
        "byselapuix.com",
        "www.mp4upload.com",
    ])
    const unique = new Map<string, URL>()
    for (const rawUrl of rawUrls) {
        try {
            const parsed = new URL(rawUrl.replace(/(?:&amp;|&#0*38;)/gi, "&"))
            if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname)) continue
            unique.set(parsed.href, parsed)
        } catch {
            // Ignore malformed mirror URLs.
        }
    }
    const priority = (url: URL) => {
        // MP4Upload currently exposes a complete HTML5 player and is the most
        // consistent hard-sub mirror. Its ad overlay is removed inside our
        // WebView, so users should not have to cycle through fragile mirrors.
        if (url.hostname === "www.mp4upload.com") return 0
        if (url.hostname === "byselapuix.com") return 1
        // animeav1.uns.bio is retained ahead of VOE because VOE frequently
        // changes to an unrelated redirect host instead of loading the video.
        if (url.hostname === "animeav1.uns.bio") return 2
        if (url.hostname === "voe.sx") return 3
        if (url.hostname === "animeav1.eu") return 4
        return 5
    }
    return [...unique.values()].sort((a, b) => priority(a) - priority(b))
}

type JkAnimeSearchResult = {
    title: string
    url: string
}

export function findJkAnimeMatch(
    candidates: JkAnimeSearchResult[],
    expectedTitles: string[],
): JkAnimeSearchResult | undefined {
    let best: { candidate: JkAnimeSearchResult; score: number } | undefined
    for (const candidate of candidates) {
        const score = Math.max(...expectedTitles.map(title => getStreamIdentityScore(candidate.title, title)))
        if (score < 0 || (best && score <= best.score)) continue
        best = { candidate, score }
    }
    return best?.candidate
}

export function getJkAnimePlayerUrls(html: string): URL[] {
    const unique = new Map<string, URL>()
    const matches = html.matchAll(/video\[\d+\]\s*=\s*['"][\s\S]*?<iframe\b[^>]*\bsrc=\\?["']([^"']+)\\?["']/gi)
    for (const match of matches) {
        try {
            const parsed = new URL(match[1].replace(/\\["']/g, "").replace(/(?:&amp;|&#0*38;)/gi, "&"))
            const isJkPlayer = (parsed.hostname === "jkanime.net" || parsed.hostname.endsWith(".jkanime.net"))
                && parsed.pathname.startsWith("/jkplayer/")
            if (parsed.protocol === "https:" && isJkPlayer) unique.set(parsed.href, parsed)
        } catch {
            // Ignore malformed player URLs.
        }
    }
    return [...unique.values()]
}

export function getJkAnimeHlsUrls(html: string): URL[] {
    const unique = new Map<string, URL>()
    for (const match of html.matchAll(/https:\/\/[^'"\s]+\.m3u8(?:\?[^'"\s<]+)?/gi)) {
        try {
            const parsed = new URL(match[0].replace(/&amp;/gi, "&"))
            const trustedCdn = parsed.hostname === "playmudos.com" || parsed.hostname.endsWith(".playmudos.com")
            if (parsed.protocol === "https:" && trustedCdn) unique.set(parsed.href, parsed)
        } catch {
            // Ignore malformed HLS URLs.
        }
    }
    return [...unique.values()]
}

export function extractJkAnimeLatinoServerIds(html: string): string[] {
    const deflangMatch = html.match(/<select[^>]*id=["']deflang["'][^>]*>([\s\S]*?)<\/select>/i)
    if (!deflangMatch) return []
    const latinoOption = deflangMatch[1].match(/<option[^>]*value=["'](\d+)["'][^>]*>[^<]*(?:latino|doblaje)[^<]*<\/option>/i)
    if (!latinoOption) return []
    const langId = latinoOption[1]
    const buttonRegex = new RegExp(`<a\\b[^>]*?(?:data-id=["'](\\d+)["'][^>]*?class=["'][^"']*\\blg_${langId}\\b|class=["'][^"']*\\blg_${langId}\\b[^"']*?data-id=["'](\\d+)["'])`, "gi")
    const serverIds: string[] = []
    for (const match of html.matchAll(buttonRegex)) {
        const id = match[1] || match[2]
        if (id && !serverIds.includes(id)) serverIds.push(id)
    }
    return serverIds
}

export function getJkAnimePlayerUrlsForIds(html: string, ids: string[]): URL[] {
    const unique = new Map<string, URL>()
    for (const id of ids) {
        const videoRegex = new RegExp(`video\\[${id}\\]\\s*=\\s*['"][\\s\\S]*?<iframe\\b[^>]*\\bsrc=\\\\?["']([^"']+)\\\\?["']`, "i")
        const match = html.match(videoRegex)
        if (!match) continue
        try {
            const rawUrl = match[1].replace(/\\/g, "").replace(/(?:&amp;|&#0*38;)/gi, "&")
            const parsed = new URL(rawUrl)
            const isJkPlayer = (parsed.hostname === "jkanime.net" || parsed.hostname.endsWith(".jkanime.net"))
                && parsed.pathname.startsWith("/jkplayer/")
            if (parsed.protocol === "https:" && isJkPlayer) unique.set(parsed.href, parsed)
        } catch {
            // Ignore malformed player URLs
        }
    }
    return [...unique.values()]
}

export function parseTioAnimeVideos(html: string): Array<{ server: string; url: string }> {
    const videosMatch = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/i)
    if (!videosMatch) return []
    try {
        const raw = JSON.parse(videosMatch[1]) as Array<[string, string, ...unknown[]]>
        return raw
            .filter(item => Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string")
            .map(item => ({ server: item[0], url: item[1] }))
    } catch {
        return []
    }
}

export function findAnimeAv1EpisodeResult(
    candidates: AnimeAv1SearchResult[],
    expectedTitles: string[],
    episodeNumber: number,
): AnimeAv1SearchResult | undefined {
    let best: { candidate: AnimeAv1SearchResult; score: number } | undefined
    for (const candidate of candidates) {
        if (candidate.subtype !== "episode" || !candidate.title || !candidate.url) continue
        let parsed: URL
        try {
            parsed = new URL(candidate.url)
        } catch {
            continue
        }
        if (parsed.protocol !== "https:" || parsed.hostname !== "animeav1.eu") continue
        const pathEpisode = Number(parsed.pathname.match(/\/(\d+)\/?$/)?.[1])
        if (pathEpisode !== episodeNumber) continue

        const seriesTitle = candidate.title
            .replace(/&(?:#8211|ndash);/gi, "–")
            .replace(/\s*(?:-|–|—)\s*Episodio\s+\d+\s*$/i, "")
            .trim()
        const score = Math.max(...expectedTitles.map(title => getStreamIdentityScore(seriesTitle, title)))
        if (score < 0 || (best && score <= best.score)) continue
        best = { candidate, score }
    }
    return best?.candidate
}

export function getAnipubEpisodeLink(
    local: AnipubStreamingDetails["local"],
    episodeNumber: number,
): string | undefined {
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) return undefined

    // Some new AniPub entries contain a corrupt `ep` array that loops through
    // episodes 2-5 (for example Sparks of Tomorrow). Its canonical /play URL,
    // however, includes the real episode number and can be generated safely.
    const rootLink = local?.link?.trim().replace(/^src=/i, "")
    if (rootLink) {
        try {
            const parsed = new URL(rootLink)
            const playPath = parsed.pathname.match(/^\/play\/([^/]+)\/(\d+)\/([^/]+)\/?$/i)
            const isAnipub = parsed.hostname === "anipub.xyz" || parsed.hostname.endsWith(".anipub.xyz")
            if (isAnipub && playPath) {
                parsed.pathname = `/play/${playPath[1]}/${episodeNumber}/${playPath[3]}`
                return `src=${parsed.href}`
            }
        } catch {
            // Older entries use opaque /video IDs and still need the array.
        }
    }

    return episodeNumber === 1
        ? local?.link
        : local?.ep?.[episodeNumber - 2]?.link
}

export class AnimeflexApiError extends Error {
    readonly status?: number

    constructor(message: string, status?: number) {
        super(message)
        this.name = "AnimeflexApiError"
        this.status = status
    }
}

async function getJson<T>(path: string, signal?: AbortSignal, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const abortFromCaller = () => controller.abort(signal?.reason)
    signal?.addEventListener("abort", abortFromCaller, { once: true })

    try {
        let response: Response | undefined
        for (let attempt = 0; attempt < 2; attempt += 1) {
            response = await fetch(`${ANIMEFLEX_API_BASE_URL}${path}`, {
                headers: { Accept: "application/json" },
                signal: controller.signal,
            })
            if (![502, 503, 504].includes(response.status) || attempt === 1) break
            await new Promise(resolve => setTimeout(resolve, 350))
        }
        if (!response) throw new AnimeflexApiError("Animeflex did not return a response")
        const contentType = response.headers.get("content-type") ?? ""
        const data = contentType.includes("application/json")
            ? await response.json() as { error?: string }
            : null

        if (!response.ok) {
            throw new AnimeflexApiError(data?.error || `Animeflex API error ${response.status}`, response.status)
        }
        if (!data) {
            throw new AnimeflexApiError("Animeflex returned an invalid response", response.status)
        }
        return data as T
    } catch (error) {
        if (error instanceof AnimeflexApiError) throw error
        if (controller.signal.aborted) throw new AnimeflexApiError("Animeflex request timed out")
        throw new AnimeflexApiError(error instanceof Error ? error.message : "Unable to reach Animeflex")
    } finally {
        clearTimeout(timer)
        signal?.removeEventListener("abort", abortFromCaller)
    }
}

async function getExternalJson<T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const abortFromCaller = () => controller.abort(signal?.reason)
    signal?.addEventListener("abort", abortFromCaller, { once: true })

    try {
        const response = await fetch(url, { ...init, signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json() as T
    } finally {
        clearTimeout(timer)
        signal?.removeEventListener("abort", abortFromCaller)
    }
}

async function getExternalText(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const abortFromCaller = () => controller.abort(signal?.reason)
    signal?.addEventListener("abort", abortFromCaller, { once: true })

    try {
        const response = await fetch(url, { ...init, signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.text()
    } finally {
        clearTimeout(timer)
        signal?.removeEventListener("abort", abortFromCaller)
    }
}

async function postAniList<T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const response = await getExternalJson<{ data?: T; errors?: Array<{ message?: string }> }>(
        ANILIST_GRAPHQL_URL,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query, variables }),
        },
        signal,
    )
    if (!response.data) throw new Error(response.errors?.[0]?.message ?? "AniList no devolvió datos")
    return response.data
}

export function getAnimeflexTitle(title: AnimeflexAnime["title"]): string {
    if (typeof title === "string") return title
    return title.userPreferred ?? title.english ?? title.romaji ?? title.native ?? "Sin título"
}

function normalizeScore(rating?: number): number | undefined {
    if (rating == null || !Number.isFinite(rating)) return undefined
    if (rating <= 1) return Math.round(rating * 100)
    if (rating <= 10) return Math.round(rating * 10)
    return Math.round(rating)
}

function normalizeStatus(status?: string): AL_BaseAnime["status"] {
    const value = status?.toUpperCase() ?? ""
    if (value.includes("NOT") || value.includes("UPCOMING")) return "NOT_YET_RELEASED"
    if (value.includes("RELEAS") || value.includes("ONGOING")) return "RELEASING"
    if (value.includes("CANCEL")) return "CANCELLED"
    if (value.includes("HIATUS")) return "HIATUS"
    return "FINISHED"
}

function normalizeFormat(type?: string): AL_BaseAnime["format"] {
    const value = type?.toUpperCase() ?? "TV"
    if (value.includes("MOVIE")) return "MOVIE"
    if (value.includes("OVA")) return "OVA"
    if (value.includes("ONA")) return "ONA"
    if (value.includes("SPECIAL")) return "SPECIAL"
    if (value.includes("MUSIC")) return "MUSIC"
    return "TV"
}

export function animeflexAnimeToAL(anime: AnimeflexAnime): AL_BaseAnime {
    const year = Number.parseInt(String(anime.releaseDate ?? ""), 10)
    const title = typeof anime.title === "string"
        ? { userPreferred: anime.title, romaji: anime.title }
        : anime.title

    return {
        id: Number(anime.id),
        type: "ANIME",
        format: normalizeFormat(anime.type),
        status: normalizeStatus(anime.status),
        seasonYear: Number.isFinite(year) ? year : undefined,
        startDate: Number.isFinite(year) ? { year } : undefined,
        bannerImage: anime.cover ?? anime.image,
        episodes: anime.totalEpisodes,
        meanScore: normalizeScore(anime.rating),
        description: anime.description,
        genres: anime.genres,
        duration: typeof anime.duration === "number" ? anime.duration : undefined,
        title: {
            english: title.english,
            native: title.native,
            romaji: title.romaji,
            userPreferred: title.userPreferred ?? title.english ?? title.romaji ?? title.native,
        },
        coverImage: {
            color: anime.color,
            extraLarge: anime.image,
            large: anime.image,
            medium: anime.image,
        },
    }
}

export function animeflexInfoToEntry(info: AnimeflexAnimeInfo): Anime_Entry {
    const media = animeflexAnimeToAL(info)
    return {
        mediaId: media.id,
        media,
        listData: { progress: 0 },
        episodes: [],
        anidbId: 0,
        currentEpisodeCount: info.currentEpisode ?? info.totalEpisodes ?? 0,
        _isNakamaEntry: false,
    }
}

function normalizeMangaStatus(status?: string | null): AL_BaseManga["status"] {
    const value = status?.toUpperCase() ?? ""
    if (value.includes("ONGOING") || value.includes("RELEAS")) return "RELEASING"
    if (value.includes("HIATUS")) return "HIATUS"
    if (value.includes("CANCEL")) return "CANCELLED"
    return "FINISHED"
}

export function animeflexMangaToAL(manga: AnimeflexManga | AnimeflexMangaInfo): AL_BaseManga {
    getAnimeflexMangaNumericId(manga.id)
    const title = getAnimeflexTitle(manga.title)
    const slug = resolveAnimeflexMangaSlug(manga.id)
    const normalizedTitle = title ? title.toLowerCase().trim() : ""
    const cached = mangaCoverCache.get(String(manga.id)) ?? mangaCoverCache.get(slug) ?? (normalizedTitle ? mangaCoverCache.get(normalizedTitle) : undefined)
    const image = manga.image ?? manga.cover ?? cached

    return {
        id: manga.id as unknown as number,
        siteUrl: manga.id,
        type: "MANGA",
        format: "MANGA",
        status: normalizeMangaStatus(manga.status),
        chapters: Array.isArray(manga.chapters) ? manga.chapters.length : manga.chapters,
        meanScore: normalizeScore(manga.rating ?? undefined),
        description: manga.description,
        genres: manga.genres,
        countryOfOrigin: getAnimeflexMangaCountry(manga),
        title: { english: title, romaji: title, userPreferred: title },
        bannerImage: manga.cover ?? image,
        coverImage: { extraLarge: image, large: image, medium: image },
    }
}

export function getAnimeflexMangaCountry(manga: Pick<AnimeflexManga, "id" | "genres">): "JP" | "KR" | "CN" {
    const identity = `${manga.id} ${(manga.genres ?? []).join(" ")}`.toLowerCase()
    if (identity.includes("manhwa")) return "KR"
    if (identity.includes("manhua")) return "CN"
    return "JP"
}

export function getAnimeflexMangaIdentity(manga: Pick<AnimeflexManga, "id" | "title">): string {
    const title = getAnimeflexTitle(manga.title)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    return title || manga.id.toLowerCase()
}

export function animeflexMangaInfoToEntry(info: AnimeflexMangaInfo): Manga_Entry {
    const media = animeflexMangaToAL(info)
    return {
        mediaId: getAnimeflexMangaNumericId(info.id),
        media,
        listData: { progress: 0 },
    }
}

export function getAnimeflexTrending(signal?: AbortSignal): Promise<AnimeflexSearchResult> {
    return getJson<AnimeflexSearchResult>("/anime/trending", signal)
}

export function getAnimeflexHealth(signal?: AbortSignal): Promise<{ status?: string }> {
    return getJson<{ status?: string }>("/healthz", signal, 8_000)
}

export function getAnimeflexPopular(signal?: AbortSignal): Promise<AnimeflexSearchResult> {
    return getJson<AnimeflexSearchResult>("/anime/popular", signal)
}

export function getAnimeflexRecent(signal?: AbortSignal): Promise<AnimeflexSearchResult> {
    return getJson<AnimeflexSearchResult>("/anime/recent", signal)
}

export async function getAniListUpcomingAnime(signal?: AbortSignal): Promise<AL_BaseAnime[]> {
    const query = `query UpcomingAnime($page: Int) {
            Page(page: $page, perPage: 50) {
                media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, sort: [POPULARITY_DESC, START_DATE]) {
                    id
                    idMal
                    type
                    format
                    status
                    season
                    seasonYear
                    episodes
                    isAdult
                    meanScore
                    description
                    genres
                    bannerImage
                    startDate { year month day }
                    title { userPreferred english romaji native }
                    coverImage { color extraLarge large medium }
                }
            }
        }`
    const pages = await Promise.all([1, 2].map(page => postAniList<{
        Page?: { media?: AL_BaseAnime[] }
    }>(query, { page }, signal)))
    const seen = new Set<number>()
    return pages.flatMap(result => result.Page?.media ?? []).filter(media => {
        if (media.status !== "NOT_YET_RELEASED" || seen.has(media.id)) return false
        seen.add(media.id)
        return true
    })
}

export type AniListCatalogOptions = {
    season?: "WINTER" | "SPRING" | "SUMMER" | "FALL"
    seasonYear?: number
    format?: "MOVIE" | "TV" | "ONA" | "OVA" | "SPECIAL"
    status?: "RELEASING" | "FINISHED" | "NOT_YET_RELEASED"
    sort?: string[]
    /** Number of 50-title pages to request for large catalog views. */
    pageCount?: number
}

export async function getAniListAnimeCatalog(
    options: AniListCatalogOptions,
    signal?: AbortSignal,
): Promise<AL_BaseAnime[]> {
    const query = `query AnimeCatalog($page: Int, $season: MediaSeason, $seasonYear: Int, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
            Page(page: $page, perPage: 50) {
                media(
                    type: ANIME,
                    season: $season,
                    seasonYear: $seasonYear,
                    format: $format,
                    status: $status,
                    isAdult: false,
                    sort: $sort
                ) {
                    id
                    idMal
                    type
                    format
                    status
                    season
                    seasonYear
                    episodes
                    isAdult
                    meanScore
                    description
                    genres
                    bannerImage
                    startDate { year month day }
                    title { userPreferred english romaji native }
                    coverImage { color extraLarge large medium }
                }
            }
        }`
    const pageCount = Math.max(1, Math.min(6, Math.trunc(options.pageCount ?? 2)))
    const pages = await Promise.all(Array.from({ length: pageCount }, (_, index) => index + 1).map(page => postAniList<{ Page?: { media?: AL_BaseAnime[] } }>(
        query,
        {
            page,
            season: options.season,
            seasonYear: options.seasonYear,
            format: options.format,
            status: options.status,
            sort: options.sort ?? ["POPULARITY_DESC"],
        },
        signal,
    )))
    const seen = new Set<number>()
    return pages.flatMap(result => result.Page?.media ?? []).filter(media => {
        if (media.isAdult || media.format === "TV_SHORT" || seen.has(media.id)) return false
        seen.add(media.id)
        return true
    })
}

export function searchAnimeflex(query: string, page = 1, signal?: AbortSignal): Promise<AnimeflexSearchResult> {
    const params = new URLSearchParams({ q: query, page: String(page) })
    return getJson<AnimeflexSearchResult>(`/anime/search?${params.toString()}`, signal)
}

export function getAnimeflexInfo(id: string | number, signal?: AbortSignal): Promise<AnimeflexAnimeInfo> {
    return getJson<AnimeflexAnimeInfo>(`/anime/anilist-info?id=${encodeURIComponent(String(id))}`, signal)
}

export async function getAniListExtendedDetails(id: string | number, signal?: AbortSignal): Promise<AniListExtendedDetails | null> {
    const numId = Number(id)
    if (!numId || Number.isNaN(numId)) return null
    try {
        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    id
                    studios(isMain: true) {
                        nodes {
                            id
                            name
                        }
                    }
                    characters(sort: [ROLE, RELEVANCE, ID], perPage: 24) {
                        edges {
                            id
                            role
                            node {
                                id
                                name {
                                    full
                                    native
                                }
                                image {
                                    large
                                    medium
                                }
                            }
                            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                                id
                                name {
                                    full
                                    native
                                }
                                image {
                                    large
                                    medium
                                }
                            }
                        }
                    }
                    relations {
                        edges {
                            id
                            relationType(version: 2)
                            node {
                                id
                                title {
                                    userPreferred
                                    romaji
                                    english
                                }
                                format
                                type
                                status
                                coverImage {
                                    extraLarge
                                    large
                                    medium
                                }
                                meanScore
                                episodes
                            }
                        }
                    }
                }
            }
        `
        const res = await postAniList<{ Media?: AniListExtendedDetails }>(query, { id: numId }, signal)
        return res?.Media ?? null
    } catch {
        return null
    }
}

export function recordMangaCovers(mangas: AnimeflexManga[]) {
    for (const m of mangas) {
        const img = m.image || m.cover
        if (img) {
            if (m.id) mangaCoverCache.set(String(m.id), img)
            const slug = resolveAnimeflexMangaSlug(m.id)
            if (slug) mangaCoverCache.set(slug, img)
            const titleStr = typeof m.title === "string" ? m.title : (m.title?.userPreferred || m.title?.romaji || m.title?.english)
            if (titleStr) {
                mangaCoverCache.set(titleStr.toLowerCase().trim(), img)
            }
        }
    }
}

export async function getAnimeflexTrendingManga(page = 1, signal?: AbortSignal): Promise<AnimeflexMangaSearchResult> {
    const res = await getJson<AnimeflexMangaSearchResult>(`/manga/trending?page=${page}`, signal)
    if (res?.results) recordMangaCovers(res.results)
    return res
}

export async function getAnimeflexRecentManga(page = 1, signal?: AbortSignal): Promise<AnimeflexMangaSearchResult> {
    const res = await getJson<AnimeflexMangaSearchResult>(`/manga/recent?page=${page}`, signal)
    if (res?.results) recordMangaCovers(res.results)
    return res
}

export async function searchAnimeflexManga(query: string, page = 1, signal?: AbortSignal): Promise<AnimeflexMangaSearchResult> {
    const params = new URLSearchParams({ q: query, page: String(page) })
    const [animeflex, mangaDex] = await Promise.allSettled([
        getJson<AnimeflexMangaSearchResult>(`/manga/search?${params.toString()}`, signal),
        searchMangaDex(query, page, signal),
    ])
    const sources = [animeflex, mangaDex].flatMap(result => result.status === "fulfilled" ? [result.value] : [])
    if (sources.length === 0) throw new AnimeflexApiError("No se pudo consultar ninguna fuente de manga")
    const seen = new Set<string>()
    const results = sources.flatMap(source => source.results).filter(manga => {
        const identity = getAnimeflexMangaIdentity(manga)
        if (seen.has(identity)) return false
        seen.add(identity)
        return true
    })
    recordMangaCovers(results)
    return {
        currentPage: page,
        hasNextPage: sources.some(source => source.hasNextPage),
        total: sources.reduce((total, source) => total + (source.total ?? source.results.length), 0),
        results,
    }
}

export async function getAnimeflexMangaCatalog(signal?: AbortSignal): Promise<AnimeflexManga[]> {
    const requests = [
        () => getAnimeflexTrendingManga(1, signal),
        () => getAnimeflexRecentManga(1, signal),
        () => getAnimeflexTrendingManga(2, signal),
        () => getAnimeflexRecentManga(2, signal),
    ]
    const collected: AnimeflexManga[] = []
    for (const request of requests) {
        try {
            const response = await request()
            collected.push(...response.results)
        } catch {
            // Keep the pages already collected if the upstream source throttles a later request.
        }
    }
    const seen = new Set<string>()
    return collected.filter(manga => {
        const identity = getAnimeflexMangaIdentity(manga)
        if (seen.has(identity)) return false
        seen.add(identity)
        return true
    })
}

export async function getAnimeflexMangaInfo(id: string | number, signal?: AbortSignal): Promise<AnimeflexMangaInfo> {
    const slug = resolveAnimeflexMangaSlug(id)
    const mangaDex = resolveMangaDexId(slug)
    let info: AnimeflexMangaInfo
    if (mangaDex) {
        info = await getMangaDexInfo(mangaDex, signal)
    } else {
        info = await getJson<AnimeflexMangaInfo>(`/manga/info/${encodeURIComponent(slug)}`, signal)
    }

    const rawTitle = typeof info.title === "string" ? info.title : (info.title?.userPreferred || info.title?.romaji || info.title?.english || "")
    const normalizedKey = rawTitle ? rawTitle.toLowerCase().trim() : ""
    let resolvedImage = info.image ?? info.cover ?? mangaCoverCache.get(String(id)) ?? mangaCoverCache.get(slug) ?? (normalizedKey ? mangaCoverCache.get(normalizedKey) : undefined)

    if (!resolvedImage && rawTitle) {
        try {
            const anilistQuery = `
                query ($search: String) {
                    Media(search: $search, type: MANGA) {
                        coverImage {
                            extraLarge
                            large
                            medium
                        }
                        bannerImage
                    }
                }
            `
            const aniRes = await postAniList<{ Media?: { coverImage?: { extraLarge?: string; large?: string; medium?: string }; bannerImage?: string } }>(
                anilistQuery,
                { search: rawTitle },
                signal
            )
            const aniCover = aniRes?.Media?.coverImage
            if (aniCover) {
                resolvedImage = aniCover.extraLarge || aniCover.large || aniCover.medium
                if (aniRes?.Media?.bannerImage && !info.cover) {
                    info.cover = aniRes.Media.bannerImage
                }
            }
        } catch {
            // Ignore AniList lookup failure
        }
    }

    if (resolvedImage) {
        info.image = resolvedImage
        if (!info.cover) info.cover = resolvedImage
        mangaCoverCache.set(String(id), resolvedImage)
        mangaCoverCache.set(slug, resolvedImage)
        if (normalizedKey) mangaCoverCache.set(normalizedKey, resolvedImage)
    }

    return info
}

export async function getAnimeflexMangaChapters(
    id: string | number,
    signal?: AbortSignal,
): Promise<Manga_ChapterContainer> {
    const info = await getAnimeflexMangaInfo(id, signal)
    const mediaId = getAnimeflexMangaNumericId(info.id)
    const provider = resolveMangaDexId(info.id) ? "mangadex" : "animeflex"
    const chapters: HibikeManga_ChapterDetails[] = (info.chapters ?? []).map((chapter, index) => ({
        provider,
        id: chapter.id,
        url: "",
        title: chapter.title || `Capítulo ${chapter.chapterNumber ?? index + 1}`,
        chapter: String(chapter.chapterNumber ?? index + 1),
        index,
        language: chapter.lang ?? "es",
        updatedAt: chapter.releaseDate ?? undefined,
    }))
    return { mediaId, provider, chapters }
}

export async function getAnimeflexMangaPages(
    mediaId: string | number,
    chapterId: string,
    signal?: AbortSignal,
): Promise<Manga_PageContainer> {
    if (resolveMangaDexId(chapterId)) return getMangaDexPages(mediaId, chapterId, signal)
    const pages = await getJson<AnimeflexMangaPage[]>(`/manga/chapter/${encodeURIComponent(chapterId)}`, signal)
    return {
        mediaId: getAnimeflexMangaNumericId(resolveAnimeflexMangaSlug(mediaId)),
        provider: "animeflex",
        chapterId,
        pages: pages.map((page, index) => ({
            provider: "animeflex",
            url: page.img,
            index,
        })),
        isDownloaded: false,
    }
}

export function getAnimeflexMangaDirectImageUrl(proxyUrl: string): string | undefined {
    try {
        const parsed = new URL(proxyUrl)
        if (!parsed.pathname.endsWith("/api/manga/img-proxy")) return undefined

        const directUrl = parsed.searchParams.get("u")
        if (!directUrl) return undefined

        const direct = new URL(directUrl)
        const allowedHosts = new Set(["zonatmo.org", "storage.zonatmo.org", "storage2.zonatmo.org"])
        if (direct.protocol !== "https:" || !allowedHosts.has(direct.hostname)) return undefined
        return direct.href
    } catch {
        return undefined
    }
}

export function buildAnimeflexProxyUrl(sourceUrl: string, referer?: string): string {
    const proxyEndpoint = `${ANIMEFLEX_API_BASE_URL}/anime/hls-proxy`
    const params = new URLSearchParams({
        url: sourceUrl,
        base: proxyEndpoint,
    })
    if (referer) params.set("referer", referer)
    return `${proxyEndpoint}?${params.toString()}`
}

export function buildAnimeflexSubtitleProxyUrl(sourceUrl: string, referer?: string): string {
    const params = new URLSearchParams({ url: sourceUrl })
    if (referer) params.set("referer", referer)
    return `${ANIMEFLEX_API_BASE_URL}/anime/subtitle-proxy?${params.toString()}`
}

export async function getAnimeflexEpisodes(
    anilistId: string | number,
    signal?: AbortSignal,
): Promise<Onlinestream_EpisodeListResponse> {
    const data = await getJson<AnimeflexEpisodeList>(
        `/anime/episodes?anilistId=${encodeURIComponent(String(anilistId))}`,
        signal,
        12_000,
    )

    const episodes = data.episodes ?? []
    let aniZipMetadata = new Map<number, AniZipEpisode>()
    const metadataController = new AbortController()
    const abortMetadata = () => metadataController.abort(signal?.reason)
    if (signal?.aborted) metadataController.abort(signal.reason)
    else signal?.addEventListener("abort", abortMetadata, { once: true })
    const metadataTimer = setTimeout(() => metadataController.abort(), 2_000)
    try {
        aniZipMetadata = await getEpisodeMetadataFromAniZip(anilistId, metadataController.signal)
    } catch {
        // Episode metadata is decorative. Never hold the playable list hostage
        // when AniZip is slow or temporarily unavailable.
    } finally {
        clearTimeout(metadataTimer)
        signal?.removeEventListener("abort", abortMetadata)
    }

    return {
        episodes: episodes.filter(episode => Number.isFinite(Number(episode.number)) && Number(episode.number) > 0).map(episode => {
            const episodeNumber = Number(episode.number)
            const aniZip = aniZipMetadata.get(episodeNumber)
            const localizedTitle = aniZip?.title?.es
                || aniZip?.title?.en
                || aniZip?.title?.["x-jat"]
                || aniZip?.title?.ja
            const title = cleanEpisodeTitle(
                localizedTitle || episode.title,
                episodeNumber,
            )
            return {
                number: episodeNumber,
                title,
                description: aniZip?.overview || aniZip?.summary || episode.description,
                image: aniZip?.image || episode.image,
                isFiller: episode.isFiller,
            }
        }),
    }
}

type AniZipEpisode = {
    title?: Record<string, string | undefined>
    overview?: string | null
    summary?: string | null
    image?: string | null
}

type AniZipResponse = {
    episodes?: Record<string, AniZipEpisode>
}

type JikanEpisode = {
    mal_id: number
    title?: string | null
    synopsis?: string | null
    filler?: boolean
}

function isGenericEpisodeTitle(title: string | undefined, episodeNumber: number): boolean {
    if (!title?.trim()) return true
    const normalized = title.trim().toLowerCase().replace(/[.:-]/g, " ").replace(/\s+/g, " ")
    return normalized === `episode ${episodeNumber}` || normalized === `episodio ${episodeNumber}`
}

function cleanEpisodeTitle(title: string | null | undefined, episodeNumber: number): string | undefined {
    if (!title?.trim()) return undefined
    const withoutPrefix = title
        .trim()
        .replace(new RegExp(`^(?:episode|episodio)\\s*${episodeNumber}\\s*[-:–—]\\s*`, "i"), "")
        .trim()
    return isGenericEpisodeTitle(withoutPrefix, episodeNumber) ? undefined : withoutPrefix || undefined
}

async function getEpisodeMetadataFromAniZip(
    anilistId: string | number,
    signal?: AbortSignal,
): Promise<Map<number, AniZipEpisode>> {
    const data = await getExternalJson<AniZipResponse>(
        `${ANIZIP_API_URL}/mappings?anilist_id=${encodeURIComponent(String(anilistId))}`,
        { headers: { Accept: "application/json" } },
        signal,
    )
    const entries = Object.entries(data.episodes ?? {})
        .map(([number, episode]) => [Number(number), episode] as const)
        .filter(([number]) => Number.isFinite(number) && number > 0)
    return new Map(entries)
}

async function getEpisodeMetadataFromJikan(
    anilistId: string | number,
    signal?: AbortSignal,
): Promise<Map<number, JikanEpisode>> {
    const anilist = await postAniList<{ Media?: { idMal?: number | null } }>(
        `query EpisodeMetadata($id: Int) { Media(id: $id, type: ANIME) { idMal } }`,
        { id: Number(anilistId) },
        signal,
    )
    const malId = anilist.Media?.idMal
    if (!malId) return new Map()

    const first = await getExternalJson<{
        data?: JikanEpisode[]
        pagination?: { last_visible_page?: number }
    }>(`${JIKAN_API_URL}/anime/${malId}/episodes?page=1`, { headers: { Accept: "application/json" } }, signal)

    const allEpisodes = [...(first.data ?? [])]
    const lastPage = Math.min(first.pagination?.last_visible_page ?? 1, 6)
    for (let page = 2; page <= lastPage; page += 1) {
        try {
            const next = await getExternalJson<{ data?: JikanEpisode[] }>(
                `${JIKAN_API_URL}/anime/${malId}/episodes?page=${page}`,
                { headers: { Accept: "application/json" } },
                signal,
            )
            allEpisodes.push(...(next.data ?? []))
        } catch {
            break
        }
    }
    return new Map(allEpisodes.map(episode => [episode.mal_id, episode]))
}

type AniListScheduleMedia = {
    id: number
    isAdult?: boolean
    format?: string
    episodes?: number
    title?: AnimeflexTitle
    coverImage?: { extraLarge?: string; large?: string }
}

type AniListScheduleEntry = {
    airingAt: number
    episode: number
    media?: AniListScheduleMedia
}

export async function getAnimeAiringSchedule(
    from: Date,
    to: Date,
    signal?: AbortSignal,
): Promise<Anime_ScheduleItem[]> {
    const query = `query Schedule($page: Int, $from: Int, $to: Int) {
        Page(page: $page, perPage: 50) {
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
                airingAt
                episode
                media {
                    id
                    isAdult
                    format
                    episodes
                    title { userPreferred english romaji native }
                    coverImage { extraLarge large }
                }
            }
        }
    }`
    const variables = {
        from: Math.floor(from.getTime() / 1000),
        to: Math.floor(to.getTime() / 1000),
    }
    const pages = await Promise.all([1, 2].map(page => postAniList<{
        Page?: { airingSchedules?: AniListScheduleEntry[] }
    }>(query, { ...variables, page }, signal)))

    const seen = new Set<string>()
    return pages.flatMap(page => page.Page?.airingSchedules ?? []).flatMap(item => {
        const media = item.media
        if (!media || media.isAdult) return []
        const key = `${media.id}-${item.episode}-${item.airingAt}`
        if (seen.has(key)) return []
        seen.add(key)
        const date = new Date(item.airingAt * 1000)
        return [{
            mediaId: media.id,
            title: getAnimeflexTitle(media.title ?? "Sin título"),
            time: date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
            dateTime: date.toISOString(),
            image: media.coverImage?.extraLarge ?? media.coverImage?.large ?? "",
            episodeNumber: item.episode,
            isMovie: media.format === "MOVIE",
            isSeasonFinale: media.episodes != null && item.episode >= media.episodes,
        }]
    })
}

export function normalizeAnimeflexStream(
    episodeNumber: number,
    data: AnimeflexStreamingData,
): Onlinestream_EpisodeSource {
    const subtitleReferer = data.headers?.Referer ?? data.headers?.referer
    const subtitles: Onlinestream_Subtitle[] = (data.subtitles ?? []).map((subtitle, index) => ({
        url: buildAnimeflexSubtitleProxyUrl(subtitle.url, subtitleReferer),
        language: subtitle.lang ?? subtitle.language ?? "Unknown",
        isDefault: index === 0,
    }))

    const seenSourceUrls = new Set<string>()
    const videoSources: Onlinestream_VideoSource[] = (data.sources ?? [])
        .filter(source => {
            if (typeof source.url !== "string" || source.url.trim().length === 0) return false
            try {
                const parsed = new URL(source.url.trim())
                if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
                if (seenSourceUrls.has(parsed.href)) return false
                seenSourceUrls.add(parsed.href)
                return true
            } catch {
                return false
            }
        })
        .flatMap((source, index) => {
            const sourceUrl = source.url.trim()
            const isHls = source.isM3U8 === true || sourceUrl.includes(".m3u8")
            const server = source.quality?.trim() || `Animeflex ${index + 1}`
            const resolution = server.match(/\b\d{3,4}p\b/i)?.[0] ?? "auto"
            const referer = source.referer ?? data.headers?.Referer ?? data.headers?.referer
            const headers = {
                ...data.headers,
                ...(referer ? { Referer: referer } : {}),
            }
            const common: Pick<Onlinestream_VideoSource, "quality" | "label" | "type" | "subtitles"> = {
                quality: resolution,
                label: [source.lang, source.isDub ? "DUB" : undefined].filter(Boolean).join(" · ") || undefined,
                type: isHls ? "m3u8" : "mp4",
                subtitles: subtitles.length > 0 ? subtitles : undefined,
            }

            if (!isHls) {
                return [{
                    ...common,
                    server,
                    url: sourceUrl,
                    headers,
                }]
            }

            // Native mpv does not have browser CORS restrictions. Prefer the
            // CDN directly and keep the API proxy as a genuinely separate path
            // for providers that reject direct playback on a particular device.
            return [
                {
                    ...common,
                    server: `${server} · Directo`,
                    url: sourceUrl,
                    headers,
                },
                {
                    ...common,
                    server: `${server} · Respaldo`,
                    url: buildAnimeflexProxyUrl(sourceUrl, referer),
                    headers: undefined,
                },
            ]
        })

    return { number: episodeNumber, videoSources }
}

function normalizeStreamIdentity(value: string): string[] {
    const normalized = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/(\d+)(?:st|nd|rd|th)\b/g, "$1")
        .replace(/\bii\b/g, "2")
        .replace(/\biii\b/g, "3")
        .replace(/\biv\b/g, "4")
        .replace(/\bv\b/g, "5")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()

    const ignored = new Set(["a", "an", "and", "de", "del", "el", "la", "las", "los", "no", "of", "the", "to"])
    return normalized.split(/\s+/).filter(token => (/^\d+$/.test(token) || token.length > 1) && !ignored.has(token))
}

function getStreamIdentityScore(candidate: string, expected: string): number {
    const candidateTokens = normalizeStreamIdentity(candidate)
    const expectedTokens = normalizeStreamIdentity(expected)
    if (candidateTokens.length === 0 || expectedTokens.length === 0) return -1

    const candidateSet = new Set(candidateTokens)
    const expectedSet = new Set(expectedTokens)
    const candidateNumbers = candidateTokens.filter(token => /^\d+$/.test(token))
    const expectedNumbers = expectedTokens.filter(token => /^\d+$/.test(token))
    if (expectedNumbers.length > 0 && expectedNumbers.some(number => !candidateSet.has(number))) return -1
    if (candidateNumbers.length > 0 && expectedNumbers.length > 0
        && candidateNumbers.some(number => !expectedSet.has(number))) return -1

    const mediaKindTokens = ["movie", "film"]
    const candidateIsMovie = mediaKindTokens.some(token => candidateSet.has(token))
    const expectedIsMovie = mediaKindTokens.some(token => expectedSet.has(token))
    if (candidateIsMovie !== expectedIsMovie) return -1

    const common = expectedTokens.filter(token => candidateSet.has(token)).length
    const expectedCoverage = common / expectedTokens.length
    const candidateCoverage = common / candidateTokens.length
    if (expectedCoverage < 0.65 || candidateCoverage < 0.5) return -1

    const exact = candidateTokens.join(" ") === expectedTokens.join(" ")
    return (exact ? 1_000 : 0) + (common * 20) - ((candidateTokens.length - common) * 3)
}

export function findBestAnipubMatch(
    candidates: AnipubSearchResult[],
    expectedTitles: string[],
): AnipubSearchResult | undefined {
    let best: { candidate: AnipubSearchResult; score: number } | undefined
    for (const candidate of candidates) {
        if (!candidate.Name?.trim() || !Number.isFinite(candidate.Id)) continue
        const score = Math.max(...expectedTitles.map(title => getStreamIdentityScore(candidate.Name!, title)))
        if (score < 0 || (best && score <= best.score)) continue
        best = { candidate, score }
    }
    return best?.candidate
}

function stripAnipubSourcePrefix(value: string | undefined): string | undefined {
    const candidate = value?.trim().replace(/^src=/i, "")
    if (!candidate) return undefined
    try {
        const parsed = new URL(candidate)
        if (parsed.protocol !== "https:") return undefined
        const allowedHosts = [
            "anipub.xyz",
            "gogoanime.com.by",
            "megaplay.buzz",
            "megavid.buzz",
            "anixo.buzz",
        ]
        if (!allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
            return undefined
        }
        return parsed.href
    } catch {
        return undefined
    }
}

async function resolveAnipubPlayerUrl(url: string, signal?: AbortSignal): Promise<string> {
    let current = url
    for (let depth = 0; depth < 2; depth += 1) {
        let html: string
        try {
            html = await getExternalText(current, {
                headers: {
                    Accept: "text/html,application/xhtml+xml",
                    Referer: `${ANIPUB_BASE_URL}/`,
                },
            }, signal)
        } catch {
            break
        }

        const iframeMatch = html.match(/<iframe\b[^>]*\bsrc\s*=\s*["']?([^\s"'>]+)/i)
        const embedded = stripAnipubSourcePrefix(iframeMatch?.[1]?.replace(/&amp;/g, "&"))
        if (!embedded || embedded === current) break
        current = embedded
    }
    return current
}

async function getAnimeAv1SpanishStream(
    episodeNumber: number,
    expectedTitles: string[],
    signal?: AbortSignal,
): Promise<Onlinestream_EpisodeSource> {
    const searches = await Promise.allSettled(expectedTitles.slice(0, 4).map(title => (
        getExternalJson<AnimeAv1SearchResult[]>(
            `${ANIMEAV1_BASE_URL}/wp-json/wp/v2/search?search=${encodeURIComponent(title)}&per_page=20`,
            { headers: { Accept: "application/json" } },
            signal,
        )
    )))
    const candidates = searches.flatMap(search => search.status === "fulfilled" ? search.value : [])
    const match = findAnimeAv1EpisodeResult(candidates, expectedTitles, episodeNumber)
    if (!match?.url) throw new AnimeflexApiError("No se encontró una fuente con subtítulos en español")

    const html = await getExternalText(match.url, {
        headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: `${ANIMEAV1_BASE_URL}/`,
        },
    }, signal)
    const playerUrls = getAnimeAv1PlayerUrls(html)
    if (playerUrls.length === 0) throw new AnimeflexApiError("La fuente en español no contiene un reproductor")

    return {
        number: episodeNumber,
        videoSources: playerUrls.map((playerUrl, index) => ({
            server: index === 0 ? "Sub español · Principal" : `Sub español · Respaldo ${index}`,
            url: playerUrl.href,
            quality: "auto",
            type: "unknown",
            label: playerUrl.hostname === "www.mp4upload.com"
                ? "Sub español verificado"
                : playerUrl.hostname === "byselapuix.com"
                    ? "Sub español incrustado"
                : "Sub español · Compatibilidad",
            headers: { Referer: `${ANIMEAV1_BASE_URL}/` },
        })),
    }
}

async function getAnimeFlvSpanishStream(
    episodeNumber: number,
    expectedTitles: string[],
    signal?: AbortSignal,
): Promise<Onlinestream_EpisodeSource> {
    const slugCandidates = [...new Set(expectedTitles
        .map(makeSpanishSiteSlug)
        .filter(slug => slug.length >= 3))]

    for (const slug of slugCandidates) {
        const episodeUrl = `${ANIMEFLV_ES_BASE_URL}/${slug}-episodio-${episodeNumber}/`
        let html: string
        try {
            html = await getExternalText(episodeUrl, {
                headers: {
                    Accept: "text/html,application/xhtml+xml",
                    Referer: `${ANIMEFLV_ES_BASE_URL}/anime/${slug}/`,
                },
            }, signal)
        } catch {
            continue
        }

        const pageTitle = decodeHtmlEntities(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "")
            .replace(/\s+Episodio\s+\d+[\s\S]*$/i, "")
            .trim()
        if (!pageTitle || Math.max(...expectedTitles.map(title => getStreamIdentityScore(pageTitle, title))) < 0) {
            continue
        }

        const playerUrls = getSpanishEmbedUrls(html)
        if (playerUrls.length === 0) continue

        return {
            number: episodeNumber,
            videoSources: playerUrls.map((playerUrl, index) => ({
                server: index === 0 ? "Sub español · Principal" : `Sub español · Respaldo ${index}`,
                url: playerUrl.href,
                quality: "auto",
                type: "unknown",
                label: "Sub español verificado",
                headers: { Referer: episodeUrl },
            })),
        }
    }

    throw new AnimeflexApiError("No se encontró este episodio con subtítulos en español")
}

async function getJkAnimeSpanishStream(
    animeId: string | number,
    episodeNumber: number,
    expectedTitles: string[],
    signal?: AbortSignal,
    dubbed?: boolean,
): Promise<Onlinestream_EpisodeSource> {
    const cacheKey = dubbed ? `${animeId}:dub` : String(animeId)
    let seriesUrl = jkAnimeSeriesUrlCache.get(cacheKey)
    if (!seriesUrl) {
        let lookup = jkAnimeSeriesLookupInFlight.get(cacheKey)
        if (!lookup) {
            lookup = (async () => {
                const searchTitles = dubbed
                    ? buildLatinoSearchQueries(expectedTitles)
                    : expectedTitles.slice(0, 4)
                for (const title of searchTitles) {
                    let html = ""
                    try {
                        html = await getExternalText(
                            `${JKANIME_BASE_URL}/buscar/${encodeURIComponent(title)}`,
                            { headers: { Accept: "text/html,application/xhtml+xml" } },
                            signal,
                        )
                    } catch {
                        continue
                    }
                    const candidates = Array.from(html.matchAll(/<h5>\s*<a\b[^>]*href=["'](https:\/\/jkanime\.net\/[^"']+)["'][^>]*>([^<]+)<\/a>\s*<\/h5>/gi), match => ({
                        url: match[1],
                        title: match[2].replace(/&amp;/gi, "&").trim(),
                    }))
                    const match = findJkAnimeMatch(candidates, expectedTitles)
                    if (match) return match.url.endsWith("/") ? match.url : `${match.url}/`
                }
                throw new AnimeflexApiError("JKAnime no encontró este anime")
            })()
            jkAnimeSeriesLookupInFlight.set(cacheKey, lookup)
        }
        try {
            seriesUrl = await lookup
            jkAnimeSeriesUrlCache.set(cacheKey, seriesUrl)
        } finally {
            jkAnimeSeriesLookupInFlight.delete(cacheKey)
        }
    }

    const episodeUrl = `${seriesUrl}${episodeNumber}/`
    const html = await getExternalText(episodeUrl, {
        headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: seriesUrl,
        },
    }, signal)

    let playerUrls: URL[] = []
    if (dubbed) {
        const latinoServerIds = extractJkAnimeLatinoServerIds(html)
        if (latinoServerIds.length > 0) {
            playerUrls = getJkAnimePlayerUrlsForIds(html, latinoServerIds)
        }
        if (playerUrls.length === 0) {
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? ""
            const isLatino = /latino|doblaje/i.test(titleMatch) || /latino|doblaje/i.test(seriesUrl)
            if (isLatino) {
                playerUrls = getJkAnimePlayerUrls(html)
            }
        }
        if (playerUrls.length === 0) {
            throw new AnimeflexApiError("JKAnime no confirmó el episodio en español latino")
        }
    } else {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? ""
        const declaresSpanishEpisode = new RegExp(`\\b${episodeNumber}\\s+Sub\\s+Español\\b`, "i").test(titleMatch)
        if (!declaresSpanishEpisode) throw new AnimeflexApiError("JKAnime no confirmó el episodio en español")
        playerUrls = getJkAnimePlayerUrls(html)
    }

    if (playerUrls.length === 0) throw new AnimeflexApiError("JKAnime no devolvió un reproductor válido")
    const playerPages = await Promise.allSettled(playerUrls.map(url => getExternalText(url.href, {
        headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: episodeUrl,
        },
    }, signal)))
    const hlsSources = new Map<string, { url: string; referer: string }>()
    for (let index = 0; index < playerPages.length; index += 1) {
        const page = playerPages[index]
        if (page.status !== "fulfilled") continue
        for (const sourceUrl of getJkAnimeHlsUrls(page.value)) {
            hlsSources.set(sourceUrl.href, { url: sourceUrl.href, referer: playerUrls[index].href })
        }
    }
    if (hlsSources.size === 0) throw new AnimeflexApiError("JKAnime no devolvió el video HLS")

    return {
        number: episodeNumber,
        videoSources: [...hlsSources.values()].map((source, index) => ({
            server: dubbed
                ? (index === 0 ? "JKAnime · Audio Latino (Doblaje)" : `JKAnime · Respaldo ${index} (Latino)`)
                : (index === 0 ? "JKAnime · Sub español" : `JKAnime · Respaldo ${index}`),
            url: source.url,
            quality: "auto",
            type: "m3u8",
            label: dubbed ? "Español Latino (Doblaje)" : "Sub español verificado",
            headers: { Referer: source.referer },
        })),
    }
}

async function getTioAnimeLatinoStream(
    episodeNumber: number,
    expectedTitles: string[],
    signal?: AbortSignal,
): Promise<Onlinestream_EpisodeSource> {
    const searchTitles = buildLatinoSearchQueries(expectedTitles)
    for (const title of searchTitles) {
        let html = ""
        try {
            html = await getExternalText(
                `${TIOANIME_BASE_URL}/directorio?q=${encodeURIComponent(title)}`,
                { headers: { Accept: "text/html,application/xhtml+xml" } },
                signal,
            )
        } catch {
            continue
        }
        const candidates = Array.from(
            html.matchAll(/<article class="anime">[\s\S]*?<a href="([^"]+)">[\s\S]*?<h3 class="title">([^<]+)<\/h3>/gi),
            match => ({
                slug: match[1].replace(/^\/anime\//, "").replace(/\/$/, ""),
                title: match[2].trim(),
            }),
        )
        const latinoMatch = candidates.find(c =>
            (/latino|doblaje/i.test(c.title) || /latino|doblaje/i.test(c.slug)) &&
            expectedTitles.some(exp => getStreamIdentityScore(c.title.replace(/latino|doblaje/gi, "").trim(), exp) >= 0),
        )
        if (!latinoMatch) continue

        const epUrl = `${TIOANIME_BASE_URL}/ver/${latinoMatch.slug}-${episodeNumber}`
        let epHtml = ""
        try {
            epHtml = await getExternalText(
                epUrl,
                {
                    headers: {
                        Accept: "text/html,application/xhtml+xml",
                        Referer: `${TIOANIME_BASE_URL}/anime/${latinoMatch.slug}`,
                    },
                },
                signal,
            )
        } catch {
            continue
        }
        const videos = parseTioAnimeVideos(epHtml)
        const directVideos = videos.filter(v => v.url.endsWith(".m3u8") || v.url.includes(".m3u8?") || v.url.endsWith(".mp4") || v.url.includes(".mp4?"))
        if (directVideos.length === 0) continue

        return {
            number: episodeNumber,
            videoSources: directVideos.map((v) => ({
                server: `TioAnime · ${v.server} (Latino)`,
                url: v.url,
                quality: "auto",
                type: (v.url.endsWith(".m3u8") || v.url.includes(".m3u8?")) ? "m3u8" : "mp4",
                label: "Español Latino (Doblaje)",
                headers: { Referer: `${TIOANIME_BASE_URL}/` },
            })),
        }
    }
    throw new AnimeflexApiError("TioAnime no encontró este episodio en español latino")
}

function hexToAscii(hexStr: string): string {
    let str = ""
    for (let i = 0; i < hexStr.length; i += 2) {
        str += String.fromCharCode(parseInt(hexStr.substr(i, 2), 16))
    }
    return str
}

function buildLatinoSearchQueries(expectedTitles: string[]): string[] {
    const queries = new Set<string>()
    for (const raw of expectedTitles.slice(0, 5)) {
        if (!raw || !raw.trim()) continue
        const t = raw.trim()
        queries.add(t)
        queries.add(`${t} latino`)
        queries.add(`${t} audio latino`)

        const parts = t.split(/[:\-–—()]/).map(p => p.trim()).filter(p => p.length >= 3)
        for (const p of parts) {
            queries.add(p)
            queries.add(`${p} latino`)
        }
    }
    return [...queries]
}

async function getAnimeFenixLatinoStream(
    episodeNumber: number,
    expectedTitles: string[],
    signal?: AbortSignal,
): Promise<Onlinestream_EpisodeSource> {
    const searchQueries = buildLatinoSearchQueries(expectedTitles)

    for (const query of searchQueries) {
        let searchHtml = ""
        try {
            searchHtml = await getExternalText(
                `${ANIME_FENIX_BASE_URL}/animes?buscar=${encodeURIComponent(query)}`,
                {
                    headers: {
                        Accept: "text/html,application/xhtml+xml",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                },
                signal,
            )
        } catch {
            continue
        }

        const candidateRegex = /<a\s+href="(?:\.\/|https?:\/\/ww1\.animefenix\.vip\/)?([^"]+)"[^>]*title="Ver Anime\s+([^"]+)\s+Online Gratis"/gi
        const candidates: Array<{ slug: string; title: string }> = []
        let match: RegExpExecArray | null
        while ((match = candidateRegex.exec(searchHtml)) !== null) {
            candidates.push({ slug: match[1], title: match[2].trim() })
        }

        const rankedCandidates = candidates
            .filter(c => /latino|doblaje/i.test(c.title) || /latino|doblaje/i.test(c.slug))
            .map(c => {
                const clean = c.title.replace(/latino|doblaje/gi, "").trim()
                const score = Math.max(...expectedTitles.map(exp => getStreamIdentityScore(clean, exp)))
                return { ...c, score }
            })
            .filter(c => c.score >= 0)
            .sort((a, b) => b.score - a.score)

        for (const candidate of rankedCandidates) {
            let detailHtml = ""
            try {
                detailHtml = await getExternalText(
                    `${ANIME_FENIX_BASE_URL}/${candidate.slug}`,
                    {
                        headers: {
                            Accept: "text/html,application/xhtml+xml",
                            Referer: `${ANIME_FENIX_BASE_URL}/animes`,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        },
                    },
                    signal,
                )
            } catch {
                continue
            }

            const slMatch = detailHtml.match(/data-sl="([^"]+)"/)
            const sl = slMatch ? slMatch[1] : candidate.slug.replace(/-[a-zA-Z0-9]+$/, "")

            const epsMatch = detailHtml.match(/var\s+eps\s*=\s*(\[\[[\s\S]*?\]\]);/)
            if (!epsMatch) continue

            let eps: Array<[string | number, string]> = []
            try {
                eps = JSON.parse(epsMatch[1]) as Array<[string | number, string]>
            } catch {
                continue
            }

            const targetEp = eps.find(e => Number(e[0]) === episodeNumber)
            if (!targetEp) continue

            const [epNum, epCode] = targetEp
            const epPageUrl = `${ANIME_FENIX_BASE_URL}/ver/${sl}-${epNum}-${epCode}`

            let epHtml = ""
            try {
                epHtml = await getExternalText(
                    epPageUrl,
                    {
                        headers: {
                            Accept: "text/html,application/xhtml+xml",
                            Referer: `${ANIME_FENIX_BASE_URL}/${candidate.slug}`,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        },
                    },
                    signal,
                )
            } catch {
                continue
            }

            const encMatch = epHtml.match(/data-encrypt="([^"]+)"/)
            if (!encMatch) continue

            let fnxHtml = ""
            try {
                fnxHtml = await getExternalText(
                    `${ANIME_FENIX_BASE_URL}/fnx`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "X-Requested-With": "XMLHttpRequest",
                            Referer: epPageUrl,
                            Origin: ANIME_FENIX_BASE_URL,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        },
                        body: `acc=opt&i=${encodeURIComponent(encMatch[1])}`,
                    },
                    signal,
                )
            } catch {
                continue
            }

            const liRegex = /<li\b([^>]*)>/gi
            let liMatch: RegExpExecArray | null
            const sources: Onlinestream_VideoSource[] = []
            while ((liMatch = liRegex.exec(fnxHtml)) !== null) {
                const attrs = liMatch[1]
                const encVal = attrs.match(/encrypt="([^"]+)"/i)?.[1]
                const titleVal = attrs.match(/title="([^"]+)"/i)?.[1]
                if (!encVal) continue

                const serverName = (titleVal || "Opción").replace(/^Opción\s+/i, "").trim()
                const decodedUrl = hexToAscii(encVal).trim()
                if (!decodedUrl.startsWith("http")) continue
                if (/hqq\.(?:ac|tv)|netu\.tv|waaw\.(?:to|tv)/i.test(decodedUrl)) continue

                const isHls = decodedUrl.endsWith(".m3u8") || decodedUrl.includes(".m3u8?")
                const isMp4 = decodedUrl.endsWith(".mp4") || decodedUrl.includes(".mp4?")
                if (!isHls && !isMp4) continue

                sources.push({
                    server: `AnimeFenix · ${serverName} (Latino)`,
                    url: decodedUrl,
                    quality: "auto",
                    type: isHls ? "m3u8" : "mp4",
                    label: "Español Latino (Doblaje)",
                    headers: {
                        Referer: epPageUrl,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                })
            }

            if (sources.length > 0) {
                return {
                    number: episodeNumber,
                    videoSources: sources,
                }
            }
        }
    }

    throw new AnimeflexApiError("AnimeFenix no encontró este episodio en español latino")
}

export function unpackDeanEdwards(packedJs: string): string | null {
    const match = packedJs.match(/}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split\(['"]\|['"]\)/)
    if (!match) return null

    const p = match[1]
    const a = parseInt(match[2], 10)
    const c = parseInt(match[3], 10)
    const k = match[4].split("|")

    function base(n: number): string {
        const prefix = n >= a ? base(Math.floor(n / a)) : ""
        const remainder = n % a
        return prefix + (remainder > 35 ? String.fromCharCode(remainder + 29) : remainder.toString(36))
    }

    const dict: Record<string, string> = {}
    for (let i = 0; i < c; i++) {
        dict[base(i)] = k[i] || base(i)
    }

    return p.replace(/\b\w+\b/g, word => dict[word] !== undefined ? dict[word] : word)
}

export async function extractLuluvidDirectHls(
    embedUrl: string,
    signal?: AbortSignal,
): Promise<string | null> {
    try {
        const html = await getExternalText(
            embedUrl,
            {
                headers: {
                    Accept: "text/html,application/xhtml+xml",
                    Referer: `${LATANIME_BASE_URL}/`,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            },
            signal,
        )
        const directMatch = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i)
        if (directMatch) return directMatch[0]

        const unpacked = unpackDeanEdwards(html)
        if (!unpacked) return null

        const m3u8Match = unpacked.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i)
        return m3u8Match ? m3u8Match[0] : null
    } catch {
        return null
    }
}

export async function extractOkRuDirectStreams(
    embedUrl: string,
    signal?: AbortSignal,
): Promise<Array<{ quality: string; url: string; type: "mp4" }>> {
    try {
        const html = await getExternalText(
            embedUrl,
            {
                headers: {
                    Accept: "text/html,application/xhtml+xml",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            },
            signal,
        )
        const dataOptions = html.match(/data-options="([^"]+)"/)
        if (!dataOptions) return []
        const decoded = dataOptions[1].replace(/&quot;/g, '"')
        const json = JSON.parse(decoded) as Record<string, any>
        const meta = typeof json.flashvars?.metadata === "string"
            ? JSON.parse(json.flashvars.metadata)
            : json.flashvars?.metadata
        if (!meta || !Array.isArray(meta.videos)) return []

        const qualityMap: Record<string, string> = {
            quad: "1440p",
            full: "1080p",
            hd: "720p",
            sd: "480p",
            low: "360p",
            lowest: "240p",
            mobile: "144p",
        }

        const streams: Array<{ quality: string; url: string; type: "mp4" }> = []
        for (const v of meta.videos) {
            if (v.disallowed || !v.url || typeof v.url !== "string") continue
            const q = qualityMap[v.name] || v.name || "auto"
            streams.push({
                quality: q,
                url: v.url,
                type: "mp4",
            })
        }
        return streams.reverse()
    } catch {
        return []
    }
}

export async function extractMp4UploadDirectUrl(
    embedUrl: string,
    signal?: AbortSignal,
): Promise<string | null> {
    try {
        const html = await getExternalText(
            embedUrl,
            {
                headers: {
                    Accept: "text/html,application/xhtml+xml",
                    Referer: `${LATANIME_BASE_URL}/`,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            },
            signal,
        )
        const srcMatch = html.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i)
            ?? html.match(/(https?:\/\/[a-zA-Z0-9.\-_:]+(?::\d+)?\/d\/[a-zA-Z0-9_\-\.\/]+\.mp4)/i)
        return srcMatch ? srcMatch[1] : null
    } catch {
        return null
    }
}

function getLatanimeServerName(url: string): string {
    const lower = url.toLowerCase()
    if (lower.includes("ok.ru") || lower.includes("odnoklassniki")) return "OK.ru"
    if (lower.includes("mp4upload.com")) return "Mp4Upload"
    if (lower.includes("voe.sx")) return "VOE"
    if (lower.includes("filemoon")) return "Filemoon"
    if (lower.includes("uqload")) return "Uqload"
    if (lower.includes("dsvplay.com")) return "Dsvplay"
    if (lower.includes("mega.nz")) return "Mega"
    if (lower.includes("luluvid.com") || lower.includes("lulustream.com")) return "Luluvid"
    if (lower.includes("mxdrop.to")) return "Mxdrop"
    if (lower.includes("listeamed.net")) return "Listeamed"
    if (lower.includes("streamwish")) return "StreamWish"
    return "Servidor"
}

export async function getLatanimeLatinoStream(
    episodeNumber: number,
    expectedTitles: string[],
    signal?: AbortSignal,
): Promise<Onlinestream_EpisodeSource> {
    const primaryTitle = expectedTitles[0] ?? ""
    const cacheKey = primaryTitle.toLowerCase()

    let seriesSlug = latanimeSeriesUrlCache.get(cacheKey)
    if (!seriesSlug) {
        let lookup = latanimeSeriesLookupInFlight.get(cacheKey)
        if (!lookup) {
            lookup = (async () => {
                const searchTitles = buildLatinoSearchQueries(expectedTitles)
                for (const query of searchTitles) {
                    let html = ""
                    try {
                        html = await getExternalText(
                            `${LATANIME_BASE_URL}/buscar?q=${encodeURIComponent(query)}`,
                            {
                                headers: {
                                    Accept: "text/html,application/xhtml+xml",
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                },
                            },
                            signal,
                        )
                    } catch {
                        continue
                    }

                    const cardRegex = /<a[^>]*href=["'](https:\/\/latanime\.org\/anime\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
                    let match: RegExpExecArray | null
                    const candidates: Array<{ slug: string; title: string }> = []
                    while ((match = cardRegex.exec(html)) !== null) {
                        const href = match[1]
                        const inner = match[2]
                        const titleMatch = inner.match(/<h3[^>]*>([^<]+)<\/h3>/i) || inner.match(/<h2[^>]*>([^<]+)<\/h2>/i)
                        const title = titleMatch ? titleMatch[1].trim() : ""
                        const slug = href.replace(/^https:\/\/latanime\.org\/anime\//i, "").replace(/\/$/, "").trim()
                        if (slug && title && !candidates.some(c => c.slug === slug)) {
                            candidates.push({ slug, title })
                        }
                    }

                    if (candidates.length === 0) continue

                    const scored = candidates.map(c => {
                        const isLatino = /latino/i.test(c.title) || /latino/i.test(c.slug)
                        const isCastellano = /castellano|catal[aá]n/i.test(c.title) || /castellano|catal[aá]n/i.test(c.slug)
                        if (isCastellano && !isLatino) return { ...c, score: -1 }

                        const clean = c.title.replace(/\b(?:latino|castellano|catal[aá]n|doblaje|audio latino)\b/gi, "").trim()
                        let bestScore = -1
                        for (const exp of expectedTitles) {
                            const score = getStreamIdentityScore(clean, exp)
                            if (score > bestScore) bestScore = score
                        }
                        if (bestScore >= 0 && isLatino) {
                            bestScore += 100
                        }
                        return { ...c, score: bestScore }
                    }).filter(c => c.score >= 0)
                      .sort((a, b) => b.score - a.score)

                    if (scored.length > 0 && scored[0].score >= 0) {
                        return scored[0].slug
                    }
                }
                throw new AnimeflexApiError("Latanime no encontró este anime en audio latino")
            })()
            latanimeSeriesLookupInFlight.set(cacheKey, lookup)
        }
        try {
            seriesSlug = await lookup
            latanimeSeriesUrlCache.set(cacheKey, seriesSlug)
        } finally {
            latanimeSeriesLookupInFlight.delete(cacheKey)
        }
    }

    const episodeUrl = `${LATANIME_BASE_URL}/ver/${seriesSlug}-episodio-${episodeNumber}`
    const epHtml = await getExternalText(
        episodeUrl,
        {
            headers: {
                Accept: "text/html,application/xhtml+xml",
                Referer: `${LATANIME_BASE_URL}/anime/${seriesSlug}`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        },
        signal,
    )

    const playerRegex = /data-player=["']([^"']+)["']/gi
    let pMatch: RegExpExecArray | null
    const rawPlayerUrls: string[] = []
    while ((pMatch = playerRegex.exec(epHtml)) !== null) {
        const decoded = decodeBase64Url(pMatch[1])
        if (decoded && decoded.startsWith("http")) {
            if (!/hqq\.(?:ac|tv)|netu\.tv|waaw\.(?:to|tv)/i.test(decoded)) {
                rawPlayerUrls.push(decoded)
            }
        }
    }

    if (rawPlayerUrls.length === 0) {
        throw new AnimeflexApiError("Latanime no tiene servidores disponibles para este episodio")
    }

    const sources: Onlinestream_VideoSource[] = []

    // 1. Extract direct HLS from Luluvid / Lulustream (adaptive streaming, highest stability, zero ads)
    const luluUrl = rawPlayerUrls.find(url => url.toLowerCase().includes("luluvid.com") || url.toLowerCase().includes("lulustream.com"))
    if (luluUrl) {
        try {
            const directHls = await extractLuluvidDirectHls(luluUrl, signal)
            if (directHls) {
                sources.push({
                    server: "Latanime · HLS Directo (Latino)",
                    url: directHls,
                    quality: "auto",
                    type: "m3u8",
                    label: "Español Latino (Doblaje)",
                    headers: {
                        Referer: luluUrl,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                })
            }
        } catch {
            // fallback to mp4
        }
    }

    // 2. Extract direct MP4 streams from OK.ru (fastest, high stability, standard HTTPS port 443)
    const okRuUrl = rawPlayerUrls.find(url => url.toLowerCase().includes("ok.ru") || url.toLowerCase().includes("odnoklassniki"))
    if (okRuUrl) {
        try {
            const okStreams = await extractOkRuDirectStreams(okRuUrl, signal)
            for (const stream of okStreams) {
                sources.push({
                    server: `Latanime · OK.ru ${stream.quality} (Latino)`,
                    url: stream.url,
                    quality: stream.quality,
                    type: "mp4",
                    label: "Español Latino (Doblaje)",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                })
            }
        } catch {
            // fallback
        }
    }

    // 3. Extract direct MP4 from Mp4Upload (1080p hardware-accelerated playback)
    const mp4UploadUrl = rawPlayerUrls.find(url => url.toLowerCase().includes("mp4upload.com"))
    if (mp4UploadUrl) {
        try {
            const directMp4 = await extractMp4UploadDirectUrl(mp4UploadUrl, signal)
            if (directMp4) {
                sources.push({
                    server: "Latanime · Mp4Upload (Directo)",
                    url: directMp4,
                    quality: "1080p",
                    type: "mp4",
                    label: "Español Latino (Doblaje)",
                    headers: {
                        Referer: "https://www.mp4upload.com/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                })
            }
        } catch {
            // fallback
        }
    }

    // 4. Only add sources that are strictly direct streams (HLS/MP4), completely avoiding third-party ad iframes
    for (const playerUrl of rawPlayerUrls) {
        const isHls = playerUrl.endsWith(".m3u8") || playerUrl.includes(".m3u8?")
        const isMp4 = playerUrl.endsWith(".mp4") || playerUrl.includes(".mp4?")
        if (isHls || isMp4) {
            const serverName = getLatanimeServerName(playerUrl)
            sources.push({
                server: `Latanime · ${serverName} (Latino)`,
                url: playerUrl,
                quality: "auto",
                type: isHls ? "m3u8" : "mp4",
                label: "Español Latino (Doblaje)",
                headers: {
                    Referer: `${LATANIME_BASE_URL}/`,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            })
        }
    }

    if (sources.length === 0) {
        throw new AnimeflexApiError("Latanime no tiene transmisiones directas disponibles para este episodio")
    }

    return {
        number: episodeNumber,
        videoSources: sources,
    }
}

async function getAnipubStream(
    episodeNumber: number,
    expectedTitles: string[],
    signal?: AbortSignal,
): Promise<Onlinestream_EpisodeSource> {
    const candidates = new Map<number, AnipubSearchResult>()
    const searches = await Promise.allSettled(expectedTitles.map(title => (
        getExternalJson<AnipubSearchResult[] | AnipubSearchResult | { found?: boolean }>(
                `${ANIPUB_BASE_URL}/api/search/${encodeURIComponent(title)}`,
                { headers: { Accept: "application/json" } },
                signal,
            )
    )))
    for (const search of searches) {
        if (search.status !== "fulfilled") continue
        const response = search.value
        const results = Array.isArray(response)
            ? response
            : Number.isFinite((response as AnipubSearchResult).Id)
                ? [response as AnipubSearchResult]
                : []
        for (const candidate of results) {
            if (Number.isFinite(candidate.Id)) candidates.set(candidate.Id!, candidate)
        }
    }

    const match = findBestAnipubMatch([...candidates.values()], expectedTitles)
    if (!match?.Id) throw new AnimeflexApiError("No se encontró una fuente de respaldo para este anime")

    const details = await getExternalJson<AnipubStreamingDetails>(
        `${ANIPUB_BASE_URL}/v1/api/details/${match.Id}`,
        { headers: { Accept: "application/json" } },
        signal,
    )
    const rawLink = getAnipubEpisodeLink(details.local, episodeNumber)
    const initialUrl = stripAnipubSourcePrefix(rawLink)
    if (!initialUrl) throw new AnimeflexApiError("La fuente de respaldo no tiene este episodio")
    const url = await resolveAnipubPlayerUrl(initialUrl, signal)

    return {
        number: episodeNumber,
        videoSources: [{
            server: "AniPub · Respaldo web",
            url,
            quality: "auto",
            type: "unknown",
            label: "Reproductor web",
            headers: { Referer: `${ANIPUB_BASE_URL}/` },
        }],
    }
}

export function isAnimeflexStreamIdentityMatch(
    data: Pick<AnimeflexStreamingData, "slug">,
    expectedTitles: string[],
): boolean {
    if (!data.slug?.trim()) return true

    const candidateTokens = normalizeStreamIdentity(data.slug)
    if (candidateTokens.length === 0) return false
    const candidateSet = new Set(candidateTokens)
    const candidateNumbers = new Set(candidateTokens.filter(token => /^\d+$/.test(token)))

    return expectedTitles.some(title => {
        const expectedTokens = normalizeStreamIdentity(title)
        if (expectedTokens.length === 0) return false

        const expectedNumbers = new Set(expectedTokens.filter(token => /^\d+$/.test(token)))
        if (expectedNumbers.size > 0 && candidateNumbers.size > 0) {
            const sharesRequestedNumber = [...expectedNumbers].some(number => candidateNumbers.has(number))
            if (!sharesRequestedNumber) return false
        }

        const common = expectedTokens.filter(token => candidateSet.has(token)).length
        if (expectedTokens.length === 1) {
            return candidateTokens.length === 1 && common === 1
        }

        const expectedCoverage = common / expectedTokens.length
        const candidateCoverage = common / candidateTokens.length
        return expectedCoverage >= 0.65 && candidateCoverage >= 0.5
    })
}

export function mergeAnimeflexEpisodeSources(
    episodeNumber: number,
    streams: Onlinestream_EpisodeSource[],
): Onlinestream_EpisodeSource {
    const seenUrls = new Set<string>()
    const videoSources = streams.flatMap(stream => stream.videoSources ?? []).filter(source => {
        const normalizedUrl = source.url.trim()
        if (!normalizedUrl || seenUrls.has(normalizedUrl)) return false
        seenUrls.add(normalizedUrl)
        return true
    })

    return { number: episodeNumber, videoSources: rankAnimeflexVideoSources(videoSources) }
}

/**
 * Orders mirrors by their probability of playing natively. Direct HLS/MP4
 * sources are substantially more reliable than embedded web players, while
 * every mirror is still retained for automatic recovery.
 */
export function rankAnimeflexVideoSources(
    sources: Onlinestream_VideoSource[],
): Onlinestream_VideoSource[] {
    return sources
        .map((source, index) => ({ source, index, score: getVideoSourceReliabilityScore(source) }))
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map(item => item.source)
}

function getVideoSourceReliabilityScore(source: Onlinestream_VideoSource): number {
    const description = `${source.server ?? ""} ${source.label ?? ""}`.toLowerCase()
    const url = source.url.toLowerCase()
    let score = 0

    if (source.type === "m3u8" || /\.m3u8(?:$|[?#])/.test(url)) score += 120
    else if (source.type === "mp4" || /\.mp4(?:$|[?#])/.test(url)) score += 100
    else score += 20

    if (description.includes("verificado")) score += 35
    if (description.includes("sub español") || description.includes("español")) score += 25
    if (description.includes("jkanime")) score += 20
    if (description.includes("directo")) score += 15
    if (description.includes("respaldo web") || description.includes("compatibilidad")) score -= 30
    if ((url.includes("mp4upload.com") || url.includes("byselapuix.com")) && source.type !== "mp4") score -= 15

    return score
}

export async function getAnimeflexStream({
    anilistId,
    episodeNumber,
    animeTitle,
    animeTitles,
    signal,
    dubbed,
}: {
    anilistId: string | number
    episodeNumber: number
    animeTitle?: string
    animeTitles?: string[]
    signal?: AbortSignal
    dubbed?: boolean
}): Promise<Onlinestream_EpisodeSource> {
    const raceController = new AbortController()
    const abortFromCaller = () => raceController.abort(signal?.reason)
    if (signal?.aborted) raceController.abort(signal.reason)
    else signal?.addEventListener("abort", abortFromCaller, { once: true })
    const raceSignal = raceController.signal

    const expectedTitles = [...new Set([animeTitle, ...(animeTitles ?? [])]
        .filter((title): title is string => typeof title === "string" && title.trim().length > 0))]

    const withProviderTimeout = <T>(
        timeoutMs: number,
        task: (providerSignal: AbortSignal) => Promise<T>,
    ): Promise<T> => {
        const controller = new AbortController()
        const abortProvider = () => controller.abort(raceSignal.reason)
        if (raceSignal.aborted) controller.abort(raceSignal.reason)
        else raceSignal.addEventListener("abort", abortProvider, { once: true })
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        return task(controller.signal).finally(() => {
            clearTimeout(timer)
            raceSignal.removeEventListener("abort", abortProvider)
        })
    }

    if (dubbed) {
        const latinoAttempts: Array<Promise<Onlinestream_EpisodeSource>> = expectedTitles.length > 0
            ? [
                withProviderTimeout(6_000, providerSignal => (
                    getLatanimeLatinoStream(episodeNumber, expectedTitles, providerSignal)
                )),
                withProviderTimeout(5_500, providerSignal => (
                    getJkAnimeSpanishStream(anilistId, episodeNumber, expectedTitles, providerSignal, true)
                )),
                withProviderTimeout(5_500, providerSignal => (
                    getTioAnimeLatinoStream(episodeNumber, expectedTitles, providerSignal)
                )),
                withProviderTimeout(5_000, providerSignal => (
                    getAnimeFenixLatinoStream(episodeNumber, expectedTitles, providerSignal)
                )),
            ]
            : []

        const successfulStreams: Array<{ priority: number; stream: Onlinestream_EpisodeSource }> = []
        const trackedAttempts = latinoAttempts.map((attempt, priority) => attempt.then(stream => {
            successfulStreams.push({ priority, stream })
            return stream
        }))
        const allSettled = Promise.allSettled(trackedAttempts)

        try {
            await Promise.any(trackedAttempts)
            const backupWindow = new Promise<void>(resolve => {
                setTimeout(resolve, 1_500)
            })
            await Promise.race([allSettled.then(() => undefined), backupWindow])

            const merged = mergeAnimeflexEpisodeSources(
                episodeNumber,
                successfulStreams
                    .sort((left, right) => left.priority - right.priority)
                    .map(result => result.stream),
            )
            if ((merged.videoSources?.length ?? 0) > 0) {
                raceController.abort()
                signal?.removeEventListener("abort", abortFromCaller)
                return merged
            }
        } catch {
            // latino attempts failed or empty
        }

        raceController.abort()
        signal?.removeEventListener("abort", abortFromCaller)
        throw new AnimeflexApiError("No tiene disponible episodios en español latino")
    }

    const episodeId = `${anilistId}-episode-${episodeNumber}`
    const params = new URLSearchParams({
        episodeId,
        episodeNum: String(episodeNumber),
        animeId: String(anilistId),
    })
    if (animeTitle) params.set("animeTitle", animeTitle)

    const legacyAttempts: Array<Promise<Onlinestream_EpisodeSource>> = []

    if (animeTitle?.trim()) {
        const fallbackParams = new URLSearchParams({
            title: animeTitle.trim(),
            episode: String(episodeNumber),
            animeId: String(anilistId),
        })
        legacyAttempts.push((async () => {
            const trustedData = await getJson<AnimeflexStreamingData>(
                `/anime/animeflv-watch?${fallbackParams.toString()}`,
                raceSignal,
                8_000,
            )
            if (!isAnimeflexStreamIdentityMatch(trustedData, expectedTitles)) {
                throw new AnimeflexApiError("The provider matched a different anime")
            }
            const trustedStream = normalizeAnimeflexStream(episodeNumber, trustedData)
            if ((trustedStream.videoSources?.length ?? 0) > 0) return trustedStream
            throw new AnimeflexApiError("No playable sources were found")
        })())
    }

    legacyAttempts.push((async () => {
        const data = await getJson<AnimeflexStreamingData>(`/anime/watch?${params.toString()}`, raceSignal, 10_000)
        if (!isAnimeflexStreamIdentityMatch(data, expectedTitles)) {
            throw new AnimeflexApiError("The provider matched a different anime")
        }
        const stream = normalizeAnimeflexStream(episodeNumber, data)
        if ((stream.videoSources?.length ?? 0) === 0) {
            throw new AnimeflexApiError("No playable sources were found")
        }
        return stream
    })())

    const spanishAttempts = expectedTitles.length > 0
        ? [
            withProviderTimeout(8_500, providerSignal => (
                getAnimeFlvSpanishStream(episodeNumber, expectedTitles, providerSignal)
            )),
            withProviderTimeout(6_500, providerSignal => (
                getJkAnimeSpanishStream(anilistId, episodeNumber, expectedTitles, providerSignal)
            )),
            withProviderTimeout(9_000, providerSignal => (
                getAnimeAv1SpanishStream(episodeNumber, expectedTitles, providerSignal)
            )),
        ]
        : []
    const exactAttempts = expectedTitles.length > 0
        ? [
            withProviderTimeout(9_000, providerSignal => (
                getAnipubStream(episodeNumber, expectedTitles, providerSignal)
            )),
            ...legacyAttempts,
        ]
        : legacyAttempts
    const attempts = [...spanishAttempts, ...exactAttempts]
    const successfulStreams: Array<{ priority: number; stream: Onlinestream_EpisodeSource }> = []
    const trackedAttempts = attempts.map((attempt, priority) => attempt.then(stream => {
        successfulStreams.push({ priority, stream })
        return stream
    }))
    const allSettled = Promise.allSettled(trackedAttempts)
    let backupTimer: ReturnType<typeof setTimeout> | undefined

    try {
        // Return quickly after the first working provider, but keep a short
        // collection window so the player receives real backups instead of
        // being stranded when the first URL expires or rejects the device.
        await Promise.any(trackedAttempts)
        const backupWindow = new Promise<void>(resolve => {
            backupTimer = setTimeout(resolve, 4_000)
        })
        await Promise.race([allSettled.then(() => undefined), backupWindow])

        const merged = mergeAnimeflexEpisodeSources(
            episodeNumber,
            successfulStreams
                .sort((left, right) => left.priority - right.priority)
                .map(result => result.stream),
        )
        if ((merged.videoSources?.length ?? 0) === 0) {
            throw new AnimeflexApiError("No playable sources were found")
        }
        return merged
    } catch {
        throw new AnimeflexApiError("All streaming providers failed for this episode")
    } finally {
        if (backupTimer !== undefined) clearTimeout(backupTimer)
        raceController.abort()
        signal?.removeEventListener("abort", abortFromCaller)
    }
}
