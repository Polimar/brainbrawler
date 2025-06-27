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
        // Allow user to rejoin if already in room
        console.log(`👤 User ${userId} rejoining room ${roomCode}`);
        
        // Get user info
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

        return {
          success: true,
          alreadyJoined: true,
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
      }

      // Aggiungi player
      gameState.players.push(userId);
      gameState.scores[userId] = 0;

      await this.setGameState(roomCode, gameState);

      // Ottieni info utente
      const userInfo = await this.prisma.user.findUnique({
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
        user: userInfo
      };
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }

  // Inizia la partita
  async startGame(userId, roomCode) {
    try {
      console.log(`🚀 StartGame called for room ${roomCode} by user ${userId}`);
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState) {
        console.error(`❌ CRITICAL: Game state not found for room ${roomCode}`);
        throw new Error('Room not found');
      }
      
      console.log(`✅ Game state retrieved for ${roomCode}: status=${gameState.status}, questions=${gameState.questions?.length}, players=${gameState.players?.length}`);

      if (gameState.hostUserId !== userId) {
        throw new Error('Only host can start the game');
      }

      if (gameState.players.length < 1) {
        throw new Error('Need at least 1 player');
      }

      if (gameState.status !== 'LOBBY') {
        throw new Error('Game already started');
      }

      // Update game status
      gameState.status = 'ACTIVE';
      gameState.startedAt = Date.now();
      gameState.currentQuestion = 0;
      
      await this.setGameState(roomCode, gameState);

      // Update database
      await this.prisma.game.update({
        where: { roomCode },
        data: { 
          status: 'ACTIVE',
          startedAt: new Date()
        }
      });

      console.log(`🚀 Game starting in room ${roomCode} with ${gameState.players.length} players`);

      // Notify all players game is starting
      this.io.to(roomCode).emit('game-started', {
        message: 'Game is starting!',
        totalQuestions: gameState.questions.length,
        players: gameState.players
      });

      // Start questions with delay
      setTimeout(() => this.startQuestion(roomCode), 3000);

      return {
        success: true,
        message: 'Game started successfully',
        gameState: {
          roomCode,
          status: gameState.status,
          totalQuestions: gameState.questions.length,
          players: gameState.players.length
        }
      };
    } catch (error) {
      console.error('Error starting game:', error);
      throw error;
    }
  }

  // Inizia una domanda
  async startQuestion(roomCode) {
    try {
      console.log(`📚 StartQuestion called for room ${roomCode}`);
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState || gameState.status !== 'ACTIVE') {
        console.log(`⚠️ Game ${roomCode} is no longer active or not found. State: ${gameState?.status || 'null'}`);
        return;
      }

      if (gameState.currentQuestion >= gameState.questions.length) {
        await this.endGame(roomCode);
        return;
      }

      const question = gameState.questions[gameState.currentQuestion];
      const questionNumber = gameState.currentQuestion + 1;
      const timeLimit = gameState.timePerQuestion || 15;

      console.log(`❓ Starting question ${questionNumber} in room ${roomCode}: ${question.text}`);

      // Clear previous answers and set question start time (server-side)
      gameState.answers[gameState.currentQuestion] = {};
      gameState.questionStartTime = Date.now(); // Server timestamp when question starts
      await this.setGameState(roomCode, gameState);

      // Send question to all players via Socket.io
      const questionData = {
        question: {
          id: question.id,
          text: question.text,
          options: question.options,
          // Don't send correct answer to frontend
        },
        questionNumber: questionNumber,
        totalQuestions: gameState.questions.length,
        timeLimit: timeLimit,
        roomCode: roomCode
      };

      console.log(`📝 Sending question ${questionNumber} to room ${roomCode}:`, {
        text: question.text,
        options: question.options,
        players: gameState.players.length
      });
      
      this.io.to(roomCode).emit('game-question', questionData);
      console.log(`✅ Question ${questionNumber} emitted to Socket.io room ${roomCode}`);

      // Set timer for question end
      const timer = setTimeout(() => {
        console.log(`⏰ Time's up for question ${questionNumber} in room ${roomCode}`);
        this.endQuestion(roomCode);
      }, timeLimit * 1000);

      this.gameTimers.set(`${roomCode}-question`, timer);

      console.log(`📝 Question ${questionNumber} sent to ${gameState.players.length} players in room ${roomCode}`);

    } catch (error) {
      console.error('Error starting question:', error);
    }
  }

  // Gestisce l'invio di una risposta
  async submitAnswer(userId, roomCode, questionIndex, answer) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState || gameState.status !== 'ACTIVE') {
        throw new Error('Game not active');
      }

      if (questionIndex !== gameState.currentQuestion) {
        throw new Error('Invalid question index');
      }

      // Check if player already answered
      if (gameState.answers[questionIndex] && gameState.answers[questionIndex][userId]) {
        throw new Error('Already answered this question');
      }

      const currentQuestion = gameState.questions[questionIndex];
      const isCorrect = answer === currentQuestion.correctAnswer;
      
      // Calculate response time using server-side timing (ABSOLUTE TIME)
      const responseTime = Date.now() - gameState.questionStartTime;
      
      console.log(`⏱️ SERVER-SIDE TIMING: Question started at ${gameState.questionStartTime}, answered at ${Date.now()}, responseTime: ${responseTime}ms`);

      // Store answer
      if (!gameState.answers[questionIndex]) {
        gameState.answers[questionIndex] = {};
      }

      gameState.answers[questionIndex][userId] = {
        answer: answer,
        isCorrect: isCorrect,
        responseTime: responseTime,
        serverTimestamp: Date.now() // When server received the answer
      };

      await this.setGameState(roomCode, gameState);

      console.log(`📝 Answer received from ${userId} for question ${questionIndex + 1}: ${answer} (${isCorrect ? 'correct' : 'wrong'})`);

      return {
        success: true,
        isCorrect: isCorrect,
        responseTime: responseTime
      };
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  // Termina una domanda e mostra risultati
  async endQuestion(roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState || gameState.status !== 'ACTIVE') {
        return;
      }

      const currentQuestion = gameState.questions[gameState.currentQuestion];
      const correctAnswer = currentQuestion.correctAnswer;
      const answers = gameState.answers[gameState.currentQuestion] || {};
      
      console.log(`⏰ Time's up for question ${gameState.currentQuestion + 1} in room ${roomCode}`);
      
      // Calculate scores for this question
      const questionScores = {};
      const playerAnswers = {};
      
      for (const playerId of gameState.players) {
        const answer = answers[playerId];
        const isCorrect = answer !== undefined && answer.answer === correctAnswer;
        
        playerAnswers[playerId] = {
          answer: answer?.answer,
          isCorrect: isCorrect,
          responseTime: answer?.responseTime || null
        };
        
        // Calcola sempre i punti, sia per risposte corrette che sbagliate
        // Se il player non ha risposto (timeout), consideriamo come risposta sbagliata
        const responseTime = answer?.responseTime || 0;
        const questionTime = currentQuestion.timeLimit || gameState.timePerQuestion || 15;
        const points = this.calculateScore(isCorrect, responseTime, questionTime * 1000);
        
        gameState.scores[playerId] = (gameState.scores[playerId] || 0) + points;
        questionScores[playerId] = points;
        
        console.log(`🎯 Player ${playerId}: ${isCorrect ? 'CORRECT' : 'WRONG'} answer, ${points} points (total: ${gameState.scores[playerId]})`);
      }

      await this.setGameState(roomCode, gameState);

      // Send results to all players
      this.io.to(roomCode).emit('game-results', {
        questionNumber: gameState.currentQuestion + 1,
        correctAnswer: correctAnswer,
        correctOption: currentQuestion.options[correctAnswer],
        scores: gameState.scores,
        questionScores: questionScores,
        playerAnswers: playerAnswers,
        explanation: currentQuestion.explanation || null
      });

      console.log(`📊 Results sent for question ${gameState.currentQuestion + 1} in room ${roomCode}`);
      
      // Move to next question after showing results
      setTimeout(() => {
        this.nextQuestion(roomCode);
      }, 5000); // Show results for 5 seconds

    } catch (error) {
      console.error('Error ending question:', error);
    }
  }

  // Passa alla domanda successiva o termina il gioco
  async nextQuestion(roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState || gameState.status !== 'ACTIVE') {
        return;
      }

      gameState.currentQuestion++;
      
      if (gameState.currentQuestion >= gameState.questions.length) {
        // Game finished
        await this.endGame(roomCode);
      } else {
        // Start next question
        await this.setGameState(roomCode, gameState);
        await this.startQuestion(roomCode);
      }
    } catch (error) {
      console.error('Error moving to next question:', error);
    }
  }

  // Termina la partita
  async endGame(roomCode) {
    try {
      const gameState = await this.getGameState(roomCode);
      
      if (!gameState) {
        return;
      }

      gameState.status = 'FINISHED';
      gameState.endedAt = Date.now();
      
      // Calculate final leaderboard with detailed stats
      const leaderboard = await this.getLeaderboard(gameState.scores, gameState);
      
      // Calculate game statistics
      const gameStats = {
        totalQuestions: gameState.questions.length,
        gameDuration: gameState.endedAt - gameState.startedAt,
        totalPlayers: gameState.players.length,
        averageScore: Object.values(gameState.scores).reduce((a, b) => a + b, 0) / gameState.players.length
      };

      // Update database and clear all players from the room
      await this.prisma.game.update({
        where: { roomCode },
        data: {
          status: 'FINISHED',
          endedAt: new Date(),
          currentPlayers: 0 // Reset player count to 0
        }
      });

      // Mark all players as inactive when game finishes
      // First, get the game ID from roomCode
      const finishedGame = await this.prisma.game.findUnique({
        where: { roomCode: roomCode },
        select: { id: true }
      });

      if (finishedGame) {
        await this.prisma.gamePlayer.updateMany({
          where: {
            gameId: finishedGame.id,
            isActive: true
          },
          data: {
            isActive: false,
            leftAt: new Date()
          }
        });
      }

      // Save player results
      for (const playerId of gameState.players) {
        const score = gameState.scores[playerId] || 0;
        const correctAnswers = Object.values(gameState.answers).filter(
          questionAnswers => questionAnswers[playerId]?.isCorrect
        ).length;

        await this.updatePlayerStats(playerId, score, correctAnswers, gameState.questions.length);
      }

      await this.setGameState(roomCode, gameState);

      // Send final results to all players
      this.io.to(roomCode).emit('game-ended', {
        message: 'Game completed!',
        leaderboard: leaderboard,
        gameStats: gameStats,
        finalScores: gameState.scores,
        redirect: '/lobby.html'
      });

      // Clean up timers
      this.clearGameTimers(roomCode);

      // Delete game state after some time
      setTimeout(() => {
        this.deleteGameState(roomCode);
      }, 30000); // Keep for 30 seconds

      console.log(`🏁 Game ended in room ${roomCode}. Winner: ${leaderboard[0]?.username || 'Unknown'}`);
      console.log(`🧹 All players marked inactive and room cleared for future games`);

    } catch (error) {
      console.error('Error ending game:', error);
    }
  }

  // Aggiorna le statistiche del giocatore
  async updatePlayerStats(userId, score, correctAnswers, totalQuestions) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) return;

      const isWin = correctAnswers > totalQuestions / 2; // More than 50% correct = win
      const xpGained = this.calculateXP(correctAnswers, totalQuestions, score);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          totalGamesPlayed: { increment: 1 },
          totalWins: isWin ? { increment: 1 } : undefined,
          totalScore: { increment: score },
          xp: { increment: xpGained },
          level: Math.floor((user.xp + xpGained) / 1000) + 1 // Simple leveling
        }
      });

      console.log(`📊 Updated stats for ${userId}: +${score} score, +${xpGained} XP`);
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }

  // Calcola punteggio con regole semplificate e logiche
  calculateScore(isCorrect, responseTime, timeLimit) {
    // REGOLE:
    // - Risposta corretta: +100 punti base
    // - Risposta sbagliata: -100 punti (penalità)
    // - Bonus tempo: Solo su risposte corrette, +100 / tempo_risposta_arrotondato
    
    if (!isCorrect) {
      console.log(`🧮 Score calculation: WRONG ANSWER = -100 points`);
      return -100; // Penalità per risposta sbagliata
    }

    const baseScore = 100; // Punti base per risposta corretta
    
    // Converti responseTime da millisecondi a secondi e arrotonda all'unità
    const responseTimeSeconds = Math.round(responseTime / 1000);
    
    // Bonus tempo: 100 / tempo_risposta (arrotondato), ma almeno 1 secondo per evitare divisione per 0
    const timeForBonus = Math.max(1, responseTimeSeconds);
    const timeBonus = Math.floor(100 / timeForBonus);
    
    const totalScore = baseScore + timeBonus;
    
    console.log(`🧮 Score calculation: CORRECT ANSWER base=${baseScore}, timeBonus=${timeBonus} (responseTime=${responseTime}ms = ${responseTimeSeconds}s), total=${totalScore}`);
    
    return totalScore;
  }

  // Calcola XP guadagnati
  calculateXP(correctAnswers, totalQuestions, score) {
    let baseXP = 10; // XP base per partecipazione
    let accuracyBonus = Math.floor((correctAnswers / totalQuestions) * 50); // Bonus per accuratezza
    let scoreBonus = Math.floor(score / 100); // Bonus per punteggio alto
    
    return baseXP + accuracyBonus + scoreBonus;
  }

  // Genera leaderboard dettagliata
  async getLeaderboard(scores, gameState) {
    try {
      const leaderboard = [];
      
      for (const [userId, score] of Object.entries(scores)) {
        // Calcola risposte corrette per questo player
        let correctAnswers = 0;
        let totalResponseTime = 0;
        let responseTimes = [];
        
        // Conta risposte corrette e calcola tempo medio
        Object.values(gameState.answers).forEach(questionAnswers => {
          const playerAnswer = questionAnswers[userId];
          if (playerAnswer) {
            if (playerAnswer.isCorrect) {
              correctAnswers++;
            }
            if (playerAnswer.responseTime) {
              totalResponseTime += playerAnswer.responseTime;
              responseTimes.push(playerAnswer.responseTime);
            }
          }
        });
        
        const averageResponseTime = responseTimes.length > 0 
          ? Math.round(totalResponseTime / responseTimes.length) 
          : 0;
        
        const accuracy = gameState.questions.length > 0 
          ? Math.round((correctAnswers / gameState.questions.length) * 100) 
          : 0;
        
        // Ottieni info utente dal database
        let userInfo = { username: 'Unknown', displayName: 'Unknown Player' };
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { username: true, displayName: true }
          });
          if (user) {
            userInfo = user;
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
        
        leaderboard.push({
          userId,
          username: userInfo.username,
          displayName: userInfo.displayName,
          score,
          correctAnswers,
          totalQuestions: gameState.questions.length,
          accuracy,
          averageResponseTime,
          responseTimes
        });
      }
      
      // Ordina per punteggio decrescente
      leaderboard.sort((a, b) => b.score - a.score);
      
      // Aggiungi posizioni
      leaderboard.forEach((player, index) => {
        player.position = index + 1;
      });
      
      return leaderboard;
    } catch (error) {
      console.error('Error generating leaderboard:', error);
      // Fallback al vecchio formato
      return Object.entries(scores)
        .map(([userId, score]) => ({ userId, score }))
        .sort((a, b) => b.score - a.score);
    }
  }

  // Gestione stato gioco in Redis/memoria
  async getGameState(roomCode) {
    console.log(`🔍 Getting game state for room: ${roomCode}`);
    
    if (this.redis) {
      try {
        const state = await this.redis.get(`game:${roomCode}`);
        if (state) {
          const parsed = JSON.parse(state);
          console.log(`✅ Found game state in Redis for ${roomCode}, status: ${parsed.status}, questions: ${parsed.questions?.length}`);
          return parsed;
        } else {
          console.log(`❌ No game state found in Redis for ${roomCode}`);
          return null;
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }
    
    // Fallback a memoria (non persistente)
    const memoryState = this.memoryCache?.[roomCode] || null;
    if (memoryState) {
      console.log(`✅ Found game state in memory for ${roomCode}, status: ${memoryState.status}, questions: ${memoryState.questions?.length}`);
    } else {
      console.log(`❌ No game state found in memory for ${roomCode}`);
    }
    return memoryState;
  }

  async setGameState(roomCode, state) {
    console.log(`💾 Setting game state for room: ${roomCode}, status: ${state.status}, questions: ${state.questions?.length}`);
    
    if (this.redis) {
      try {
        await this.redis.setex(`game:${roomCode}`, 3600, JSON.stringify(state));
        console.log(`✅ Game state saved to Redis for ${roomCode}`);
        return;
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
    
    // Fallback a memoria
    this.memoryCache = this.memoryCache || {};
    this.memoryCache[roomCode] = state;
    console.log(`✅ Game state saved to memory for ${roomCode}`);
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