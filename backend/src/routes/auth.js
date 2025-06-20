const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    // Validazione email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validazione username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' });
    }

    // Controlla se utente esiste già
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email.toLowerCase() ? 'Email already exists' : 'Username already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Crea utente
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
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

    // Trova utente (case insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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

    if (!user || !user.passwordHash) {
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

// Google OAuth Login
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    // Verifica token Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ error: 'Google account email is not verified' });
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
        where: { email: email.toLowerCase() }
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
        const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        let username = baseUsername;
        let counter = 1;
        
        // Trova username univoco
        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }
        
        user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
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
      // Aggiorna ultimo login e avatar se cambiato
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          lastLoginAt: new Date(),
          avatar: picture || user.avatar
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

    const token = generateToken(user.id);

    res.json({
      message: 'Google login successful',
      user,
      token
    });
  } catch (error) {
    console.error('Google login error:', error);
    
    if (error.message.includes('Token used too early') || error.message.includes('Wrong number of segments')) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint per ottenere Google Client ID (per frontend)
router.get('/google/config', (req, res) => {
  res.json({ 
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    configured: !!process.env.GOOGLE_CLIENT_ID
  });
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Genera nuovo token
    const newToken = generateToken(req.user.id);
    
    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      user: req.user
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Profilo utente
router.get('/profile', authenticateToken, async (req, res) => {
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
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Aggiorna profilo
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    const updateData = {};

    if (displayName !== undefined) {
      if (!displayName || displayName.trim().length < 1) {
        return res.status(400).json({ error: 'Display name cannot be empty' });
      }
      updateData.displayName = displayName.trim();
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
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
        createdAt: true,
        lastLoginAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Profile update error:', error);
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