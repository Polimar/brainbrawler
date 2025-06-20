@echo off
echo 🛑 Stopping BrainBrawler Development Environment

echo.
echo 🔄 Termino processi Node.js...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM nodemon.exe 2>nul

echo.
echo 🐳 Fermo servizi Docker...
docker compose -f docker-compose.dev.yml down

echo.
echo 🧹 Pulisco volumi Docker (opzionale)...
set /p cleanup="Vuoi pulire anche i volumi Docker? (y/N): "
if /i "%cleanup%"=="y" (
    docker compose -f docker-compose.dev.yml down -v
    echo ✅ Volumi puliti
)

echo.
echo ✅ Environment fermato!
echo.
pause 