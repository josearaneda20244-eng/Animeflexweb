# Guía de Despliegue: Railway (Backend) + Vercel (Frontend)

## Resumen
- **Backend API** → Railway (gratis con $5 crédito/mes)
- **Frontend Web** → Vercel (gratis, sin límites)
- **Base de datos** → Neon PostgreSQL (ya configurada)

---

## PARTE 1 — Backend en Railway

### Paso 1: Crear cuenta en Railway
1. Ve a https://railway.app
2. Haz clic en **"Start a New Project"**
3. Inicia sesión con tu cuenta de **GitHub**

### Paso 2: Crear el proyecto desde tu repositorio
1. Haz clic en **"Deploy from GitHub repo"**
2. Busca y selecciona **"Animeflexweb"**
3. Railway detectará automáticamente la configuración del archivo `railway.toml`

### Paso 3: Configurar las variables de entorno
En el panel de Railway, ve a tu servicio → pestaña **"Variables"** y agrega:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | Tu cadena de conexión de Neon (la misma que usas en Replit) |
| `JWT_SECRET` | El mismo valor que usas en Replit |
| `NODE_ENV` | `production` |

> Para obtener el `DATABASE_URL` de Neon: entra a https://neon.tech, selecciona tu proyecto y copia la "Connection string".

### Paso 4: Obtener la URL del backend
- Una vez desplegado, Railway te dará una URL como: `https://animeflexweb-production.up.railway.app`
- **Guarda esta URL**, la necesitarás para Vercel en el siguiente paso.

### Paso 5: Verificar que funciona
Abre en el navegador:
```
https://TU-URL-RAILWAY.up.railway.app/api/health
```
Deberías ver una respuesta JSON indicando que el servidor está activo.

---

## PARTE 2 — Frontend en Vercel

### Paso 1: Crear cuenta en Vercel
1. Ve a https://vercel.com
2. Haz clic en **"Sign Up"**
3. Inicia sesión con tu cuenta de **GitHub**

### Paso 2: Importar el proyecto
1. Haz clic en **"Add New Project"**
2. Busca y selecciona el repositorio **"Animeflexweb"**
3. Haz clic en **"Import"**

### Paso 3: Configurar el proyecto en Vercel
En la pantalla de configuración:
- **Framework Preset**: selecciona `Other` (no Vite, para que use nuestro `vercel.json`)
- **Root Directory**: deja en blanco (usa la raíz del repo)
- El resto se configura solo con el archivo `vercel.json`

### Paso 4: Agregar variable de entorno
En la sección **"Environment Variables"**:

| Variable | Valor |
|----------|-------|
| `VITE_API_BASE_URL` | `https://TU-URL-RAILWAY.up.railway.app/api` |
| `VITE_API_URL` | `https://TU-URL-RAILWAY.up.railway.app/api` |

> Reemplaza `TU-URL-RAILWAY.up.railway.app` con la URL que obtuviste en el Paso 4 de Railway.

### Paso 5: Desplegar
- Haz clic en **"Deploy"**
- Vercel construirá y publicará el frontend automáticamente
- Al terminar, te dará una URL como: `https://animeflexweb.vercel.app`

---

## PARTE 3 — Conectar dominio propio (animeflex.eu)

### Opción A: Dominio en el frontend (Vercel)
1. En Vercel → tu proyecto → pestaña **"Domains"**
2. Escribe `animeflex.eu` y haz clic en **"Add"**
3. Vercel te dará registros DNS que debes agregar en tu proveedor de dominio

### Opción B: Dominio en el backend (Railway)
1. En Railway → tu servicio → pestaña **"Settings"** → **"Networking"**
2. Haz clic en **"Custom Domain"** y agrega `api.animeflex.eu`
3. Agrega el registro CNAME en tu proveedor de dominio

---

## PARTE 4 — Actualizaciones futuras

Cada vez que hagas cambios en Replit y los subas a GitHub:
- **Railway** se redesplegará automáticamente el backend
- **Vercel** se redesplegará automáticamente el frontend

No necesitas hacer nada extra.

---

## Solución de problemas comunes

### El frontend no conecta con el API
- Verifica que `VITE_API_BASE_URL` en Vercel tenga la URL correcta de Railway
- Asegúrate de incluir `/api` al final de la URL

### Railway falla al iniciar
- Revisa los logs en Railway → tu servicio → pestaña **"Logs"**
- Verifica que `DATABASE_URL` y `JWT_SECRET` estén configurados correctamente

### Error de CORS
- El backend ya está configurado para aceptar cualquier dominio de Vercel (`*.vercel.app`)
- Si usas dominio propio, avisa para agregarlo al CORS
