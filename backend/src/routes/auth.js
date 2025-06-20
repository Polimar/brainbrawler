const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Registrazione
router.post('/register', async (req, res) => {
  try {
    const { email, username, displayName, password } = req.body;

    // Validazione input
    if (!email || !username || !displayName || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Controlla se utente esiste già
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email ? 'Email already exists' : 'Username already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Crea utente
    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        lastLoginAt: new Date()
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true,
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        createdAt: true
      }
    });

    // Genera token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Trova utente
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true,
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        passwordHash: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verifica password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Aggiorna ultimo login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Rimuovi password hash dalla risposta
    const { passwordHash, ...userWithoutPassword } = user;

    // Genera token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login con Google (placeholder per ora)
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name, picture } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Google ID and email are required' });
    }

    // Cerca utente esistente con Google ID
    let user = await prisma.user.findUnique({
      where: { googleId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true,
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        createdAt: true
      }
    });

    if (!user) {
      // Cerca per email
      user = await prisma.user.findUnique({
        where: { email }
      });

      if (user) {
        // Collega account Google esistente
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatar: picture || user.avatar,
            lastLoginAt: new Date()
          },
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatar: true,
            level: true,
            xp: true,
            totalGamesPlayed: true,
            totalWins: true,
            totalScore: true,
            createdAt: true
          }
        });
      } else {
        // Crea nuovo utente
        const username = email.split('@')[0] + Math.random().toString(36).substr(2, 4);
        
        user = await prisma.user.create({
          data: {
            email,
            username,
            displayName: name || email.split('@')[0],
            googleId,
            avatar: picture,
            lastLoginAt: new Date()
          },
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatar: true,
            level: true,
            xp: true,
            totalGamesPlayed: true,
            totalWins: true,
            totalScore: true,
            createdAt: true
          }
        });
      }
    } else {
      // Aggiorna ultimo login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Google login successful',
      user,
      token
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ottieni profilo utente corrente
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true,
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        lastLoginAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Aggiorna profilo
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    const updates = {};

    if (displayName) updates.displayName = displayName;
    if (avatar) updates.avatar = avatar;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        level: true,
        xp: true,
        totalGamesPlayed: true,
        totalWins: true,
        totalScore: true,
        createdAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verifica token (per development)
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  });
});

// Logout (principalmente per pulizia lato client)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router; 