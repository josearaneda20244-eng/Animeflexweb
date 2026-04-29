import { ANIME, META } from "@consumet/extensions";
import { createDecipheriv } from "crypto";
import { getJkAnimeWatch } from "../lib/jkanime.js";
import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const JWT_SECRET = (process.env.JWT_SECRET || process.env.SESSION_SECRET)!;

// Helper function to get admin config from database
async function getAdminConfig(key: string, defaultValue: string = ""): Promise<string> {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_config WHERE key = $1`,
      [key]
    );
    return rows[0]?.value ?? defaultValue;
  } catch (err) {
    console.error(`Error getting admin config ${key}:`, err);
    return defaultValue;
  }
}

// Helper function to get daily limit as number
async function getDailyLimit(): Promise<number> {
  const limitStr = await getAdminConfig("daily_limit", "5");
  return parseInt(limitStr, 10) || 5;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface AuthReq extends Request { userId?: number; }

function optAuth(req: AuthReq, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) {
    try {
      const p = jwt.verify(h.slice(7), JWT_SECRET) as { userId: number };
      req.userId = p.userId;
    } catch {}
  }
  next();
}

const router: IRouter = Router();

// AniList META wrappers were removed. AniList's GraphQL API is permanently
// disabled, so all metadata now comes from Jikan. The streaming providers
// (AnimeKai, HiAnime, AnimePahe, KickAssAnime, JKAnime) are still scraped
// directly via @consumet/extensions ANIME.* providers.
let animeKai: InstanceType<typeof ANIME.AnimeKai>;
let hianime: InstanceType<typeof ANIME.Hianime>;
let animePahe: InstanceType<typeof ANIME.AnimePahe>;
let kickAssAnime: InstanceType<typeof ANIME.KickAssAnime>;

function getAnimeKai() {
  if (!animeKai) animeKai = new ANIME.AnimeKai();
  return animeKai;
}

function getHianime() {
  if (!hianime) hianime = new ANIME.Hianime();
  return hianime;
}

function getAnimePahe() {
  if (!animePahe) animePahe = new ANIME.AnimePahe();
  return animePahe;
}

function getKickAssAnime() {
  if (!kickAssAnime) kickAssAnime = new ANIME.KickAssAnime();
  return kickAssAnime;
}

function titleVariants(title: string): string[] {
  const variants: string[] = [title];
  const specificSeasonIntent = hasSpecificSeasonIntent(title);
  const colonIdx = title.indexOf(":");
  if (specificSeasonIntent && colonIdx > 0) {
    const beforeColon = title.slice(0, colonIdx).trim();
    if (beforeColon && !variants.includes(beforeColon)) variants.push(beforeColon);
  }
  const noPunct = title.replace(/[!?]/g, "").trim();
  if (noPunct !== title && !variants.includes(noPunct)) variants.push(noPunct);
  if (specificSeasonIntent) return [...new Set(variants)];
  const noPart = title.replace(/[\s:,\-–]+Part\s+\d+\s*$/i, "").trim();
  if (noPart !== title) variants.push(noPart);
  const noSeason = title
    .replace(/[\s:,\-–]+(Season\s+\d+|\d+(st|nd|rd|th)\s+Season)\s*$/i, "")
    .trim();
  if (noSeason !== title && noSeason !== noPart) variants.push(noSeason);
  if (colonIdx > 0) {
    const beforeColon = title.slice(0, colonIdx).trim();
    if (!variants.includes(beforeColon)) variants.push(beforeColon);
  }
  const words3 = title.split(" ").slice(0, 3).join(" ");
  if (!variants.includes(words3) && words3.length > 3) variants.push(words3);
  const words4 = title.split(" ").slice(0, 4).join(" ");
  if (!variants.includes(words4) && words4.length > 3) variants.push(words4);
  const firstWord = title.split(/[\s:]/)[0].trim();
  if (firstWord.length >= 4 && !variants.includes(firstWord)) variants.push(firstWord);
  return [...new Set(variants)];
}

function normalizeComparableTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

function extractSeasonNumber(title: string): number | null {
  const match =
    title.match(/\b(\d+)(?:st|nd|rd|th)?\s+season\b/i) ??
    title.match(/\bseason\s+(\d+)\b/i);
  if (match?.[1]) return parseInt(match[1], 10);
  const wordMatch = title.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season\b/i);
  return wordMatch?.[1] ? ORDINAL_WORDS[wordMatch[1].toLowerCase()] ?? null : null;
}

function hasSpecificSeasonIntent(title: string): boolean {
  return (
    (extractSeasonNumber(title) ?? 1) > 1 ||
    /\b(part|cour)\s+\d+\b/i.test(title) ||
    /\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+year\b/i.test(title) ||
    /:\s*\S.+/.test(title)
  );
}

function getAllTitleTexts(title: unknown): string[] {
  if (!title) return [];
  if (typeof title === "string") return [title];
  const t = title as { english?: string; romaji?: string; userPreferred?: string; native?: string };
  return [t.english, t.romaji, t.userPreferred, t.native].filter((v): v is string => !!v);
}

function titleMatchesRequestedSeason(requestedTitle: string, candidateTitles: unknown): boolean {
  const requested = normalizeComparableTitle(requestedTitle);
  const candidates = getAllTitleTexts(candidateTitles);
  if (candidates.length === 0) return !hasSpecificSeasonIntent(requestedTitle);

  const requestedSeason = extractSeasonNumber(requestedTitle);
  const colonSuffix = requestedTitle.includes(":")
    ? normalizeComparableTitle(requestedTitle.split(":").slice(1).join(" "))
    : "";
  const suffixTokens = colonSuffix.split(" ").filter((w) => w.length > 2);

  for (const candidateTitle of candidates) {
    const candidate = normalizeComparableTitle(candidateTitle);
    if (!candidate) continue;
    if (candidate === requested) return true;

    if (hasSpecificSeasonIntent(requestedTitle)) {
      const candidateSeason = extractSeasonNumber(candidateTitle);
      if (requestedSeason && requestedSeason > 1) {
        const sameSeason =
          candidateSeason === requestedSeason ||
          new RegExp(`\\b${requestedSeason}\\b`).test(candidate) ||
          new RegExp(`\\b${requestedSeason}(st|nd|rd|th)\\b`).test(candidate);
        if (!sameSeason) continue;
        return true;
      }
      if (suffixTokens.length > 0) {
        const commonSuffixTokens = suffixTokens.filter((token) => candidate.includes(token)).length;
        const required = Math.min(3, Math.ceil(suffixTokens.length / 2));
        if (commonSuffixTokens < required && computeTitleSimilarity(candidate, requested) < 0.78) continue;
      }
      if (computeTitleSimilarity(candidate, requested) >= 0.5) return true;
      if (requestedSeason && candidate.includes(`${requestedSeason}`)) return true;
      continue;
    }

    if (computeTitleSimilarity(candidate, requested) >= 0.5) return true;
  }

  return false;
}

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

function buildProxyHeaders(referer?: string): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": DEFAULT_UA };
  if (referer) {
    headers["Referer"] = referer;
    try {
      headers["Origin"] = new URL(referer).origin;
    } catch {
      headers["Origin"] = referer;
    }
  }
  return headers;
}

// Simple in-memory key cache (keys are small, 16 bytes each)
const keyCache = new Map<string, Buffer>();

async function fetchKey(keyUrl: string, referer?: string): Promise<Buffer> {
  const cacheKey = `${keyUrl}|${referer ?? ""}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey)!;
  const resp = await fetch(keyUrl, { headers: buildProxyHeaders(referer) });
  if (!resp.ok) throw new Error(`Key fetch failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  keyCache.set(keyUrl, buf);
  if (keyCache.size > 200) {
    const firstKey = keyCache.keys().next().value;
    if (firstKey) keyCache.delete(firstKey);
  }
  return buf;
}

function makeIV(seq: number): Buffer {
  const iv = Buffer.alloc(16, 0);
  iv.writeUInt32BE(seq, 12);
  return iv;
}

/**
 * HLS Proxy — serves m3u8 playlists and decrypts AES-128 segments on the fly.
 */
router.get("/anime/hls-proxy", async (req, res) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  const rawKey = req.query.key as string | undefined;
  const seq = parseInt((req.query.seq as string) || "0", 10);

  const rawReferer = req.query.referer as string | undefined;
  const proxyReferer = rawReferer ? decodeURIComponent(rawReferer) : undefined;
  const proxyHeaders = buildProxyHeaders(proxyReferer);

  // Forward Range header so MP4 seeking works (browser sends Range for partial content)
  const rangeHeader = req.headers["range"];
  if (rangeHeader) proxyHeaders["Range"] = rangeHeader;

  try {
    const upstream = await fetch(targetUrl, { headers: proxyHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const isM3U8 =
      targetUrl.includes(".m3u8") ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegURL");

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=300");

    if (isM3U8) {
      res.set("Content-Type", "application/vnd.apple.mpegurl");
      const text = await upstream.text();
      const baseUrl = targetUrl.slice(0, targetUrl.lastIndexOf("/") + 1);

      const clientBase = req.query.base as string | undefined;
      const selfBase = clientBase
        ? decodeURIComponent(clientBase)
        : (() => {
            const proto =
              (req.headers["x-forwarded-proto"] as string) ||
              req.protocol ||
              "https";
            const host =
              (req.headers["x-forwarded-host"] as string) ||
              req.headers.host ||
              "localhost";
            return `${proto}://${host}/api/anime/hls-proxy`;
          })();

      let currentKeyUrl = "";
      let mediaSeq = 0;
      let segCount = 0;

      const seqMatch = text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
      if (seqMatch) mediaSeq = parseInt(seqMatch[1], 10);

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed === "") return line;

          if (trimmed.startsWith("#EXT-X-KEY")) {
            const uriMatch = trimmed.match(/URI="([^"]+)"/);
            if (uriMatch) {
              currentKeyUrl = uriMatch[1].startsWith("http")
                ? uriMatch[1]
                : baseUrl + uriMatch[1];
            }
            return "";
          }

          if (trimmed.startsWith("#")) return line;

          const absSegUrl = trimmed.startsWith("http")
            ? trimmed
            : baseUrl + trimmed;
          const segSeq = mediaSeq + segCount;
          segCount++;

          let newUrl = `${selfBase}?url=${encodeURIComponent(absSegUrl)}&seq=${segSeq}`;
          if (proxyReferer) {
            newUrl += `&referer=${encodeURIComponent(proxyReferer)}`;
          }
          if (currentKeyUrl) {
            newUrl += `&key=${encodeURIComponent(currentKeyUrl)}`;
            newUrl += `&base=${encodeURIComponent(selfBase)}`;
          }
          return newUrl;
        })
        .join("\n");

      res.send(rewritten);
    } else if (rawKey) {
      const keyUrl = decodeURIComponent(rawKey);
      const [key, encryptedBuf] = await Promise.all([
        fetchKey(keyUrl, proxyReferer),
        upstream.arrayBuffer().then((b) => Buffer.from(b)),
      ]);

      const iv = makeIV(seq);
      try {
        const decipher = createDecipheriv("aes-128-cbc", key, iv);
        const decrypted = Buffer.concat([
          decipher.update(encryptedBuf),
          decipher.final(),
        ]);
        res.set("Content-Type", "video/MP2T");
        res.set("Content-Length", String(decrypted.length));
        res.send(decrypted);
      } catch {
        res.set("Content-Type", "video/MP2T");
        res.send(encryptedBuf);
      }
    } else {
      const cl = upstream.headers.get("content-length");
      const cr = upstream.headers.get("content-range");
      const ar = upstream.headers.get("accept-ranges");
      if (cl) res.set("Content-Length", cl);
      if (cr) res.set("Content-Range", cr);
      res.set("Accept-Ranges", ar ?? "bytes");
      // Force video/MP2T: CDNs disguise HLS segments with fake extensions (.gif, .png, etc.)
      // HLS.js rejects segments with wrong MIME types, causing silent playback failure
      res.set("Content-Type", "video/MP2T");
      res.status(upstream.status); // preserve 206 Partial Content for range requests
      const nodeStream = Readable.fromWeb(upstream.body as any);
      nodeStream.pipe(res);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Proxy failed" });
    }
  }
});

/**
 * Embedded HLS player page.
 */
router.get("/anime/player-embed", (req, res) => {
  const rawM3u8 = req.query.m3u8 as string;
  if (!rawM3u8) {
    res.status(400).send("m3u8 param required");
    return;
  }

  let m3u8Url: string;
  try {
    m3u8Url = decodeURIComponent(rawM3u8);
  } catch {
    res.status(400).send("Invalid m3u8 param");
    return;
  }

  const title = (req.query.title as string | undefined) ?? "AnimeFLEX";

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Access-Control-Allow-Origin", "*");
  res.set("X-Frame-Options", "ALLOWALL");
  res.set("Cache-Control", "no-cache");

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; user-select: none; }
    #wrap { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: contain; outline: none; }
    #overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 14px; color: #fff; font-family: system-ui, sans-serif;
      font-size: 14px; text-align: center; padding: 24px;
      pointer-events: none;
      transition: opacity .3s;
      background: rgba(0,0,0,0.7);
    }
    #overlay.hidden { opacity: 0; pointer-events: none; }
    .spinner {
      width: 48px; height: 48px;
      border: 3px solid rgba(255,255,255,.15);
      border-top-color: #7c3aed;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loadMsg { color: rgba(255,255,255,0.7); font-size: 13px; }
    #errIcon { font-size: 36px; }
    #errMsg { color: #f87171; font-weight: 600; font-size: 15px; }
    #retryBtn {
      display: none; pointer-events: all;
      background: #7c3aed; color: #fff; border: none;
      padding: 10px 28px; border-radius: 10px;
      cursor: pointer; font-size: 14px; font-weight: 700;
      transition: background .15s;
    }
    #retryBtn:hover { background: #6d28d9; }
    #skipFb {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      background: rgba(0,0,0,.55); color: #fff;
      font-family: system-ui, sans-serif; font-size: 15px; font-weight: 700;
      padding: 10px 22px; border-radius: 24px;
      opacity: 0; transition: opacity .2s; pointer-events: none;
      white-space: nowrap;
    }
    #skipFb.show { opacity: 1; }
  </style>
</head>
<body>
<div id="wrap">
  <video id="v" controls playsinline></video>
  <div id="skipFb" aria-hidden="true"></div>
  <div id="overlay">
    <div class="spinner" id="spinner"></div>
    <span id="loadMsg">Cargando episodio...</span>
    <span id="errIcon" style="display:none">⚠️</span>
    <span id="errMsg"></span>
    <button id="retryBtn" onclick="load()">Reintentar</button>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js"></script>
<script>
  const SRC = ${JSON.stringify(m3u8Url)};
  const video = document.getElementById('v');
  const overlay = document.getElementById('overlay');
  const spinner = document.getElementById('spinner');
  const loadMsg = document.getElementById('loadMsg');
  const errIcon = document.getElementById('errIcon');
  const errMsg = document.getElementById('errMsg');
  const retryBtn = document.getElementById('retryBtn');
  const skipFb = document.getElementById('skipFb');
  let hls;
  let skipTimer;

  window.addEventListener('keydown', function(e) {
    const nav = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Backspace'];
    if (nav.includes(e.key)) {
      e.stopPropagation();
      if (!video.paused || video.currentTime > 0) {
        if (e.key === 'ArrowRight') { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); showSkip('+10s'); }
        if (e.key === 'ArrowLeft')  { video.currentTime = Math.max(0, video.currentTime - 10); showSkip('-10s'); }
        if (e.key === 'ArrowUp')    { video.volume = Math.min(1, video.volume + 0.1); }
        if (e.key === 'ArrowDown')  { video.volume = Math.max(0, video.volume - 0.1); }
        if (e.key !== 'Backspace') e.preventDefault();
      }
    }
    if (e.key === ' ') {
      e.preventDefault();
      video.paused ? video.play() : video.pause();
    }
  }, true);

  function showSkip(text) {
    skipFb.textContent = text;
    skipFb.classList.add('show');
    clearTimeout(skipTimer);
    skipTimer = setTimeout(() => skipFb.classList.remove('show'), 800);
  }

  function showError(text) {
    spinner.style.display = 'none';
    loadMsg.style.display = 'none';
    errIcon.style.display = '';
    errMsg.textContent = text;
    retryBtn.style.display = 'inline-block';
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function load() {
    errMsg.textContent = '';
    errIcon.style.display = 'none';
    retryBtn.style.display = 'none';
    spinner.style.display = '';
    loadMsg.style.display = '';
    loadMsg.textContent = 'Cargando episodio...';
    overlay.classList.remove('hidden');

    if (hls) { hls.destroy(); hls = null; }

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 180,
        startLevel: -1,
        abrEwmaDefaultEstimate: 1500000,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 30000,
      });
      hls.loadSource(SRC);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hideOverlay();
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              showError('Error al reproducir. Intenta de nuevo.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = SRC;
      video.addEventListener('loadedmetadata', () => {
        hideOverlay();
        video.play().catch(() => {});
      }, { once: true });
    } else {
      showError('Tu navegador no soporta reproducción HLS.');
    }
  }

  document.addEventListener('click', () => window.focus(), { once: true });
  window.focus();
  load();
</script>
</body>
</html>`);
});

// Only show proper anime formats — exclude manga, novels and other non-anime
const ANIME_FORMATS = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"];

function isAnimeFormat(type: string | undefined | null): boolean {
  if (!type) return true; // unknown → allow through
  return ANIME_FORMATS.includes(type.toUpperCase());
}

// ── Stale-while-revalidate cache for slow AniList endpoints ──
// Avoids users waiting 10-40s for trending/popular/recent on cold requests.
type CacheEntry<T> = { data: T; expires: number; refreshing: boolean };
const swrCache = new Map<string, CacheEntry<any>>();
const SWR_TTL_MS = 5 * 60 * 1000; // 5 min fresh window

async function serveSwr<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  res: any,
  log: any,
  errorLabel: string
) {
  const now = Date.now();
  const cached = swrCache.get(cacheKey);

  // Allow CDN/browser to cache too: fresh for 5 min, can serve stale for an hour while revalidating.
  res.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");

  // Hit (fresh): instant response
  if (cached && cached.expires > now) {
    res.json(cached.data);
    return;
  }

  // Stale hit: respond instantly with stale data, refresh in background
  if (cached) {
    res.json(cached.data);
    if (!cached.refreshing) {
      cached.refreshing = true;
      loader()
        .then((fresh) => {
          swrCache.set(cacheKey, { data: fresh, expires: Date.now() + SWR_TTL_MS, refreshing: false });
        })
        .catch((err) => {
          log.warn({ err, cacheKey }, `${errorLabel} (background refresh failed, keeping stale cache)`);
          cached.refreshing = false;
          // Extend stale TTL a bit so we don't hammer the upstream
          cached.expires = Date.now() + 30 * 1000;
        });
    }
    return;
  }

  // Cold: must wait for upstream
  try {
    const fresh = await loader();
    swrCache.set(cacheKey, { data: fresh, expires: now + SWR_TTL_MS, refreshing: false });
    res.json(fresh);
  } catch (err) {
    log.error({ err }, errorLabel);
    res.status(500).json({ error: errorLabel });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Jikan (MyAnimeList) is now the primary data source for anime listings,
// search, and metadata. The variable names still mention "anilist" in a few
// places for backward compatibility with the existing frontend contract
// (e.g. the /anime/anilist-info endpoint), but every actual upstream call
// goes to Jikan. IDs throughout the system are MAL IDs.
// ──────────────────────────────────────────────────────────────────────────────
const JIKAN_BASE = "https://api.jikan.moe/v4";

function jikanImage(images: any): string {
  return (
    images?.webp?.large_image_url ??
    images?.jpg?.large_image_url ??
    images?.webp?.image_url ??
    images?.jpg?.image_url ??
    ""
  );
}

function jikanTitle(m: any): { romaji: string; english?: string; userPreferred: string; native?: string } {
  return {
    romaji: m.title ?? "",
    english: m.title_english ?? undefined,
    userPreferred: m.title_english || m.title || "",
    native: m.title_japanese ?? undefined,
  };
}

function mapJikanAnime(m: any): any {
  return {
    id: String(m.mal_id),
    title: jikanTitle(m),
    image: jikanImage(m.images),
    type: (m.type ?? "TV").toUpperCase(),
    status: (m.status ?? "").toUpperCase().replace(/\s+/g, "_"),
    totalEpisodes: m.episodes ?? 0,
    rating: m.score != null ? Math.round(m.score * 10) : 0,
    genres: Array.isArray(m.genres) ? m.genres.map((g: any) => g.name).filter(Boolean) : [],
    releaseDate: m.year ?? m.aired?.prop?.from?.year ?? undefined,
  };
}

async function jikanFetch(path: string): Promise<any> {
  const r = await fetch(`${JIKAN_BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Jikan ${r.status} on ${path}`);
  return await r.json();
}

async function loadTrending() {
  // "Trending" ≈ currently airing top anime on MAL.
  const j = await jikanFetch(`/top/anime?filter=airing&limit=25`);
  const results = (j.data ?? []).map(mapJikanAnime).filter((a: any) => isAnimeFormat(a.type));
  return {
    currentPage: j.pagination?.current_page ?? 1,
    hasNextPage: Boolean(j.pagination?.has_next_page),
    results,
  };
}

async function loadPopular() {
  const j = await jikanFetch(`/top/anime?filter=bypopularity&limit=25`);
  const results = (j.data ?? []).map(mapJikanAnime).filter((a: any) => isAnimeFormat(a.type));
  return {
    currentPage: j.pagination?.current_page ?? 1,
    hasNextPage: Boolean(j.pagination?.has_next_page),
    results,
  };
}

// Tiny per-process cache of hydrated anime details, keyed by MAL id.
// Used by loadRecent to avoid re-fetching the same anime metadata across
// repeated SWR refreshes within a short window.
const recentMetaCache = new Map<number, { at: number; data: any }>();
const RECENT_META_TTL = 30 * 60 * 1000;

async function loadRecent() {
  // Jikan's /watch/episodes feed lists the most recently-aired episodes
  // reported by the MAL community. Each entry only carries
  // {mal_id, url, title} for the anime — no images — so we hydrate the
  // top N unique anime via /anime/{id} (with an in-memory cache and a
  // small delay between requests to respect Jikan's ~3 req/s limit).
  const j = await jikanFetch(`/watch/episodes`);
  const raw: any[] = j.data ?? [];

  const uniqueEntries: Array<{ mal_id: number; title: string; lastEp: number }> = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const e = item?.entry;
    const id = typeof e?.mal_id === "number" ? e.mal_id : null;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const epList: any[] = item.episodes ?? [];
    const lastEp = typeof epList[0]?.mal_id === "number" ? epList[0].mal_id : epList.length;
    uniqueEntries.push({ mal_id: id, title: e.title ?? "", lastEp });
    if (uniqueEntries.length >= 20) break;
  }

  const results: any[] = [];
  for (const entry of uniqueEntries) {
    let detail: any = null;
    const hit = recentMetaCache.get(entry.mal_id);
    if (hit && Date.now() - hit.at < RECENT_META_TTL) {
      detail = hit.data;
    } else {
      try {
        const d = await jikanFetch(`/anime/${entry.mal_id}`);
        detail = d?.data ?? null;
        if (detail) recentMetaCache.set(entry.mal_id, { at: Date.now(), data: detail });
      } catch {
        detail = null;
      }
      // Stay under Jikan's ~3 req/s rate limit.
      await new Promise((r) => setTimeout(r, 350));
    }

    if (detail) {
      results.push({
        ...mapJikanAnime(detail),
        currentEpisode: entry.lastEp,
        status: "RELEASING",
      });
    } else {
      // Fallback: keep the entry visible even if hydration failed.
      results.push({
        id: String(entry.mal_id),
        title: { romaji: entry.title, english: undefined, userPreferred: entry.title },
        image: "",
        currentEpisode: entry.lastEp,
        type: "TV",
        status: "RELEASING",
        totalEpisodes: 0,
        rating: 0,
        genres: [],
      });
    }
  }

  return { currentPage: 1, hasNextPage: false, results };
}

// Pre-warm cache at module load so the very first user request is instant.
// We do this lazily (no top-level await) to avoid blocking server startup.
function prewarm() {
  loadTrending()
    .then((d) => swrCache.set("trending", { data: d, expires: Date.now() + SWR_TTL_MS, refreshing: false }))
    .catch(() => {});
  loadPopular()
    .then((d) => swrCache.set("popular", { data: d, expires: Date.now() + SWR_TTL_MS, refreshing: false }))
    .catch(() => {});
  loadRecent()
    .then((d) => swrCache.set("recent", { data: d, expires: Date.now() + SWR_TTL_MS, refreshing: false }))
    .catch(() => {});
}
prewarm();

router.get("/anime/trending", async (req, res) => {
  await serveSwr("trending", loadTrending, res, req.log, "Failed to fetch trending anime");
});

router.get("/anime/popular", async (req, res) => {
  await serveSwr("popular", loadPopular, res, req.log, "Failed to fetch popular anime");
});

router.get("/anime/recent", async (req, res) => {
  await serveSwr("recent", loadRecent, res, req.log, "Failed to fetch recent episodes");
});

router.get("/anime/search", async (req, res) => {
  const query = req.query.q as string;
  const page = Number(req.query.page) || 1;
  if (!query) {
    res.status(400).json({ error: "Query param 'q' is required" });
    return;
  }
  try {
    const j = await jikanFetch(
      `/anime?q=${encodeURIComponent(query)}&page=${page}&limit=24&sfw=true&order_by=popularity&sort=asc`,
    );
    const results = (j.data ?? []).map(mapJikanAnime).filter((a: any) => isAnimeFormat(a.type));
    res.json({
      currentPage: j.pagination?.current_page ?? page,
      hasNextPage: Boolean(j.pagination?.has_next_page),
      results,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to search anime");
    res.status(500).json({ error: "Failed to search anime" });
  }
});

/**
 * Fetch anime by format (MOVIE, OVA, ONA, SPECIAL), sorted by popularity.
 * Backed by Jikan (MyAnimeList).
 * GET /api/anime/by-format?format=MOVIE&page=1
 */
const byFormatCache = new Map<string, { data: unknown; expires: number }>();

// Cache for anime detail responses — prevents hammering Jikan (rate limit ~3 req/sec).
const anilistInfoCache = new Map<string, { data: unknown; expires: number; stale: unknown }>();
const ANILIST_INFO_CACHE_TTL = 20 * 60 * 1000; // 20 minutes

function jikanTypeForFormat(format: string): string {
  switch (format) {
    case "MOVIE":   return "movie";
    case "OVA":     return "ova";
    case "ONA":     return "ona";
    case "SPECIAL": return "special";
    default:        return "movie";
  }
}

router.get("/anime/by-format", async (req, res) => {
  const ALLOWED = ["MOVIE", "OVA", "ONA", "SPECIAL"];
  const format = ((req.query.format as string) || "MOVIE").toUpperCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  if (!ALLOWED.includes(format)) {
    res.status(400).json({ error: `Invalid format. Use: ${ALLOWED.join(", ")}` });
    return;
  }
  const cacheKey = `${format}-${page}`;
  const cached = byFormatCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.json(cached.data);
    return;
  }
  try {
    const j = await jikanFetch(
      `/anime?type=${jikanTypeForFormat(format)}` +
      `&order_by=popularity&sort=asc&page=${page}&limit=24&sfw=true`,
    );
    const results = (j.data ?? []).map(mapJikanAnime);
    const payload = {
      results,
      currentPage: j.pagination?.current_page ?? page,
      hasNextPage: Boolean(j.pagination?.has_next_page),
    };
    byFormatCache.set(cacheKey, { data: payload, expires: Date.now() + 15 * 60 * 1000 });
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch anime by format");
    res.status(500).json({ error: "Failed to fetch anime" });
  }
});

router.get("/anime/info", async (req, res) => {
  const id = req.query.id as string;
  if (!id) {
    res.status(400).json({ error: "Query param 'id' is required" });
    return;
  }
  try {
    const data = await getAnimeKai().fetchAnimeInfo(id);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch anime info from AnimeKai");
    res.status(500).json({ error: "Failed to fetch anime info" });
  }
});

/**
 * Compute a rough title similarity score between two strings (0–1).
 * Used to detect when AnimeKai maps an AniList ID to the wrong anime.
 */
function computeTitleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalizeComparableTitle(a);
  const nb = normalizeComparableTitle(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = na.split(/\s+/);
  const wb = nb.split(/\s+/);
  const common = wa.filter(w => w.length > 1 && wb.includes(w)).length;
  return common / Math.max(wa.length, wb.length);
}

/**
 * Fetch episodes for an anime using its MAL ID (still called `anilistId`
 * in the query string for backward compatibility with existing clients).
 * Backed by Jikan; returns the canonical episode list when Jikan has it,
 * otherwise synthesizes a numbered list from the planned episode total.
 */
router.get("/anime/episodes", async (req, res) => {
  const anilistId = req.query.anilistId as string;
  if (!anilistId) {
    res.status(400).json({ error: "Query param 'anilistId' is required" });
    return;
  }
  try {
    // Episode list is derived from Jikan (MAL). The variable is still
    // called `anilistId` for backward-compat but the value is a MAL ID.
    const [metaR, epsR] = await Promise.allSettled([
      jikanFetch(`/anime/${encodeURIComponent(anilistId)}/full`),
      jikanFetch(`/anime/${encodeURIComponent(anilistId)}/episodes`),
    ]);

    const media = metaR.status === "fulfilled" ? metaR.value?.data : null;
    const epsRaw: any[] = epsR.status === "fulfilled" ? (epsR.value?.data ?? []) : [];

    if (!media && epsRaw.length === 0) {
      res.status(500).json({ error: "Failed to fetch episode list" });
      return;
    }

    let episodes: Array<{ id: string; number: number; title: string; image: string | null }>;
    if (epsRaw.length > 0) {
      episodes = epsRaw
        .filter((e: any) => typeof e.mal_id === "number")
        .sort((a: any, b: any) => a.mal_id - b.mal_id)
        .map((e: any) => ({
          id: `${anilistId}-episode-${e.mal_id}`,
          number: e.mal_id,
          title: e.title ?? `Episodio ${e.mal_id}`,
          image: null,
        }));
    } else {
      const count = typeof media?.episodes === "number" ? media.episodes : 0;
      episodes = Array.from({ length: count }, (_, i) => {
        const num = i + 1;
        return {
          id: `${anilistId}-episode-${num}`,
          number: num,
          title: `Episodio ${num}`,
          image: null,
        };
      });
    }

    res.json({
      id: anilistId,
      title: media ? jikanTitle(media) : {},
      episodes,
      totalEpisodes: episodes.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch episodes");
    res.status(500).json({ error: "Failed to fetch episode list" });
  }
});

router.get("/anime/anilist-info", async (req, res) => {
  const id = req.query.id as string;
  if (!id) {
    res.status(400).json({ error: "Query param 'id' is required" });
    return;
  }
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    res.status(400).json({ error: "Invalid id — must be a numeric AniList ID" });
    return;
  }

  // Serve from cache if available and not expired
  const cacheKey = `anilist-info:${numId}`;
  const cached = anilistInfoCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    res.json(cached.data);
    return;
  }

  try {
    // Fetch full anime info + recommendations + characters from Jikan in parallel.
    const [fullJ, recsJ, charsJ, epsJ] = await Promise.allSettled([
      jikanFetch(`/anime/${numId}/full`),
      jikanFetch(`/anime/${numId}/recommendations`),
      jikanFetch(`/anime/${numId}/characters`),
      jikanFetch(`/anime/${numId}/episodes`),
    ]);

    const media = fullJ.status === "fulfilled" ? fullJ.value?.data : null;
    if (!media) {
      // Return stale cache data rather than an error when Jikan is unavailable
      if (cached?.stale) {
        req.log.warn({ id }, "Jikan unavailable — serving stale cache");
        res.json(cached.stale);
        return;
      }
      res.status(404).json({ error: "Anime not found" });
      return;
    }

    const recsRaw = recsJ.status === "fulfilled" ? (recsJ.value?.data ?? []) : [];
    const charsRaw = charsJ.status === "fulfilled" ? (charsJ.value?.data ?? []) : [];
    const epsRaw = epsJ.status === "fulfilled" ? (epsJ.value?.data ?? []) : [];

    // Build the episode list. Prefer the real episode list from Jikan when it
    // has data; otherwise synthesize from `media.episodes` (planned total).
    let episodes: any[];
    if (epsRaw.length > 0) {
      episodes = epsRaw
        .filter((e: any) => typeof e.mal_id === "number")
        .sort((a: any, b: any) => a.mal_id - b.mal_id)
        .map((e: any) => ({
          id: `${id}-episode-${e.mal_id}`,
          number: e.mal_id,
          title: e.title ?? `Episodio ${e.mal_id}`,
          image: null,
          url: e.url ?? null,
        }));
    } else {
      const count = typeof media.episodes === "number" ? media.episodes : 0;
      episodes = Array.from({ length: count }, (_, i) => {
        const num = i + 1;
        return {
          id: `${id}-episode-${num}`,
          number: num,
          title: `Episodio ${num}`,
          image: null,
          url: null,
        };
      });
    }

    const characters = charsRaw.slice(0, 16).map((c: any) => ({
      id: String(c.character?.mal_id ?? ""),
      name: c.character?.name ?? "",
      image:
        c.character?.images?.webp?.image_url ??
        c.character?.images?.jpg?.image_url ??
        "",
      role: (c.role ?? "SUPPORTING").toUpperCase(),
    }));

    const recommendations = recsRaw.slice(0, 10).map((r: any) => {
      const e = r.entry ?? {};
      return {
        id: String(e.mal_id ?? ""),
        title: e.title ?? "",
        image: jikanImage(e.images),
        rating: 0,
        type: "TV",
        totalEpisodes: 0,
      };
    });

    const trailer = media.trailer?.youtube_id
      ? { id: media.trailer.youtube_id as string, site: "youtube" }
      : null;

    const studios = (media.studios ?? []).map((s: any) => s.name).filter(Boolean);

    const payload = {
      id: String(media.mal_id),
      title: jikanTitle(media),
      image: jikanImage(media.images),
      cover: media.trailer?.images?.maximum_image_url ?? jikanImage(media.images),
      description: media.synopsis ?? "",
      genres: (media.genres ?? []).map((g: any) => g.name).filter(Boolean),
      status: (media.status ?? "").toUpperCase().replace(/\s+/g, "_"),
      type: (media.type ?? "TV").toUpperCase(),
      totalEpisodes: episodes.length || media.episodes || 0,
      duration: media.duration ?? "",
      rating: media.score != null ? Math.round(media.score * 10) : 0,
      color: undefined,
      studios,
      trailer,
      characters,
      recommendations,
      episodes,
    };

    anilistInfoCache.set(cacheKey, {
      data: payload,
      expires: Date.now() + ANILIST_INFO_CACHE_TTL,
      stale: payload,
    });

    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch anime info from Jikan");
    if (cached?.stale) {
      req.log.warn({ id }, "Jikan error — serving stale cache");
      res.json(cached.stale);
      return;
    }
    res.status(500).json({ error: "Failed to fetch anime info" });
  }
});

/**
 * Search on AnimeKai directly.
 */
router.get("/anime/search-pahe", async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: "Query param 'q' is required" });
    return;
  }
  try {
    const data = await getAnimeKai().search(query);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to search on AnimeKai");
    res.status(500).json({ error: "Failed to search on AnimeKai" });
  }
});

/**
 * Find anime episodes on AnimeKai by title.
 * Fallback for when the AniList ID is not available.
 */
router.get("/anime/info-by-title", async (req, res) => {
  const title = req.query.title as string;
  if (!title || !title.trim()) {
    res.status(400).json({ error: "Query param 'title' is required" });
    return;
  }

  const variants = titleVariants(title.trim());
  req.log.info({ title, variants }, "Looking up anime by title on AnimeKai");

  for (const variant of variants) {
    try {
      const searchResults = await getAnimeKai().search(variant);
      const candidates = (searchResults.results ?? []).slice(0, 5);
      for (const candidate of candidates) {
        if (!candidate?.id) continue;
        const data = await getAnimeKai().fetchAnimeInfo(candidate.id as string);
        if (!titleMatchesRequestedSeason(title, data.title ?? candidate.title)) continue;
        req.log.info({ variant, id: candidate.id }, "Found anime info on AnimeKai");
        res.json(data);
        return;
      }
    } catch {
      // try next variant
    }
  }

  res.status(404).json({ error: `Anime not found: "${title}"` });
});

/**
 * Fetch streaming sources for an episode via AnimeKai.
 * Episode IDs are in AnimeKai format: slug$ep=N$token=xxx
 */
async function retryFetch<T>(fn: () => Promise<T>, attempts = 4, baseDelayMs = 600): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

router.get("/anime/watch", optAuth, async (req: AuthReq, res) => {
  const episodeId  = req.query.episodeId  as string;
  const animeTitle = (req.query.animeTitle as string | undefined)?.trim() ?? "";
  const episodeNum = (req.query.episodeNum as string | undefined)?.trim() ?? "";
  const animeId = (req.query.animeId as string | undefined)?.trim() ?? "";
  if (!episodeId || !episodeId.trim()) {
    res.status(400).json({ error: "Query param 'episodeId' is required" });
    return;
  }
  const id = episodeId.trim();

  // ── Verificar límite diario si el usuario está autenticado ─────────────
  if (req.userId) {
    try {
      const memberResult = await pool.query(
        `SELECT membership_tier, is_active FROM users WHERE id = $1`,
        [req.userId]
      );
      const row = memberResult.rows[0];
      if (row?.is_active === false) {
        res.status(403).json({ error: "Cuenta desactivada" });
        return;
      }
      const tier = row?.membership_tier ?? "free";
      if (tier !== "megafan") {
        const today = new Date().toISOString().slice(0, 10);
        const { rows } = await pool.query(
          `SELECT COUNT(DISTINCT episode_id) as count FROM user_daily_views WHERE user_id = $1 AND view_date = $2`,
          [req.userId, today]
        );
        const count = parseInt(rows[0]?.count ?? "0", 10);
        const dailyLimit = await getDailyLimit();
        if (count >= dailyLimit) {
          res.status(403).json({ error: "Límite diario alcanzado", limitReached: true, remaining: 0 });
          return;
        }
      }
    } catch { /* no bloquear por error DB */ }
  }
  const fetchAnimeKaiSources = async (sourceId: string) => {
    try {
      // Reduced retries (was 4): we now race AnimeKai against other providers,
      // so we want it to fail fast if it can't deliver quickly.
      return await retryFetch(() => getAnimeKai().fetchEpisodeSources(sourceId), 2, 400);
    } catch (directErr) {
      const servers = await retryFetch(() => getAnimeKai().fetchEpisodeServers(sourceId), 2, 400);
      if (!servers || servers.length === 0) throw directErr;
      let lastServerErr: unknown = directErr;
      for (const server of servers.slice(0, 2)) {
        try {
          const data = await retryFetch(() => getAnimeKai().fetchEpisodeSources(server.url), 2, 400);
          req.log.info({ server: server.name }, "AnimeKai fallback server succeeded");
          return data;
        } catch (err) {
          lastServerErr = err;
        }
      }
      throw lastServerErr;
    }
  };

  const animeKaiTokenMatch = id.match(/\$token=([^$&]+)/);
  const animeKaiToken = animeKaiTokenMatch?.[1] ?? "";
  const hasValidToken = animeKaiToken.length >= 12;
  const syntheticAnilistMatch = id.match(/^(\d+)-episode-\d+$/);
  const anilistCandidates = [...new Set([animeId, syntheticAnilistMatch?.[1]].filter(Boolean))] as string[];

  /* Helper: returns true if the data has at least one playable M3U8 source.
   * We treat anything else as a failed attempt so we keep racing other providers. */
  const isPlayable = (data: any): boolean => {
    if (!data) return false;
    const sources = (data.sources ?? []) as any[];
    return sources.some(
      (s) => s.isM3U8 === true || (typeof s.url === "string" && s.url.includes(".m3u8")),
    );
  };

  /* Wrap a result: rejects if not playable, so Promise.any keeps waiting for
   * a real winner. */
  const requirePlayable = (name: string, dataPromise: Promise<any>): Promise<any> =>
    dataPromise.then((data) => {
      if (!isPlayable(data)) {
        throw new Error(`${name}: no playable sources`);
      }
      return data;
    });

  /* ── Build all provider attempts as independent promises ─────────────
   * They race via Promise.any: the first PLAYABLE response wins. This is
   * dramatically faster than the previous sequential cascade where a slow
   * AnimeKai retry-storm (~5-15s) blocked the fallbacks entirely. */
  const attempts: Promise<any>[] = [];

  // ── Branch 1: AnimeKai with the existing token (fastest path) ──────
  if (hasValidToken) {
    attempts.push(
      requirePlayable("animekai-direct", fetchAnimeKaiSources(id)).then((d) => {
        req.log.info({ provider: "AnimeKai-direct", episodeId: id }, "AnimeKai direct hit");
        return d;
      }),
    );
  }

  // ── Branch 2 removed: AnimeKai's AniList-ID lookup wrapper relied on the
  // AniList GraphQL API, which is permanently disabled. Title-based
  // discovery (Branch 3) and JKAnime (Branch 7) cover the same ground.
  void anilistCandidates; // keep variable referenced for future re-use

  // ── Branch 3: AnimeKai via title search (slowest AnimeKai path) ────
  if (animeTitle && episodeNum) {
    attempts.push(
      (async () => {
        const variants = titleVariants(animeTitle).slice(0, 2);
        for (const variant of variants) {
          try {
            const searchData = await retryFetch(() => getAnimeKai().search(variant), 1, 300) as any;
            const candidates = (searchData.results ?? []).slice(0, 3);
            for (const candidate of candidates) {
              if (!candidate?.id) continue;
              try {
                const info = await retryFetch(
                  () => getAnimeKai().fetchAnimeInfo(candidate.id as string),
                  1,
                  300,
                ) as any;
                if (!titleMatchesRequestedSeason(animeTitle, info?.title ?? candidate.title)) continue;
                const ep = (info.episodes ?? []).find((e: any) => String(e.number) === episodeNum);
                if (!ep?.id) continue;
                const data = await fetchAnimeKaiSources(ep.id as string);
                if (!isPlayable(data)) continue;
                req.log.info(
                  { provider: "AnimeKai-search", variant, episodeNum },
                  "AnimeKai search hit",
                );
                return data;
              } catch { /* try next */ }
            }
          } catch { /* try next */ }
        }
        throw new Error("animekai-search exhausted");
      })(),
    );
  }

  // ── Branches 4-6: HiAnime / AnimePahe / KickAssAnime in parallel ───
  if (animeTitle && episodeNum) {
    const tryProvider = async (
      name: string,
      searcher: (q: string) => Promise<any>,
      infoFetcher: (id: string) => Promise<any>,
      sourcesFetcher: (id: string) => Promise<any>,
    ): Promise<any> => {
      const variants = titleVariants(animeTitle).slice(0, 2);
      for (const variant of variants) {
        let searchData: any;
        try { searchData = await searcher(variant); } catch { continue; }
        const candidates = (searchData?.results ?? []).slice(0, 3);
        for (const candidate of candidates) {
          if (!candidate?.id) continue;
          let info: any;
          try { info = await infoFetcher(String(candidate.id)); } catch { continue; }
          if (!titleMatchesRequestedSeason(animeTitle, info?.title ?? candidate.title)) continue;
          const ep = (info?.episodes ?? []).find((e: any) => String(e.number) === episodeNum);
          if (!ep?.id) continue;
          try {
            const data = await sourcesFetcher(String(ep.id));
            if (!isPlayable(data)) continue;
            req.log.info(
              { provider: name, variant, episodeNum },
              `${name} race hit`,
            );
            return data;
          } catch { continue; }
        }
      }
      throw new Error(`${name} exhausted`);
    };

    attempts.push(
      tryProvider("hianime", q => getHianime().search(q), id => getHianime().fetchAnimeInfo(id), id => getHianime().fetchEpisodeSources(id)),
      tryProvider("animepahe", q => getAnimePahe().search(q), id => getAnimePahe().fetchAnimeInfo(id), id => getAnimePahe().fetchEpisodeSources(id)),
      tryProvider("kickassanime", q => getKickAssAnime().search(q), id => getKickAssAnime().fetchAnimeInfo(id), id => getKickAssAnime().fetchEpisodeSources(id)),
    );
  }

  // ── Branch 7: JKAnime (wide Spanish-language coverage) ─────────────
  if (animeTitle && episodeNum) {
    attempts.push(
      (async () => {
        let extraTitles: string[] = [];
        if (animeId && /^\d+$/.test(animeId)) {
          try { extraTitles = await fetchAnilistTitles(animeId); } catch {}
        }
        const jkData = await getJkAnimeWatch(animeTitle, parseInt(episodeNum, 10), extraTitles, animeId);
        if (!isPlayable(jkData)) throw new Error("jkanime: no playable sources");
        req.log.info({ provider: "jkanime", animeTitle, episodeNum }, "JKAnime race hit");
        return jkData;
      })(),
    );
  }

  if (attempts.length === 0) {
    res.status(400).json({ error: "Insufficient parameters to fetch sources" });
    return;
  }

  /* Race them all. First playable response wins — typical p50 should
   * drop from ~5-15s to ~1-3s because we no longer block on AnimeKai
   * retries before starting the cheap providers. */
  try {
    const result = await Promise.any(attempts);
    res.json(result);
    return;
  } catch (err) {
    req.log.error(
      { err, episodeId: id, animeTitle, episodeNum, attempted: attempts.length },
      "All streaming providers failed for this episode",
    );
    res.status(503).json({ error: "All streaming providers failed for this episode" });
  }
});

/**
 * OpenSubtitles subtitle search
 * GET /api/anime/subtitles?title=...&episode=...&lang=es
 */
router.get("/anime/subtitles", async (req, res) => {
  const title = (req.query.title as string | undefined)?.trim();
  const episode = (req.query.episode as string | undefined)?.trim();
  const lang = (req.query.lang as string | undefined)?.trim() ?? "es";

  if (!title) {
    res.status(400).json({ error: "Query param 'title' is required" });
    return;
  }

  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENSUBTITLES_API_KEY is not configured" });
    return;
  }

  try {
    const params = new URLSearchParams({
      query: title,
      languages: lang,
      type: "episode",
      order_by: "download_count",
    });
    if (episode) params.set("episode_number", episode);

    const searchRes = await fetch(
      `https://api.opensubtitles.com/api/v1/subtitles?${params.toString()}`,
      {
        headers: {
          "Api-Key": apiKey,
          "User-Agent": "AnimeFLEX v1.0",
          Accept: "application/json",
        },
      }
    );

    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => "");
      req.log.error({ status: searchRes.status, body: errText }, "OpenSubtitles search failed");
      res.status(searchRes.status).json({ error: "OpenSubtitles search failed", data: [] });
      return;
    }

    const json = (await searchRes.json()) as {
      data: Array<{
        id: string;
        attributes: {
          language: string;
          release: string;
          download_count: number;
          files: Array<{ file_id: number; file_name: string }>;
        };
      }>;
    };

    const results = (json.data ?? [])
      .filter((item) => item.attributes.files?.[0]?.file_id)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        lang: item.attributes.language,
        release: item.attributes.release ?? "",
        downloadCount: item.attributes.download_count ?? 0,
        fileId: item.attributes.files?.[0]?.file_id ?? null,
        fileName: item.attributes.files?.[0]?.file_name ?? "",
      }));

    res.json({ data: results });
  } catch (err) {
    req.log.error({ err }, "Failed to search subtitles on OpenSubtitles");
    res.status(500).json({ error: "Failed to search subtitles" });
  }
});

/**
 * Download subtitle URL from OpenSubtitles (returns a temporary download URL)
 * POST /api/anime/subtitles/download  body: { fileId }
 */
router.post("/anime/subtitles/download", async (req, res) => {
  const { fileId } = req.body as { fileId?: number };
  if (!fileId) {
    res.status(400).json({ error: "fileId is required" });
    return;
  }

  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENSUBTITLES_API_KEY is not configured" });
    return;
  }

  try {
    const dlRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "User-Agent": "AnimeFLEX v1.0",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ file_id: fileId, sub_format: "webvtt" }),
    });

    if (!dlRes.ok) {
      const errText = await dlRes.text().catch(() => "");
      req.log.error({ status: dlRes.status, body: errText }, "OpenSubtitles download failed");
      res.status(dlRes.status).json({ error: "Download request failed" });
      return;
    }

    const json = (await dlRes.json()) as { link?: string; message?: string };
    if (!json.link) {
      res.status(502).json({ error: json.message ?? "No download link returned" });
      return;
    }

    res.json({ url: json.link });
  } catch (err) {
    req.log.error({ err }, "Failed to get subtitle download link");
    res.status(500).json({ error: "Failed to get subtitle download link" });
  }
});

/**
 * Subtitle proxy: fetches and re-serves a subtitle file (srt/vtt) to avoid CORS issues.
 * GET /api/anime/subtitle-proxy?url=...
 */
router.get("/anime/subtitle-proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  const rawReferer = req.query.referer as string | undefined;
  if (!rawUrl) {
    res.status(400).send("url param required");
    return;
  }

  let targetUrl: string;
  let referer: string | undefined;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    referer = rawReferer ? decodeURIComponent(rawReferer) : undefined;
  } catch {
    res.status(400).send("Invalid url param");
    return;
  }

  try {
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (referer) fetchHeaders["Referer"] = referer;

    const upstream = await fetch(targetUrl, { headers: fetchHeaders });

    if (!upstream.ok) {
      res.status(upstream.status).send("Upstream error");
      return;
    }

    const text = await upstream.text();

    // Convert SRT → WebVTT if needed
    let body = text;
    if (!text.trimStart().startsWith("WEBVTT")) {
      body = "WEBVTT\n\n" + text
        .replace(/\r\n/g, "\n")
        .replace(/(\d+:\d+:\d+),(\d+)/g, "$1.$2"); // SRT comma → VTT dot
    }

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "text/vtt; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(body);
  } catch (err) {
    req.log.error({ err }, "Subtitle proxy failed");
    res.status(500).send("Subtitle proxy failed");
  }
});

/**
 * Download proxy — fetches any video/subtitle URL server-side to bypass CORS
 * GET /api/anime/download-proxy?url=...&filename=...&referer=...
 */
router.get("/anime/download-proxy", async (req, res) => {
  const rawUrl      = req.query.url      as string | undefined;
  const rawFilename = req.query.filename as string | undefined;
  const rawReferer  = req.query.referer  as string | undefined;

  if (!rawUrl) {
    res.status(400).send("url param required");
    return;
  }

  let targetUrl: string;
  let filename: string;
  let referer: string | undefined;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    filename  = rawFilename ? decodeURIComponent(rawFilename) : "episode.mp4";
    referer   = rawReferer  ? decodeURIComponent(rawReferer)  : undefined;
  } catch {
    res.status(400).send("Invalid params");
    return;
  }

  try {
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
    };
    if (referer) {
      fetchHeaders["Referer"]        = referer;
      fetchHeaders["Origin"]         = new URL(referer).origin;
    }

    const upstream = await fetch(targetUrl, { headers: fetchHeaders });
    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    res.set("Content-Disposition", `attachment; filename="${filename}"`);
    res.set("Content-Type", contentType);
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-store");
    if (contentLength) res.set("Content-Length", contentLength);

    // Stream the body directly to the client
    if (!upstream.body) {
      res.status(502).send("No body from upstream");
      return;
    }
    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    pump().catch((err) => {
      req.log.warn({ err }, "Download proxy stream error");
      res.end();
    });
  } catch (err) {
    req.log.error({ err }, "Download proxy failed");
    res.status(500).send("Download proxy failed");
  }
});

/**
 * Fetch all title variants for a given anime (MAL ID) — romaji, english,
 * native plus synonyms. Used to improve JKAnime slug-search coverage.
 */
async function fetchAnilistTitles(anilistId: string): Promise<string[]> {
  try {
    const j = await jikanFetch(`/anime/${encodeURIComponent(anilistId)}/full`);
    const m = j?.data;
    if (!m) return [];
    const titles: string[] = [];
    if (typeof m.title === "string") titles.push(m.title);
    if (typeof m.title_english === "string") titles.push(m.title_english);
    if (typeof m.title_japanese === "string") titles.push(m.title_japanese);
    if (Array.isArray(m.title_synonyms)) {
      for (const s of m.title_synonyms) if (typeof s === "string") titles.push(s);
    }
    if (Array.isArray(m.titles)) {
      for (const t of m.titles) if (t && typeof t.title === "string") titles.push(t.title);
    }
    // Deduplicate while preserving order
    const seen = new Set<string>();
    return titles.filter((s) => {
      const k = s.toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch {
    return [];
  }
}

/**
 * JKAnime — subtítulos en español (modo LAT del frontend)
 * GET /api/anime/animeflv-watch?title=...&episode=N&animeId=ANILIST_ID
 */
router.get("/anime/animeflv-watch", optAuth, async (req: AuthReq, res) => {
  const title = (req.query.title as string | undefined)?.trim();
  const episode = parseInt(req.query.episode as string);
  const animeId = (req.query.animeId as string | undefined)?.trim();
  if (!title || !episode || isNaN(episode)) {
    res.status(400).json({ error: "Query params 'title' and 'episode' are required" });
    return;
  }
  try {
    // Fetch romaji/native titles from AniList to improve JKAnime slug matching
    let extraTitles: string[] = [];
    if (animeId && /^\d+$/.test(animeId)) {
      const anilistTitles = await fetchAnilistTitles(animeId);
      // Exclude the already-provided title to avoid duplicates
      extraTitles = anilistTitles.filter(t => t.toLowerCase().trim() !== title.toLowerCase().trim());
    }
    const data = await getJkAnimeWatch(title, episode, extraTitles, animeId);
    res.json(data);
  } catch (err) {
    req.log.warn({ err, title, episode, animeId }, "JKAnime (LAT/español) watch failed");
    res.status(404).json({ error: "No se encontró el episodio subtitulado en español" });
  }
});

/**
 * AnimeFLV — Search Spanish anime
 * GET /api/anime/animeflv-search?q=...
 */
router.get("/anime/animeflv-search", async (req, res) => {
  const query = (req.query.q as string | undefined)?.trim();
  if (!query) {
    res.status(400).json({ error: "Query param 'q' is required" });
    return;
  }
  try {
    const { searchAnimeFLV } = await import("../lib/animeflv.js");
    const results = await searchAnimeFLV(query);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "AnimeFLV search failed");
    res.status(500).json({ error: "AnimeFLV search failed" });
  }
});

export default router;
