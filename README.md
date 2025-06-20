# 🧠 BrainBrawler

> Multiplayer quiz game scalabile costruito con Kafka, Socket.io e Flutter

## 🚀 Quick Start

### Opzione 1: Script Automatico (Windows)
```bash
# Avvia tutto l'environment di sviluppo
./start-dev.bat

# Ferma tutto
./stop-dev.bat
```

### Opzione 2: Manuale

#### 1. Prerequisiti
- **Docker Desktop** installato e avviato
- **Node.js** >= 18.x
- **Git**

#### 2. Clone e Setup
```bash
git clone <your-repo-url>
cd brainbrawler

# Avvia servizi Docker
docker compose -f docker-compose.dev.yml up -d

# Setup backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed

# Avvia backend
npm run dev
```

## 🏗️ Architettura

```
BrainBrawler/
├── backend/           # Node.js + Socket.io + Kafka
├── frontend/          # Flutter Web/Mobile (TODO)
├── worker/            # Kafka consumers (TODO)
├── docker/            # Docker configs
└── docs/              # Documentazione
```

### Stack Tecnologico
- **Backend**: Node.js, Express, Socket.io, Prisma ORM
- **Database**: PostgreSQL
- **Cache**: Redis  
- **Messaging**: Apache Kafka
- **Frontend**: Flutter (Web + Mobile)
- **Auth**: JWT + Google OAuth

## 🎮 Features Implementate

### ✅ Backend Core
- [x] Sistema di autenticazione JWT
- [x] Gestione utenti e profili
- [x] Database schema completo
- [x] API REST complete
- [x] Socket.io per real-time
- [x] Game Engine con logica completa
- [x] Sistema di punteggi e ranking
- [x] Kafka producer per messaging
- [x] Seed database con dati di esempio

### 🚧 In Sviluppo
- [ ] Frontend Flutter
- [ ] Kafka consumers
- [ ] Sistema achievements
- [ ] Admin panel
- [ ] Mobile app

## 🌐 Servizi Locali

Una volta avviato, avrai accesso a:

| Servizio | URL | Descrizione |
|----------|-----|-------------|
| **API Backend** | http://localhost:3000 | Server principale |
| **Health Check** | http://localhost:3000/health | Status servizi |
| **Adminer** | http://localhost:8080 | Gestione database |
| **Kafka UI** | http://localhost:8090 | Monitoraggio Kafka |

## 🧪 Testing API

### Health Check
```bash
curl http://localhost:3000/health
```

### Registrazione Utente
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "displayName": "Test User",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@brainbrawler.com",
    "password": "admin123"
  }'
```

## 🎮 Credenziali Demo

| Email | Password | Ruolo |
|-------|----------|-------|
| admin@brainbrawler.com | admin123 | Admin |
| test@brainbrawler.com | test123 | Player |
| player@brainbrawler.com | player123 | Player |

## 📊 Database

### Schema Principale
- **Users**: Utenti e statistiche
- **Categories**: Categorie domande
- **Questions**: Domande con opzioni
- **QuestionSets**: Set di domande organizzati
- **Games**: Partite e stanze di gioco
- **GameResults**: Risultati partite
- **Achievements**: Sistema achievement

### Comandi Utili
```bash
# Visualizza database
npx prisma studio

# Reset database
npx prisma migrate reset

# Nuova migrazione
npx prisma migrate dev --name <name>

# Re-seed
npm run db:seed
```

## 🔧 Sviluppo

### Backend
```bash
cd backend
npm run dev          # Avvia con nodemon
npm run start        # Avvia production
npm run db:studio    # Apri Prisma Studio
npm run db:seed      # Popola database
```

### Socket.io Events

#### Client → Server
- `create-room` - Crea nuova stanza
- `join-room` - Unisciti a stanza  
- `start-game` - Inizia partita (solo host)
- `submit-answer` - Invia risposta
- `leave-room` - Abbandona stanza

#### Server → Client
- `room-created` - Stanza creata
- `player-joined` - Giocatore entrato
- `game-starting` - Partita in avvio
- `question-start` - Nuova domanda
- `question-end` - Fine domanda + risultati
- `game-end` - Fine partita + classifica

## 🐳 Docker Services

```yaml
# Servizi disponibili
- postgres:5432    # Database
- redis:6379       # Cache  
- kafka:9092       # Message broker
- zookeeper:2181   # Kafka coordinator
- adminer:8080     # DB admin
- kafka-ui:8090    # Kafka monitor
```

## 🚨 Troubleshooting

### Docker Issues
```bash
# Verifica servizi
docker ps

# Logs servizi
docker compose -f docker-compose.dev.yml logs -f

# Restart servizi
docker compose -f docker-compose.dev.yml restart
```

### Database Issues
```bash
# Reset completo database
npx prisma migrate reset

# Riapplica seed
npm run db:seed
```

### Kafka Issues
```bash
# Verifica topics
docker exec bb_kafka kafka-topics --list --bootstrap-server localhost:9092

# Crea topic manualmente
docker exec bb_kafka kafka-topics --create --topic test-topic --bootstrap-server localhost:9092
```

## 📁 Struttura File

```
backend/
├── src/
│   ├── controllers/     # Logic controllers
│   ├── services/        # Business logic
│   ├── middleware/      # Auth, validation
│   ├── routes/          # API routes
│   ├── kafka/           # Kafka producers/consumers
│   ├── utils/           # Utilities e seed
│   └── server.js        # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## 🎯 Prossimi Passi

1. **Frontend Flutter** - UI e client Socket.io
2. **Kafka Consumers** - Worker per game engine
3. **Mobile App** - iOS e Android
4. **Admin Panel** - Gestione domande
5. **Deploy Production** - Render.com setup

## 📝 API Endpoints

### Auth
- `POST /api/auth/register` - Registrazione
- `POST /api/auth/login` - Login
- `POST /api/auth/google` - Login Google
- `GET /api/auth/me` - Profilo corrente

### Game
- `GET /api/game/question-sets` - Lista set domande
- `GET /api/game/categories` - Lista categorie
- `GET /api/game/room/:code` - Info stanza
- `GET /api/game/leaderboard` - Classifica globale

### User  
- `GET /api/user/stats` - Statistiche personali
- `GET /api/user/achievements` - Achievement utente
- `GET /api/user/search` - Cerca utenti

## 🤝 Contribuire

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

## 📄 Licenza

Distributed under the MIT License. See `LICENSE` for more information.

---

Made with ❤️ for competitive quiz gaming! 