const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Middleware per Socket.io
const authMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // Per sviluppo, permetti connessioni senza auth
      if (process.env.NODE_ENV === 'development') {
        socket.user = {
          id: 'dev-user-1',
          username: 'DevUser',
          email: 'dev@brainbrawler.com',
          displayName: 'Development User'
        };
        return next();
      }
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true,
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        emailVerified: true,
        accountType: true,
        hasCompletedSetup: true
      }
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next(new Error('Invalid token'));
  }
};

// Middleware per Express
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // Per sviluppo, permetti richieste senza auth
      if (process.env.NODE_ENV === 'development') {
        req.user = {
          id: 'dev-user-1',
          username: 'DevUser',
          email: 'dev@brainbrawler.com',
          displayName: 'Development User'
        };
        return next();
      }
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true,
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        emailVerified: true,
        accountType: true,
        hasCompletedSetup: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware opzionale - non blocca se non c'è token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true
      }
    });

    req.user = user;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Utility per generare JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Utility per verificare token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = {
  authMiddleware,
  authenticateToken,
  optionalAuth,
  generateToken,
  verifyToken
}; 