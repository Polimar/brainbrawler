const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Ottieni tutti i set di domande disponibili
router.get('/question-sets', optionalAuth, async (req, res) => {
  try {
    const questionSets = await prisma.questionSet.findMany({
      where: {
        isActive: true,
        isPublic: true
      },
      include: {
        category: true,
        _count: {
          select: {
            questions: true
          }
        }
      },
      orderBy: [
        { category: { name: 'asc' } },
        { difficulty: 'asc' },
        { name: 'asc' }
      ]
    });

    const formattedSets = questionSets.map(set => ({
      id: set.id,
      name: set.name,
      description: set.description,
      difficulty: set.difficulty,
      questionCount: set._count.questions,
      category: {
        id: set.category.id,
        name: set.category.name,
        icon: set.category.icon,
        color: set.category.color
      },
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
        _count: {
          select: {
            questions: true,
            questionSets: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      questionCount: cat._count.questions,
      setCount: cat._count.questionSets
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
        category: true,
        questions: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                difficulty: true,
                imageUrl: true,
                timeLimit: true,
                // Non inviamo le opzioni e la risposta corretta per sicurezza
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

    if (!questionSet.isActive || (!questionSet.isPublic && !req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const formattedSet = {
      id: questionSet.id,
      name: questionSet.name,
      description: questionSet.description,
      difficulty: questionSet.difficulty,
      isPublic: questionSet.isPublic,
      category: {
        id: questionSet.category.id,
        name: questionSet.category.name,
        icon: questionSet.category.icon,
        color: questionSet.category.color
      },
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
router.get('/room/:roomCode', optionalAuth, async (req, res) => {
  try {
    const { roomCode } = req.params;

    const game = await prisma.game.findUnique({
      where: { roomCode },
      include: {
        questionSet: {
          include: {
            category: true
          }
        }
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
        category: game.questionSet.category.name,
        difficulty: game.questionSet.difficulty,
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
        questionSet: {
          include: {
            category: true
          }
        },
        results: {
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
        category: game.questionSet.category.name,
        difficulty: game.questionSet.difficulty
      },
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      duration: game.endedAt && game.startedAt 
        ? game.endedAt.getTime() - game.startedAt.getTime()
        : null,
      results: game.results.map(result => ({
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
            questionSet: {
              include: {
                category: true
              }
            }
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
        category: result.game.questionSet.category.name,
        difficulty: result.game.questionSet.difficulty
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
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await prisma.game.findMany({
      where: {
        status: 'WAITING',
        currentPlayers: {
          lt: prisma.raw('max_players')
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        questionTime: true,
        totalQuestions: true,
        currentPlayers: true,
        maxPlayers: true,
        isPrivate: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
          lt: prisma.raw('max_players')
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

        // TODO: Add user to room participants
        
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
          questionTime: 30,
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

    const room = await prisma.game.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.status !== 'WAITING') {
      return res.status(400).json({ error: 'Room is not accepting new players' });
    }

    if (room.currentPlayers >= room.maxPlayers) {
      return res.status(400).json({ error: 'Room is full' });
    }

    // Update room player count
    const updatedRoom = await prisma.game.update({
      where: { id: roomId },
      data: {
        currentPlayers: {
          increment: 1
        }
      }
    });

    // TODO: Add user to room participants

    res.json({
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
      category, 
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
    if (!name || !category) {
      return res.status(400).json({ error: 'Room name and category are required' });
    }

    if (questionTime < 10 || questionTime > 120) {
      return res.status(400).json({ error: 'Question time must be between 10 and 120 seconds' });
    }

    if (totalQuestions < 5 || totalQuestions > 50) {
      return res.status(400).json({ error: 'Total questions must be between 5 and 50' });
    }

    if (maxPlayers < 2 || maxPlayers > 8) {
      return res.status(400).json({ error: 'Max players must be between 2 and 8' });
    }

    const newRoom = await prisma.game.create({
      data: {
        name: name.trim(),
        category,
        questionTime: parseInt(questionTime),
        totalQuestions: parseInt(totalQuestions),
        maxPlayers: parseInt(maxPlayers),
        currentPlayers: 1,
        status: 'WAITING',
        isPrivate: Boolean(isPrivate),
        password: password ? password.trim() : null,
        createdBy: userId
      }
    });

    res.status(201).json({
      message: 'Room created successfully',
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

    const room = await prisma.game.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
            avatar: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 