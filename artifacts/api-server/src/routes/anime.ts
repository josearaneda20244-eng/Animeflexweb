import { ANIME, META } from "@consumet/extensions";
import { Readable } from "stream";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

let anilist: InstanceType<typeof META.Anilist>;
let animePahe: InstanceType<typeof ANIME.AnimePahe>;

function getAnilist() {
  if (!anilist) anilist = new META.Anilist();
  return anilist;
}

function getAnimePahe() {
  if (!animePahe) animePahe = new ANIME.AnimePahe();
  return animePahe;
}

function titleVariants(title: string): string[] {
  const variants: string[] = [title];
  const noPart = title.replace(/[\s:,\-–]+Part\s+\d+\s*$/i, "").trim();
  if (noPart !== title) variants.push(noPart);
  const noSeason = title.replace(/[\s:,\-–]+(Season\s+\d+|\d+(st|nd|rd|th)\s+Season)\s*$/i, "").trim();
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

const PROXY_HEADERS = {
  Referer: "https://kwik.cx/",
  Origin: "https://kwik.cx",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
};

function getProxyBase(req: any): string {
  // Client passes ?base=<their-own-proxy-url> so we rewrite m3u8 correctly
  const clientBase = req.query.base as string | undefined;
  if (clientBase) return decodeURIComponent(clientBase);

  // Fallback: use x-forwarded headers set by the Replit proxy
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    req.protocol ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.headers.host ||
    "localhost";
  return `${proto}://${host}/api/anime/hls-proxy`;
}

// HLS proxy — pipes streams with proper headers and rewrites m3u8 playlists
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

  try {
    const upstream = await fetch(targetUrl, { headers: PROXY_HEADERS });

    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const isM3U8 =
      targetUrl.includes(".m3u8") ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegURL");

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=60");

    if (isM3U8) {
      res.set("Content-Type", "application/vnd.apple.mpegurl");
      const text = await upstream.text();
      const baseUrl = targetUrl.slice(0, targetUrl.lastIndexOf("/") + 1);
      const proxyBase = getProxyBase(req);
      const selfUrl = `${proxyBase}?url=`;

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed === "") return line;

          // Rewrite encryption key URI inside #EXT-X-KEY line
          if (trimmed.startsWith("#EXT-X-KEY")) {
            return line.replace(/URI="([^"]+)"/, (_match, uri) => {
              const absUri = uri.startsWith("http") ? uri : baseUrl + uri;
              return `URI="${selfUrl}${encodeURIComponent(absUri)}"`;
            });
          }

          // Skip other # lines
          if (trimmed.startsWith("#")) return line;

          // Segment URL lines
          const absUrl = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
          return selfUrl + encodeURIComponent(absUrl);
        })
        .join("\n");

      res.send(rewritten);
    } else {
      // Binary data — pipe directly (segments, keys, etc.)
      res.set("Content-Type", contentType);
      const nodeStream = Readable.fromWeb(upstream.body as any);
      nodeStream.pipe(res);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Proxy failed" });
    }
  }
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
    const data = await getAnimePahe().fetchRecentEpisodes(1);
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
    const data = await getAnimePahe().fetchAnimeInfo(id);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch anime info");
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
    const data = await getAnimePahe().search(query);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to search on AnimePahe");
    res.status(500).json({ error: "Failed to search on AnimePahe" });
  }
});

router.get("/anime/info-by-title", async (req, res) => {
  const title = req.query.title as string;
  if (!title || !title.trim()) {
    res.status(400).json({ error: "Query param 'title' is required" });
    return;
  }

  const variants = titleVariants(title.trim());
  req.log.info({ title, variants }, "Looking up anime by title");

  for (const variant of variants) {
    try {
      const searchResults = await getAnimePahe().search(variant);
      const first = searchResults.results?.[0];
      if (first?.id) {
        const data = await getAnimePahe().fetchAnimeInfo(first.id as string);
        req.log.info({ variant, id: first.id }, "Found anime info");
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
  try {
    const data = await getAnimePahe().fetchEpisodeSources(episodeId.trim());
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch episode sources");
    res.status(500).json({ error: "Failed to fetch episode sources" });
  }
});

export default router;
