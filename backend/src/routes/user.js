const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Ottieni statistiche personali
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Statistiche base dell'utente
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        level: true,
        xp: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Statistiche dettagliate dai risultati delle partite
    const gameStats = await prisma.gameResult.aggregate({
      where: { userId },
      _avg: {
        finalScore: true,
        avgResponseTime: true,
        finalRank: true
      },
      _sum: {
        correctAnswers: true,
        totalAnswers: true,
        xpGained: true
      },
      _max: {
        finalScore: true
      }
    });

    // Partite recenti (ultime 10)
    const recentGames = await prisma.gameResult.findMany({
      where: { userId },
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
      take: 10
    });

    // Statistiche per categoria
    const categoryStats = await prisma.gameResult.findMany({
      where: { userId },
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
      }
    });

    // Raggruppa per categoria
    const categoryBreakdown = categoryStats.reduce((acc, result) => {
      const categoryName = result.game.questionSet.category.name;
      if (!acc[categoryName]) {
        acc[categoryName] = {
          category: result.game.questionSet.category,
          gamesPlayed: 0,
          totalScore: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          wins: 0
        };
      }
      
      acc[categoryName].gamesPlayed++;
      acc[categoryName].totalScore += result.finalScore;
      acc[categoryName].correctAnswers += result.correctAnswers;
      acc[categoryName].totalAnswers += result.totalAnswers;
      if (result.finalRank === 1) acc[categoryName].wins++;
      
      return acc;
    }, {});

    // Converti in array e calcola percentuali
    const categoryArray = Object.values(categoryBreakdown).map(cat => ({
      category: cat.category,
      gamesPlayed: cat.gamesPlayed,
      avgScore: cat.gamesPlayed > 0 ? Math.round(cat.totalScore / cat.gamesPlayed) : 0,
      accuracy: cat.totalAnswers > 0 ? Math.round((cat.correctAnswers / cat.totalAnswers) * 100) : 0,
      winRate: cat.gamesPlayed > 0 ? Math.round((cat.wins / cat.gamesPlayed) * 100) : 0
    }));

    // Trend ultimi 30 giorni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await prisma.gameResult.findMany({
      where: {
        userId,
        completedAt: { gte: thirtyDaysAgo }
      },
      select: {
        finalScore: true,
        finalRank: true,
        completedAt: true
      },
      orderBy: { completedAt: 'asc' }
    });

    const stats = {
      overview: {
        level: user.level,
        xp: user.xp,
        xpToNextLevel: ((user.level * 1000) - (user.xp % 1000)),
        totalGamesPlayed: user.totalGamesPlayed,
        totalWins: user.totalWins,
        totalScore: user.totalScore,
        winRate: user.totalGamesPlayed > 0 
          ? Math.round((user.totalWins / user.totalGamesPlayed) * 100) 
          : 0,
        memberSince: user.createdAt
      },
      performance: {
        avgScore: gameStats._avg.finalScore ? Math.round(gameStats._avg.finalScore) : 0,
        bestScore: gameStats._max.finalScore || 0,
        avgRank: gameStats._avg.finalRank ? Math.round(gameStats._avg.finalRank * 10) / 10 : 0,
        avgResponseTime: gameStats._avg.avgResponseTime ? Math.round(gameStats._avg.avgResponseTime) : 0,
        totalCorrectAnswers: gameStats._sum.correctAnswers || 0,
        totalAnswers: gameStats._sum.totalAnswers || 0,
        overallAccuracy: gameStats._sum.totalAnswers > 0 
          ? Math.round((gameStats._sum.correctAnswers / gameStats._sum.totalAnswers) * 100)
          : 0,
        totalXpGained: gameStats._sum.xpGained || 0
      },
      categories: categoryArray,
      recentGames: recentGames.map(result => ({
        gameId: result.game.id,
        roomCode: result.game.roomCode,
        category: result.game.questionSet.category.name,
        questionSet: result.game.questionSet.name,
        rank: result.finalRank,
        score: result.finalScore,
        accuracy: result.totalAnswers > 0 
          ? Math.round((result.correctAnswers / result.totalAnswers) * 100)
          : 0,
        xpGained: result.xpGained,
        completedAt: result.completedAt
      })),
      activity: recentActivity.map(game => ({
        date: game.completedAt.toISOString().split('T')[0],
        score: game.finalScore,
        rank: game.finalRank
      }))
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni achievements dell'utente
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Tutti gli achievements disponibili
    const allAchievements = await prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    // Achievements sbloccati dall'utente
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true
      }
    });

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId));

    const achievements = allAchievements.map(achievement => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      xpReward: achievement.xpReward,
      unlocked: unlockedIds.has(achievement.id),
      unlockedAt: userAchievements.find(ua => ua.achievementId === achievement.id)?.unlockedAt || null
    }));

    const summary = {
      total: allAchievements.length,
      unlocked: userAchievements.length,
      progress: allAchievements.length > 0 
        ? Math.round((userAchievements.length / allAchievements.length) * 100)
        : 0,
      totalXpFromAchievements: userAchievements.reduce((sum, ua) => sum + ua.achievement.xpReward, 0)
    };

    res.json({
      achievements,
      summary
    });
  } catch (error) {
    console.error('Get user achievements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cerca altri utenti
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } }
        ],
        NOT: {
          id: req.user.id // Escludi l'utente corrente
        }
      },
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
      take: parseInt(limit),
      orderBy: [
        { totalScore: 'desc' },
        { username: 'asc' }
      ]
    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      level: user.level,
      stats: {
        totalScore: user.totalScore,
        totalGames: user.totalGamesPlayed,
        winRate: user.totalGamesPlayed > 0 
          ? Math.round((user.totalWins / user.totalGamesPlayed) * 100)
          : 0
      }
    }));

    res.json({ users: formattedUsers });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni profilo di un altro utente
router.get('/profile/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        totalScore: true,
        totalGamesPlayed: true,
        totalWins: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Statistiche pubbliche
    const gameStats = await prisma.gameResult.aggregate({
      where: { userId },
      _avg: {
        finalScore: true,
        finalRank: true
      },
      _max: {
        finalScore: true
      }
    });

    // Partite recenti (solo alcune info pubbliche)
    const recentGames = await prisma.gameResult.findMany({
      where: { userId },
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
      take: 5
    });

    // Achievements sbloccati
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true
      },
      orderBy: { unlockedAt: 'desc' },
      take: 10
    });

    const profile = {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        level: user.level,
        memberSince: user.createdAt
      },
      stats: {
        totalGamesPlayed: user.totalGamesPlayed,
        totalWins: user.totalWins,
        totalScore: user.totalScore,
        winRate: user.totalGamesPlayed > 0 
          ? Math.round((user.totalWins / user.totalGamesPlayed) * 100)
          : 0,
        avgScore: gameStats._avg.finalScore ? Math.round(gameStats._avg.finalScore) : 0,
        bestScore: gameStats._max.finalScore || 0,
        avgRank: gameStats._avg.finalRank ? Math.round(gameStats._avg.finalRank * 10) / 10 : 0
      },
      recentGames: recentGames.map(result => ({
        category: result.game.questionSet.category.name,
        questionSet: result.game.questionSet.name,
        rank: result.finalRank,
        score: result.finalScore,
        completedAt: result.completedAt
      })),
      achievements: achievements.map(ua => ({
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        unlockedAt: ua.unlockedAt
      }))
    };

    res.json({ profile });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni ranking posizione dell'utente
router.get('/rank', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Posizione per punteggio totale
    const scoreRank = await prisma.user.count({
      where: {
        totalScore: {
          gt: (await prisma.user.findUnique({
            where: { id: userId },
            select: { totalScore: true }
          }))?.totalScore || 0
        }
      }
    });

    // Posizione per vittorie
    const winsRank = await prisma.user.count({
      where: {
        totalWins: {
          gt: (await prisma.user.findUnique({
            where: { id: userId },
            select: { totalWins: true }
          }))?.totalWins || 0
        }
      }
    });

    // Totale utenti per percentile
    const totalUsers = await prisma.user.count();

    const ranking = {
      scoreRank: scoreRank + 1,
      winsRank: winsRank + 1,
      totalUsers,
      scorePercentile: totalUsers > 0 
        ? Math.round(((totalUsers - scoreRank) / totalUsers) * 100)
        : 100,
      winsPercentile: totalUsers > 0 
        ? Math.round(((totalUsers - winsRank) / totalUsers) * 100)
        : 100
    };

    res.json({ ranking });
  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 