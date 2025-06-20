@echo off
echo 🚀 Avvio BrainBrawler Development Environment

echo.
echo 🔍 Verifica Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker non trovato. Installa Docker Desktop
    echo    https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo.
echo 🐳 Avvio servizi Docker...
docker compose -f docker-compose.dev.yml up -d

echo.
echo ⏳ Attendo che i servizi siano pronti...
timeout /t 30 /nobreak >nul

echo.
echo 📦 Installo dipendenze backend (se necessario)...
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Errore durante l'installazione delle dipendenze
    pause
    exit /b 1
)

echo.
echo 🗄️ Applico migrazioni database...
call npx prisma migrate dev --name init
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️ Errore migrazioni - probabilmente il database non è pronto
    echo    Prova a riavviare lo script tra qualche secondo
    pause
    exit /b 1
)

echo.
echo 🌱 Applico seed del database...
call npm run db:seed
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️ Errore durante il seed - procedo comunque
)

echo.
echo 🚀 Avvio backend...
start "BrainBrawler Backend" cmd /k npm run dev

cd ..

echo.
echo ✅ Environment pronto!
echo.
echo 📊 Servizi disponibili:
echo    • API Backend: http://localhost:3000
echo    • Health Check: http://localhost:3000/health
echo    • Adminer (DB): http://localhost:8080
echo    • Kafka UI: http://localhost:8090
echo.
echo 🎮 Credenziali demo:
echo    • Email: admin@brainbrawler.com, Password: admin123
echo    • Email: test@brainbrawler.com, Password: test123
echo.
echo ⏹️ Per fermare tutto: stop-dev.bat
echo.
pause 