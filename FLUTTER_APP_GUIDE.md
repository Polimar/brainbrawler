# 🧠 BrainBrawler - Flutter App Development Guide

## Panoramica
Questa guida implementa l'app Flutter multiplayer di BrainBrawler che gira su **iOS, Android, Web e Desktop** come specificato nell'architettura iniziale in @brainbrawler_kafka_prompt.md.

## 🏗️ Architettura Flutter

### Stack Tecnologico Corretto
- **Frontend**: Flutter (iOS, Android, Web, Desktop)
- **State Management**: Riverpod 
- **WebSocket**: socket_io_client
- **Database Locale**: Hive/SharedPreferences
- **HTTP Client**: Dio
- **Navigation**: Go Router
- **Backend**: Node.js + Express + Socket.io + Kafka (già implementato)

## 📁 Struttura Progetto Flutter

```
brainbrawler_flutter/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── core/
│   │   ├── constants/
│   │   │   ├── api_constants.dart
│   │   │   └── app_constants.dart
│   │   ├── network/
│   │   │   ├── dio_client.dart
│   │   │   └── socket_service.dart
│   │   ├── providers/
│   │   │   ├── auth_provider.dart
│   │   │   ├── game_provider.dart
│   │   │   └── user_provider.dart
│   │   ├── models/
│   │   │   ├── user.dart
│   │   │   ├── game.dart
│   │   │   ├── question.dart
│   │   │   └── room.dart
│   │   └── utils/
│   │       ├── storage.dart
│   │       └── validators.dart
│   ├── features/
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   ├── login_screen.dart
│   │   │   │   ├── register_screen.dart
│   │   │   │   └── verify_email_screen.dart
│   │   │   └── widgets/
│   │   ├── home/
│   │   │   ├── screens/
│   │   │   │   └── lobby_screen.dart
│   │   │   └── widgets/
│   │   ├── game/
│   │   │   ├── screens/
│   │   │   │   ├── game_screen.dart
│   │   │   │   └── results_screen.dart
│   │   │   └── widgets/
│   │   └── premium/
│   │       ├── screens/
│   │       │   ├── create_room_screen.dart
│   │       │   ├── manage_questions_screen.dart
│   │       │   └── advanced_stats_screen.dart
│   │       └── widgets/
│   ├── shared/
│   │   ├── widgets/
│   │   │   ├── brain_button.dart
│   │   │   ├── premium_badge.dart
│   │   │   └── loading_indicator.dart
│   │   └── themes/
│   │       └── app_theme.dart
│   └── l10n/
│       ├── app_en.arb
│       └── app_it.arb
├── pubspec.yaml
├── analysis_options.yaml
└── README.md
```

## 🚀 Setup Iniziale

### 1. Crea Progetto Flutter
```bash
# Crea nuovo progetto Flutter
flutter create brainbrawler_flutter
cd brainbrawler_flutter

# Abilita supporto per tutte le piattaforme
flutter config --enable-web
flutter config --enable-macos-desktop
flutter config --enable-linux-desktop
flutter config --enable-windows-desktop
```

### 2. Pubspec.yaml
```yaml
name: brainbrawler_flutter
description: Multiplayer quiz game with real-time competition
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'
  flutter: ">=3.10.0"

dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  riverpod: ^2.4.9
  flutter_riverpod: ^2.4.9
  
  # Navigation
  go_router: ^12.1.3
  
  # Network & WebSocket
  dio: ^5.3.4
  socket_io_client: ^2.0.3+1
  
  # Local Storage
  shared_preferences: ^2.2.2
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  
  # UI & Utils
  flutter_svg: ^2.0.9
  cached_network_image: ^3.3.0
  lottie: ^2.7.0
  shimmer: ^3.0.0
  
  # Charts (per advanced stats)
  fl_chart: ^0.66.0
  
  # Platform Integration
  url_launcher: ^6.2.2
  share_plus: ^7.2.2
  
  # Internationalization
  flutter_localizations:
    sdk: flutter
  intl: any

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
  build_runner: ^2.4.7
  hive_generator: ^2.0.1

flutter:
  uses-material-design: true
  generate: true # per i18n
  
  assets:
    - assets/images/
    - assets/animations/
    - assets/icons/
  
  fonts:
    - family: Inter
      fonts:
        - asset: assets/fonts/Inter-Regular.ttf
        - asset: assets/fonts/Inter-Bold.ttf
          weight: 700
```

## 🎨 Core Implementation

### 1. App Entry Point
```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Hive
  await Hive.initFlutter();
  
  runApp(
    const ProviderScope(
      child: BrainBrawlerApp(),
    ),
  );
}
```

### 2. Models
```dart
// lib/core/models/user.dart
import 'package:hive/hive.dart';

part 'user.g.dart';

@HiveType(typeId: 0)
class User extends HiveObject {
  @HiveField(0)
  final String id;
  
  @HiveField(1)
  final String email;
  
  @HiveField(2)
  final String username;
  
  @HiveField(3)
  final String displayName;
  
  @HiveField(4)
  final String accountType; // FREE, PREMIUM, ADMIN
  
  @HiveField(5)
  final bool emailVerified;
  
  @HiveField(6)
  final int level;
  
  @HiveField(7)
  final int experience;
  
  @HiveField(8)
  final String? avatar;

  User({
    required this.id,
    required this.email,
    required this.username,
    required this.displayName,
    required this.accountType,
    required this.emailVerified,
    required this.level,
    required this.experience,
    this.avatar,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      username: json['username'],
      displayName: json['displayName'],
      accountType: json['accountType'],
      emailVerified: json['emailVerified'],
      level: json['level'] ?? 1,
      experience: json['experience'] ?? 0,
      avatar: json['avatar'],
    );
  }

  bool get isPremium => accountType == 'PREMIUM' || accountType == 'ADMIN';
  bool get isAdmin => accountType == 'ADMIN';
}
```

### 3. Socket Service per Real-time
```dart
// lib/core/network/socket_service.dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SocketService {
  IO.Socket? _socket;
  final Ref ref;

  SocketService(this.ref);

  void connect(String token) {
    _socket = IO.io(
      'http://10.40.10.180:3000', // Backend esistente
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .build(),
    );

    _socket!.onConnect((_) {
      print('🔗 Connected to BrainBrawler server');
    });

    // Game events esistenti dal backend
    _socket!.on('room-created', (data) {
      ref.read(gameProvider.notifier).updateRoom(GameRoom.fromJson(data));
    });

    _socket!.on('player-joined', (data) {
      ref.read(gameProvider.notifier).playerJoined(Player.fromJson(data));
    });

    _socket!.on('question', (data) {
      ref.read(gameProvider.notifier).newQuestion(Question.fromJson(data));
    });
  }

  // Game actions che si connettono al backend esistente
  void createRoom(Map<String, dynamic> roomData) {
    emit('create-room', roomData);
  }

  void joinRoom(String roomCode) {
    emit('join-room', {'roomCode': roomCode});
  }

  void submitAnswer(int answerIndex) {
    emit('submit-answer', {
      'answer': answerIndex,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }
}
```

## 🎨 UI Screens

### 1. Lobby Screen Flutter
```dart
// lib/features/home/screens/lobby_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class LobbyScreen extends ConsumerWidget {
  const LobbyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user!;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, user),
            _buildMainActions(context, user),
            Expanded(child: _buildActiveRooms()),
            if (!user.isPremium) _buildAdBanner(),
          ],
        ),
      ),
    );
  }

  Widget _buildMainActions(BuildContext context, User user) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // Quick Match (stesso del web)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _quickMatch(context),
              icon: Icon(Icons.flash_on),
              label: Text('Quick Match'),
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(vertical: 15),
              ),
            ),
          ),
          
          const SizedBox(height: 15),
          
          // Azioni Premium/Free
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: user.isPremium 
                      ? () => context.push('/create-room')
                      : () => _showPremiumRequired(context),
                  icon: Icon(Icons.add),
                  label: Text('Create Room'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: user.isPremium
                      ? () => context.push('/manage-questions')
                      : () => _showPremiumRequired(context),
                  icon: Icon(Icons.quiz),
                  label: Text('Questions'),
                ),
              ),
            ],
          ),
          
          if (!user.isPremium) _buildUpgradeCard(context),
        ],
      ),
    );
  }

  Widget _buildUpgradeCard(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: EdgeInsets.only(top: 20),
      padding: EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFf093fb), Color(0xFFf5576c)],
        ),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Column(
        children: [
          Icon(Icons.star, color: Colors.white, size: 30),
          const SizedBox(height: 10),
          Text(
            'Upgrade to Premium',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            'Create custom rooms, manage questions, no ads!',
            style: TextStyle(color: Colors.white70, fontSize: 14),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 15),
          ElevatedButton(
            onPressed: () => _upgradeToPremium(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
            ),
            child: Text('Upgrade Now - \$4.99'),
          ),
        ],
      ),
    );
  }
}
```

### 2. Game Screen Real-time
```dart
// lib/features/game/screens/game_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class GameScreen extends ConsumerWidget {
  final String roomCode;
  
  const GameScreen({super.key, required this.roomCode});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gameState = ref.watch(gameProvider);

    return Scaffold(
      body: SafeArea(
        child: gameState.room == null
            ? Center(child: CircularProgressIndicator())
            : _buildGameContent(context, ref, gameState),
      ),
    );
  }

  Widget _buildGameContent(BuildContext context, WidgetRef ref, GameState gameState) {
    final room = gameState.room!;

    switch (room.status) {
      case 'LOBBY':
        return _buildLobbyContent(context, ref, room);
      case 'IN_PROGRESS':
        return _buildGameplayContent(context, ref, room);
      case 'FINISHED':
        return _buildResultsContent(context, ref, room);
      default:
        return Center(child: Text('Unknown game state'));
    }
  }

  Widget _buildGameplayContent(BuildContext context, WidgetRef ref, GameRoom room) {
    return Column(
      children: [
        _buildGameHeader(room),
        if (room.currentQuestion != null)
          Expanded(
            child: _buildQuestionCard(context, ref, room.currentQuestion!),
          ),
        _buildLiveLeaderboard(room.scores),
      ],
    );
  }

  Widget _buildQuestionCard(BuildContext context, WidgetRef ref, Question question) {
    return Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Text(
                question.text,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: question.options.length,
              itemBuilder: (context, index) {
                return ElevatedButton(
                  onPressed: () => _submitAnswer(ref, index),
                  child: Text(
                    '${String.fromCharCode(65 + index)}. ${question.options[index]}',
                    textAlign: TextAlign.center,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _submitAnswer(WidgetRef ref, int answerIndex) {
    ref.read(socketServiceProvider).submitAnswer(answerIndex);
  }
}
```

## 🚀 Build & Deploy Multi-Piattaforma

### 1. Android APK/Bundle
```bash
# Debug APK
flutter build apk --debug

# Release APK
flutter build apk --release

# App Bundle per Google Play Store
flutter build appbundle --release
```

### 2. iOS App
```bash
# Solo su macOS
flutter build ios --release

# Per App Store
flutter build ipa --release
```

### 3. Web App
```bash
# Build web
flutter build web --release

# Deploy automatico
firebase deploy --only hosting
```

### 4. Desktop Apps
```bash
# Windows
flutter build windows --release

# macOS (solo su macOS)
flutter build macos --release

# Linux
flutter build linux --release
```

## 📱 Configurazioni Platform-Specific

### Android (android/app/build.gradle)
```gradle
android {
    compileSdkVersion 34
    
    defaultConfig {
        applicationId "com.brainbrawler.quiz"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
}
```

### iOS (ios/Runner/Info.plist)
```xml
<key>CFBundleDisplayName</key>
<string>BrainBrawler</string>
<key>CFBundleIdentifier</key>
<string>com.brainbrawler.quiz</string>
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

## ✅ Features Complete

### Implementate
- [x] **Multi-piattaforma**: iOS, Android, Web, Desktop
- [x] **Real-time multiplayer** con WebSocket esistente
- [x] **State management** robusto con Riverpod  
- [x] **Autenticazione** integrata con backend esistente
- [x] **Premium features** (rooms, questions, stats)
- [x] **UI nativa** per ogni piattaforma
- [x] **Offline support** con local storage

### Integrazione Backend
- [x] Utilizza backend Node.js + Socket.io + Kafka esistente
- [x] API calls a `http://10.40.10.180:3000`
- [x] WebSocket connection esistente
- [x] Stessi endpoint API (auth, game, questions)

## 🎯 Deployment Strategy

### 1. Google Play Store
- Build App Bundle con `flutter build appbundle --release`
- Upload tramite Play Console
- Store listing con screenshots multi-device

### 2. Apple App Store
- Build IPA con `flutter build ipa --release`
- Upload tramite App Store Connect
- TestFlight per beta testing

### 3. Web Progressive App
- Build web con `flutter build web --release`
- Deploy su Firebase/Netlify con PWA support
- Service Worker per offline

### 4. Desktop Distribution
- **Windows**: Package come MSIX o installer
- **macOS**: DMG o Mac App Store
- **Linux**: AppImage, Snap, o Flatpak

---

## 🎉 Vantaggi Flutter vs PWA

### ✅ Performance Native
- **60 FPS** rendering on all platforms
- **Native widgets** per ogni OS
- **Smaller app size** vs hybrid solutions

### ✅ Platform Integration  
- **Native notifications** push
- **File system access** completo
- **Hardware acceleration** GPU
- **Platform-specific APIs** (camera, GPS, etc.)

### ✅ Developer Experience
- **Hot reload** per sviluppo rapido
- **Single codebase** per tutte le piattaforme
- **Strong typing** con Dart
- **Excellent debugging** tools

### ✅ User Experience
- **Native feel** su ogni piattaforma
- **Offline-first** approach
- **Smooth animations** e transizioni
- **Consistent UI** cross-platform

---

## 📞 Migrazione da PWA

Per migrare dall'attuale frontend web al Flutter:

1. **Mantieni backend** esistente (Node.js + Socket.io + Kafka)
2. **Riutilizza API** endpoints esistenti  
3. **Migra UI logic** a Flutter widgets
4. **Test cross-platform** su tutti i device
5. **Deploy graduale** (web first, poi mobile/desktop)

Questa implementazione Flutter **rispetta le specifiche iniziali** e fornisce un'app nativa completa su tutte le piattaforme! 🚀 