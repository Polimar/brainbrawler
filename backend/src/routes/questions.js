const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// QUESTION SETS ENDPOINTS
// ============================================================================

// Ottieni tutti i question sets dell'utente (PREMIUM only)
router.get('/sets', authenticateToken, async (req, res) => {
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

    const questionSets = await prisma.questionSet.findMany({
      where: {
        userId: userId
      },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      questionSets: questionSets.map(qs => ({
        id: qs.id,
        name: qs.name,
        description: qs.description,
        language: qs.language,
        category: qs.category,
        questionCount: qs._count.questions,
        createdAt: qs.createdAt,
        updatedAt: qs.updatedAt
      }))
    });

  } catch (error) {
    console.error('Get question sets error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load question sets' 
    });
  }
});

// Crea un nuovo question set (PREMIUM only)
router.post('/sets', authenticateToken, async (req, res) => {
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

    const { name, description, language, category } = req.body;

    // Validazione
    if (!name || !language || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, language and category are required'
      });
    }

    // Valida lingua
    const validLanguages = ['IT', 'EN', 'ES', 'DE', 'FR'];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language. Must be one of: ' + validLanguages.join(', ')
      });
    }

    // Crea il question set
    const questionSet = await prisma.questionSet.create({
      data: {
        name,
        description: description || null,
        language,
        category,
        userId: userId,
        isPublic: false
      }
    });

    res.json({
      success: true,
      questionSet: {
        id: questionSet.id,
        name: questionSet.name,
        description: questionSet.description,
        language: questionSet.language,
        category: questionSet.category,
        questionCount: 0,
        createdAt: questionSet.createdAt
      }
    });

  } catch (error) {
    console.error('Create question set error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create question set' 
    });
  }
});

// ============================================================================
// QUESTIONS ENDPOINTS
// ============================================================================

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

    // Ottieni tutte le domande attraverso i question sets dell'utente
    const questionSetItems = await prisma.questionSetItem.findMany({
      where: {
        questionSet: {
          userId: userId
        }
      },
      include: {
        question: {
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
        },
        questionSet: {
          select: {
            id: true,
            name: true,
            language: true
          }
        }
      },
      orderBy: {
        question: {
          createdAt: 'desc'
        }
      }
    });

    const questions = questionSetItems.map(item => ({
      id: item.question.id,
      text: item.question.text,
      options: item.question.options,
      correctAnswer: item.question.correctAnswer,
      difficulty: item.question.difficulty,
      language: item.question.language,
      category: item.question.category?.name || 'Uncategorized',
      explanation: item.question.explanation,
      questionSetId: item.questionSet.id,
      questionSet: item.questionSet,
      createdAt: item.question.createdAt
    }));

    res.json({
      success: true,
      questions: questions
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

    const { text, questionSetId, category, difficulty, language, options, correctAnswer, explanation } = req.body;

    // Validazione
    if (!text || !questionSetId || !category || !difficulty || !language || !options || options.length !== 4 || correctAnswer === undefined) {
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

    // Verifica che il question set appartenga all'utente
    const questionSet = await prisma.questionSet.findFirst({
      where: {
        id: questionSetId,
        userId: userId
      }
    });

    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: 'Question set not found or access denied'
      });
    }

    // Trova o crea la categoria
    let categoryRecord = await prisma.category.findFirst({
      where: { name: category }
    });

    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: {
          name: category,
          description: `Custom category: ${category}`,
          icon: '📚',
          color: '#667eea'
        }
      });
    }

    // Crea la domanda
    const question = await prisma.question.create({
      data: {
        text,
        categoryId: categoryRecord.id,
        difficulty,
        language,
        options,
        correctAnswer,
        explanation: explanation || null,
        timeLimit: 15,
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

    // Ottieni l'ordine successivo per il question set
    const maxOrder = await prisma.questionSetItem.findFirst({
      where: { questionSetId },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    // Aggiungi la domanda al question set
    await prisma.questionSetItem.create({
      data: {
        questionSetId,
        questionId: question.id,
        order: (maxOrder?.order || 0) + 1
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
        language: question.language,
        category: question.category?.name,
        explanation: question.explanation,
        questionSetId: questionSetId,
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

// ============================================================================
// BULK UPLOAD ENDPOINT
// ============================================================================

// Caricamento massivo di domande da JSON (PREMIUM only)
router.post('/bulk-upload', authenticateToken, async (req, res) => {
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

    const { questionSet: setData, questions } = req.body;

    // Validazione struttura
    if (!setData || !questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON structure. Expected questionSet and questions array.'
      });
    }

    // Validazione limiti
    if (questions.length < 10 || questions.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Question set must contain between 10 and 1000 questions'
      });
    }

    // Validazione questionSet
    if (!setData.name || !setData.language || !setData.category) {
      return res.status(400).json({
        success: false,
        message: 'Question set must have name, language and category'
      });
    }

    // Valida lingua
    const validLanguages = ['IT', 'EN', 'ES', 'DE', 'FR'];
    if (!validLanguages.includes(setData.language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language. Must be one of: ' + validLanguages.join(', ')
      });
    }

    // Validazione domande
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.options || !Array.isArray(q.options) || q.options.length !== 4 || 
          q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer > 3 ||
          !q.difficulty || !q.category) {
        return res.status(400).json({
          success: false,
          message: `Invalid question at index ${i}. Check required fields.`
        });
      }
    }

    // Inizia transazione
    const result = await prisma.$transaction(async (tx) => {
      // Crea il question set
      const questionSet = await tx.questionSet.create({
        data: {
          name: setData.name,
          description: setData.description || null,
          language: setData.language,
          category: setData.category,
          userId: userId,
          isPublic: false
        }
      });

      // Crea le domande
      const createdQuestions = [];
      
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        // Trova o crea la categoria
        let categoryRecord = await tx.category.findFirst({
          where: { name: q.category }
        });

        if (!categoryRecord) {
          categoryRecord = await tx.category.create({
            data: {
              name: q.category,
              description: `Custom category: ${q.category}`,
              icon: '📚',
              color: '#667eea'
            }
          });
        }

        // Crea la domanda
        const question = await tx.question.create({
          data: {
            text: q.text,
            categoryId: categoryRecord.id,
            difficulty: q.difficulty,
            language: setData.language,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || null,
            timeLimit: 15,
            createdBy: userId,
            isActive: true
          }
        });

        // Aggiungi al question set
        await tx.questionSetItem.create({
          data: {
            questionSetId: questionSet.id,
            questionId: question.id,
            order: i + 1
          }
        });

        createdQuestions.push(question);
      }

      return {
        questionSet,
        questionsCount: createdQuestions.length
      };
    });

    res.json({
      success: true,
      message: `Successfully created question set "${setData.name}" with ${result.questionsCount} questions`,
      questionSet: {
        id: result.questionSet.id,
        name: result.questionSet.name,
        description: result.questionSet.description,
        language: result.questionSet.language,
        category: result.questionSet.category,
        questionCount: result.questionsCount,
        createdAt: result.questionSet.createdAt
      }
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload questions: ' + error.message 
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

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
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        createdBy: userId
      }
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found or access denied'
      });
    }

    // Elimina la domanda e tutte le sue associazioni
    await prisma.$transaction(async (tx) => {
      // Prima elimina le associazioni ai question sets
      await tx.questionSetItem.deleteMany({
        where: { questionId }
      });
      
      // Poi elimina la domanda
      await tx.question.delete({
        where: { id: questionId }
      });
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

// Elimina un question set (PREMIUM only)
router.delete('/sets/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const questionSetId = req.params.id;
    
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

    // Verifica che il question set appartenga all'utente
    const questionSet = await prisma.questionSet.findFirst({
      where: {
        id: questionSetId,
        userId: userId
      }
    });

    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: 'Question set not found or access denied'
      });
    }

    // Elimina il question set e tutte le sue associazioni
    await prisma.questionSet.delete({
      where: { id: questionSetId }
    });

    res.json({
      success: true,
      message: 'Question set deleted successfully'
    });

  } catch (error) {
    console.error('Delete question set error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete question set' 
    });
  }
});

module.exports = router; 