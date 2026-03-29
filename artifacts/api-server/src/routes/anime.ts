import { ANIME, META } from "@consumet/extensions";
import { createDecipheriv } from "crypto";
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

const PROXY_HEADERS = {
  Referer: "https://kwik.cx/",
  Origin: "https://kwik.cx",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
};

// Simple in-memory key cache (keys are small, 16 bytes each)
const keyCache = new Map<string, Buffer>();

async function fetchKey(keyUrl: string): Promise<Buffer> {
  if (keyCache.has(keyUrl)) return keyCache.get(keyUrl)!;
  const resp = await fetch(keyUrl, { headers: PROXY_HEADERS });
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

  try {
    const upstream = await fetch(targetUrl, { headers: PROXY_HEADERS });
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
        fetchKey(keyUrl),
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
