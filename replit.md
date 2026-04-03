# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## AnimeFlex Web — React+Vite Web App (artifacts/anime-web)

A full-featured anime streaming web app built with React + Vite + Tailwind + Wouter. Deployable to Vercel.
Preview path: `/anime-web/`

### Features
- **Membership system**: MegaFan tier ($4/month via Stripe) — no ads, VIP badge, manage via Stripe portal
- **Home**: Hero banner, trending, popular, recent episodes, continue watching
- **Search**: Real-time debounce search with genre/status filters and quick tags
- **Anime Detail**: Cover, genres, description, episode list, characters carousel, YouTube trailer modal, recommendations section, studio name
- **Player**: Plyr + HLS.js — theater mode, speed control, quality selector, subtitles in Spanish
- **Favorites & History**: Persisted in localStorage (no backend needed)
- **Mi Lista (Watch List)**: Mark anime as Viendo/Completado/Pendiente — persisted in localStorage, dedicated /watchlist page
- **PWA**: manifest.json added, installable on mobile
- **Page transitions**: CSS fade-in animation on route changes
- **Lazy loading**: All images use loading="lazy"
- **API**: All calls to `/api` (api-server artifact, no CORS issues in Replit)

### Key files (anime-web)
- `artifacts/anime-web/src/App.tsx` — routing + context providers
- `artifacts/anime-web/src/pages/Player.tsx` — Plyr + HLS.js player with theater mode
- `artifacts/anime-web/src/pages/AnimeDetail.tsx` — rich detail page with characters, trailer, recommendations
- `artifacts/anime-web/src/pages/WatchList.tsx` — Mi Lista page
- `artifacts/anime-web/src/lib/consumet.ts` — API client with AnimeCharacter, AnimeTrailer types
- `artifacts/anime-web/src/context/` — Favorites, History, WatchProgress, WatchList contexts
- `artifacts/anime-web/public/manifest.json` — PWA manifest

---

## AnimeFLEX — Anime Mobile App (AnimeKai-style)

A professional anime streaming app built with Expo. Inspired by AnimeKai.to design.

### Features
- **Hero banner** with horizontal carousel (trending anime, arrows + dots navigation)
- **5 home sections**: Trending, Latest Episodes, Popular, Top Anime (ranked list), Genres
- **Horizontal carousels** for all content sections with skeleton loading states
- **Portrait cards** (Trending/Popular) with SUB badge, episode count, rating, type chip
- **Landscape cards** (Recent Episodes) with play overlay, HD/EP badges
- **Search screen** with real-time debounce, genre filters, status filters
- **Favorites screen** (bookmark any anime with heart button on cards)
- **History screen** with grouped sections (Today/Yesterday/Week/Older) and clear option
- **Detail screen** with cover image, poster, expandable description, episode list, play Ep1 button
- **Player screen** with HLS streaming, quality selector, subtitle list, info card
- **History auto-saved** when user plays any episode

### Color palette (AnimeKai-inspired)
- Background: `#090A12` (very dark blue-black)
- Cards: `#13131C`
- Primary: `#6C63FF` (vibrant purple-indigo)
- Accent: `#A78BFA`, Cyan: `#06B6D4`, Pink: `#EC4899`

### Key files
- `artifacts/anime-app/` — Expo React Native app
- `artifacts/anime-app/app/(tabs)/index.tsx` — Home (hero + 5 sections)
- `artifacts/anime-app/app/(tabs)/search.tsx` — Search with real-time + filters
- `artifacts/anime-app/app/(tabs)/favorites.tsx` — Favorites list
- `artifacts/anime-app/app/(tabs)/history.tsx` — Watch history (new)
- `artifacts/anime-app/app/detail/[id].tsx` — Detail + episode list
- `artifacts/anime-app/app/player.tsx` — HLS video player with quality selector
- `artifacts/anime-app/context/FavoritesContext.tsx` — favorites via AsyncStorage
- `artifacts/anime-app/context/HistoryContext.tsx` — watch history via AsyncStorage (new)
- `artifacts/anime-app/lib/consumet.ts` — API client for the anime routes
- `artifacts/api-server/src/routes/anime.ts` — anime routes using @consumet/extensions

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
