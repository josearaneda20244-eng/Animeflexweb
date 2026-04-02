import { ANIME, META } from "@consumet/extensions";
import { createDecipheriv } from "crypto";
import { Readable } from "stream";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

let anilist: InstanceType<typeof META.Anilist>;
let animeKai: InstanceType<typeof ANIME.AnimeKai>;

function getAnilist() {
  if (!anilist) anilist = new META.Anilist();
  return anilist;
}

function getAnimeKai() {
  if (!animeKai) animeKai = new ANIME.AnimeKai();
  return animeKai;
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
  // Evict oldest if cache grows too large
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
 *
 * For m3u8 files:
 *   - Removes the #EXT-X-KEY encryption header (client won't see encrypted content)
 *   - Rewrites segment URLs to point at this proxy with the key and sequence number
 *
 * For segment files:
 *   - Fetches from CDN, decrypts with AES-128-CBC, returns raw MPEG-TS
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

  // The key and sequence are set when this proxy URL was generated for a segment
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
      // --- Playlist rewriting ---
      res.set("Content-Type", "application/vnd.apple.mpegurl");
      const text = await upstream.text();
      const baseUrl = targetUrl.slice(0, targetUrl.lastIndexOf("/") + 1);

      // Determine the self-base for rewriting links
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

      // Parse #EXT-X-MEDIA-SEQUENCE
      const seqMatch = text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
      if (seqMatch) mediaSeq = parseInt(seqMatch[1], 10);

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed === "") return line;

          // Capture current key URL — but remove from output (server decrypts)
          if (trimmed.startsWith("#EXT-X-KEY")) {
            const uriMatch = trimmed.match(/URI="([^"]+)"/);
            if (uriMatch) {
              currentKeyUrl = uriMatch[1].startsWith("http")
                ? uriMatch[1]
                : baseUrl + uriMatch[1];
            }
            // Strip the key tag — client receives plain MPEG-TS
            return "";
          }

          // Leave other # tags alone
          if (trimmed.startsWith("#")) return line;

          // Segment URL
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
            // Also pass base so sub-playlists are handled (multi-bitrate)
            newUrl += `&base=${encodeURIComponent(selfBase)}`;
          }
          return newUrl;
        })
        .join("\n");

      res.send(rewritten);
    } else if (rawKey) {
      // --- Encrypted segment: decrypt and serve ---
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
        // Decryption failed — serve raw and let the player figure it out
        res.set("Content-Type", "video/MP2T");
        res.send(encryptedBuf);
      }
    } else {
      // --- Unencrypted binary (key file, unencrypted segments) ---
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
 * Serves a self-contained HTML page that plays an HLS stream using HLS.js.
 * HLS.js supports full seeking in any browser, unlike native <video>.
 *
 * Query params:
 *   m3u8  — the (encoded) proxy URL of the m3u8 playlist
 *   title — optional string shown in the page title
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

  const title = (req.query.title as string | undefined) ?? "AniFlow";

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Access-Control-Allow-Origin", "*");
  res.set("X-Frame-Options", "ALLOWALL");
  res.set("Cache-Control", "no-cache");

  // language=html
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title.replace(/</g, "&lt;")}</title>
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
      border-top-color: #a855f7;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loadMsg { color: rgba(255,255,255,0.7); font-size: 13px; }
    #errIcon { font-size: 36px; }
    #errMsg { color: #f87171; font-weight: 600; font-size: 15px; }
    #retryBtn {
      display: none; pointer-events: all;
      background: #a855f7; color: #fff; border: none;
      padding: 10px 28px; border-radius: 10px;
      cursor: pointer; font-size: 14px; font-weight: 700;
      transition: background .15s;
    }
    #retryBtn:hover { background: #9333ea; }
    /* Skip feedback */
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

  // Prevent arrow keys from bubbling up to parent (which would trigger browser back/forward)
  window.addEventListener('keydown', function(e) {
    const nav = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Backspace'];
    if (nav.includes(e.key)) {
      e.stopPropagation();
      // Manual seek with left/right
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

  // Ensure the page captures focus so keyboard events work
  document.addEventListener('click', () => window.focus(), { once: true });
  window.focus();
  load();
</script>
</body>
</html>`);
});

router.get("/anime/trending", async (req, res) => {
  try {
    const data = await getAnilist().fetchTrendingAnime(1, 24);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trending anime");
    res.status(500).json({ error: "Failed to fetch trending anime" });
  }
});

router.get("/anime/popular", async (req, res) => {
  try {
    const data = await getAnilist().fetchPopularAnime(1, 24);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch popular anime");
    res.status(500).json({ error: "Failed to fetch popular anime" });
  }
});

router.get("/anime/recent", async (req, res) => {
  try {
    // Use airing schedule for the current week as "recently airing" content
    const now = new Date();
    const weekStart = Math.floor(now.getTime() / 1000) - 7 * 24 * 60 * 60;
    const weekEnd = Math.floor(now.getTime() / 1000) + 24 * 60 * 60;
    const data = await getAnilist().fetchAiringSchedule(1, 24, weekStart, weekEnd, false);
    res.json(data);
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
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to search anime");
    res.status(500).json({ error: "Failed to search anime" });
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
    req.log.error({ err }, "Failed to fetch anime info");
    res.status(500).json({ error: "Failed to fetch anime info" });
  }
});

router.get("/anime/anilist-info", async (req, res) => {
  const id = req.query.id as string;
  if (!id) {
    res.status(400).json({ error: "Query param 'id' is required" });
    return;
  }
  try {
    // Direct AniList GraphQL query — fast, no external provider dependency
    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { romaji english native userPreferred }
          description(asHtml: false)
          coverImage { extraLarge large medium color }
          bannerImage
          genres
          status
          format
          episodes
          duration
          season
          seasonYear
          averageScore
          popularity
          studios(isMain: true) { nodes { name } }
          streamingEpisodes { title thumbnail url site }
          relations {
            edges {
              relationType
              node {
                id
                title { userPreferred }
                coverImage { medium }
                format
                episodes
              }
            }
          }
        }
      }
    `;
    const resp = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { id: parseInt(id) } }),
    });
    if (!resp.ok) throw new Error(`AniList GraphQL error: ${resp.status}`);
    const json = (await resp.json()) as {
      data: { Media: Record<string, unknown> };
      errors?: { message: string }[];
    };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    const media = json.data.Media as any;

    // Build episodes list from streamingEpisodes metadata (no external provider)
    const streamingEps: { title?: string; thumbnail?: string; url?: string; site?: string }[] =
      media.streamingEpisodes ?? [];

    // For ongoing anime, AniList may not have a total episode count;
    // use the number of known streaming episodes as a lower bound.
    const episodeCount: number = media.episodes ?? streamingEps.length ?? 0;

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
        image: meta?.thumbnail ?? null,
        url: meta?.url ?? null,
      };
    });

    const result = {
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
      episodes,
    };

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch anilist anime info");
    res.status(500).json({ error: "Failed to fetch anime info" });
  }
});

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

router.get("/anime/watch", async (req, res) => {
  const episodeId = req.query.episodeId as string;
  if (!episodeId || !episodeId.trim()) {
    res.status(400).json({ error: "Query param 'episodeId' is required" });
    return;
  }
  const id = episodeId.trim();
  try {
    const data = await getAnimeKai().fetchEpisodeSources(id);
    res.json(data);
    return;
  } catch (firstErr: any) {
    const msg = (firstErr?.message ?? "").toLowerCase();
    if (!msg.includes("not found") && !msg.includes("server")) {
      req.log.error({ err: firstErr }, "Failed to fetch episode sources");
      res.status(500).json({ error: "Failed to fetch episode sources" });
      return;
    }
    // The default server wasn't found — try fetching servers and use first URL directly
    try {
      req.log.warn({ episodeId: id }, "Default server not found, trying fallback via fetchEpisodeServers");
      const servers = await getAnimeKai().fetchEpisodeServers(id);
      if (!servers || servers.length === 0) {
        res.status(503).json({ error: "No streaming servers available for this episode" });
        return;
      }
      // Try each server URL directly (passing URL as episodeId triggers direct extraction)
      for (const server of servers) {
        try {
          const data = await getAnimeKai().fetchEpisodeSources(server.url);
          req.log.info({ server: server.name }, "Fallback server succeeded");
          res.json(data);
          return;
        } catch {
          // try next server
        }
      }
      res.status(503).json({ error: "All streaming servers failed for this episode" });
    } catch (fallbackErr) {
      req.log.error({ err: fallbackErr }, "Fallback server fetch also failed");
      res.status(500).json({ error: "Failed to fetch episode sources" });
    }
  }
});

export default router;
