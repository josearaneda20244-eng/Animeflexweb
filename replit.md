# AnimeFlex Workspace

## Overview

AnimeFlex es una plataforma de streaming de anime construida como monorepo pnpm + TypeScript. Migrada de Vercel a Replit en abril 2026.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (puerto 8080)
- **Frontend**: React + Vite (puerto 5000, ruta `/anime-web/`)
- **Database**: PostgreSQL (Neon, via `DATABASE_URL` secret)
- **Auth**: JWT (`JWT_SECRET` secret, 30 días de expiración)
- **Anime data**: `@consumet/extensions` (AniList + AnimeKai)
- **Build**: esbuild (externaliza `@consumet/extensions`)

## Artifacts

| Artifact | Puerto | Ruta | Descripción |
|----------|--------|------|-------------|
| `anime-web` | 5000 | `/anime-web/` | Frontend React/Vite |
| `api-server` | 8080 | `/api` | Backend Express |
| `mockup-sandbox` | 8081 | `/__mockup` | Canvas de diseño |

## Secrets Requeridos

- `DATABASE_URL` — Neon PostgreSQL connection string (ya configurado)
- `JWT_SECRET` — Secreto JWT para tokens de auth (ya configurado)

## Mejoras del Home (abril 2026)

Refactor completo de la página principal con:

- **Banner "Nuevos episodios de tu lista"** (autenticado): compara la watchlist del usuario con AniList vía endpoint nuevo `/api/user/watchlist/new-episodes` (caché 5 min).
- **Selección AnimeFlex**: contenido destacado por el equipo desde panel admin (`admin_content` action `featured`/`highlight`/`destacado`/`pin`), endpoint público `/api/featured-content` (caché 60s).
- **Discusiones activas**: top hilos de comentarios de los últimos 7 días, endpoint público `/api/discussions/active` (caché 60s).
- **Chips de filtros rápidos** debajo del hero: salto a secciones por id + accesos rápidos a Películas, OVAs, búsqueda, Sorpréndeme.
- **Marcado de watchlist en Calendario**: badge "EN MI LISTA" en cards y contador de "X de tu lista emite hoy".
- **Continuar viendo** con botón "Quitar" que borra el progreso (usa `removeProgress` del context).
- **Hero pausable**: se detiene cuando la pestaña está oculta o el sistema pide `prefers-reduced-motion`. Imagen del hero precargada con `fetchpriority="high"` para mejorar LCP.
- **Vista previa de noticias y banner de manga reciente** integrados en el flujo del home.
- **SEO dinámico** con `usePageMeta`: title, description, Open Graph y Twitter Card.
- **Episodios emitidos vs planificados**: las cards muestran `currentEpisode` cuando existe (preferencia sobre `totalEpisodes`) y un badge "LIVE" en animes en emisión.

## API Endpoints Principales

### Auth (`/api/auth/`)
- `POST /api/auth/register` — registro de usuario
- `POST /api/auth/login` — login
- `GET /api/auth/me` — perfil propio (requiere Bearer token)
- `PATCH /api/auth/me` — actualizar perfil

### Usuario (`/api/user/`)
- `GET/POST/DELETE /api/user/favorites` — favoritos
- `GET/PUT/DELETE /api/user/watchlist/:animeId` — watchlist
- `GET/POST /api/user/history` — historial de visionado
- `GET/PUT /api/user/progress/:episodeId` — progreso de episodios
- `GET/POST /api/user/daily-access` — control de límite diario

### Admin (`/api/admin/`) — requiere role `admin` o `owner`
- `GET /api/admin/stats` — estadísticas
- `GET/PATCH /api/admin/users` — gestión de usuarios
- `GET/PUT /api/admin/config` — configuración
- `GET/POST/DELETE /api/admin/content` — contenido destacado
- `GET/DELETE /api/admin/comments` — moderación de comentarios

### Comentarios (`/api/comments/`)
- `GET /api/comments/:animeId` — obtener comentarios
- `POST /api/comments/:animeId` — publicar comentario
- `POST /api/comments/:animeId/:commentId/like` — toggle like
- `DELETE /api/comments/:animeId/:commentId` — eliminar propio comentario

### Anime (`/api/anime/*`) — datos de AniList/AnimeKai
- Búsqueda, detalles, episodios, streaming, subtítulos

## Base de Datos (PostgreSQL/Neon)

Tablas principales:
- `users` — usuarios con roles (user/admin/owner) y membresía (free/megafan)
- `user_favorites`, `user_watchlist`, `user_history` — listas del usuario
- `user_watch_progress` — progreso de reproducción
- `user_daily_views` — control de límite diario (5 eps/día para free)
- `anime_comments`, `comment_likes` — comentarios y likes
- `admin_config`, `admin_content` — configuración del panel admin

Para dar acceso de owner al administrador:
```sql
UPDATE users SET role='owner' WHERE email='josearaneda20244@gmail.com';
```

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — inicia backend (compila + sirve)
- `pnpm --filter @workspace/anime-web run dev` — inicia frontend Vite
- `pnpm --filter @workspace/api-server add <pkg>` — agregar dep al backend

## Notas de Arquitectura

- El frontend usa un proxy en desarrollo: `/api` → `http://localhost:8080`
- `@consumet/extensions` está externalizado en esbuild (no bundleado)
- Las migraciones usan `safeQuery` para ser resilientes si las tablas ya existen
- CORS está configurado con `origin: true` para funcionar con el proxy de Replit


## Refactor Replit (abril 2026)

- Repositorio clonado desde GitHub (`josearaneda20244-eng/Animeflexweb`) y reintegrado al monorepo del workspace conservando los IDs de los artefactos `api-server` y `mockup-sandbox` (corrige conflictos de registro en Replit).
- `anime-web` re-registrado como artifact React/Vite con puerto asignado por la plataforma (`PORT=24976`, ruta base `/`).
- Pantalla de inicio: la franja negra del hero mientras carga la API externa se reemplazó por un `HeroSkeleton` cinematográfico animado (rejilla, brillos rojos, shimmer y barrido) que mantiene la línea visual del sitio durante la espera.
- Endpoint `/api/config/limits`: confirmado que el endpoint público de `routes/user.ts` está activo tras aplicar las migraciones (antes devolvía 404 por estado parcial al primer arranque). Eliminada una definición duplicada accidental.

## Cambios Recientes

- El módulo de manga ahora usa LeerMangaEsp como fuente principal: listado/búsqueda desde su API pública y scraping de ficha, capítulos e imágenes de lectura desde páginas públicas.
- La ficha del anime ahora prioriza la lista completa de episodios de AnimeKai cuando supera la lista parcial de AniList.
- El detalle del anime incluye búsqueda rápida por número o título de episodio para series largas.
- El reproductor abre el panel de episodios en el rango del episodio actual e incluye salto directo por número, selector compacto de rangos y botón de últimos episodios.
- La ruta de reproducción intenta re-resolver episodios recientes con AnimeKai fresco, JKAnime, AnimeFLV y Hianime antes de fallar.
- El frontend inicia fuentes alternativas automáticamente en los últimos episodios o cuando AnimeKai empieza a reintentar, para reducir el bloqueo en capítulos recién publicados.
- El reproductor cambia automáticamente a la siguiente fuente cuando una fuente HLS falla o tarda demasiado, manteniendo AnimeKai como prioridad.
- Los rangos del panel de episodios ahora muestran exactamente la misma tanda visible (por ejemplo, Ep. 101-124 si se listan 24 por página).
- La resolución de reproducción ahora rechaza coincidencias genéricas cuando el título solicita una temporada/parte específica, evitando que secuelas como Classroom of the Elite 4th Season reproduzcan temporadas anteriores.
