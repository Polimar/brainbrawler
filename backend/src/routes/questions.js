const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Ottieni le domande dell'utente (PREMIUM only)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verifica account premium
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user || (user.accountType !== 'PREMIUM' && user.accountType !== 'ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: 'This feature requires a Premium account' 
      });
    }

    const questions = await prisma.question.findMany({
      where: {
        createdBy: userId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      questions: questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        explanation: q.explanation,
        timeLimit: q.timeLimit,
        categoryId: q.categoryId,
        category: q.category,
        createdAt: q.createdAt
      }))
    });

  } catch (error) {
    console.error('Get user questions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load questions' 
    });
  }
});

// Crea una nuova domanda (PREMIUM only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verifica account premium
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user || (user.accountType !== 'PREMIUM' && user.accountType !== 'ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: 'This feature requires a Premium account' 
      });
    }

    const { text, categoryId, difficulty, options, correctAnswer, explanation } = req.body;

    // Validazione
    if (!text || !categoryId || !difficulty || !options || options.length !== 4 || correctAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid correct answer index'
      });
    }

    // Verifica che la categoria esista
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Crea la domanda
    const question = await prisma.question.create({
      data: {
        text,
        categoryId,
        difficulty,
        options,
        correctAnswer,
        explanation: explanation || null,
        timeLimit: 30,
        createdBy: userId,
        isActive: true
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true
          }
        }
      }
    });

    res.json({
      success: true,
      question: {
        id: question.id,
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        difficulty: question.difficulty,
        explanation: question.explanation,
        timeLimit: question.timeLimit,
        categoryId: question.categoryId,
        category: question.category,
        createdAt: question.createdAt
      }
    });

  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create question' 
    });
  }
});

// Aggiorna una domanda (PREMIUM only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const questionId = req.params.id;
    
    // Verifica account premium
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user || (user.accountType !== 'PREMIUM' && user.accountType !== 'ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: 'This feature requires a Premium account' 
      });
    }

    // Verifica che la domanda appartenga all'utente
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        createdBy: userId
      }
    });

    if (!existingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Question not found or access denied'
      });
    }

    const { text, categoryId, difficulty, options, correctAnswer, explanation } = req.body;

    // Validazione
    if (text && (!categoryId || !difficulty || !options || options.length !== 4 || correctAnswer === undefined)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (correctAnswer !== undefined && (correctAnswer < 0 || correctAnswer > 3)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid correct answer index'
      });
    }

    // Aggiorna la domanda
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        ...(text && { text }),
        ...(categoryId && { categoryId }),
        ...(difficulty && { difficulty }),
        ...(options && { options }),
        ...(correctAnswer !== undefined && { correctAnswer }),
        ...(explanation !== undefined && { explanation })
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true
          }
        }
      }
    });

    res.json({
      success: true,
      question: {
        id: updatedQuestion.id,
        text: updatedQuestion.text,
        options: updatedQuestion.options,
        correctAnswer: updatedQuestion.correctAnswer,
        difficulty: updatedQuestion.difficulty,
        explanation: updatedQuestion.explanation,
        timeLimit: updatedQuestion.timeLimit,
        categoryId: updatedQuestion.categoryId,
        category: updatedQuestion.category,
        updatedAt: updatedQuestion.updatedAt
      }
    });

  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update question' 
    });
  }
});

// Elimina una domanda (PREMIUM only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const questionId = req.params.id;
    
    // Verifica account premium
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user || (user.accountType !== 'PREMIUM' && user.accountType !== 'ADMIN')) {
      return res.status(403).json({ 
        success: false, 
        message: 'This feature requires a Premium account' 
      });
    }

    // Verifica che la domanda appartenga all'utente
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        createdBy: userId
      }
    });

    if (!existingQuestion) {
      return res.status(404).json({
        success: false,
        message: 'Question not found or access denied'
      });
    }

    // Elimina la domanda (e automaticamente le associazioni nei question sets)
    await prisma.question.delete({
      where: { id: questionId }
    });

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });

  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete question' 
    });
  }
});

module.exports = router; 