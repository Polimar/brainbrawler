#!/bin/bash

# BrainBrawler Android APK Builder
# Usa PWA Builder per convertire la PWA in APK Android

echo "🧠 BrainBrawler - Android APK Builder"
echo "======================================"

# Verifica che Node.js sia installato
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non è installato. Installalo prima di procedere."
    exit 1
fi

# Verifica che npm sia installato
if ! command -v npm &> /dev/null; then
    echo "❌ npm non è installato. Installalo prima di procedere."
    exit 1
fi

echo "✅ Node.js e npm sono installati"

# Installa PWA Builder CLI se non già installato
if ! command -v pwa-builder &> /dev/null; then
    echo "📦 Installando PWA Builder CLI..."
    npm install -g pwa-builder
fi

echo "✅ PWA Builder CLI installato"

# Crea directory per l'APK se non esiste
mkdir -p android-build

# URL della PWA (modifica con il tuo dominio)
PWA_URL="http://10.40.10.180:3001"
echo "🌐 URL PWA: $PWA_URL"

# Verifica che il server sia in esecuzione
echo "🔍 Verificando che il server sia in esecuzione..."
if curl -f -s "$PWA_URL" > /dev/null; then
    echo "✅ Server raggiungibile"
else
    echo "❌ Server non raggiungibile. Avvia il server con 'npm run dev' prima di procedere."
    echo "💡 Suggerimento: Esegui 'cd frontend && npm start' in un altro terminale"
    exit 1
fi

# Genera APK Android con PWA Builder
echo "🏗️ Generando APK Android..."
cd android-build

# PWA Builder genererà un progetto Android Studio
pwa-builder "$PWA_URL" -p android

if [ $? -eq 0 ]; then
    echo "✅ APK Android generato con successo!"
    echo "📱 Controlla la cartella android-build/ per i file generati"
    echo ""
    echo "📋 Prossimi passi:"
    echo "1. Apri Android Studio"
    echo "2. Importa il progetto dalla cartella android-build/"
    echo "3. Configura le chiavi di firma"
    echo "4. Genera l'APK finale"
    echo ""
    echo "🔑 Configurazione consigliata:"
    echo "- Package Name: com.brainbrawler.quiz"
    echo "- App Name: BrainBrawler"
    echo "- Min SDK: 21 (Android 5.0)"
    echo "- Target SDK: 34 (Android 14)"
else
    echo "❌ Errore durante la generazione dell'APK"
    exit 1
fi

# Crea anche un file di configurazione per distribuzioni future
cat > build-config.json << EOF
{
  "appName": "BrainBrawler",
  "packageName": "com.brainbrawler.quiz",
  "version": "1.0.0",
  "versionCode": 1,
  "minSdkVersion": 21,
  "targetSdkVersion": 34,
  "pwaUrl": "$PWA_URL",
  "manifestUrl": "$PWA_URL/manifest.json",
  "features": [
    "Multiplayer Quiz Game",
    "Real-time Competition", 
    "Premium Features",
    "Offline Support",
    "Push Notifications"
  ],
  "permissions": [
    "INTERNET",
    "ACCESS_NETWORK_STATE",
    "WAKE_LOCK",
    "VIBRATE"
  ]
}
EOF

echo "💾 File di configurazione salvato: android-build/build-config.json"

# Crea README per la distribuzione
cat > android-build/README.md << EOF
# BrainBrawler Android APK

## Descrizione
APK Android generato dalla PWA di BrainBrawler usando PWA Builder.

## Funzionalità
- ✅ Multiplayer quiz in tempo reale
- ✅ Funzionalità Premium (creazione room, domande custom, statistiche)
- ✅ Supporto offline
- ✅ Notifiche push
- ✅ Design responsive

## Generazione APK

### Requisiti
- Android Studio
- Android SDK
- Chiavi di firma (per rilascio su Play Store)

### Steps
1. Apri Android Studio
2. Importa il progetto generato
3. Configura build.gradle se necessario
4. Genera APK: Build > Generate Signed Bundle / APK

### Configurazione Play Store
- Package Name: com.brainbrawler.quiz
- Privacy Policy: Richiesta per dati utente
- Target Audience: 13+ anni
- Categoria: Giochi > Trivia

## Testing
- Test su dispositivi fisici
- Test funzionalità offline
- Test notifiche push
- Test funzionalità Premium

## Deployment
- Alpha/Beta testing con Google Play Console
- Recensioni e feedback utenti
- Release production

## Supporto
Per supporto tecnico, contatta il team di sviluppo.
EOF

echo "📚 README creato: android-build/README.md"
echo ""
echo "🎉 Generazione APK completata!"
echo "📲 Il tuo APK BrainBrawler è pronto per Android Studio!" 