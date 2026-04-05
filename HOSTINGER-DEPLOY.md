# Guía de Despliegue en Hostinger Cloud — AnimeFlex

## Requisitos previos en Hostinger
- Node.js 20+ activado en tu panel
- PM2 disponible (viene incluido en Cloud Hosting de Hostinger)
- PostgreSQL externo (Neon) — ya lo tienes configurado

---

## Variables de entorno necesarias

En el panel de Hostinger, configura estas variables de entorno:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | Tu cadena de conexión de Neon PostgreSQL |
| `JWT_SECRET` | Un texto secreto largo y aleatorio (mínimo 32 caracteres) |
| `NODE_ENV` | `production` |
| `PORT` | `8080` (o el que Hostinger te asigne) |

---

## Pasos de despliegue

### 1. Instalar dependencias
```bash
npm install -g pnpm
pnpm install
```

### 2. Compilar el backend (API)
```bash
cd artifacts/api-server
pnpm run build
```
Esto genera la carpeta `artifacts/api-server/dist/` con el servidor compilado.

### 3. Compilar el frontend (Web)
```bash
cd artifacts/anime-web
pnpm run build
```
Esto genera la carpeta `artifacts/anime-web/dist/public/` con los archivos estáticos.

### 4. Subir los archivos estáticos del frontend
Sube el contenido de `artifacts/anime-web/dist/public/` a la carpeta pública de tu dominio en Hostinger (normalmente `public_html/`).

### 5. Iniciar el backend con PM2
```bash
cd artifacts/api-server
pm2 start ecosystem.config.cjs
pm2 save
```

### 6. Configurar proxy inverso (Nginx)
En Hostinger Cloud, configura Nginx para que:
- Las rutas `/api/*` apunten a `http://localhost:8080/api/*`
- El resto de rutas sirvan los archivos estáticos del frontend

Ejemplo de configuración Nginx:
```nginx
server {
    listen 80;
    server_name animeflex.eu www.animeflex.eu;
    root /home/tu_usuario/public_html;
    index index.html;

    # Proxy para la API
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend (React SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Estructura de archivos en producción

```
public_html/           ← archivos del frontend (dist/public/)
  index.html
  assets/
  ...

artifacts/api-server/  ← backend Node.js
  dist/
    index.mjs          ← servidor compilado
  ecosystem.config.cjs
  logs/
```

---

## Comandos útiles de PM2

```bash
pm2 status            # Ver estado del servidor
pm2 logs animeflex-api # Ver logs en tiempo real
pm2 restart animeflex-api # Reiniciar el servidor
pm2 stop animeflex-api    # Detener el servidor
```

---

## Notas importantes

- La base de datos Neon (PostgreSQL) es externa y no necesita instalación en Hostinger.
- Las migraciones se ejecutan automáticamente al iniciar el servidor.
- El frontend en React es una SPA (Single Page App), por eso el Nginx necesita el `try_files ... /index.html`.
- HTTPS: Hostinger activa SSL automáticamente con Let's Encrypt para tu dominio.
