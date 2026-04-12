import { ANIME, META } from "@consumet/extensions";
import { createDecipheriv } from "crypto";
import { getAnimeFLVWatch } from "../lib/animeflv.js";
import { getJkAnimeWatch } from "../lib/jkanime.js";
import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET!;

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

let anilist: InstanceType<typeof META.Anilist>;
let animeKai: InstanceType<typeof ANIME.AnimeKai>;
let anilistWithKai: InstanceType<typeof META.Anilist>;
let gogoanime: InstanceType<typeof ANIME.Hianime>;

function getAnilist() {
  if (!anilist) anilist = new META.Anilist();
  return anilist;
}

function getAnimeKai() {
  if (!animeKai) animeKai = new ANIME.AnimeKai();
  return animeKai;
}

function getGogoanime() {
  if (!gogoanime) gogoanime = new ANIME.Hianime();
  return gogoanime;
}

/**
 * AniList wrapper that uses AnimeKai as the streaming provider.
 * This leverages AniList's ID-to-AnimeKai mapping, giving us access to
 * AnimeKai's full library without unreliable title-based search.
 */
function getAnilistWithKai() {
  if (!anilistWithKai) anilistWithKai = new META.Anilist(new ANIME.AnimeKai());
  return anilistWithKai;
}

function titleVariants(title: string): string[] {
  const variants: string[] = [title];
  const noPart = title.replace(/[\s:,\-–]+Part\s+\d+\s*$/i, "").trim();
  if (noPart !== title) variants.push(noPart);
  const noSeason = title
    .replace(/[\s:,\-–]+(Season\s+\d+|\d+(st|nd|rd|th)\s+Season)\s*$/i, "")
    .trim();
  if (noSeason !== title && noSeason !== noPart) variants.push(noSeason);
  const colonIdx = title.indexOf(":");
  if (colonIdx > 0) {
    const beforeColon = title.slice(0, colonIdx).trim();
    if (!variants.includes(beforeColon)) variants.push(beforeColon);
  }
  const words = title.split(" ").slice(0, 4).join(" ");
  if (!variants.includes(words) && words.length > 3) variants.push(words);
  return [...new Set(variants)];
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

  try {
    const upstream = await fetch(targetUrl, { headers: proxyHeaders });
    if (!upstream.ok) {
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
      if (cl) res.set("Content-Length", cl);
      res.set("Content-Type", contentType || "application/octet-stream");
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

router.get("/anime/trending", async (req, res) => {
  try {
    const data = await getAnilist().fetchTrendingAnime(1, 28);
    const results = (data.results || []).filter((a: any) => isAnimeFormat(a.type));
    res.json({ currentPage: data.currentPage, hasNextPage: data.hasNextPage, results });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trending anime");
    res.status(500).json({ error: "Failed to fetch trending anime" });
  }
});

router.get("/anime/popular", async (req, res) => {
  try {
    const data = await getAnilist().fetchPopularAnime(1, 28);
    const results = (data.results || []).filter((a: any) => isAnimeFormat(a.type));
    res.json({ currentPage: data.currentPage, hasNextPage: data.hasNextPage, results });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch popular anime");
    res.status(500).json({ error: "Failed to fetch popular anime" });
  }
});

router.get("/anime/recent", async (req, res) => {
  try {
    const data = await getAnilist().fetchRecentEpisodes(undefined, 1, 28);
    const results = (data.results || []).filter((a: any) => isAnimeFormat(a.type));
    res.json({ currentPage: data.currentPage, hasNextPage: data.hasNextPage, results });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recent episodes");
    res.status(500).json({ error: "Failed to fetch recent episodes" });
  }
});

router.get("/anime/search", async (req, res) => {
  const query = req.query.q as string;
  const page = Number(req.query.page) || 1;
  if (!query) {
    res.status(400).json({ error: "Query param 'q' is required" });
    return;
  }
  try {
    const data = await getAnilist().search(query, page, 24);
    const results = (data.results || []).filter((a: any) => isAnimeFormat(a.type));
    res.json({ currentPage: data.currentPage, hasNextPage: data.hasNextPage, results });
  } catch (err) {
    req.log.error({ err }, "Failed to search anime");
    res.status(500).json({ error: "Failed to search anime" });
  }
});

/**
 * Fetch anime by Anilist format (MOVIE, OVA, ONA, SPECIAL), sorted by popularity.
 * Uses AniList GraphQL API directly for reliability.
 * GET /api/anime/by-format?format=MOVIE&page=1
 */
const byFormatCache = new Map<string, { data: unknown; expires: number }>();

const ANILIST_GQL = "https://graphql.anilist.co";

async function anilistByFormat(format: string, page: number, perPage = 24) {
  const query = `
    query ($format: MediaFormat, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { currentPage hasNextPage }
        media(type: ANIME, format: $format, sort: POPULARITY_DESC, isAdult: false) {
          id
          title { romaji english native userPreferred }
          coverImage { extraLarge large }
          averageScore
          format
          episodes
          status
          genres
        }
      }
    }
  `;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(ANILIST_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { format, page, perPage } }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`AniList GQL error ${resp.status}`);
    const json: any = await resp.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data.Page;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function anilistByFormatFallback(format: string, page: number, perPage = 24) {
  // Fallback A: consumet's Anilist advancedSearch with format as 5th param
  const anilistMeta = getAnilist();
  const data: any = await (anilistMeta as any).advancedSearch(
    undefined,  // query
    "ANIME",    // type
    page,       // page
    perPage,    // perPage
    format      // format — 5th parameter
  );
  const results = ((data?.results) || []).map((m: any) => ({
    id: String(m.id),
    title: m.title ?? { romaji: String(m.title), english: String(m.title) },
    image: m.image ?? "",
    rating: m.rating ?? 0,
    type: m.type ?? format,
    totalEpisodes: m.totalEpisodes ?? 0,
    status: m.status ?? "",
    genres: m.genres ?? [],
  }));
  return {
    media: results,
    pageInfo: { currentPage: page, hasNextPage: data?.hasNextPage ?? false },
    _fromFallback: true,
  };
}

async function anilistByFormatDirect(format: string, page: number, perPage = 24) {
  // Fallback B: public Consumet REST API as last resort
  const url = `https://api.consumet.org/meta/anilist/advanced-search?type=ANIME&format=${format}&page=${page}&perPage=${perPage}&sort=%5B%22POPULARITY_DESC%22%5D`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`consumet.org API error ${resp.status}`);
    const json: any = await resp.json();
    const results = ((json?.results) || []).map((m: any) => ({
      id: String(m.id),
      title: m.title ?? {},
      image: m.image ?? "",
      rating: m.rating ?? 0,
      type: m.type ?? format,
      totalEpisodes: m.totalEpisodes ?? 0,
      status: m.status ?? "",
      genres: m.genres ?? [],
    }));
    return {
      media: results,
      pageInfo: { currentPage: page, hasNextPage: json?.hasNextPage ?? false },
      _fromFallback: true,
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
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
    let page_data: any;
    let usedFallback = false;

    // Attempt 1: direct AniList GraphQL
    try {
      page_data = await anilistByFormat(format, page);
    } catch (err1) {
      req.log.warn({ err1 }, "AniList GQL failed, trying consumet advancedSearch");
      // Attempt 2: consumet Anilist advancedSearch
      try {
        page_data = await anilistByFormatFallback(format, page);
        usedFallback = true;
      } catch (err2) {
        req.log.warn({ err2 }, "consumet advancedSearch failed, trying consumet.org REST API");
        // Attempt 3: public consumet.org REST API
        try {
          page_data = await anilistByFormatDirect(format, page);
          usedFallback = true;
        } catch (err3) {
          req.log.error({ err1, err2, err3 }, "All three methods failed for by-format");
          throw err1;
        }
      }
    }

    const rawItems: any[] = page_data.media || [];
    const results = usedFallback
      ? rawItems  // already normalized in fallback functions
      : rawItems.map((m: any) => ({
          id: String(m.id),
          title: m.title,
          image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? "",
          rating: m.averageScore ?? 0,
          type: m.format ?? format,
          totalEpisodes: m.episodes ?? 0,
          status: m.status,
          genres: m.genres ?? [],
        }));

    const payload = {
      results,
      currentPage: page_data.pageInfo?.currentPage ?? page,
      hasNextPage: page_data.pageInfo?.hasNextPage ?? false,
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
 * Fetch episodes for an anime using its AniList ID.
 * Uses META.Anilist(AnimeKai) which maps AniList IDs to AnimeKai slugs,
 * giving access to the full AnimeKai library without title-based search.
 */
router.get("/anime/episodes", async (req, res) => {
  const anilistId = req.query.anilistId as string;
  if (!anilistId) {
    res.status(400).json({ error: "Query param 'anilistId' is required" });
    return;
  }
  try {
    const data = await getAnilistWithKai().fetchAnimeInfo(anilistId);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch episodes via AniList+AnimeKai");
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

  const FIELDS = `
    id idMal
    title { romaji english native userPreferred }
    description(asHtml: false)
    coverImage { extraLarge large medium color }
    bannerImage genres status format episodes duration season seasonYear
    averageScore popularity
    nextAiringEpisode { episode airingAt }
    studios(isMain: true) { nodes { name } }
    streamingEpisodes { title thumbnail url site }
    trailer { id site }
    characters(sort: [ROLE, RELEVANCE], perPage: 16) {
      edges { role node { id name { full } image { medium } } }
    }
    recommendations(sort: RATING_DESC, perPage: 10) {
      nodes {
        mediaRecommendation {
          id title { userPreferred english romaji }
          coverImage { large medium } averageScore format episodes
        }
      }
    }
    relations {
      edges {
        relationType
        node { id title { userPreferred } coverImage { medium } format episodes }
      }
    }
  `;

  async function queryAnilist(field: "idMal" | "id"): Promise<any | null> {
    try {
      const gql = `query ($id: Int) { Media(${field}: $id, type: ANIME) { ${FIELDS} } }`;
      const resp = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: gql, variables: { id: numId } }),
      });
      if (!resp.ok) return null;
      const json = await resp.json() as { data?: { Media?: any }; errors?: unknown[] };
      if (json.errors?.length || !json.data?.Media) return null;
      return json.data.Media;
    } catch {
      return null;
    }
  }

  try {
    // Query AniList by native AniList ID
    let media = await queryAnilist("id");

    if (!media) {
      res.status(404).json({ error: "Anime not found" });
      return;
    }

    const streamingEps: { title?: string; thumbnail?: string }[] = media.streamingEpisodes ?? [];

    // For airing anime, media.episodes may be null (total not yet known).
    // Use nextAiringEpisode.episode - 1 to count how many have already aired.
    // Fall back to streamingEpisodes length, then 0.
    const airedCount: number | null =
      media.nextAiringEpisode?.episode != null
        ? Math.max(0, media.nextAiringEpisode.episode - 1)
        : null;
    const episodeCount: number =
      media.episodes ?? airedCount ?? streamingEps.length ?? 0;
    const episodes = Array.from({ length: episodeCount }, (_, i) => {
      const num = i + 1;
      const meta = streamingEps.find((e) => {
        const m = e.title?.match(/Episode\s+(\d+)/i);
        return m ? parseInt(m[1]) === num : false;
      });
      return {
        id: `${id}-episode-${num}`,
        number: num,
        title: meta?.title ?? `Episodio ${num}`,
        image: (meta as any)?.thumbnail ?? null,
        url: (meta as any)?.url ?? null,
      };
    });

    const characters = (media.characters?.edges ?? []).map((e: any) => ({
      id: String(e.node?.id),
      name: e.node?.name?.full ?? "",
      image: e.node?.image?.medium ?? "",
      role: e.role ?? "SUPPORTING",
    }));

    const recommendations = (media.recommendations?.nodes ?? [])
      .filter((n: any) => n.mediaRecommendation)
      .map((n: any) => {
        const m = n.mediaRecommendation;
        return {
          id: String(m.id),
          title: m.title?.english || m.title?.userPreferred || m.title?.romaji || "",
          image: m.coverImage?.large ?? m.coverImage?.medium ?? "",
          rating: m.averageScore,
          type: m.format,
          totalEpisodes: m.episodes,
        };
      });

    const trailer = media.trailer?.id
      ? { id: media.trailer.id as string, site: (media.trailer.site ?? "") as string }
      : null;

    res.json({
      id: String(media.id),
      title: media.title,
      image: media.coverImage?.extraLarge ?? media.coverImage?.large ?? "",
      cover: media.bannerImage ?? "",
      description: media.description ?? "",
      genres: media.genres ?? [],
      status: media.status,
      type: media.format,
      totalEpisodes: episodeCount,
      duration: media.duration,
      rating: media.averageScore,
      color: media.coverImage?.color,
      studios: (media.studios?.nodes ?? []).map((s: any) => s.name),
      trailer,
      characters,
      recommendations,
      episodes,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch anilist anime info");
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
      const first = searchResults.results?.[0];
      if (first?.id) {
        const data = await getAnimeKai().fetchAnimeInfo(first.id as string);
        req.log.info({ variant, id: first.id }, "Found anime info on AnimeKai");
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
  try {
    const data = await retryFetch(() => getAnimeKai().fetchEpisodeSources(id), 4, 600);
    res.json(data);
    return;
  } catch (firstErr: any) {
    const msg = (firstErr?.message ?? "").toLowerCase();
    if (!msg.includes("not found") && !msg.includes("server")) {
      req.log.error({ err: firstErr }, "Failed to fetch episode sources");
      res.status(500).json({ error: "Failed to fetch episode sources" });
      return;
    }
    req.log.warn({ episodeId: id }, "Direct fetch failed after retries, trying fallback via fetchEpisodeServers");
    try {
      const servers = await retryFetch(() => getAnimeKai().fetchEpisodeServers(id), 3, 500);
      if (!servers || servers.length === 0) {
        res.status(503).json({ error: "No streaming servers available for this episode" });
        return;
      }
      for (const server of servers) {
        try {
          const data = await retryFetch(() => getAnimeKai().fetchEpisodeSources(server.url), 3, 500);
          req.log.info({ server: server.name }, "Fallback server succeeded");
          res.json(data);
          return;
        } catch { /* try next server */ }
      }
      res.status(503).json({ error: "All streaming servers failed for this episode" });
    } catch (fallbackErr) {
      req.log.error({ err: fallbackErr }, "Fallback server fetch also failed");
      res.status(500).json({ error: "Failed to fetch episode sources" });
    }
  }

  /* ── Gogoanime fallback (only reached if AnimeKai completely failed above) ── */
  if (!res.headersSent && animeTitle && episodeNum) {
    req.log.warn({ animeTitle, episodeNum }, "Trying Gogoanime as secondary provider");
    try {
      const titleVariantList = titleVariants(animeTitle);
      for (const variant of titleVariantList) {
        try {
          const searchData = await retryFetch(() => getGogoanime().search(variant), 2, 400) as any;
          const firstResult = (searchData.results ?? [])[0];
          if (!firstResult) continue;
          const info = await retryFetch(() => getGogoanime().fetchAnimeInfo(firstResult.id as string), 2, 400) as any;
          const ep = (info.episodes ?? []).find((e: any) => String(e.number) === episodeNum);
          if (!ep) continue;
          const data = await retryFetch(() => getGogoanime().fetchEpisodeSources(ep.id as string), 3, 500);
          req.log.info({ provider: "gogoanime", variant }, "Gogoanime fallback succeeded");
          res.json(data);
          return;
        } catch { /* try next variant */ }
      }
      req.log.warn({ animeTitle, episodeNum }, "Gogoanime fallback exhausted all title variants");
    } catch (gogoErr) {
      req.log.error({ err: gogoErr }, "Gogoanime fallback failed");
    }
  }

  if (!res.headersSent) {
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
 * AnimeFLV — Spanish dubbed/subtitled anime streaming
 * GET /api/anime/animeflv-watch?title=...&episode=N
 * (mantenemos la ruta para compatibilidad, internamente usa JKAnime)
 */
router.get("/anime/animeflv-watch", optAuth, async (req: AuthReq, res) => {
  const title = (req.query.title as string | undefined)?.trim();
  const episode = parseInt(req.query.episode as string);
  if (!title || !episode || isNaN(episode)) {
    res.status(400).json({ error: "Query params 'title' and 'episode' are required" });
    return;
  }
  try {
    const data = await getJkAnimeWatch(title, episode);
    res.json(data);
  } catch (err) {
    req.log.warn({ err, title, episode }, "JKAnime watch failed");
    res.status(404).json({ error: "No se encontró el episodio en JKAnime" });
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
