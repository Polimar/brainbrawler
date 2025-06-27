const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Controlla disponibilità nome room
router.get('/check-room-name', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.trim().length < 3) {
      return res.json({
        available: false,
        message: 'Room name must be at least 3 characters'
      });
    }

    // Cerca se esiste già una room attiva con questo nome
    const existingRoom = await prisma.game.findFirst({
      where: {
        name: name.trim(),
        status: {
          in: ['WAITING', 'LOBBY', 'ACTIVE']
        }
      }
    });

    res.json({
      available: !existingRoom,
      message: existingRoom ? 'Room name is already taken' : 'Room name is available'
    });

  } catch (error) {
    console.error('Check room name error:', error);
    res.status(500).json({ 
      available: false,
      message: 'Error checking room name availability' 
    });
  }
});



// Ottieni tutti i set di domande disponibili
router.get('/question-sets', optionalAuth, async (req, res) => {
  try {
    const questionSets = await prisma.questionSet.findMany({
      where: {
        isPublic: true
      },
      include: {
        questions: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    const formattedSets = questionSets.map(set => ({
      id: set.id,
      name: set.name,
      description: set.description,
      questionCount: set.questions.length,
      category: set.category,
      language: set.language,
      createdAt: set.createdAt
    }));

    res.json({
      questionSets: formattedSets,
      total: formattedSets.length
    });
  } catch (error) {
    console.error('Get question sets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Ottieni categorie disponibili
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        questions: true
      },
      orderBy: { name: 'asc' }
    });

    const formattedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      questionCount: cat.questions.length
    }));

    res.json({ categories: formattedCategories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni dettagli di un set di domande
router.get('/question-sets/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const questionSet = await prisma.questionSet.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                difficulty: true,
                imageUrl: true,
                timeLimit: true
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!questionSet) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    if (!questionSet.isPublic && !req.user) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const formattedSet = {
      id: questionSet.id,
      name: questionSet.name,
      description: questionSet.description,
      isPublic: questionSet.isPublic,
      category: questionSet.category,
      language: questionSet.language,
      questions: questionSet.questions.map((qi, index) => ({
        order: qi.order,
        questionNumber: index + 1,
        question: {
          id: qi.question.id,
          text: qi.question.text,
          difficulty: qi.question.difficulty,
          imageUrl: qi.question.imageUrl,
          timeLimit: qi.question.timeLimit
        }
      })),
      totalQuestions: questionSet.questions.length,
      createdAt: questionSet.createdAt
    };

    res.json({ questionSet: formattedSet });
  } catch (error) {
    console.error('Get question set error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cerca room per codice (senza join automatico)
router.get('/room/by-code/:roomCode', optionalAuth, async (req, res) => {
  try {
    const { roomCode } = req.params;

    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        questionSet: true
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomInfo = {
      roomCode: game.roomCode,
      status: game.status,
      maxPlayers: game.maxPlayers,
      timePerQuestion: game.timePerQuestion,
      questionSet: {
        name: game.questionSet.name,
        category: game.questionSet.category,
        totalQuestions: await prisma.questionSetItem.count({
          where: { questionSetId: game.questionSetId }
        })
      },
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      canJoin: game.status === 'LOBBY'
    };

    res.json({ room: roomInfo });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni risultati di una partita
router.get('/game/:gameId/results', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;

    // Verifica che l'utente abbia partecipato alla partita
    const userResult = await prisma.gameResult.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId: req.user.id
        }
      }
    });

    if (!userResult) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Ottieni tutti i risultati della partita
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        questionSet: true,
        gameResults: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                level: true
              }
            }
          },
          orderBy: { finalRank: 'asc' }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameResults = {
      gameId: game.id,
      roomCode: game.roomCode,
      status: game.status,
      questionSet: {
        name: game.questionSet.name,
        category: game.questionSet.category
      },
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      duration: game.endedAt && game.startedAt 
        ? game.endedAt.getTime() - game.startedAt.getTime()
        : null,
      results: game.gameResults.map(result => ({
        rank: result.finalRank,
        user: result.user,
        score: result.finalScore,
        correctAnswers: result.correctAnswers,
        totalAnswers: result.totalAnswers,
        accuracy: result.totalAnswers > 0 
          ? Math.round((result.correctAnswers / result.totalAnswers) * 100)
          : 0,
        avgResponseTime: Math.round(result.avgResponseTime),
        xpGained: result.xpGained
      }))
    };

    res.json({ game: gameResults });
  } catch (error) {
    console.error('Get game results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni storico partite dell'utente
router.get('/my-games', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const results = await prisma.gameResult.findMany({
      where: { userId: req.user.id },
      include: {
        game: {
          include: {
            questionSet: true
          }
        }
      },
      orderBy: { completedAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.gameResult.count({
      where: { userId: req.user.id }
    });

    const games = results.map(result => ({
      gameId: result.game.id,
      roomCode: result.game.roomCode,
      questionSet: {
        name: result.game.questionSet.name,
        category: result.game.questionSet.category
      },
      myResult: {
        rank: result.finalRank,
        score: result.finalScore,
        correctAnswers: result.correctAnswers,
        totalAnswers: result.totalAnswers,
        accuracy: result.totalAnswers > 0 
          ? Math.round((result.correctAnswers / result.totalAnswers) * 100)
          : 0,
        xpGained: result.xpGained
      },
      completedAt: result.completedAt,
      duration: result.game.endedAt && result.game.startedAt
        ? result.game.endedAt.getTime() - result.game.startedAt.getTime()
        : null
    }));

    res.json({
      games,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get my games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni leaderboard globale
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'all', limit = 50 } = req.query;

    let dateFilter = {};
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { gte: monthAgo } };
    }

    // Leaderboard per punteggio totale
    const topScorers = await prisma.user.findMany({
      where: dateFilter,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        totalScore: true,
        totalGamesPlayed: true,
        totalWins: true
      },
      orderBy: { totalScore: 'desc' },
      take: parseInt(limit)
    });

    // Leaderboard per vittorie
    const topWinners = await prisma.user.findMany({
      where: {
        ...dateFilter,
        totalWins: { gt: 0 }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        totalWins: true,
        totalGamesPlayed: true
      },
      orderBy: { totalWins: 'desc' },
      take: parseInt(limit)
    });

    res.json({
      period,
      leaderboards: {
        topScorers: topScorers.map((user, index) => ({
          rank: index + 1,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            level: user.level
          },
          totalScore: user.totalScore,
          totalGames: user.totalGamesPlayed,
          winRate: user.totalGamesPlayed > 0 
            ? Math.round((user.totalWins / user.totalGamesPlayed) * 100)
            : 0
        })),
        topWinners: topWinners.map((user, index) => ({
          rank: index + 1,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            level: user.level
          },
          totalWins: user.totalWins,
          totalGames: user.totalGamesPlayed,
          winRate: user.totalGamesPlayed > 0 
            ? Math.round((user.totalWins / user.totalGamesPlayed) * 100)
            : 0
        }))
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni statistiche generali del gioco
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalGames,
      totalQuestions,
      gamesLast24h,
      activeGames
    ] = await Promise.all([
      prisma.user.count(),
      prisma.game.count({ where: { status: 'FINISHED' } }),
      prisma.question.count({ where: { isActive: true } }),
      prisma.game.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.game.count({
        where: {
          status: {
            in: ['LOBBY', 'STARTING', 'IN_PROGRESS']
          }
        }
      })
    ]);

    res.json({
      stats: {
        totalUsers,
        totalGames,
        totalQuestions,
        gamesLast24h,
        activeGames
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available rooms  
router.get('/rooms', (req, res, next) => {
  console.log('🔥🔥🔥 ROOMS ENDPOINT HIT - Auth header:', req.headers.authorization ? 'Present' : 'Missing');
  next();
}, authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      console.log('🚨 NO USER ID - Authentication failed');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('🚨🚨🚨 ROOMS API CALLED BY USER:', userId);
    
    const rooms = await prisma.game.findMany({
      where: {
        OR: [
          // Show all public rooms (any status) - everyone can see them
          {
            isPrivate: false
          },
          // Always show rooms created by the current user, regardless of status  
          {
            createdBy: userId
          }
        ]
      },
      include: {
        questionSet: {
          select: {
            language: true,
            category: true
          }
        },
        players: {
          where: { isActive: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('🔍 ROOMS DEBUG - Rooms found:', rooms.length);
    console.log('🔍 ROOMS DEBUG - Room details:', rooms.map(r => ({ 
      id: r.id, 
      name: r.name, 
      status: r.status, 
      createdBy: r.createdBy,
      isUserRoom: r.createdBy === userId
    })));
    
    // Format rooms for frontend
    const formattedRooms = rooms.map(room => {
      const isCreator = room.createdBy === userId;
      
      if (isCreator) {
        console.log('🔍 ROOMS DEBUG - Creator room found:', { 
          id: room.id, 
          name: room.name, 
          status: room.status, 
          createdBy: room.createdBy,
          userId: userId,
          match: room.createdBy === userId
        });
      }
      
      return {
        id: room.id,
        name: room.name,
        category: room.questionSet?.category || room.category,
        language: room.questionSet?.language || 'EN',
        questionTime: room.questionTime,
        totalQuestions: room.totalQuestions,
        currentPlayers: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        isCreator: isCreator,
        canJoin: room.status === 'WAITING' || room.status === 'LOBBY',
        statusDisplay: getStatusDisplay(room.status, isCreator)
      };
    });
    
    // Helper function for status display
    function getStatusDisplay(status, isCreator) {
      switch (status) {
        case 'WAITING':
        case 'LOBBY':
          return isCreator ? 'Waiting for players' : 'Joinable';
        case 'ACTIVE':
          return isCreator ? 'Your game in progress' : 'In progress';
        case 'FINISHED':
          return isCreator ? 'Your game finished' : 'Completed';
        default:
          return status;
      }
    }

    res.json({ rooms: formattedRooms });
  } catch (error) {
    console.error('🚨 Get rooms error:', error);
    console.error('🚨 Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Quick match - join or create a room
router.post('/quick-match', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Try to find an available room
    let availableRoom = await prisma.game.findFirst({
      where: {
        status: 'WAITING',
        isPrivate: false,
        currentPlayers: {
          lt: 4 // maxPlayers
        }
      },
      orderBy: {
        currentPlayers: 'desc' // Prefer rooms with more players
      }
    });

    if (availableRoom) {
      // Join existing room
      try {
        const updatedRoom = await prisma.game.update({
          where: { id: availableRoom.id },
          data: {
            currentPlayers: {
              increment: 1
            }
          }
        });

        res.json({
          message: 'Joined existing room',
          roomId: availableRoom.id
        });
      } catch (error) {
        // Room might be full, try to create new one
        availableRoom = null;
      }
    }

    if (!availableRoom) {
      // Create new room
      const newRoom = await prisma.game.create({
        data: {
          name: `Quick Match Room`,
          category: 'General',
          questionTime: 10, // 10 secondi per domanda come da UX
          totalQuestions: 10,
          maxPlayers: 4,
          currentPlayers: 1,
          status: 'WAITING',
          isPrivate: false,
          createdBy: userId
        }
      });

      res.json({
        message: 'Created new room',
        roomId: newRoom.id
      });
    }
  } catch (error) {
    console.error('Quick match error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join specific room
router.post('/join-room', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    let room = await prisma.game.findUnique({
      where: { id: roomId },
      include: {
        players: {
          where: { isActive: true }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // For FINISHED rooms, automatically reset them to LOBBY when someone tries to join
    if (room.status === 'FINISHED') {
      console.log(`🔄 Auto-resetting FINISHED room ${roomId} to LOBBY status when user ${userId} tries to join`);
      
      // Mark all current players as inactive
      await prisma.gamePlayer.updateMany({
        where: {
          gameId: roomId,
          isActive: true
        },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      // Reset room to LOBBY status
      await prisma.game.update({
        where: { id: roomId },
        data: {
          status: 'LOBBY',
          startedAt: null,
          endedAt: null,
          currentQuestion: 0,
          currentPlayers: 0
          // Keep existing roomCode - don't set to null as it's not nullable
        }
      });

      // Clear any existing game state from GameEngine
      const gameEngine = req.app.locals.gameEngine;
      if (gameEngine && room.roomCode) {
        await gameEngine.deleteGameState(room.roomCode);
      }

      // Refresh room data after reset
      const resetRoom = await prisma.game.findUnique({
        where: { id: roomId },
        include: {
          players: {
            where: { isActive: true }
          }
        }
      });
      
      if (!resetRoom) {
        return res.status(404).json({ error: 'Room not found after reset' });
      }
      
      // Update room reference for the rest of the function
      room = resetRoom;
    } else if (room.status !== 'WAITING' && room.status !== 'LOBBY') {
      return res.status(400).json({ error: 'Room is not accepting new players' });
    }

    // Check if room is full, BUT ALWAYS allow creator to join
    const isCreator = room.createdBy === userId;
    if (room.players.length >= room.maxPlayers && !isCreator) {
      return res.status(400).json({ error: 'Room is full' });
    }

    // Check if user is already in the room
    const existingPlayer = await prisma.gamePlayer.findUnique({
      where: {
        gameId_userId: {
          gameId: roomId,
          userId: userId
        }
      }
    });

    if (existingPlayer && existingPlayer.isActive) {
      // If user is already in the room, allow them to rejoin/go to waiting room
      return res.json({
        success: true,
        message: 'Welcome back to the room',
        room: room,
        alreadyJoined: true
      });
    }

    // Add or reactivate player
    console.log(`🔄 Adding user ${userId} to room ${roomId}...`);
    const upsertResult = await prisma.gamePlayer.upsert({
      where: {
        gameId_userId: {
          gameId: roomId,
          userId: userId
        }
      },
      update: {
        isActive: true,
        leftAt: null,
        joinedAt: new Date()
      },
      create: {
        gameId: roomId,
        userId: userId,
        isActive: true
      }
    });
    console.log(`✅ User ${userId} successfully added to room ${roomId}:`, upsertResult);

    // Update currentPlayers count based on active players
    const activePlayersCount = await prisma.gamePlayer.count({
      where: {
        gameId: roomId,
        isActive: true
      }
    });

    const updatedRoom = await prisma.game.update({
      where: { id: roomId },
      data: {
        currentPlayers: activePlayersCount
      }
    });

    // Verify user is actually in the room before responding
    const verifyPlayer = await prisma.gamePlayer.findUnique({
      where: {
        gameId_userId: {
          gameId: roomId,
          userId: userId
        }
      }
    });
    
    console.log(`🔍 VERIFICATION: User ${userId} in room ${roomId}:`, verifyPlayer ? `YES (isActive: ${verifyPlayer.isActive})` : 'NO');

    res.json({
      success: true,
      message: 'Joined room successfully',
      room: updatedRoom
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create custom room (Premium only)
router.post('/create-room', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, 
      language,
      questionSetId,
      questionTime, 
      totalQuestions, 
      maxPlayers, 
      isPrivate, 
      password 
    } = req.body;

    // Check if user has premium access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true }
    });

    if (!user || (user.accountType !== 'PREMIUM' && user.accountType !== 'ADMIN')) {
      return res.status(403).json({ 
        error: 'Premium account required to create custom rooms',
        upgradeRequired: true 
      });
    }

    // Validate input
    if (!name || !questionSetId) {
      return res.status(400).json({ error: 'Room name and question set are required' });
    }

    // Verify question set exists and belongs to user
    const questionSet = await prisma.questionSet.findFirst({
      where: {
        id: questionSetId,
        OR: [
          { userId: userId },           // Question set dell'utente
          { isPublic: true }           // Question set pubblico
        ]
      },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      }
    });

    if (!questionSet) {
      return res.status(400).json({ error: 'Question set not found or access denied' });
    }

    if (questionTime < 5 || questionTime > 20) {
      return res.status(400).json({ error: 'Question time must be between 5 and 20 seconds' });
    }

    if (totalQuestions < 5 || totalQuestions > 100) {
      return res.status(400).json({ error: 'Total questions must be between 5 and 100' });
    }

    if (maxPlayers < 2 || maxPlayers > 10) {
      return res.status(400).json({ error: 'Max players must be between 2 and 10' });
    }

    const newRoom = await prisma.game.create({
      data: {
        name: name.trim(),
        language: language || 'EN',
        questionSetId: questionSetId,
        category: questionSet.category, // Use category from question set
        questionTime: parseInt(questionTime),
        totalQuestions: parseInt(totalQuestions),
        maxPlayers: parseInt(maxPlayers),
        currentPlayers: 1,
        status: 'LOBBY', // Premium rooms start in LOBBY status
        isPrivate: Boolean(isPrivate),
        password: password ? password.trim() : null,
        createdBy: userId
      }
    });

    // Add creator as first player
    await prisma.gamePlayer.create({
      data: {
        gameId: newRoom.id,
        userId: userId,
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      roomId: newRoom.id,
      room: newRoom
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get room details
router.get('/room/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    console.log('🔍 Getting room details for ID:', id);
    console.log('🔍 User ID:', userId);

    // Simple game query like debug
    const room = await prisma.game.findUnique({
      where: { id: id }
    });

    console.log('🔍 Room found:', room ? 'YES' : 'NO');

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get players with user data
    const players = await prisma.gamePlayer.findMany({
      where: { 
        gameId: id,
        isActive: true 
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            level: true
          }
        }
      }
    });

    console.log('🔍 Players found:', players.length);
    console.log('🔍 Player details:', players.map(p => ({ 
      userId: p.userId, 
      username: p.user?.username,
      displayName: p.user?.displayName 
    })));

    // Check if user is in the room
    const userInRoom = players.find(p => p.userId === userId);
    console.log('🔍 User in room:', userInRoom ? 'YES' : 'NO');
    
    if (!userInRoom) {
      return res.status(403).json({ error: 'You are not in this room' });
    }

    // Room data with real player information
    const roomData = {
      id: room.id,
      name: room.name,
      category: room.category,
      language: room.language,
      questionTime: room.questionTime,
      totalQuestions: room.totalQuestions,
      maxPlayers: room.maxPlayers,
      currentPlayers: players.length,
      status: room.status,
      isPrivate: room.isPrivate,
      createdBy: room.createdBy,
      createdAt: room.createdAt,
      players: players.map(p => ({
        id: p.userId,
        username: p.user?.username || 'Unknown Player',
        displayName: p.user?.displayName || p.user?.username || 'Unknown Player',
        level: p.user?.level || 1,
        isCreator: p.userId === room.createdBy,
        joinedAt: p.joinedAt
      }))
    };

    console.log('🔍 Room data prepared successfully');

    res.json({ 
      success: true,
      room: roomData 
    });
  } catch (error) {
    console.error('❌ Get room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start game (Creator only)
router.post('/start-room', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const room = await prisma.game.findUnique({
      where: { id: roomId },
      include: {
        questionSet: {
          include: {
            questions: {
              include: {
                question: true
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        players: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                level: true
              }
            }
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only creator can start the game
    if (room.createdBy !== userId) {
      return res.status(403).json({ error: 'Only room creator can start the game' });
    }

    // Check if room has enough players
    if (room.players.length < 1) { // Allow single player for testing
      return res.status(400).json({ error: 'Need at least 1 player to start' });
    }

    // Get all questions from the question set
    const allQuestions = room.questionSet.questions.map(qi => qi.question);
    
    if (allQuestions.length < room.totalQuestions) {
      return res.status(400).json({ 
        error: `Question set has only ${allQuestions.length} questions, but ${room.totalQuestions} required` 
      });
    }

    // Randomize and select questions for this game
    const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffledQuestions.slice(0, room.totalQuestions);

    // Always generate roomCode based on room ID for consistency
    const roomCode = `R${room.id}`;
    console.log(`🔑 Generated roomCode: ${roomCode} for room ID: ${room.id}`);

    // Create game state compatible with GameEngine
    const gameState = {
      roomCode: roomCode,
      gameId: room.id,
      hostUserId: userId,
      status: 'LOBBY',
      players: room.players.map(p => p.userId),
      currentQuestion: 0,
      questions: selectedQuestions,
      scores: room.players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
      answers: {},
      timePerQuestion: room.questionTime,
      questionSetInfo: {
        name: room.questionSet.name,
        category: room.category,
        difficulty: room.questionSet.difficulty || 'MEDIUM',
        totalQuestions: selectedQuestions.length
      },
      createdAt: Date.now()
    };

    // Initialize game state in GameEngine
    const gameEngine = req.app.locals.gameEngine;
    if (!gameEngine) {
      return res.status(500).json({ error: 'Game engine not available' });
    }

    // Set the game state in GameEngine Redis/Memory
    await gameEngine.setGameState(roomCode, gameState);
    console.log(`🎮 Game state initialized for room ${roomCode} with ${selectedQuestions.length} questions`);
    
    // CRITICAL DEBUG: Verify state was saved by immediately reading it back
    const verifyState = await gameEngine.getGameState(roomCode);
    if (verifyState) {
      console.log(`✅ VERIFIED: Game state successfully saved and retrieved for ${roomCode}`);
    } else {
      console.error(`❌ CRITICAL ERROR: Game state NOT found immediately after saving for ${roomCode}`);
    }

    // Update room status to ACTIVE and set roomCode
    const updatedRoom = await prisma.game.update({
      where: { id: roomId },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
        roomCode: roomCode
      }
    });

    // Start the game using GameEngine (this will handle Socket.io and timing)
    try {
      await gameEngine.startGame(userId, roomCode);
      console.log(`🚀 GameEngine.startGame called successfully for room ${roomCode}`);
    } catch (gameStartError) {
      console.error('GameEngine.startGame error:', gameStartError);
      // Continue anyway, the game state is set up
    }

    console.log(`🚀 Game started in room ${roomId} (${roomCode}) with ${selectedQuestions.length} questions`);

    res.json({
      success: true,
      message: 'Game started successfully',
      room: updatedRoom,
      gameData: {
        roomId: room.id,
        roomCode: roomCode,
        totalQuestions: room.totalQuestions,
        questionTime: room.questionTime,
        playersCount: room.players.length
      }
    });
  } catch (error) {
    console.error('Start room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave room
router.post('/leave-room', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const room = await prisma.game.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Mark player as inactive
    await prisma.gamePlayer.updateMany({
      where: {
        gameId: roomId,
        userId: userId,
        isActive: true
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });

    // Update currentPlayers count based on active players
    const activePlayersCount = await prisma.gamePlayer.count({
      where: {
        gameId: roomId,
        isActive: true
      }
    });

    const updatedRoom = await prisma.game.update({
      where: { id: roomId },
      data: {
        currentPlayers: activePlayersCount
      }
    });

    // NOTE: Room is NOT deleted when all players leave
    // Only the creator can explicitly delete the room or it gets deleted when game is completed

    res.json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset room (set FINISHED room back to LOBBY for restart)
router.post('/reset-room', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const room = await prisma.game.findUnique({
      where: { id: roomId },
      include: {
        players: {
          where: { isActive: true }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only creator can reset the room OR if room is FINISHED, anyone can restart it  
    const isCreator = room.createdBy === userId;
    const canReset = isCreator || room.status === 'FINISHED';

    if (!canReset) {
      return res.status(403).json({ error: 'Only room creator can reset the room' });
    }

    // Mark all current players as inactive (they need to rejoin)
    await prisma.gamePlayer.updateMany({
      where: {
        gameId: roomId,
        isActive: true
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });

    // Reset room to LOBBY status and clear player count
    const updatedRoom = await prisma.game.update({
      where: { id: roomId },
      data: {
        status: 'LOBBY',
        startedAt: null,
        endedAt: null,
        currentQuestion: 0,
        currentPlayers: 0 // Reset player count to 0
        // Keep existing roomCode - don't set to null as it's not nullable
      }
    });

    // Clear any existing game state from GameEngine
    const gameEngine = req.app.locals.gameEngine;
    if (gameEngine && room.roomCode) {
      await gameEngine.deleteGameState(room.roomCode);
    }

    console.log(`🔄 Room ${roomId} reset successfully - all players cleared, status back to LOBBY`);

    res.json({
      success: true,
      message: 'Room reset successfully',
      room: updatedRoom
    });
  } catch (error) {
    console.error('Reset room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete room (Premium only - Creator only)
router.delete('/room/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has premium access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true }
    });

    if (!user || (user.accountType !== 'PREMIUM' && user.accountType !== 'ADMIN')) {
      return res.status(403).json({ 
        error: 'Premium account required to delete rooms',
        upgradeRequired: true 
      });
    }

    const room = await prisma.game.findUnique({
      where: { id: id }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only creator can delete the room
    if (room.createdBy !== userId) {
      return res.status(403).json({ error: 'Only room creator can delete the room' });
    }

    // Can only delete rooms that aren't currently ACTIVE 
    // FINISHED rooms can be deleted, but ACTIVE games cannot
    if (room.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot delete active games. Wait for the game to finish or cancel it first.' });
    }

    // If room is FINISHED, statistics are already preserved in User table
    if (room.status === 'FINISHED') {
      console.log(`💾 FINISHED room ${id} - player statistics already saved in User table by GameEngine.updatePlayerStats()`);
      
      // Player statistics (totalGamesPlayed, totalWins, totalScore, xp, level) 
      // are already saved in the User table by GameEngine.endGame() -> updatePlayerStats()
      // So deletion of this room won't affect those core statistics
    }

    // Remove all players from the room first
    await prisma.gamePlayer.deleteMany({
      where: { gameId: id }
    });

    // Delete the room (game results are preserved due to cascade rules)
    await prisma.game.delete({
      where: { id: id }
    });

    console.log(`🗑️ Room ${id} deleted successfully by creator ${userId}. Game statistics preserved.`);

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 