@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set LOG=%~dp0publicar-log.txt
echo ===== IZIFF ANIME - Publicar web (%date% %time%) ===== > "%LOG%"

echo.
echo  IZIFF ANIME - Compilando y publicando la web...
echo  (No cierres esta ventana. Tarda unos minutos.)
echo.

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [1/5] Instalando pnpm...
  call npm install -g pnpm >> "%LOG%" 2>&1
)

echo [1/5] Instalando dependencias...
call pnpm install >> "%LOG%" 2>&1
if errorlevel 1 goto :fail

echo [2/5] Compilando la web...
echo ----- BUILD WEB ----- >> "%LOG%"
call pnpm --filter @workspace/anime-web run build >> "%LOG%" 2>&1
if errorlevel 1 goto :fail

echo [3/5] Compilando el servidor (API)...
echo ----- BUILD API ----- >> "%LOG%"
call pnpm --filter @workspace/api-server run build >> "%LOG%" 2>&1
if errorlevel 1 goto :fail

echo [4/5] Revisando tipos (solo informativo)...
echo ----- TYPECHECK WEB (informativo) ----- >> "%LOG%"
call pnpm --filter @workspace/anime-web exec tsc -p tsconfig.json --noEmit >> "%LOG%" 2>&1
echo ----- TYPECHECK API (informativo) ----- >> "%LOG%"
call pnpm --filter @workspace/api-server run typecheck >> "%LOG%" 2>&1

echo [5/5] Subiendo a GitHub (Vercel y Railway se actualizan solos)...
echo ----- GIT ----- >> "%LOG%"
git add -A >> "%LOG%" 2>&1
git commit -m "Rediseno IZIFF ANIME: nuevo diseno, reproductor, lector manga, PWA/SEO, fuentes unificadas y correccion de bugs" >> "%LOG%" 2>&1
git push origin main >> "%LOG%" 2>&1
if errorlevel 1 goto :failpush

echo ===== OK ===== >> "%LOG%"
echo.
echo  LISTO. La web se publicara en 2-5 minutos en https://animeflex.lat
echo  Avisale a Claude que termino.
echo.
pause
exit /b 0

:failpush
echo ===== FALLO GIT PUSH ===== >> "%LOG%"
echo.
echo  La web compilo bien pero no se pudo subir a GitHub.
echo  Avisale a Claude: el detalle esta en publicar-log.txt
echo.
pause
exit /b 1

:fail
echo ===== FALLO COMPILACION ===== >> "%LOG%"
echo.
echo  Hubo un error compilando. NO se subio nada.
echo  Avisale a Claude: el detalle esta en publicar-log.txt
echo.
pause
exit /b 1
