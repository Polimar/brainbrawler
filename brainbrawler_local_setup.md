# 🧠 BrainBrawler - Setup Sviluppo Locale

## Guida Completa per lo Sviluppo in Locale

### Prerequisiti Sistema
- **Node.js** >= 18.x
- **Docker Desktop** installato e avviato
- **Flutter SDK** >= 3.10.x
- **Git** per version control
- **VSCode** con estensioni Flutter/Dart

### 1. Clone del Repository e Setup Iniziale

```bash
# Clone repository
git clone https://github.com/tuousername/brainbrawler.git
cd brainbrawler

# Crea struttura directory
mkdir -p backend frontend docker kafka
```

### 2. Docker Compose per Servizi Locali

Crea `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  # Zookeeper per Kafka
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    container_name: bb_zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"
    networks:
      - brainbrawler

  # Kafka Broker
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    container_name: bb_kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
      - "29092:29092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_HOST://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
    networks:
      - brainbrawler

  # Redis per cache e sessioni
  redis:
    image: redis:7-alpine
    container_name: bb_redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - brainbrawler

  # PostgreSQL Database
  postgres:
    image: postgres:15
    container_name: bb_postgres
    environment:
      POSTGRES_DB: brainbrawler
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: dev_password_123
      POSTGRES_HOST_AUTH_METHOD: trust
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - brainbrawler

  # Adminer per gestione DB
  adminer:
    image: adminer
    container_name: bb_adminer
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    networks:
      - brainbrawler

  # Kafka UI per monitoraggio
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: bb_kafka_ui
    ports:
      - "8090:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    depends_on:
      - kafka
    networks:
      - brainbrawler

volumes:
  postgres_data:
  redis_data:

networks:
  brainbrawler:
    driver: bridge
```

### 3. Avvio Servizi Docker

```bash
# Avvia tutti i servizi
docker-compose -f docker-compose.dev.yml up -d

# Verifica che tutti i container siano running
docker ps

# Logs per debug
docker-compose -f docker-compose.dev.yml logs -f kafka
```

### 4. Backend Node.js Setup

#### 4.1 Inizializzazione Progetto

```bash
cd backend
npm init -y

# Installa dipendenze principali
npm install express socket.io cors helmet compression
npm install kafkajs ioredis @prisma/client bcryptjs jsonwebtoken
npm install google-auth-library multer uuid date-fns
npm install dotenv nodemon --save-dev

# Installa Prisma CLI
npm install prisma --save-dev
npx prisma init
```

#### 4.2 Configurazione Environment

Crea `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:dev_password_123@localhost:5432/brainbrawler"

# Redis
REDIS_URL="redis://localhost:6379"

# Kafka
KAFKA_BROKERS="localhost:9092"
KAFKA_CLIENT_ID="brainbrawler-game-service"

# JWT
JWT_SECRET="your-super-secret-jwt-key-for-dev-only-123456"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Server
PORT=3000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:8080"

# Game Settings
QUESTIONS_PER_GAME=10
TIME_PER_QUESTION=15
MAX_PLAYERS_PER_ROOM=8
ROOM_CODE_LENGTH=6
```

#### 4.3 Prisma Schema

Crea `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  username        String    @unique
  displayName     String
  googleId        String?   @unique
  avatar          String?
  passwordHash    String?
  totalGamesPlayed Int      @default(0)
  totalWins       Int       @default(0)
  totalScore      Int       @default(0)
  level           Int       @default(1)
  xp              Int       @default(0)
  lastLoginAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  gameResults     GameResult[]
  achievements    UserAchievement[]
  friendships     Friendship[] @relation("FriendshipFrom")
  friendsOf       Friendship[] @relation("FriendshipTo")
  
  @@map("users")
}

model Category {
  id          String     @id @default(cuid())
  name        String     @unique
  icon        String
  color       String
  description String?
  isActive    Boolean    @default(true)
  createdAt   DateTime   @default(now())
  
  questions   Question[]
  questionSets QuestionSet[]
  
  @@map("categories")
}

model Question {
  id            String     @id @default(cuid())
  text          String
  options       String[]   // Array di 4 opzioni
  correctAnswer Int        // Indice risposta corretta (0-3)
  categoryId    String
  category      Category   @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  difficulty    Difficulty
  imageUrl      String?
  explanation   String?    // Spiegazione risposta
  timeLimit     Int        @default(15) // secondi
  isActive      Boolean    @default(true)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  
  questionSets  QuestionSetItem[]
  
  @@map("questions")
}

model QuestionSet {
  id          String    @id @default(cuid())
  name        String
  description String?
  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])
  difficulty  Difficulty
  isPublic    Boolean   @default(true)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  questions   QuestionSetItem[]
  games       Game[]
  
  @@map("question_sets")
}

model QuestionSetItem {
  id            String      @id @default(cuid())
  questionSetId String
  questionSet   QuestionSet @relation(fields: [questionSetId], references: [id], onDelete: Cascade)
  questionId    String
  question      Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)
  order         Int
  
  @@unique([questionSetId, questionId])
  @@unique([questionSetId, order])
  @@map("question_set_items")
}

model Game {
  id              String       @id @default(cuid())
  roomCode        String       @unique @db.VarChar(6)
  questionSetId   String
  questionSet     QuestionSet  @relation(fields: [questionSetId], references: [id])
  status          GameStatus   @default(LOBBY)
  currentQuestion Int          @default(0)
  maxPlayers      Int          @default(8)
  timePerQuestion Int          @default(15)
  hostUserId      String
  startedAt       DateTime?
  endedAt         DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  results         GameResult[]
  
  @@map("games")
}

model GameResult {
  id              String   @id @default(cuid())
  gameId          String
  game            Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  finalScore      Int      @default(0)
  finalRank       Int      @default(0)
  correctAnswers  Int      @default(0)
  totalAnswers    Int      @default(0)
  avgResponseTime Float    @default(0) // millisecondi
  xpGained        Int      @default(0)
  completedAt     DateTime @default(now())
  
  @@unique([gameId, userId])
  @@map("game_results")
}

model Achievement {
  id          String    @id @default(cuid())
  name        String    @unique
  description String
  icon        String
  condition   String    // JSON condition
  xpReward    Int       @default(0)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  
  userAchievements UserAchievement[]
  
  @@map("achievements")
}

model UserAchievement {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievementId String
  achievement   Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)
  unlockedAt    DateTime    @default(now())
  
  @@unique([userId, achievementId])
  @@map("user_achievements")
}

model Friendship {
  id         String           @id @default(cuid())
  fromUserId String
  fromUser   User             @relation("FriendshipFrom", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUserId   String
  toUser     User             @relation("FriendshipTo", fields: [toUserId], references: [id], onDelete: Cascade)
  status     FriendshipStatus @default(PENDING)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
  
  @@unique([fromUserId, toUserId])
  @@map("friendships")
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

enum FriendshipStatus {
  PENDING
  ACCEPTED
  DECLINED
  BLOCKED
}
```

#### 4.4 Genera Database e Client

```bash
# Genera Prisma client
npx prisma generate

# Applica migrations
npx prisma migrate dev --name init

# Seed database (opzionale)
npx prisma db seed
```

#### 4.5 Struttura Backend

```bash
# Crea struttura directory
mkdir -p src/{controllers,services,middleware,routes,kafka,utils,types}
mkdir -p src/kafka/{producers,consumers}
```

#### 4.6 Package.json Scripts

Aggiorna `backend/package.json`:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "node src/utils/seed.js"
  }
}
```

### 5. Frontend Flutter Setup

#### 5.1 Crea Progetto Flutter

```bash
cd ..
flutter create frontend
cd frontend

# Aggiorna pubspec.yaml con dipendenze
```

#### 5.2 Dipendenze Flutter

Modifica `frontend/pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  flutter_riverpod: ^2.4.9
  
  # Network & Socket
  socket_io_client: ^2.0.3+1
  dio: ^5.4.0
  
  # UI & Navigation
  go_router: ^12.1.3
  flutter_animate: ^4.5.0
  lottie: ^2.7.0
  
  # Storage & Auth
  shared_preferences: ^2.2.2
  flutter_secure_storage: ^9.0.0
  google_sign_in: ^6.1.6
  
  # Utils
  uuid: ^4.2.1
  intl: ^0.19.0
  share_plus: ^7.2.1
  
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1
  build_runner: ^2.4.7
  json_serializable: ^6.7.1
```

#### 5.3 Struttura Flutter

```bash
mkdir -p lib/{models,providers,screens,widgets,services,utils,constants}
mkdir -p lib/screens/{auth,game,lobby,profile,leaderboard}
mkdir -p lib/widgets/{common,game,lobby}
```

### 6. Implementazione Backend Completa

#### 6.1 Server Principale

Crea `backend/src/server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const { PrismaClient } = require('@prisma/client');
const { KafkaProducer } = require('./kafka/producers/gameProducer');
const { GameEngine } = require('./services/gameEngine');
const { authMiddleware } = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const userRoutes = require('./routes/user');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const prisma = new PrismaClient();
const kafkaProducer = new KafkaProducer();
const gameEngine = new GameEngine(io, prisma);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:8080",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.use(authMiddleware);

io.on('connection', (socket) => {
  console.log(`User ${socket.user.username} connected`);
  
  socket.on('create-room', async (data) => {
    try {
      const room = await gameEngine.createRoom(socket.user.id, data.questionSetId);
      socket.join(room.roomCode);
      
      await kafkaProducer.send('room-events', {
        type: 'ROOM_CREATED',
        roomCode: room.roomCode,
        userId: socket.user.id,
        data: room
      });
      
      socket.emit('room-created', room);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('join-room', async (data) => {
    try {
      const result = await gameEngine.joinRoom(socket.user.id, data.roomCode);
      socket.join(data.roomCode);
      
      await kafkaProducer.send('player-events', {
        type: 'PLAYER_JOINED',
        roomCode: data.roomCode,
        userId: socket.user.id,
        timestamp: Date.now()
      });
      
      io.to(data.roomCode).emit('player-joined', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('start-game', async (data) => {
    try {
      await gameEngine.startGame(socket.user.id, data.roomCode);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('submit-answer', async (data) => {
    try {
      await kafkaProducer.send('answer-events', {
        type: 'ANSWER_SUBMITTED',
        userId: socket.user.id,
        roomCode: data.roomCode,
        questionId: data.questionId,
        answer: data.answer,
        timestamp: data.timestamp || Date.now()
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.user.username} disconnected`);
  });
});

// Start services
async function startServer() {
  try {
    await kafkaProducer.connect();
    await gameEngine.start();
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Adminer: http://localhost:8080`);
      console.log(`📈 Kafka UI: http://localhost:8090`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await kafkaProducer.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});
```

### 7. Comandi di Sviluppo

#### 7.1 Script di Avvio Completo

Crea `start-dev.sh`:

```bash
#!/bin/bash

echo "🚀 Avvio BrainBrawler Development Environment"

# Verifica Docker
if ! docker --version > /dev/null 2>&1; then
    echo "❌ Docker non trovato. Installa Docker Desktop"
    exit 1
fi

# Avvia servizi Docker
echo "🐳 Avvio servizi Docker..."
docker-compose -f docker-compose.dev.yml up -d

# Attendi che i servizi siano pronti
echo "⏳ Attendo che i servizi siano pronti..."
sleep 30

# Avvia backend
echo "🔧 Avvio backend..."
cd backend && npm run dev &

# Avvia frontend
echo "🎨 Avvio frontend..."
cd frontend && flutter run -d chrome &

echo "✅ Environment pronto!"
echo "📊 Adminer: http://localhost:8080"
echo "📈 Kafka UI: http://localhost:8090"
echo "🎮 App: http://localhost:8080"
echo "🔧 API: http://localhost:3000"
```

#### 7.2 Script di Stop

Crea `stop-dev.sh`:

```bash
#!/bin/bash

echo "🛑 Stopping BrainBrawler Development Environment"

# Stop Flutter
pkill -f "flutter run"

# Stop Node.js
pkill -f "node src/server.js"
pkill -f "nodemon"

# Stop Docker services
docker-compose -f docker-compose.dev.yml down

echo "✅ Environment stopped"
```

### 8. Test e Debug

#### 8.1 Test API con cURL

```bash
# Test health check
curl http://localhost:3000/health

# Test auth endpoints
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"password123"}'
```

#### 8.2 Debug con Logs

```bash
# Backend logs
cd backend && npm run dev

# Docker logs
docker-compose -f docker-compose.dev.yml logs -f

# Kafka logs
docker logs bb_kafka -f
```

### 9. Troubleshooting Comune

#### 9.1 Kafka Connection Issues

```bash
# Verifica Kafka topics
docker exec bb_kafka kafka-topics --list --bootstrap-server localhost:9092

# Crea topics manualmente se necessario
docker exec bb_kafka kafka-topics --create --topic room-events --bootstrap-server localhost:9092
docker exec bb_kafka kafka-topics --create --topic player-events --bootstrap-server localhost:9092
docker exec bb_kafka kafka-topics --create --topic answer-events --bootstrap-server localhost:9092
```

#### 9.2 Database Issues

```bash
# Reset database
cd backend
npx prisma migrate reset
npx prisma db seed
```

#### 9.3 Flutter Issues

```bash
# Clean Flutter
cd frontend
flutter clean
flutter pub get
flutter run -d chrome
```

### 10. Prossimi Passi

Una volta che l'environment è configurato:

1. **Implementa autenticazione completa**
2. **Crea le prime schermate Flutter**
3. **Implementa logica di gioco base**
4. **Aggiungi real-time features**
5. **Implementa sistema di punteggi**

Tutti i servizi sono ora configurati per lo sviluppo locale con hot reload e debug completo! 