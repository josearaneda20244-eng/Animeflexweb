/**
 * IZIFF ANIME — Tarjetas para redes sociales (OpenGraph / Twitter Cards).
 *
 * Los bots de Facebook, X/Twitter, WhatsApp, Telegram, Discord… NO ejecutan JavaScript,
 * así que no ven los meta tags que pone React. vercel.json reescribe SOLO para esos bots
 * /anime/:id, /watch y /manga/:id hacia esta función, que devuelve un HTML mínimo con
 * título, descripción e imagen correctos. Los usuarios normales reciben la SPA de siempre.
 */
const SITE = "https://animeflex.lat";
const SITE_NAME = "IZIFF ANIME";
const API = process.env.IZ_API_URL || "https://animeflex-api-production.up.railway.app/api";
const DEFAULT_IMG = `${SITE}/opengraph.jpg`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (s, max = 200) => {
  const t = String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), ms); })]);
  } finally { clearTimeout(timer); }
}

async function anilist(id) {
  if (!/^\d+$/.test(String(id))) return null;
  const query = `query($id:Int){Media(id:$id,type:ANIME){title{romaji english}description(asHtml:false)bannerImage coverImage{extraLarge large}averageScore format episodes seasonYear genres}}`;
  const res = await withTimeout(fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { id: Number(id) } }),
  }), 3500);
  if (!res.ok) return null;
  const json = await res.json();
  return json && json.data && json.data.Media;
}

async function mangaInfo(id) {
  const res = await withTimeout(fetch(`${API}/manga/info/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } }), 4000);
  if (!res.ok) return null;
  return res.json();
}

function page({ title, description, image, url, type, imageAlt }) {
  const t = esc(title), d = esc(description), i = esc(image || DEFAULT_IMG), u = esc(url), a = esc(imageAlt || title);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="es_LA">
<meta property="og:type" content="${esc(type)}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${i}">
<meta property="og:image:secure_url" content="${i}">
<meta property="og:image:alt" content="${a}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${i}">
<meta name="twitter:image:alt" content="${a}">
<meta name="theme-color" content="#000000">
</head><body style="background:#000;color:#fff;font-family:sans-serif">
<h1>${t}</h1><p>${d}</p><p><a href="${u}" style="color:#a5b4fc">Abrir en ${SITE_NAME}</a></p>
</body></html>`;
}

module.exports = async function handler(req, res) {
  const q = req.query || {};
  const kind = String(q.kind || "");
  let meta = {
    title: `${SITE_NAME} — Anime y manga en 1080p sub español`,
    description: "Mira anime y lee manga online en 1080p con subtítulos en español. Web, Android y Windows.",
    image: DEFAULT_IMG,
    url: SITE,
    type: "website",
  };

  try {
    if (kind === "anime" || kind === "watch") {
      const id = String(q.id || q.animeId || "");
      const m = await anilist(id).catch(() => null);
      const name = (m && (m.title.english || m.title.romaji)) || String(q.animeTitle || "Anime");
      const ep = String(q.episodeNum || q.ep || "").replace(/[^\d.]/g, "");
      const img = (m && (m.bannerImage || m.coverImage.extraLarge || m.coverImage.large)) || String(q.animeImage || "") || DEFAULT_IMG;
      const score = m && m.averageScore ? ` ★ ${(m.averageScore / 10).toFixed(1)}` : "";
      if (kind === "watch" && ep) {
        meta = {
          title: `${name} · Episodio ${ep} | ${SITE_NAME}`,
          description: clean(`Mira ${name} episodio ${ep} online en HD con subtítulos en español.${score ? ` Valoración${score}.` : ""} ${m ? clean(m.description, 120) : ""}`),
          image: img,
          url: `${SITE}/anime/${encodeURIComponent(id)}`,
          type: "video.episode",
          imageAlt: `${name} episodio ${ep}`,
        };
      } else {
        const bits = [m && m.format, m && m.episodes ? `${m.episodes} episodios` : null, m && m.seasonYear].filter(Boolean).join(" · ");
        meta = {
          title: `Ver ${name} sub español | ${SITE_NAME}`,
          description: clean(`${bits ? `${bits}.${score}` : score} ${m ? m.description : `Mira ${name} online en HD.`}`),
          image: img,
          url: `${SITE}/anime/${encodeURIComponent(id)}`,
          type: m && m.format === "MOVIE" ? "video.movie" : "video.tv_show",
          imageAlt: name,
        };
      }
    } else if (kind === "manga") {
      const id = String(q.id || "");
      const m = await mangaInfo(id).catch(() => null);
      const t = m && m.title;
      const name = (typeof t === "string" ? t : t && (t.english || t.romaji)) || "Manga";
      const chapter = q.chapter ? (m && Array.isArray(m.chapters) ? m.chapters.find((c) => c.id === q.chapter) : null) : null;
      meta = {
        title: chapter ? `${name} · Capítulo ${chapter.chapterNumber} | ${SITE_NAME}` : `Leer ${name} en español | ${SITE_NAME}`,
        description: clean(chapter ? `Lee ${name} capítulo ${chapter.chapterNumber} online en HD y en español.` : (m && m.description) || `Lee ${name} online en HD y en español.`),
        image: (m && (m.cover || m.image)) || DEFAULT_IMG,
        url: `${SITE}/manga/${id}${chapter ? `/leer/${chapter.id}` : ""}`,
        type: "book",
        imageAlt: name,
      };
    }
  } catch (_) { /* se devuelve la tarjeta por defecto */ }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).send(page(meta));
};
