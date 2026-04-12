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


## Cambios Recientes

- La ficha del anime ahora prioriza la lista completa de episodios de AnimeKai cuando supera la lista parcial de AniList.
- El detalle del anime incluye búsqueda rápida por número o título de episodio para series largas.
- El reproductor abre el panel de episodios en el rango del episodio actual e incluye salto directo por número, selector compacto de rangos y botón de últimos episodios.
- La ruta de reproducción intenta re-resolver episodios recientes con AnimeKai fresco, JKAnime, AnimeFLV y Hianime antes de fallar.
- El frontend inicia fuentes alternativas automáticamente en los últimos episodios o cuando AnimeKai empieza a reintentar, para reducir el bloqueo en capítulos recién publicados.
- El reproductor cambia automáticamente a la siguiente fuente cuando una fuente HLS falla o tarda demasiado, manteniendo AnimeKai como prioridad.
- Los rangos del panel de episodios ahora muestran exactamente la misma tanda visible (por ejemplo, Ep. 101-124 si se listan 24 por página).
