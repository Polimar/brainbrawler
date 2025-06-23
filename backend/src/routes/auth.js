const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');
const { generateToken, authenticateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

// Google OAuth client
let googleClient = null;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
}

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

    // Generate email verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Crea utente
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires,
        emailVerified: false
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
        emailVerified: true,
        accountType: true,
        createdAt: true
      }
    });

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(
      email, 
      verificationCode, 
      displayName
    );

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification code.',
      user,
      verificationRequired: true,
      emailStatus: emailResult
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (!user.emailVerificationCode || user.emailVerificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // Verify email
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
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
        emailVerified: true,
        accountType: true,
        createdAt: true
      }
    });

    // Generate token
    const token = generateToken(updatedUser.id);

    // Send welcome email
    await emailService.sendWelcomeEmail(
      updatedUser.email,
      updatedUser.displayName,
      updatedUser.accountType
    );

    res.json({
      message: 'Email verified successfully',
      user: updatedUser,
      token
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires
      }
    });

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(
      email, 
      verificationCode, 
      user.displayName
    );

    res.json({
      message: 'Verification code sent successfully',
      emailStatus: emailResult
    });
  } catch (error) {
    console.error('Resend verification error:', error);
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

    // Trova utente per email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verifica password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check email verification
    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email not verified. Please check your email for verification code.',
        emailVerified: false,
        email: user.email
      });
    }

    // Aggiorna ultimo login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Genera token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        level: user.level,
        xp: user.xp,
        totalGamesPlayed: user.totalGamesPlayed,
        totalWins: user.totalWins,
        totalScore: user.totalScore,
        emailVerified: user.emailVerified,
        accountType: user.accountType,
        createdAt: user.createdAt
      },
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
        emailVerified: true,
        accountType: true,
        hasCompletedSetup: true,
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

// Endpoint per controlli di disponibilità live
router.post('/check-availability', async (req, res) => {
  try {
    const { field, value } = req.body;

    if (!field || !value) {
      return res.status(400).json({ error: 'Field and value are required' });
    }

    // Normalize value
    const normalizedValue = field === 'email' ? value.toLowerCase() : value.trim();

    let available = true;

    switch (field) {
      case 'username':
        // Check username format
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedValue)) {
          available = false;
          break;
        }
        
        const existingUsername = await prisma.user.findUnique({
          where: { username: normalizedValue.toLowerCase() }
        });
        available = !existingUsername;
        break;

      case 'email':
        // Check email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)) {
          available = false;
          break;
        }
        
        const existingEmail = await prisma.user.findUnique({
          where: { email: normalizedValue }
        });
        available = !existingEmail;
        break;

      case 'displayName':
        // Check length
        if (normalizedValue.length < 2 || normalizedValue.length > 50) {
          available = false;
          break;
        }
        
        // Display name can be duplicated, so it's always available if format is correct
        available = true;
        break;

      default:
        return res.status(400).json({ error: 'Invalid field' });
    }

    res.json({ available });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get email service status
router.get('/email-status', (req, res) => {
  const status = emailService.getStatus();
  res.json(status);
});

// Update account type (for account setup flow)
router.post('/update-account-type', authenticateToken, async (req, res) => {
  try {
    const { accountType } = req.body;

    // Validate account type
    if (!accountType || !['FREE', 'PREMIUM', 'ADMIN'].includes(accountType)) {
      return res.status(400).json({ error: 'Invalid account type' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { 
        accountType,
        hasCompletedSetup: true
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
        emailVerified: true,
        accountType: true,
        hasCompletedSetup: true,
        createdAt: true
      }
    });

    res.json({
      message: 'Account type updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Account type update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DEBUG: Get verification code (ONLY for development)
router.get('/debug/verification-code/:email', async (req, res) => {
  try {
    // SECURITY: Only enable in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        email: true,
        emailVerificationCode: true,
        emailVerificationExpires: true,
        emailVerified: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.json({ 
        message: 'Email already verified',
        verified: true 
      });
    }

    if (!user.emailVerificationCode) {
      return res.json({ 
        message: 'No verification code found',
        code: null 
      });
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return res.json({ 
        message: 'Verification code expired',
        code: user.emailVerificationCode,
        expired: true 
      });
    }

    res.json({
      message: 'Current verification code',
      email: user.email,
      code: user.emailVerificationCode,
      expires: user.emailVerificationExpires
    });

  } catch (error) {
    console.error('Debug verification code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 