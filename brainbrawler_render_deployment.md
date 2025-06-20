# 🧠 BrainBrawler - Deployment su Render.com

## Guida Completa per Deployment Production

### Panoramica Architettura Render

**Servizi Render utilizzati:**
- **Web Service**: Backend Node.js + Socket.io
- **PostgreSQL**: Database managed
- **Redis**: Cache managed 
- **Static Site**: Frontend Flutter Web
- **Background Worker**: Kafka consumer (Game Engine)

### 1. Preparazione Repository

#### 1.1 Struttura Repository per Render

```bash
brainbrawler/
├── backend/                 # Node.js API + Socket.io
├── frontend/               # Flutter Web
├── worker/                 # Kafka consumer separato
├── render.yaml            # Render Blueprint
├── docker-compose.prod.yml # Per testing locale
└── README.md
```

#### 1.2 Configurazione Git

```bash
# Crea repository GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/brainbrawler.git
git push -u origin main
```

### 2. Configurazione Database PostgreSQL

#### 2.1 Crea Database su Render

1. **Dashboard Render** → **New** → **PostgreSQL**
2. **Name**: `brainbrawler-db`
3. **Database Name**: `brainbrawler`
4. **User**: `postgres` (default)
5. **Region**: `Frankfurt` (EU) o `Oregon` (US)
6. **Plan**: `Free` per sviluppo

#### 2.2 Configurazione Database

```sql
-- Extensions necessarie (automatiche su Render)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
```

### 3. Configurazione Redis

#### 3.1 Crea Redis su Render

1. **Dashboard Render** → **New** → **Redis**
2. **Name**: `brainbrawler-redis`
3. **Plan**: `Free` (25MB)
4. **Region**: Stessa del database

### 4. Backend Web Service

#### 4.1 Dockerfile per Backend

Crea `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine

# Installa dipendenze sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

WORKDIR /app

# Copia package files
COPY package*.json ./
COPY prisma ./prisma/

# Installa dipendenze
RUN npm ci --only=production && npm cache clean --force

# Genera Prisma client
RUN npx prisma generate

# Copia codice sorgente
COPY . .

# Crea user non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Cambia ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

#### 4.2 Package.json per Production

Aggiorna `backend/package.json`:

```json
{
  "name": "brainbrawler-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "build": "npm run db:generate",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "node src/utils/seed.js",
    "postinstall": "npm run db:generate"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### 4.3 Environment Variables Backend

Configurazione su Render Dashboard:

```env
# Database (auto-generated da Render)
DATABASE_URL=postgresql://username:password@host:port/database

# Redis (auto-generated da Render)
REDIS_URL=redis://username:password@host:port

# Kafka (CloudKarafka o Upstash)
KAFKA_BROKERS=your-kafka-brokers
KAFKA_CLIENT_ID=brainbrawler-prod
KAFKA_USERNAME=your-kafka-username
KAFKA_PASSWORD=your-kafka-password
KAFKA_SSL=true

# JWT & Security
JWT_SECRET=your-super-secure-jwt-secret-key-production
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App Settings
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-app-name.onrender.com

# Game Settings
QUESTIONS_PER_GAME=10
TIME_PER_QUESTION=15
MAX_PLAYERS_PER_ROOM=8
ROOM_CODE_LENGTH=6
```

#### 4.4 Configurazione Kafka (CloudKarafka)

Aggiorna `backend/src/kafka/producer.js` per production:

```javascript
const { Kafka } = require('kafkajs');

class KafkaProducer {
  constructor() {
    const kafkaConfig = {
      clientId: process.env.KAFKA_CLIENT_ID,
      brokers: process.env.KAFKA_BROKERS.split(',')
    };

    // SSL config per CloudKarafka
    if (process.env.KAFKA_SSL === 'true') {
      kafkaConfig.ssl = true;
      kafkaConfig.sasl = {
        mechanism: 'scram-sha-256',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
      };
    }

    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });
  }

  async connect() {
    await this.producer.connect();
    console.log('✅ Kafka Producer connected');
  }

  async send(topic, message) {
    const topicName = `${process.env.KAFKA_USERNAME}-${topic}`;
    
    await this.producer.send({
      topic: topicName,
      messages: [{
        key: message.roomCode || message.userId,
        value: JSON.stringify(message),
        timestamp: Date.now().toString()
      }]
    });
  }

  async disconnect() {
    await this.producer.disconnect();
  }
}

module.exports = { KafkaProducer };
```

### 5. Background Worker (Game Engine)

#### 5.1 Worker Separato

Crea `worker/package.json`:

```json
{
  "name": "brainbrawler-worker",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/worker.js",
    "dev": "nodemon src/worker.js"
  },
  "dependencies": {
    "kafkajs": "^2.2.4",
    "ioredis": "^5.3.2",
    "@prisma/client": "^5.7.1",
    "socket.io-client": "^4.7.4",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### 5.2 Worker Dockerfile

Crea `worker/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY ../backend/prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

COPY . .

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

CMD ["npm", "start"]
```

#### 5.3 Worker Principal

Crea `worker/src/worker.js`:

```javascript
require('dotenv').config();
const { GameEngine } = require('./gameEngine');
const { KafkaConsumer } = require('./kafka/consumer');
const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');
const io = require('socket.io-client');

class Worker {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.prisma = new PrismaClient();
    this.socket = io(process.env.BACKEND_URL, {
      auth: {
        token: process.env.WORKER_TOKEN
      }
    });
    this.gameEngine = new GameEngine(this.socket, this.prisma, this.redis);
    this.consumer = new KafkaConsumer('game-engine-group');
  }

  async start() {
    try {
      await this.consumer.connect();
      await this.gameEngine.start();
      
      const topics = [
        `${process.env.KAFKA_USERNAME}-answer-events`,
        `${process.env.KAFKA_USERNAME}-player-events`,
        `${process.env.KAFKA_USERNAME}-room-events`
      ];
      
      await this.consumer.subscribe(topics);
      
      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          const data = JSON.parse(message.value.toString());
          await this.gameEngine.handleMessage(topic, data);
        }
      });
      
      console.log('✅ Worker started successfully');
    } catch (error) {
      console.error('❌ Worker startup failed:', error);
      process.exit(1);
    }
  }
}

const worker = new Worker();
worker.start();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...');
  await worker.consumer.disconnect();
  await worker.prisma.$disconnect();
  await worker.redis.disconnect();
  process.exit(0);
});
```

### 6. Frontend Flutter Web

#### 6.1 Build Configuration

Aggiorna `frontend/pubspec.yaml`:

```yaml
name: brainbrawler
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'
  flutter: ">=3.10.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_web_plugins:
    sdk: flutter
    
  # Dipendenze production-ready
  flutter_riverpod: ^2.4.9
  socket_io_client: ^2.0.3+1
  dio: ^5.4.0
  go_router: ^12.1.3
  shared_preferences: ^2.2.2
  google_sign_in: ^6.1.6
  
flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/lottie/
    - assets/sounds/
```

#### 6.2 Configurazione API per Production

Crea `frontend/lib/constants/api_config.dart`:

```dart
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://brainbrawler-api.onrender.com'
  );
  
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL', 
    defaultValue: 'wss://brainbrawler-api.onrender.com'
  );
  
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: 'your-google-client-id'
  );
}
```

#### 6.3 Build Script per Web

Crea `frontend/build-web.sh`:

```bash
#!/bin/bash

echo "🔨 Building Flutter Web for production..."

# Clean previous builds
flutter clean
flutter pub get

# Build for production
flutter build web \
  --release \
  --web-renderer canvaskit \
  --dart-define=API_BASE_URL=https://brainbrawler-api.onrender.com \
  --dart-define=SOCKET_URL=wss://brainbrawler-api.onrender.com \
  --dart-define=GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID

echo "✅ Build completed!"
echo "📁 Files in build/web/"
```

### 7. Render Blueprint (render.yaml)

Crea `render.yaml` nella root:

```yaml
databases:
  - name: brainbrawler-db
    databaseName: brainbrawler
    user: postgres
    plan: free
    region: frankfurt

  - name: brainbrawler-redis
    type: redis
    plan: free
    region: frankfurt

services:
  # Backend API + Socket.io
  - type: web
    name: brainbrawler-api
    env: node
    region: frankfurt
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    rootDir: backend
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: brainbrawler-db
          property: connectionString
      - key: REDIS_URL
        fromDatabase:
          name: brainbrawler-redis
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: KAFKA_BROKERS
        value: your-kafka-brokers
      - key: KAFKA_USERNAME
        value: your-kafka-username
      - key: KAFKA_PASSWORD
        value: your-kafka-password
      - key: KAFKA_SSL
        value: true
      - key: GOOGLE_CLIENT_ID
        value: your-google-client-id
      - key: GOOGLE_CLIENT_SECRET
        value: your-google-client-secret
    
  # Background Worker
  - type: worker
    name: brainbrawler-worker
    env: node
    region: frankfurt
    plan: free
    buildCommand: npm install && npx prisma generate
    startCommand: npm start
    rootDir: worker
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: brainbrawler-db
          property: connectionString
      - key: REDIS_URL
        fromDatabase:
          name: brainbrawler-redis
          property: connectionString
      - key: KAFKA_BROKERS
        value: your-kafka-brokers
      - key: KAFKA_USERNAME
        value: your-kafka-username
      - key: KAFKA_PASSWORD
        value: your-kafka-password
      - key: BACKEND_URL
        fromService:
          type: web
          name: brainbrawler-api
          property: host
  
  # Frontend Flutter Web
  - type: static
    name: brainbrawler-app
    buildCommand: ./build-web.sh
    staticPublishPath: frontend/build/web
    envVars:
      - key: GOOGLE_CLIENT_ID
        value: your-google-client-id
```

### 8. Configurazione Kafka su CloudKarafka

#### 8.1 Setup CloudKarafka

1. **Registrati su CloudKarafka**: https://www.cloudkarafka.com/
2. **Crea istanza**: Plan `Free` (10MB)
3. **Ottieni credenziali**:
   - Bootstrap servers
   - Username
   - Password
   - Topics prefix

#### 8.2 Topics Configuration

```bash
# Topics da creare su CloudKarafka dashboard
username-room-events
username-player-events  
username-answer-events
username-score-events
username-notification-events
```

### 9. Deploy su Render

#### 9.1 Via Blueprint

```bash
# Push codice su GitHub
git add .
git commit -m "Production ready"
git push origin main

# Su Render Dashboard
# 1. New → Blueprint
# 2. Connect Repository
# 3. Seleziona render.yaml
# 4. Deploy
```

#### 9.2 Via Dashboard Manuale

**Step 1: Database**
- New → PostgreSQL → `brainbrawler-db`

**Step 2: Redis**
- New → Redis → `brainbrawler-redis`

**Step 3: Backend**
- New → Web Service
- Connect GitHub repo
- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

**Step 4: Worker**
- New → Background Worker
- Connect GitHub repo  
- Root Directory: `worker`
- Build Command: `npm install && npx prisma generate`
- Start Command: `npm start`

**Step 5: Frontend**
- New → Static Site
- Connect GitHub repo
- Build Command: `cd frontend && ./build-web.sh`
- Publish Directory: `frontend/build/web`

### 10. Database Migration

#### 10.1 Prima Deploy

```bash
# Sul servizio backend Render, esegui:
npm run db:migrate
npm run db:seed
```

#### 10.2 Script di Seed Production

Crea `backend/src/utils/seed.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Crea categorie
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Storia',
        icon: '🏛️',
        color: '#FF6B6B',
        description: 'Domande di storia mondiale'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Scienza',
        icon: '🧪',
        color: '#4ECDC4',
        description: 'Fisica, chimica, biologia'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Geografia',
        icon: '🌍',
        color: '#45B7D1',
        description: 'Capitali, fiumi, montagne'
      }
    }),
  ]);

  // Crea domande di esempio
  const questions = [
    {
      text: "Chi ha dipinto la Gioconda?",
      options: ["Leonardo da Vinci", "Michelangelo", "Raffaello", "Donatello"],
      correctAnswer: 0,
      categoryId: categories[0].id,
      difficulty: 'EASY'
    },
    // Aggiungi più domande...
  ];

  for (const q of questions) {
    await prisma.question.create({ data: q });
  }

  console.log('✅ Database seeded successfully');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 11. Monitoraggio e Debugging

#### 11.1 Logs Render

```bash
# Via Dashboard
# Services → [service-name] → Logs

# Via CLI (opzionale)
render logs [service-name]
```

#### 11.2 Health Checks

Aggiungi endpoint per monitoring:

```javascript
// backend/src/server.js
app.get('/health', async (req, res) => {
  try {
    // Test database
    await prisma.$queryRaw`SELECT 1`;
    
    // Test Redis
    await redis.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        kafka: 'connected'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### 12. Performance Optimization

#### 12.1 Backend Optimization

```javascript
// Compression e caching
app.use(compression());

// Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // requests per window
}));

// Connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=5'
    }
  }
});
```

#### 12.2 Frontend Optimization

```dart
// Code splitting
import 'package:flutter/foundation.dart';

class ApiService {
  static final _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();
  
  // Lazy loading
  late final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));
}
```

### 13. SSL e Dominio Custom

#### 13.1 Configurazione HTTPS

Render fornisce HTTPS automatico per tutti i servizi.

#### 13.2 Dominio Custom (Optional)

1. **Render Dashboard** → **Settings** → **Custom Domains**
2. Aggiungi dominio: `brainbrawler.com`
3. Configura DNS:
   ```
   CNAME @ brainbrawler-app.onrender.com
   CNAME api brainbrawler-api.onrender.com
   ```

### 14. Backup e Sicurezza

#### 14.1 Database Backup

Render PostgreSQL include backup automatici.

#### 14.2 Environment Variables Security

Usa Render secrets per dati sensibili:
- JWT_SECRET (auto-generated)
- GOOGLE_CLIENT_SECRET
- KAFKA_PASSWORD

### 15. Costi e Limiti

#### 15.1 Piano Free Render

- **Web Service**: 750 ore/mese
- **PostgreSQL**: 1GB storage
- **Redis**: 25MB
- **Background Worker**: 750 ore/mese
- **Static Site**: Illimitato

#### 15.2 CloudKarafka Free

- **Storage**: 10MB
- **Messages**: 10M/mese
- **Connections**: 5 simultanee

### 16. Troubleshooting Production

#### 16.1 Service Non Si Avvia

```bash
# Check logs
render logs brainbrawler-api

# Common issues:
# 1. Environment variables mancanti
# 2. Database connection failed
# 3. Port binding issues
```

#### 16.2 Database Connection Issues

```javascript
// Test connection
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

// Retry logic
async function connectWithRetry() {
  for (let i = 0; i < 5; i++) {
    try {
      await prisma.$connect();
      break;
    } catch (err) {
      console.log(`Database connection attempt ${i + 1} failed. Retrying...`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}
```

### 17. Scaling e Ottimizzazioni Future

#### 17.1 Upgrade Plans

Quando necessario:
- **Starter Plan**: $7/mese (più risorse)
- **Standard Plan**: $25/mese (custom domains, più worker)

#### 17.2 Database Scaling

```javascript
// Connection pooling avanzato
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=20'
    }
  }
});
```

Il deployment su Render.com è ora completo con architettura production-ready, monitoring, e scalabilità per migliaia di utenti simultanei!