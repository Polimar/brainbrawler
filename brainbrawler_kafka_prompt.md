# 🧠 BrainBrawler - Quiz Game Multiplayer con Kafka

## Sviluppa una piattaforma di quiz multiplayer scalabile per migliaia di utenti simultanei

### Stack Tecnologico
- **Frontend**: Flutter (iOS, Android, Web)
- **Backend**: Node.js/Express + Socket.io
- **Database**: PostgreSQL con Prisma ORM
- **Messaging**: Apache Kafka per comunicazione real-time
- **Cache**: Redis per sessioni e leaderboard
- **Auth**: JWT + Google OAuth
- **Deploy**: Docker + Kubernetes

## Architettura del Sistema

### 1. Game Service (Node.js + Socket.io)
Gestisce le connessioni WebSocket dei client e le sessioni di gioco:
```javascript
// Esempio struttura
class GameService {
  async createRoom(userId, questionSetId) {
    // Genera room code, seleziona domande
    // Pubblica evento su Kafka topic: 'room-created'
  }
  
  async joinRoom(userId, roomCode) {
    // Valida room, aggiunge player
    // Pubblica su Kafka topic: 'player-joined'
  }
  
  async submitAnswer(userId, roomId, questionId, answer, timestamp) {
    // Pubblica risposta su Kafka topic: 'answer-submitted'
  }
}
```

### 2. Game Engine Service (Kafka Consumer)
Consuma eventi Kafka e gestisce la logica di gioco:
```javascript
class GameEngine {
  async processAnswer(message) {
    const { userId, roomId, answer, timestamp } = message;
    // Calcola punteggio, aggiorna stato partita
    // Pubblica risultato su 'round-completed'
  }
  
  async startNextRound(roomId) {
    // Invia prossima domanda a tutti i player
    // Pubblica su 'question-sent'
  }
}
```

### 3. Kafka Topics Structure
```yaml
Topics:
  - room-events: Creazione/eliminazione stanze
  - player-events: Join/leave/disconnect
  - game-events: Start/end partita, timer
  - answer-events: Invio risposte giocatori
  - score-events: Calcolo e aggiornamento punteggi
  - notification-events: Notifiche real-time
```

## Database Schema (Prisma)

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  username        String    @unique
  displayName     String
  googleId        String?   @unique
  avatar          String?
  totalGamesPlayed Int      @default(0)
  totalWins       Int       @default(0)
  totalScore      Int       @default(0)
  level           Int       @default(1)
  xp              Int       @default(0)
  createdAt       DateTime  @default(now())
  
  gameResults     GameResult[]
  achievements    UserAchievement[]
  friendships     Friendship[] @relation("FriendshipFrom")
}

model Question {
  id            String     @id @default(cuid())
  text          String
  options       String[]   // Array di 4 opzioni
  correctAnswer Int        // Indice risposta corretta (0-3)
  category      Category   @relation(fields: [categoryId], references: [id])
  categoryId    String
  difficulty    Difficulty
  imageUrl      String?
  explanation   String?    // Spiegazione risposta
  
  questionSets  QuestionSetItem[]
}

model Category {
  id        String     @id @default(cuid())
  name      String     @unique
  icon      String
  color     String
  questions Question[]
}

model Game {
  id              String       @id @default(cuid())
  roomCode        String       @unique @db.VarChar(6) // ABCD12
  questionSetId   String
  questionSet     QuestionSet  @relation(fields: [questionSetId], references: [id])
  status          GameStatus   @default(LOBBY)
  currentQuestion Int          @default(0)
  maxPlayers      Int          @default(8)
  timePerQuestion Int          @default(15) // secondi
  createdById     String
  startedAt       DateTime?
  endedAt         DateTime?
  createdAt       DateTime     @default(now())
  
  results         GameResult[]
}

model GameResult {
  id              String   @id @default(cuid())
  gameId          String
  game            Game     @relation(fields: [gameId], references: [id])
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  finalScore      Int
  finalRank       Int
  correctAnswers  Int
  avgResponseTime Float    // millisecondi
  xpGained        Int      @default(0)
  
  @@unique([gameId, userId])
}

enum GameStatus {
  LOBBY
  STARTING
  IN_PROGRESS
  FINISHED
  CANCELLED
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}
```

## Flutter App Structure

### 1. Main App Architecture
```dart
// lib/main.dart
void main() {
  runApp(
    ProviderScope(
      child: BrainBrawlerApp(),
    ),
  );
}

// Riverpod providers per state management
final socketProvider = Provider<SocketService>((ref) => SocketService());
final gameStateProvider = StateNotifierProvider<GameNotifier, GameState>((ref) {
  return GameNotifier(ref.read(socketProvider));
});
```

### 2. Game State Management
```dart
class GameState {
  final String? roomCode;
  final GameStatus status;
  final List<Player> players;
  final Question? currentQuestion;
  final Map<String, int> scores;
  final int timeRemaining;
  final int currentRound;
  final int totalRounds;
  
  // copyWith, fromJson, toJson methods
}

class GameNotifier extends StateNotifier<GameState> {
  final SocketService _socket;
  
  GameNotifier(this._socket) : super(GameState.initial()) {
    _socket.onGameUpdate((data) {
      state = GameState.fromJson(data);
    });
  }
  
  Future<void> createRoom(String questionSetId) async {
    await _socket.emit('create-room', {'questionSetId': questionSetId});
  }
  
  Future<void> submitAnswer(int answerIndex) async {
    await _socket.emit('submit-answer', {
      'roomCode': state.roomCode,
      'questionId': state.currentQuestion?.id,
      'answer': answerIndex,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }
}
```

### 3. Socket Service
```dart
class SocketService {
  late IO.Socket _socket;
  
  void connect(String token) {
    _socket = IO.io('ws://localhost:3000', <String, dynamic>{
      'transports': ['websocket'],
      'auth': {'token': token}
    });
    
    _socket.on('connect', (_) => print('Connected'));
    _socket.on('game-update', (data) => _onGameUpdate(data));
    _socket.on('question', (data) => _onQuestion(data));
    _socket.on('round-results', (data) => _onRoundResults(data));
  }
  
  Future<void> emit(String event, Map<String, dynamic> data) async {
    _socket.emit(event, data);
  }
}
```

## Backend Implementation

### 1. Express Server + Socket.io
```javascript
// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { KafkaProducer } = require('./kafka/producer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const kafkaProducer = new KafkaProducer();

io.use(authMiddleware); // JWT validation

io.on('connection', (socket) => {
  const userId = socket.user.id;
  
  socket.on('create-room', async (data) => {
    const room = await createRoom(userId, data.questionSetId);
    socket.join(room.code);
    
    await kafkaProducer.send('room-events', {
      type: 'ROOM_CREATED',
      roomCode: room.code,
      userId,
      data: room
    });
    
    socket.emit('room-created', room);
  });
  
  socket.on('join-room', async (data) => {
    const { roomCode } = data;
    socket.join(roomCode);
    
    await kafkaProducer.send('player-events', {
      type: 'PLAYER_JOINED',
      roomCode,
      userId,
      timestamp: Date.now()
    });
  });
  
  socket.on('submit-answer', async (data) => {
    await kafkaProducer.send('answer-events', {
      type: 'ANSWER_SUBMITTED',
      userId,
      roomCode: data.roomCode,
      questionId: data.questionId,
      answer: data.answer,
      timestamp: data.timestamp
    });
  });
});
```

### 2. Kafka Producer
```javascript
// kafka/producer.js
const { Kafka } = require('kafkajs');

class KafkaProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'brainbrawler-game-service',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
    });
    this.producer = this.kafka.producer();
  }
  
  async connect() {
    await this.producer.connect();
  }
  
  async send(topic, message) {
    await this.producer.send({
      topic,
      messages: [{
        key: message.roomCode || message.userId,
        value: JSON.stringify(message),
        timestamp: Date.now().toString()
      }]
    });
  }
}
```

### 3. Game Engine Consumer
```javascript
// services/gameEngine.js
const { KafkaConsumer } = require('../kafka/consumer');
const Redis = require('redis');

class GameEngine {
  constructor() {
    this.redis = Redis.createClient();
    this.consumer = new KafkaConsumer('game-engine-group');
  }
  
  async start() {
    await this.consumer.subscribe(['answer-events', 'player-events']);
    
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const data = JSON.parse(message.value.toString());
        
        switch (topic) {
          case 'answer-events':
            await this.processAnswer(data);
            break;
          case 'player-events':
            await this.handlePlayerEvent(data);
            break;
        }
      }
    });
  }
  
  async processAnswer(data) {
    const { userId, roomCode, questionId, answer, timestamp } = data;
    
    // Recupera stato partita da Redis
    const gameState = await this.redis.hgetall(`game:${roomCode}`);
    
    // Calcola punteggio
    const responseTime = Date.now() - parseInt(gameState.questionStartTime);
    const isCorrect = await this.checkAnswer(questionId, answer);
    const score = this.calculateScore(isCorrect, responseTime);
    
    // Salva risposta
    await this.redis.hset(`answers:${roomCode}:${questionId}`, userId, JSON.stringify({
      answer, timestamp, score, isCorrect, responseTime
    }));
    
    // Controlla se tutti hanno risposto
    const totalPlayers = await this.redis.scard(`players:${roomCode}`);
    const totalAnswers = await this.redis.hlen(`answers:${roomCode}:${questionId}`);
    
    if (totalAnswers >= totalPlayers) {
      await this.endRound(roomCode, questionId);
    }
  }
  
  calculateScore(isCorrect, responseTime) {
    if (!isCorrect) return 0;
    
    const baseScore = 1000;
    const timeBonus = Math.max(0, 1000 - (responseTime / 10)); // -1 punto per ogni 10ms
    return Math.floor(baseScore + timeBonus);
  }
  
  async endRound(roomCode, questionId) {
    // Calcola risultati round
    const answers = await this.redis.hgetall(`answers:${roomCode}:${questionId}`);
    const results = Object.entries(answers).map(([userId, data]) => ({
      userId,
      ...JSON.parse(data)
    }));
    
    // Invia risultati a tutti i client via Socket.io
    io.to(roomCode).emit('round-results', {
      questionId,
      results,
      correctAnswer: await this.getCorrectAnswer(questionId)
    });
    
    // Avvia timer per prossima domanda
    setTimeout(() => this.startNextRound(roomCode), 3000);
  }
}
```

## UI Screens (Flutter)

### 1. Game Screen
```dart
class GameScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gameState = ref.watch(gameStateProvider);
    
    return Scaffold(
      body: Column(
        children: [
          // Header con timer e punteggi
          GameHeader(
            timeRemaining: gameState.timeRemaining,
            currentRound: gameState.currentRound,
            totalRounds: gameState.totalRounds,
          ),
          
          // Domanda corrente
          if (gameState.currentQuestion != null)
            QuestionCard(question: gameState.currentQuestion!),
          
          // Opzioni di risposta
          if (gameState.currentQuestion != null)
            AnswerOptions(
              options: gameState.currentQuestion!.options,
              onAnswer: (index) => ref.read(gameStateProvider.notifier)
                  .submitAnswer(index),
            ),
          
          // Leaderboard live
          LiveLeaderboard(scores: gameState.scores),
        ],
      ),
    );
  }
}
```

### 2. Lobby Screen
```dart
class LobbyScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gameState = ref.watch(gameStateProvider);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Sala ${gameState.roomCode}'),
        actions: [
          IconButton(
            icon: Icon(Icons.share),
            onPressed: () => Share.share('Unisciti alla mia partita: ${gameState.roomCode}'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Room code display
          RoomCodeDisplay(code: gameState.roomCode!),
          
          // Players list
          Expanded(
            child: PlayersList(players: gameState.players),
          ),
          
          // Start button (solo per host)
          if (gameState.isHost)
            ElevatedButton(
              onPressed: gameState.players.length >= 2 
                  ? () => ref.read(gameStateProvider.notifier).startGame()
                  : null,
              child: Text('Inizia Partita'),
            ),
        ],
      ),
    );
  }
}
```

## Docker Compose Setup

```yaml
version: '3.8'
services:
  # Kafka
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on: [zookeeper]
    ports: ["9092:9092"]
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092

  # Redis
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  # PostgreSQL
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: brainbrawler
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Backend API
  api:
    build: ./backend
    ports: ["3000:3000"]
    depends_on: [postgres, redis, kafka]
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/brainbrawler
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092

volumes:
  postgres_data:
```

## Implementazione Step by Step

### Fase 1: Setup Base (Settimana 1)
1. Setup Docker Compose con Kafka, Redis, PostgreSQL
2. Backend Express + Socket.io base
3. Flutter app con navigazione base
4. Autenticazione JWT + Google OAuth
5. Database schema e Prisma setup

### Fase 2: Core Game Logic (Settimana 2)
1. Kafka producer/consumer setup
2. Room creation e join logic
3. Question management system
4. Basic game flow (senza UI avanzata)
5. Score calculation system

### Fase 3: UI e UX (Settimana 3)
1. Design system con Material 3
2. Game screens con animazioni
3. Real-time leaderboard
4. Risultati end-game
5. Achievement system

### Fase 4: Polish e Deploy (Settimana 4)
1. Error handling e reconnection logic
2. Performance optimization
3. Admin panel per gestione domande
4. CI/CD pipeline
5. App store submission

## Comandi di Sviluppo

```bash
# Setup progetto
git clone [repo]
cd brainbrawler
docker-compose up -d

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Flutter
cd flutter_app
flutter pub get
flutter run -d chrome  # per web
flutter run -d [device] # per mobile
```

Questa architettura è molto più robusta e scalabile rispetto al P2P. Kafka gestisce tutti i problemi di messaging distribuito, Redis fornisce cache ultra-veloce, e Socket.io garantisce comunicazione real-time affidabile.