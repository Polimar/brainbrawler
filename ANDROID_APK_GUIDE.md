# 🧠 BrainBrawler - Guida Completa APK Android

## Panoramica
Questa guida spiega come convertire la PWA di BrainBrawler in un APK Android nativo usando diversi metodi.

## 📋 Prerequisiti

### Software Richiesto
- **Node.js** (v16 o superiore)
- **npm** o **yarn**
- **Android Studio** (per testing e firma APK)
- **Git** (per versioning)

### Account Richiesti
- **Google Play Console** (per distribuzione)
- **Google Firebase** (per notifiche push - opzionale)

## 🛠️ Metodo 1: PWA Builder (Raccomandato)

### Step 1: Installazione
```bash
# Installa PWA Builder globalmente
npm install -g pwa-builder

# Verifica installazione
pwa-builder --version
```

### Step 2: Avvia il Server BrainBrawler
```bash
# Frontend (Terminal 1)
cd frontend
npm start
# Server disponibile su http://localhost:3001

# Backend (Terminal 2) 
cd backend
npm run dev
# API disponibile su http://localhost:3000
```

### Step 3: Genera APK
```bash
# Esegui lo script automatico
./build-android.sh

# O manualmente:
mkdir android-build
cd android-build
pwa-builder http://localhost:3001 -p android
```

### Step 4: Configurazione Android Studio
1. Apri Android Studio
2. Import Project → seleziona cartella generata
3. Configura `build.gradle`:
   ```gradle
   android {
       compileSdk 34
       defaultConfig {
           applicationId "com.brainbrawler.quiz"
           minSdk 21
           targetSdk 34
           versionCode 1
           versionName "1.0.0"
       }
   }
   ```

## 🔧 Metodo 2: Capacitor (Alternativa)

### Step 1: Setup Capacitor
```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android

# Inizializza Capacitor
npx cap init BrainBrawler com.brainbrawler.quiz
```

### Step 2: Configura capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brainbrawler.quiz',
  appName: 'BrainBrawler',
  webDir: '.', // Frontend files
  server: {
    url: 'http://localhost:3001',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
```

### Step 3: Build Android
```bash
# Aggiungi piattaforma Android
npx cap add android

# Sincronizza codice
npx cap sync

# Apri in Android Studio
npx cap open android
```

## 📱 Metodo 3: Cordova (Classico)

### Step 1: Setup Cordova
```bash
npm install -g cordova
cordova create BrainBrawlerApp com.brainbrawler.quiz BrainBrawler
cd BrainBrawlerApp
```

### Step 2: Configurazione
```bash
# Aggiungi piattaforma Android
cordova platform add android

# Copia file frontend nella cartella www/
cp -r ../frontend/* www/

# Plugin necessari
cordova plugin add cordova-plugin-network-information
cordova plugin add cordova-plugin-statusbar
cordova plugin add cordova-plugin-splashscreen
```

### Step 3: Build
```bash
# Debug APK
cordova build android

# Release APK (dopo aver configurato signing)
cordova build android --release
```

## 🏗️ Configurazione Avanzata

### Manifest PWA Ottimizzato
Il file `manifest.json` è già configurato con:
- **Nome**: BrainBrawler - Quiz Multiplayer
- **Icone**: Multiple dimensioni (72px - 512px)
- **Display**: standalone (fullscreen app)
- **Orientamento**: portrait
- **Shortcuts**: Quick Match, Create Room

### Service Worker
Il `sw.js` include:
- ✅ Cache offline per file statici
- ✅ Background sync per dati
- ✅ Push notifications
- ✅ Update management

### Icone e Assets
Crea icone per tutte le dimensioni:
```bash
# Dimensioni richieste:
icon-72.png    # 72x72px
icon-96.png    # 96x96px  
icon-128.png   # 128x128px
icon-144.png   # 144x144px
icon-152.png   # 152x152px
icon-192.png   # 192x192px
icon-384.png   # 384x384px
icon-512.png   # 512x512px
```

## 🔐 Firma e Distribuzione

### Genera Keystore
```bash
keytool -genkey -v -keystore brainbrawler.keystore -alias brainbrawler -keyalg RSA -keysize 2048 -validity 10000
```

### Firma APK
```bash
# Con Android Studio: Build > Generate Signed Bundle / APK
# O comando line:
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore brainbrawler.keystore app-release-unsigned.apk brainbrawler
zipalign -v 4 app-release-unsigned.apk BrainBrawler.apk
```

### Upload Play Store
1. **Play Console** → Create App
2. **App Bundle** → Upload signed APK
3. **Store Listing** → Descrizioni, screenshot
4. **Content Rating** → Completa questionario
5. **Pricing** → Freemium (gratis con acquisti in-app)

## 🧪 Testing

### Test Locali
```bash
# Installa su dispositivo Android
adb install BrainBrawler.apk

# Debug con Chrome DevTools
chrome://inspect/#devices
```

### Test Funzionalità
- ✅ Login/Registrazione
- ✅ Creazione account Premium/Free
- ✅ Quick Match
- ✅ Creazione room custom (Premium)
- ✅ Gestione domande (Premium)
- ✅ Statistiche avanzate (Premium)
- ✅ Funzionalità offline
- ✅ Notifiche push

## 📊 Monetizzazione Mobile

### Google AdMob Integration
```javascript
// In app mobile, aggiungi AdMob
if (window.AdMob) {
    AdMob.createBanner({
        adId: 'ca-app-pub-XXXXXXXXXX/XXXXXXXXXX',
        position: AdMob.POSITION.TOP_BANNER,
        autoShow: true
    });
}
```

### In-App Purchases
```javascript
// Upgrade Premium via Play Store
if (window.store) {
    store.when("premium_upgrade").approved((p) => {
        // Sblocca funzionalità Premium
        upgradeUserToPremium();
        p.finish();
    });
}
```

## 🚀 Deployment Production

### Alpha/Beta Testing
1. Upload APK su Play Console
2. **Internal Testing** → Team di sviluppo
3. **Closed Testing** → Gruppo selezionato (50-100 utenti)
4. **Open Testing** → Pubblico limitato (1000+ utenti)

### Rilascio Pubblico
1. **Review** → Google Play Review (24-48 ore)
2. **Release** → Pubblicazione graduale (20% → 50% → 100%)
3. **Monitoring** → Crash reports, feedback utenti

## 📈 Metriche e Analytics

### Google Play Console
- Downloads e installazioni
- Crash reports
- ANR (Application Not Responding)
- Rating e recensioni

### Google Analytics 4
```javascript
// Tracking eventi mobile
gtag('event', 'mobile_game_start', {
    platform: 'android',
    app_version: '1.0.0'
});
```

## 🔧 Troubleshooting

### Errori Comuni

#### Build Failures
```bash
# Pulisci cache
rm -rf node_modules
npm install

# Aggiorna Android SDK
sdkmanager --update
```

#### Signing Issues
```bash
# Verifica keystore
keytool -list -v -keystore brainbrawler.keystore

# Reset firma
rm -rf android/app/build
```

#### Performance Issues
- Ottimizza immagini (WebP format)
- Minifica JavaScript/CSS
- Abilita lazy loading
- Usa Service Worker per cache

## 📞 Supporto

### Risorse Utili
- **PWA Builder**: https://www.pwabuilder.com/
- **Capacitor Docs**: https://capacitorjs.com/docs
- **Android Dev**: https://developer.android.com/
- **Play Console**: https://play.google.com/console

### Community
- Stack Overflow (tag: pwa, android, capacitor)
- GitHub Issues del progetto
- Discord/Slack team di sviluppo

---

## ✅ Checklist Finale

Prima del rilascio, verifica:

- [ ] App testata su dispositivi Android reali
- [ ] Tutte le funzionalità Premium funzionanti
- [ ] Offline mode operativo
- [ ] Performance ottimali (< 3s load time)
- [ ] UI responsive su diverse risoluzioni
- [ ] Notifiche push configurate
- [ ] Monetizzazione (ads/premium) attiva
- [ ] Privacy policy implementata
- [ ] Analytics configurati
- [ ] Crash reporting attivo
- [ ] Store listing completo
- [ ] Screenshot e video promotional pronti

**🎉 Il tuo APK BrainBrawler è pronto per Android!** 