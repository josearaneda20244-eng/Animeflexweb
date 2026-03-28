import { ANIME, META } from "@consumet/extensions";
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
  if (!title) {
    res.status(400).json({ error: "Query param 'title' is required" });
    return;
  }
  try {
    const searchResults = await getAnimePahe().search(title);
    const first = searchResults.results?.[0];
    if (!first) {
      res.status(404).json({ error: "Anime not found on AnimePahe" });
      return;
    }
    const data = await getAnimePahe().fetchAnimeInfo(first.id as string);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch anime info by title");
    res.status(500).json({ error: "Failed to fetch anime info by title" });
  }
});

router.get("/anime/watch", async (req, res) => {
  const episodeId = req.query.episodeId as string;
  if (!episodeId) {
    res.status(400).json({ error: "Query param 'episodeId' is required" });
    return;
  }
  try {
    const data = await getAnimePahe().fetchEpisodeSources(episodeId);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch episode sources");
    res.status(500).json({ error: "Failed to fetch episode sources" });
  }
});

export default router;
