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
const questionsRoutes = require('./routes/questions');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow multiple origins for development
      const allowedOrigins = [
        'http://10.40.10.180:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3001'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

const prisma = new PrismaClient();
const kafkaProducer = new KafkaProducer();
const gameEngine = new GameEngine(io, prisma);

// Make gameEngine available to routes
app.locals.gameEngine = gameEngine;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    // Allow multiple origins for development
    const allowedOrigins = [
      'http://10.40.10.180:3001',
      'http://127.0.0.1:3001', 
      'http://localhost:3001'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/user', userRoutes);
app.use('/api/questions', questionsRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Socket.io connection handling
io.use(authMiddleware);

io.on('connection', (socket) => {
  console.log(`User ${socket.user?.username || 'anonymous'} connected`);
  
  // Create room
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
      console.error('Error creating room:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Join room
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
      console.error('Error joining room:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Start game
  socket.on('start-game', async (data) => {
    try {
      await gameEngine.startGame(socket.user.id, data.roomCode);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Join waiting room (for room lobby)
  socket.on('join-waiting-room', async (data) => {
    try {
      const { roomId } = data;
      console.log(`Player ${socket.user.id} joining waiting room ${roomId}`);
      
      // Join the Socket.io room for waiting room updates
      socket.join(`waiting-${roomId}`);
      
      // Send confirmation
      socket.emit('joined-waiting-room', {
        roomId: roomId,
        message: 'Successfully joined waiting room'
      });
      
    } catch (error) {
      console.error('Error joining waiting room:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Handle game start countdown (broadcast to all players in waiting room)
  socket.on('start-game-countdown', async (data) => {
    try {
      const { roomId, gameData } = data;
      console.log(`Broadcasting game start countdown for room ${roomId}`);
      
      // Broadcast countdown to all players in the waiting room
      socket.to(`waiting-${roomId}`).emit('game-starting-countdown', {
        gameData: gameData,
        message: 'Host started the game! Get ready...'
      });
      
    } catch (error) {
      console.error('Error broadcasting game start:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Join game room (for active games)
  socket.on('join-game-room', async (data) => {
    try {
      const { roomId, roomCode } = data;
      console.log(`🎮 Player ${socket.user.id} (${socket.user.username}) joining game room ${roomCode}`);
      
      // Join the Socket.io room
      socket.join(roomCode);
      console.log(`✅ Player ${socket.user.id} joined Socket.io room: ${roomCode}`);
      
      // Check if game state exists for this room
      const gameState = await gameEngine.getGameState(roomCode);
      if (gameState) {
        console.log(`🎯 Game state found for room ${roomCode}, status: ${gameState.status}`);
        
        // If game is ACTIVE and there's a current question, send it immediately
        if (gameState.status === 'ACTIVE' && gameState.questions && gameState.currentQuestion < gameState.questions.length) {
          const question = gameState.questions[gameState.currentQuestion];
          const questionNumber = gameState.currentQuestion + 1;
          const timeLimit = gameState.timePerQuestion || 15;
          
          console.log(`🎯 Sending current question ${questionNumber} to newly joined player ${socket.user.id}`);
          
          // Send current question to this specific player
          socket.emit('game-question', {
            question: {
              id: question.id,
              text: question.text,
              options: question.options,
            },
            questionNumber: questionNumber,
            totalQuestions: gameState.questions.length,
            timeLimit: timeLimit,
            roomCode: roomCode
          });
        }
      } else {
        console.log(`⚠️ No game state found for room ${roomCode}`);
      }
      
      // Notify other players
      socket.to(roomCode).emit('player-joined-game', {
        playerId: socket.user.id,
        displayName: socket.user.displayName || socket.user.username,
        timestamp: Date.now()
      });
      
      // Send confirmation
      socket.emit('joined-game-room', {
        roomId: roomId,
        roomCode: roomCode,
        message: 'Successfully joined game room',
        gameState: gameState ? { status: gameState.status } : null
      });
      
    } catch (error) {
      console.error('Error joining game room:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Submit answer to GameEngine
  socket.on('submit-answer', async (data) => {
    try {
      const { roomCode, questionIndex, answer } = data; // Removed timestamp - now server-side timing
      const userId = socket.user.id;
      
      console.log(`Answer from ${userId} in room ${roomCode}: ${answer} for question ${questionIndex}`);
      
      // Submit answer to GameEngine (no timestamp needed - server calculates response time)
      const result = await gameEngine.submitAnswer(userId, roomCode, questionIndex, answer);
      
      // Notify other players that this player answered
      socket.to(roomCode).emit('player-answered', {
        playerId: userId,
        hasAnswered: true,
        questionIndex: questionIndex
      });
      
      // Send confirmation to player
      socket.emit('answer-submitted', {
        success: true,
        questionIndex: questionIndex,
        answer: answer,
        isCorrect: result.isCorrect,
        responseTime: result.responseTime
      });
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Leave room
  socket.on('leave-room', async (data) => {
    try {
      socket.leave(data.roomCode);
      
      await kafkaProducer.send('player-events', {
        type: 'PLAYER_LEFT',
        roomCode: data.roomCode,
        userId: socket.user.id,
        timestamp: Date.now()
      });
      
      io.to(data.roomCode).emit('player-left', {
        userId: socket.user.id,
        username: socket.user.username
      });
    } catch (error) {
      console.error('Error leaving room:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User ${socket.user?.username || 'anonymous'} disconnected`);
  });
});

// Start services
async function startServer() {
  try {
    // Connect to Kafka (solo se disponibile)
    try {
      await kafkaProducer.connect();
      console.log('✅ Kafka connected');
    } catch (error) {
      console.warn('⚠️  Kafka not available, running without messaging:', error.message);
    }
    
    // Start game engine
    await gameEngine.start();
    console.log('✅ Game engine started');
    
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    
    server.listen(PORT, HOST, () => {
      console.log(`🚀 BrainBrawler server running on ${HOST}:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Adminer: http://localhost:8080`);
        console.log(`📈 Kafka UI: http://localhost:8090`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  try {
    await kafkaProducer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  try {
    await kafkaProducer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}); 