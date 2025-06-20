const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

class GameEngine {
  constructor(io, prisma) {
    this.io = io;
    this.prisma = prisma || new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.gameTimers = new Map(); // Per gestire i timer delle partite
  }

  async start() {
    try {
      // Test Redis connection
      await this.redis.ping();
      console.log('✅ Game Engine Redis connected');
    } catch (error) {
      console.warn('⚠️  Redis not available, using memory cache');
      this.redis = null;
    }
  }

  // Genera codice stanza univoco
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Crea una nuova stanza di gioco
  async createRoom(userId, questionSetId) {
    try {
      const roomCode = this.generateRoomCode();
      
      // Verifica che il questionSet esista
      const questionSet = await this.prisma.questionSet.findUnique({
        where: { id: questionSetId },
        include: {
          questions: {
            include: {
              question: true
            },
            orderBy: {
              order: 'asc'
            }
          },
          category: true
        }
      });

      if (!questionSet) {
        throw new Error('Question set not found');
      }

      if (questionSet.questions.length === 0) {
        throw new Error('Question set is empty');
      }

      // Crea il gioco nel database
      const game = await this.prisma.game.create({
        data: {
          roomCode,
          questionSetId,
          hostUserId: userId,
          status: 'LOBBY',
          timePerQuestion: process.env.TIME_PER_QUESTION || 15,
          maxPlayers: process.env.MAX_PLAYERS_PER_ROOM || 8
        },
        include: {
          questionSet: {
            include: {
              category: true
            }
          }
        }
      });

      // Salva stato iniziale in Redis/memoria
      const gameState = {
        roomCode,
        gameId: game.id,
        hostUserId: userId,
        status: 'LOBBY',
        players: [userId],
        currentQuestion: 0,
        questions: questionSet.questions.map(qi => qi.question),
        scores: { [userId]: 0 },
        answers: {},
        questionSetInfo: {
          name: questionSet.name,
          category: questionSet.category.name,
          difficulty: questionSet.difficulty,
          totalQuestions: questionSet.questions.length
        },
        createdAt: Date.now()
      };

      await this.setGameState(roomCode, gameState);

      console.log(`🎮 Room ${roomCode} created by user ${userId}`);

      return {
        roomCode,
        gameId: game.id,
        questionSet: {
          name: questionSet.name,
          category: questionSet.category.name,
          difficulty: questionSet.difficulty,
          totalQuestions: questionSet.questions.length
        },
        maxPlayers: game.maxPlayers,
        timePerQuestion: game.timePerQuestion
      };
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  // Unisciti a una stanza
  async joinRoom(userId, roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState) {
        throw new Error('Room not found');
      }

      if (gameState.status !== 'LOBBY') {
        throw new Error('Game already started');
      }

      if (gameState.players.length >= 8) {
        throw new Error('Room is full');
      }

      if (gameState.players.includes(userId)) {
        throw new Error('Already in this room');
      }

      // Aggiungi player
      gameState.players.push(userId);
      gameState.scores[userId] = 0;

      await this.setGameState(roomCode, gameState);

      // Ottieni info utente
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          level: true
        }
      });

      console.log(`👤 User ${userId} joined room ${roomCode}`);

      return {
        success: true,
        gameState: {
          roomCode,
          status: gameState.status,
          players: gameState.players,
          questionSetInfo: gameState.questionSetInfo,
          maxPlayers: 8,
          timePerQuestion: 15
        },
        user
      };
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }

  // Inizia la partita
  async startGame(userId, roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState) {
        throw new Error('Room not found');
      }

      if (gameState.hostUserId !== userId) {
        throw new Error('Only host can start the game');
      }

      if (gameState.players.length < 2) {
        throw new Error('Need at least 2 players');
      }

      if (gameState.status !== 'LOBBY') {
        throw new Error('Game already started');
      }

      // Aggiorna stato
      gameState.status = 'STARTING';
      gameState.currentQuestion = 0;
      gameState.startedAt = Date.now();

      await this.setGameState(roomCode, gameState);

      // Aggiorna database
      await this.prisma.game.update({
        where: { roomCode },
        data: {
          status: 'STARTING',
          startedAt: new Date()
        }
      });

      // Notifica tutti i player
      this.io.to(roomCode).emit('game-starting', {
        message: 'Game starting in 3 seconds...',
        countdown: 3
      });

      // Avvia countdown
      setTimeout(() => this.startQuestion(roomCode), 3000);

      console.log(`🚀 Game starting in room ${roomCode}`);
    } catch (error) {
      console.error('Error starting game:', error);
      throw error;
    }
  }

  // Avvia una domanda
  async startQuestion(roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState) return;

      if (gameState.currentQuestion >= gameState.questions.length) {
        return this.endGame(roomCode);
      }

      const question = gameState.questions[gameState.currentQuestion];
      
      gameState.status = 'IN_PROGRESS';
      gameState.questionStartTime = Date.now();
      gameState.answers[gameState.currentQuestion] = {};

      await this.setGameState(roomCode, gameState);

      // Aggiorna database
      await this.prisma.game.update({
        where: { roomCode },
        data: {
          status: 'IN_PROGRESS',
          currentQuestion: gameState.currentQuestion
        }
      });

      // Invia domanda ai client (senza risposta corretta)
      const questionForClient = {
        id: question.id,
        text: question.text,
        options: question.options,
        imageUrl: question.imageUrl,
        timeLimit: question.timeLimit || 15,
        questionNumber: gameState.currentQuestion + 1,
        totalQuestions: gameState.questions.length
      };

      this.io.to(roomCode).emit('question-start', {
        question: questionForClient,
        timeRemaining: question.timeLimit || 15
      });

      // Avvia timer per fine domanda
      const timer = setTimeout(() => {
        this.endQuestion(roomCode);
      }, (question.timeLimit || 15) * 1000);

      this.gameTimers.set(`${roomCode}-question`, timer);

      console.log(`❓ Question ${gameState.currentQuestion + 1} started in room ${roomCode}`);
    } catch (error) {
      console.error('Error starting question:', error);
    }
  }

  // Gestisce risposta del player
  async submitAnswer(userId, roomCode, questionId, answer, timestamp) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState || gameState.status !== 'IN_PROGRESS') {
        return;
      }

      const currentQuestion = gameState.questions[gameState.currentQuestion];
      
      if (currentQuestion.id !== questionId) {
        return; // Domanda non corrente
      }

      // Verifica se ha già risposto
      if (gameState.answers[gameState.currentQuestion][userId]) {
        return; // Già risposto
      }

      // Calcola tempo di risposta
      const responseTime = timestamp - gameState.questionStartTime;
      const isCorrect = answer === currentQuestion.correctAnswer;
      
      // Calcola punteggio
      const score = this.calculateScore(isCorrect, responseTime, currentQuestion.timeLimit || 15);

      // Salva risposta
      gameState.answers[gameState.currentQuestion][userId] = {
        answer,
        timestamp,
        responseTime,
        isCorrect,
        score
      };

      // Aggiorna punteggio totale
      gameState.scores[userId] += score;

      await this.setGameState(roomCode, gameState);

      // Conferma ricezione al player
      const socket = [...this.io.sockets.sockets.values()]
        .find(s => s.user?.id === userId);
      
      if (socket) {
        socket.emit('answer-confirmed', {
          score,
          isCorrect,
          responseTime
        });
      }

      // Controlla se tutti hanno risposto
      const totalPlayers = gameState.players.length;
      const totalAnswers = Object.keys(gameState.answers[gameState.currentQuestion]).length;

      if (totalAnswers >= totalPlayers) {
        // Tutti hanno risposto, termina domanda
        clearTimeout(this.gameTimers.get(`${roomCode}-question`));
        this.endQuestion(roomCode);
      }

      console.log(`💬 Answer submitted by ${userId} in room ${roomCode}: ${isCorrect ? 'CORRECT' : 'WRONG'}`);
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  }

  // Termina la domanda corrente
  async endQuestion(roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState) return;

      const currentQuestion = gameState.questions[gameState.currentQuestion];
      const answers = gameState.answers[gameState.currentQuestion];

      // Prepara risultati
      const results = gameState.players.map(playerId => {
        const playerAnswer = answers[playerId];
        return {
          userId: playerId,
          answer: playerAnswer?.answer ?? null,
          isCorrect: playerAnswer?.isCorrect ?? false,
          score: playerAnswer?.score ?? 0,
          responseTime: playerAnswer?.responseTime ?? null
        };
      });

      // Invia risultati
      this.io.to(roomCode).emit('question-end', {
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        results,
        leaderboard: this.getLeaderboard(gameState.scores),
        nextQuestionIn: 5
      });

      // Avanza alla prossima domanda
      gameState.currentQuestion++;
      await this.setGameState(roomCode, gameState);

      // Timer per prossima domanda o fine gioco
      const timer = setTimeout(() => {
        if (gameState.currentQuestion >= gameState.questions.length) {
          this.endGame(roomCode);
        } else {
          this.startQuestion(roomCode);
        }
      }, 5000);

      this.gameTimers.set(`${roomCode}-next`, timer);

      console.log(`✅ Question ended in room ${roomCode}`);
    } catch (error) {
      console.error('Error ending question:', error);
    }
  }

  // Termina la partita
  async endGame(roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState) return;

      gameState.status = 'FINISHED';
      gameState.endedAt = Date.now();

      // Calcola classifica finale
      const finalLeaderboard = this.getLeaderboard(gameState.scores);
      
      // Salva risultati nel database
      for (let i = 0; i < finalLeaderboard.length; i++) {
        const player = finalLeaderboard[i];
        
        // Calcola statistiche
        let correctAnswers = 0;
        let totalResponseTime = 0;
        let answeredQuestions = 0;

        for (let q = 0; q < gameState.currentQuestion; q++) {
          const answer = gameState.answers[q]?.[player.userId];
          if (answer) {
            answeredQuestions++;
            if (answer.isCorrect) correctAnswers++;
            totalResponseTime += answer.responseTime;
          }
        }

        const avgResponseTime = answeredQuestions > 0 ? totalResponseTime / answeredQuestions : 0;
        const xpGained = this.calculateXP(i + 1, correctAnswers, finalLeaderboard.length);

        await this.prisma.gameResult.create({
          data: {
            gameId: gameState.gameId,
            userId: player.userId,
            finalScore: player.score,
            finalRank: i + 1,
            correctAnswers,
            totalAnswers: answeredQuestions,
            avgResponseTime,
            xpGained
          }
        });

        // Aggiorna statistiche utente
        await this.prisma.user.update({
          where: { id: player.userId },
          data: {
            totalGamesPlayed: { increment: 1 },
            totalWins: i === 0 ? { increment: 1 } : undefined,
            totalScore: { increment: player.score },
            xp: { increment: xpGained }
          }
        });
      }

      // Aggiorna stato gioco nel database
      await this.prisma.game.update({
        where: { roomCode },
        data: {
          status: 'FINISHED',
          endedAt: new Date()
        }
      });

      await this.setGameState(roomCode, gameState);

      // Invia risultati finali
      this.io.to(roomCode).emit('game-end', {
        finalLeaderboard,
        gameStats: {
          totalQuestions: gameState.questions.length,
          totalPlayers: gameState.players.length,
          duration: gameState.endedAt - gameState.startedAt
        }
      });

      // Cleanup
      this.clearGameTimers(roomCode);
      
      // Rimuovi stato del gioco dopo 5 minuti
      setTimeout(() => {
        this.deleteGameState(roomCode);
      }, 5 * 60 * 1000);

      console.log(`🏁 Game ended in room ${roomCode}`);
    } catch (error) {
      console.error('Error ending game:', error);
    }
  }

  // Calcola punteggio
  calculateScore(isCorrect, responseTime, timeLimit) {
    if (!isCorrect) return 0;

    const baseScore = 1000;
    const maxTimeBonus = 500;
    
    // Bonus tempo: più veloce = più punti
    const timeBonus = Math.max(0, maxTimeBonus * (1 - responseTime / (timeLimit * 1000)));
    
    return Math.floor(baseScore + timeBonus);
  }

  // Calcola XP
  calculateXP(rank, correctAnswers, totalPlayers) {
    const baseXP = correctAnswers * 10;
    const rankBonus = Math.max(0, (totalPlayers - rank + 1) * 5);
    return baseXP + rankBonus;
  }

  // Genera leaderboard
  getLeaderboard(scores) {
    return Object.entries(scores)
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score);
  }

  // Gestione stato gioco in Redis/memoria
  async getGameState(roomCode) {
    if (this.redis) {
      try {
        const state = await this.redis.get(`game:${roomCode}`);
        return state ? JSON.parse(state) : null;
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }
    
    // Fallback a memoria (non persistente)
    return this.memoryCache?.[roomCode] || null;
  }

  async setGameState(roomCode, state) {
    if (this.redis) {
      try {
        await this.redis.setex(`game:${roomCode}`, 3600, JSON.stringify(state));
        return;
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
    
    // Fallback a memoria
    this.memoryCache = this.memoryCache || {};
    this.memoryCache[roomCode] = state;
  }

  async deleteGameState(roomCode) {
    if (this.redis) {
      try {
        await this.redis.del(`game:${roomCode}`);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    } else if (this.memoryCache) {
      delete this.memoryCache[roomCode];
    }
  }

  // Cleanup timer
  clearGameTimers(roomCode) {
    const questionTimer = this.gameTimers.get(`${roomCode}-question`);
    const nextTimer = this.gameTimers.get(`${roomCode}-next`);
    
    if (questionTimer) {
      clearTimeout(questionTimer);
      this.gameTimers.delete(`${roomCode}-question`);
    }
    
    if (nextTimer) {
      clearTimeout(nextTimer);
      this.gameTimers.delete(`${roomCode}-next`);
    }
  }
}

module.exports = { GameEngine };