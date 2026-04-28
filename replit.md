# AnimeFlex Web — Replit Workspace

## Overview
AnimeFLEX is an anime streaming web app in Spanish. Cloned from https://github.com/josearaneda20244-eng/Animeflexweb. The project is a pnpm monorepo with two artifacts plus a mockup sandbox.

## Architecture

### Artifacts
- **artifacts/anime-web** — React 19 + Vite 7 + Tailwind 4 frontend (the user-facing site).
- **artifacts/api-server** — Express 5 + Drizzle ORM + PostgreSQL backend (REST API at `/api/*`).
- **artifacts/mockup-sandbox** — Component preview environment.

### Frontend stack
- React 19, Vite 7, Tailwind v4, wouter (routing), TanStack Query, framer-motion 12, lucide-react, radix-ui, plyr + hls.js (player), tw-animate-css.
- Brand identity: dark cinematic "system / cyberpunk" aesthetic with deep red `#DC2626` and orange `#F97316` accents. Custom HUD components in `src/components/SystemUI.tsx` (CornerBrackets, ScanLines, SystemTag) used throughout for the bracketed-monospace "terminal" feel.
- Routes (Wouter): `/` Home, `/anime/:id` AnimeDetail, `/watch?animeId=&episodeId=...` Player, plus Manga, Noticias, Películas, Favoritos, Historial, Membresía, Settings, Profile, Admin, Feed.

### Backend stack
- Express 5 + Drizzle ORM + PostgreSQL, JWT auth (httpOnly cookies), bcrypt, nodemailer.
- Routes mounted in `artifacts/api-server/src/routes/index.ts`: health, storage, manga, news, anime, auth, publicUser, comments, ratings, announcements, search, home, user, admin, membership.

### Contexts (frontend state)
- `AuthContext`, `WatchListContext`, `FavoritesContext`, `HistoryContext`, `WatchProgressContext` in `src/context/`.

### External APIs (consumed via `src/lib/`)
- `consumet.ts` — Episodes, streaming sources, animeflv fallback.
- `anilist.ts` — Anime metadata, airing schedule, characters.

## Environment
- **DATABASE_URL** — set (Replit Postgres).
- **SESSION_SECRET** — set.
- **JWT_SECRET** — NOT set yet (may be required for auth flows).

## Recent Work
- **2026-04-28**: Redesigned the three main pages (Dashboard `Home.tsx`, `AnimeDetail.tsx`, `Player.tsx`) with cinematic system aesthetic. Added new widgets including "Continue Watching" rail with progress bars, sticky "play next episode" CTA, theater-mode player chrome, floating mini info bar, refined episode list with watched/in-progress markers, polished membership upsell modal, staggered reveals, and micro-interactions throughout.
- **2026-04-28 (later)**: Player perceived-load and visual polish:
  - **Streaming source prefetch** in `AnimeDetail.tsx` via `useQueryClient().prefetchQuery` using the *same* query keys Player.tsx consumes (`["stream", episodeId, animeTitle, episodeNum, animeId]` and `["animeflv", animeTitle, episodeNum, animeId]`). Triggers: 800ms after episodes load (warms next-to-watch episode), on episode-card hover/touchstart, and synchronously inside `handleEpisode` BEFORE navigation. Result: by the time Player mounts, the request is in-flight or cached, so the loading screen often disappears immediately.
  - **PlayerLoadingScreen** component (top of `Player.tsx`): blurred `animeImage` backdrop, crimson radial glow, scan lines, dual counter-rotating rings + pulsing core, EP pill, anime title, rotating status messages every 1.8s ("Conectando con servidores..." → "Buscando la mejor fuente..." → ...), indeterminate shimmer progress bar, and a hint after 6s. Replaces the bare `Loader2 + "Buscando fuentes de video..."` block.
  - **Episode list polish** in `AnimeDetail.tsx`: in-progress episode now glows red, accent stripe on left edge for watched/in-progress, larger 10×10 number badge with red gradient when in-progress, "EN CURSO" pill, "VISTO" badge upgraded to pill with check icon, hover prefetches stream.

- **2026-04-28 (round 3)**: Major round to address user feedback ("changes too subtle, player still slow"):
  - **Backend `/anime/watch` racing**: Replaced the sequential AnimeKai-first cascade in `artifacts/api-server/src/routes/anime.ts` with a true `Promise.any` race across ALL 7 attempt branches at once (AnimeKai-direct via token, AnimeKai-anilist, AnimeKai-search, HiAnime, AnimePahe, KickAssAnime, JKAnime). Each branch wraps its result in `requirePlayable` so non-M3U8 responses are rejected and the race continues. Reduced AnimeKai retry attempts from 4 to 2 and backoff from 600/1200/2400ms to 400/800ms. Expected p50 drop from ~5-15s to ~1-3s because cheap providers no longer wait for the AnimeKai retry storm.
  - **AnimeDetail hero**: Hero height bumped from 60vw/420px max to 78vw/560px max. Added grid-line overlay, orange accent radial in bottom-left, larger crimson glow, ScanLines, 26px CornerBrackets. **Floating title block** absolutely positioned on the hero with studio kicker, clamp-sized title (28-56px) with crimson drop shadow, native title.
  - **Stats grid**: Genres are now pill chips with crimson gradient + border. Stats (rating/type/episodes/year) became distinct glassmorphic cards with icon + value + unit (rating uses amber accent). "EN EMISIÓN" badge on the poster for ongoing series.
  - **Primary CTA**: "Reproducir" / "Continuar Ep. N" became a large 16/28px button with circular play badge, two-line label (kicker + main), animated white shine sweep, and a 14px/40px crimson glow shadow.
  - **Description**: Quote-style card with big serif quotation mark, "Sinopsis" header with section accent, gradient crimson border, line-clamp-4 default, prettier "Leer más" pill button.
  - **Bug fix**: Player.tsx was missing `import { motion, AnimatePresence } from "framer-motion"` after round 2 — added it. App was compiling via esbuild but tsc was failing.

## Known Issues (pre-existing, not regressions)
- A handful of TypeScript errors in `AuthModal.tsx`, `Membership.tsx`, `Settings.tsx` from broken JSX string templates in the original repo. App compiles via Vite (esbuild) and runs correctly; these are tech debt to clean up later.
- Node engine warning: project declares Node 22, environment runs Node 24 — non-blocking.
