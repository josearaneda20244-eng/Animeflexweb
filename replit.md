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

## Known Issues (pre-existing, not regressions)
- A handful of TypeScript errors in `AuthModal.tsx`, `Membership.tsx`, `Settings.tsx` from broken JSX string templates in the original repo. App compiles via Vite (esbuild) and runs correctly; these are tech debt to clean up later.
- Node engine warning: project declares Node 22, environment runs Node 24 — non-blocking.
