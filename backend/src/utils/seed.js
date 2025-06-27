const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Seed questions for testing
async function seedQuestions() {
  console.log('🌱 Seeding questions...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'General Knowledge' },
      update: {},
      create: {
        name: 'General Knowledge',
        description: 'General knowledge questions',
        icon: '🧠',
        color: '#667eea'
      }
    }),
    prisma.category.upsert({
      where: { name: 'Science' },
      update: {},
      create: {
        name: 'Science',
        description: 'Science and technology questions',
        icon: '🔬',
        color: '#28a745'
      }
    }),
    prisma.category.upsert({
      where: { name: 'History' },
      update: {},
      create: {
        name: 'History',
        description: 'Historical events and figures',
        icon: '📚',
        color: '#dc3545'
      }
    })
  ]);

  // Sample questions
  const questions = [
    {
      text: "What is the capital of Italy?",
      options: ["Rome", "Milan", "Naples", "Florence"],
      correctAnswer: 0,
      categoryId: categories[0].id,
      difficulty: 'EASY'
    },
    {
      text: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correctAnswer: 1,
      categoryId: categories[1].id,
      difficulty: 'EASY'
    },
    {
      text: "In which year did World War II end?",
      options: ["1944", "1945", "1946", "1947"],
      correctAnswer: 1,
      categoryId: categories[2].id,
      difficulty: 'MEDIUM'
    },
    {
      text: "What is the largest mammal in the world?",
      options: ["African Elephant", "Blue Whale", "Giraffe", "Hippopotamus"],
      correctAnswer: 1,
      categoryId: categories[1].id,
      difficulty: 'EASY'
    },
    {
      text: "Who painted the Mona Lisa?",
      options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
      correctAnswer: 2,
      categoryId: categories[0].id,
      difficulty: 'MEDIUM'
    },
    {
      text: "What is the chemical symbol for gold?",
      options: ["Go", "Gd", "Au", "Ag"],
      correctAnswer: 2,
      categoryId: categories[1].id,
      difficulty: 'MEDIUM'
    },
    {
      text: "Which ancient wonder of the world was located in Alexandria?",
      options: ["Hanging Gardens", "Lighthouse of Alexandria", "Colossus of Rhodes", "Temple of Artemis"],
      correctAnswer: 1,
      categoryId: categories[2].id,
      difficulty: 'HARD'
    },
    {
      text: "What is the smallest country in the world?",
      options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"],
      correctAnswer: 2,
      categoryId: categories[0].id,
      difficulty: 'MEDIUM'
    },
    {
      text: "Which element has the atomic number 1?",
      options: ["Helium", "Hydrogen", "Lithium", "Carbon"],
      correctAnswer: 1,
      categoryId: categories[1].id,
      difficulty: 'EASY'
    },
    {
      text: "Who was the first Emperor of Rome?",
      options: ["Julius Caesar", "Augustus", "Nero", "Trajan"],
      correctAnswer: 1,
      categoryId: categories[2].id,
      difficulty: 'HARD'
    }
  ];

  // Create questions
  for (const questionData of questions) {
    await prisma.question.upsert({
      where: { text: questionData.text },
      update: {},
      create: questionData
    });
  }

  // Create a default question set
  const questionSet = await prisma.questionSet.upsert({
    where: { name: 'General Quiz Set' },
    update: {},
    create: {
      name: 'General Quiz Set',
      description: 'A mix of general knowledge questions',
      isPublic: true,
      userId: 'system'
    }
  });

  // Add questions to the set
  const allQuestions = await prisma.question.findMany();
  for (let i = 0; i < allQuestions.length; i++) {
    await prisma.questionSetItem.upsert({
      where: {
        questionSetId_questionId: {
          questionSetId: questionSet.id,
          questionId: allQuestions[i].id
        }
      },
      update: {},
      create: {
        questionSetId: questionSet.id,
        questionId: allQuestions[i].id,
        order: i + 1
      }
    });
  }

  console.log('✅ Questions seeded successfully');
}

// Main seed function
async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Pulisci il database esistente (solo per sviluppo!)
    console.log('🧹 Cleaning existing data...');
    await prisma.userAchievement.deleteMany();
    await prisma.gameResult.deleteMany();
    await prisma.game.deleteMany();
    await prisma.questionSetItem.deleteMany();
    await prisma.question.deleteMany();
    await prisma.questionSet.deleteMany();
    await prisma.achievement.deleteMany();
    await prisma.user.deleteMany();
    await prisma.category.deleteMany();

    // Crea categorie
    console.log('📚 Creating categories...');
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          name: 'Storia',
          icon: '🏛️',
          color: '#FF6B6B',
          description: 'Domande di storia mondiale e italiana'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Scienza',
          icon: '🧪',
          color: '#4ECDC4',
          description: 'Fisica, chimica, biologia e matematica'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Geografia',
          icon: '🌍',
          color: '#45B7D1',
          description: 'Capitali, fiumi, montagne e paesi'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Arte e Cultura',
          icon: '🎨',
          color: '#96CEB4',
          description: 'Pittura, scultura, letteratura e musica'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Sport',
          icon: '⚽',
          color: '#FFEAA7',
          description: 'Calcio, tennis, olimpiadi e sport vari'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Tecnologia',
          icon: '💻',
          color: '#DDA0DD',
          description: 'Informatica, internet e innovazioni'
        }
      })
    ]);

    // Crea domande per ogni categoria
    console.log('❓ Creating questions...');
    
    // Domande di Storia
    const historiaQuestions = [
      {
        text: "Chi ha dipinto la Gioconda?",
        options: ["Leonardo da Vinci", "Michelangelo", "Raffaello", "Donatello"],
        correctAnswer: 0,
        difficulty: 'EASY',
        explanation: "La Gioconda (Monna Lisa) è stata dipinta da Leonardo da Vinci tra il 1503 e il 1519."
      },
      {
        text: "In che anno è iniziata la Prima Guerra Mondiale?",
        options: ["1912", "1914", "1916", "1918"],
        correctAnswer: 1,
        difficulty: 'MEDIUM',
        explanation: "La Prima Guerra Mondiale iniziò il 28 luglio 1914 con la dichiarazione di guerra dell'Austria-Ungheria alla Serbia."
      },
      {
        text: "Chi fu il primo imperatore romano?",
        options: ["Giulio Cesare", "Marco Antonio", "Augusto", "Nerone"],
        correctAnswer: 2,
        difficulty: 'MEDIUM',
        explanation: "Augusto (Ottaviano) fu il primo imperatore romano, regnando dal 27 a.C. al 14 d.C."
      },
      {
        text: "La Rivoluzione Francese iniziò nel:",
        options: ["1789", "1792", "1799", "1804"],
        correctAnswer: 0,
        difficulty: 'EASY',
        explanation: "La Rivoluzione Francese iniziò nel 1789 con la presa della Bastiglia il 14 luglio."
      },
      {
        text: "Chi fu l'ultimo zar di Russia?",
        options: ["Alessandro II", "Alessandro III", "Nicola I", "Nicola II"],
        correctAnswer: 3,
        difficulty: 'HARD',
        explanation: "Nicola II fu l'ultimo zar di Russia, abdicò nel 1917 durante la Rivoluzione Russa."
      }
    ];

    // Domande di Scienza
    const scienceQuestions = [
      {
        text: "Qual è il simbolo chimico dell'oro?",
        options: ["Go", "Au", "Ag", "Or"],
        correctAnswer: 1,
        difficulty: 'EASY',
        explanation: "Il simbolo chimico dell'oro è Au, dal latino 'aurum'."
      },
      {
        text: "Quanti elementi ci sono nella tavola periodica?",
        options: ["108", "114", "118", "122"],
        correctAnswer: 2,
        difficulty: 'MEDIUM',
        explanation: "Attualmente la tavola periodica contiene 118 elementi confermati."
      },
      {
        text: "Chi formulò la teoria della relatività?",
        options: ["Isaac Newton", "Galileo Galilei", "Albert Einstein", "Stephen Hawking"],
        correctAnswer: 2,
        difficulty: 'EASY',
        explanation: "Albert Einstein formulò la teoria della relatività speciale (1905) e generale (1915)."
      },
      {
        text: "Qual è la velocità della luce nel vuoto?",
        options: ["299.792.458 m/s", "300.000.000 m/s", "299.000.000 m/s", "301.000.000 m/s"],
        correctAnswer: 0,
        difficulty: 'HARD',
        explanation: "La velocità della luce nel vuoto è esattamente 299.792.458 metri al secondo."
      },
      {
        text: "Qual è l'organo più grande del corpo umano?",
        options: ["Fegato", "Polmoni", "Pelle", "Cervello"],
        correctAnswer: 2,
        difficulty: 'MEDIUM',
        explanation: "La pelle è l'organo più grande del corpo umano, rappresentando circa il 16% del peso corporeo."
      }
    ];

    // Domande di Geografia
    const geographyQuestions = [
      {
        text: "Qual è la capitale dell'Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        correctAnswer: 2,
        difficulty: 'MEDIUM',
        explanation: "Canberra è la capitale dell'Australia, anche se Sydney e Melbourne sono più popolose."
      },
      {
        text: "Quale fiume attraversa Parigi?",
        options: ["Loira", "Rodano", "Senna", "Garonna"],
        correctAnswer: 2,
        difficulty: 'EASY',
        explanation: "La Senna attraversa Parigi ed è uno dei simboli della città."
      },
      {
        text: "Qual è il monte più alto del mondo?",
        options: ["K2", "Everest", "Kangchenjunga", "Makalu"],
        correctAnswer: 1,
        difficulty: 'EASY',
        explanation: "L'Everest è il monte più alto del mondo con 8.848 metri sul livello del mare."
      },
      {
        text: "In quale continente si trova il deserto del Sahara?",
        options: ["Asia", "Africa", "Australia", "America"],
        correctAnswer: 1,
        difficulty: 'EASY',
        explanation: "Il Sahara è il più grande deserto caldo del mondo e si trova in Africa."
      },
      {
        text: "Qual è il lago più profondo del mondo?",
        options: ["Lago Superiore", "Lago Baikal", "Lago Tanganica", "Lago Vittoria"],
        correctAnswer: 1,
        difficulty: 'HARD',
        explanation: "Il Lago Baikal in Russia è il lago più profondo del mondo (1.642 metri) e contiene il 20% dell'acqua dolce mondiale."
      }
    ];

    // Crea domande nel database
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      let questions = [];
      
      switch (category.name) {
        case 'Storia':
          questions = historiaQuestions;
          break;
        case 'Scienza':
          questions = scienceQuestions;
          break;
        case 'Geografia':
          questions = geographyQuestions;
          break;
        default:
          // Per le altre categorie, crea domande di esempio
          questions = [
            {
              text: `Domanda di esempio per ${category.name}?`,
              options: ["Opzione A", "Opzione B", "Opzione C", "Opzione D"],
              correctAnswer: 0,
              difficulty: 'EASY',
              explanation: `Spiegazione per la domanda di ${category.name}.`
            }
          ];
      }

      for (const q of questions) {
        await prisma.question.create({
          data: {
            ...q,
            categoryId: category.id
          }
        });
      }
    }

    // Crea question sets
    console.log('📋 Creating question sets...');
    const questionSets = [];
    
    for (const category of categories) {
      // Ottieni domande per questa categoria
      const categoryQuestions = await prisma.question.findMany({
        where: { categoryId: category.id }
      });

      if (categoryQuestions.length > 0) {
        // Crea set per ogni difficoltà
        const difficulties = ['EASY', 'MEDIUM', 'HARD'];
        
        for (const difficulty of difficulties) {
          const difficultyQuestions = categoryQuestions.filter(q => q.difficulty === difficulty);
          
          if (difficultyQuestions.length > 0) {
            const questionSet = await prisma.questionSet.create({
              data: {
                name: `${category.name} - ${difficulty}`,
                description: `Domande di ${category.name.toLowerCase()} di livello ${difficulty.toLowerCase()}`,
                isPublic: true,
                userId: 'system'
              }
            });

            // Aggiungi domande al set
            for (let i = 0; i < difficultyQuestions.length; i++) {
              await prisma.questionSetItem.create({
                data: {
                  questionSetId: questionSet.id,
                  questionId: difficultyQuestions[i].id,
                  order: i + 1
                }
              });
            }

            questionSets.push(questionSet);
          }
        }

        // Crea anche un set misto per categoria
        if (categoryQuestions.length >= 3) {
          const mixedSet = await prisma.questionSet.create({
            data: {
              name: `${category.name} - Mix`,
              description: `Domande miste di ${category.name.toLowerCase()} di varie difficoltà`,
              isPublic: true,
              userId: 'system'
            }
          });

          for (let i = 0; i < Math.min(categoryQuestions.length, 10); i++) {
            await prisma.questionSetItem.create({
              data: {
                questionSetId: mixedSet.id,
                questionId: categoryQuestions[i].id,
                order: i + 1
              }
            });
          }

          questionSets.push(mixedSet);
        }
      }
    }

    // Crea achievements
    console.log('🏆 Creating achievements...');
    const achievements = await Promise.all([
      prisma.achievement.create({
        data: {
          name: 'Prima Vittoria',
          description: 'Vinci la tua prima partita',
          icon: '🥇',
          xpReward: 100,
          condition: JSON.stringify({ type: 'wins', value: 1 })
        }
      }),
      prisma.achievement.create({
        data: {
          name: 'Esperto Quiz',
          description: 'Gioca 10 partite',
          icon: '🎯',
          xpReward: 200,
          condition: JSON.stringify({ type: 'games_played', value: 10 })
        }
      }),
      prisma.achievement.create({
        data: {
          name: 'Veloce Come un Fulmine',
          description: 'Rispondi correttamente in meno di 3 secondi',
          icon: '⚡',
          xpReward: 150,
          condition: JSON.stringify({ type: 'fast_answer', value: 3000 })
        }
      }),
      prisma.achievement.create({
        data: {
          name: 'Perfezionista',
          description: 'Ottieni il 100% di risposte corrette in una partita',
          icon: '💯',
          xpReward: 300,
          condition: JSON.stringify({ type: 'perfect_game', value: 100 })
        }
      }),
      prisma.achievement.create({
        data: {
          name: 'Campione',
          description: 'Vinci 5 partite consecutive',
          icon: '👑',
          xpReward: 500,
          condition: JSON.stringify({ type: 'win_streak', value: 5 })
        }
      }),
      prisma.achievement.create({
        data: {
          name: 'Studioso',
          description: 'Gioca in tutte le categorie disponibili',
          icon: '📚',
          xpReward: 250,
          condition: JSON.stringify({ type: 'all_categories', value: categories.length })
        }
      })
    ]);

    // Crea utenti specifici per testing
    console.log('👥 Creating test users...');
    const users = await Promise.all([
      // Admin con super poteri
      prisma.user.create({
        data: {
          email: 'admin@brainbrawler.com',
          username: 'admin',
          displayName: 'Super Admin',
          passwordHash: await bcrypt.hash('admin123', 12),
          accountType: 'PREMIUM',
          emailVerified: true,
          level: 99,
          xp: 99999,
          totalGamesPlayed: 100,
          totalWins: 85,
          totalScore: 999999,
          hasCompletedSetup: true
        }
      }),
      // Utente Premium
      prisma.user.create({
        data: {
          email: 'premium@brainbrawler.com',
          username: 'premiumuser',
          displayName: 'Premium Player',
          passwordHash: await bcrypt.hash('premium123', 12),
          accountType: 'PREMIUM',
          emailVerified: true,
          level: 15,
          xp: 12500,
          totalGamesPlayed: 50,
          totalWins: 32,
          totalScore: 125000,
          hasCompletedSetup: true
        }
      }),
      // Utente Free Test 1
      prisma.user.create({
        data: {
          email: 'test1@brainbrawler.com',
          username: 'testfree1',
          displayName: 'Free Player 1',
          passwordHash: await bcrypt.hash('test123', 12),
          accountType: 'FREE',
          emailVerified: true,
          level: 5,
          xp: 2500,
          totalGamesPlayed: 15,
          totalWins: 8,
          totalScore: 25000,
          hasCompletedSetup: true
        }
      }),
      // Utente Free Test 2
      prisma.user.create({
        data: {
          email: 'test2@brainbrawler.com',
          username: 'testfree2',
          displayName: 'Free Player 2',
          passwordHash: await bcrypt.hash('test456', 12),
          accountType: 'FREE',
          emailVerified: true,
          level: 3,
          xp: 1800,
          totalGamesPlayed: 8,
          totalWins: 3,
          totalScore: 18000,
          hasCompletedSetup: true
        }
      })
    ]);

    // Assegna alcuni achievements agli utenti
    console.log('🎖️ Assigning achievements...');
    for (const user of users) {
      // Assegna achievement "Prima Vittoria" se ha almeno una vittoria
      if (user.totalWins > 0) {
        await prisma.userAchievement.create({
          data: {
            userId: user.id,
            achievementId: achievements[0].id // Prima Vittoria
          }
        });
      }

      // Assegna achievement "Esperto Quiz" se ha giocato almeno 10 partite
      if (user.totalGamesPlayed >= 10) {
        await prisma.userAchievement.create({
          data: {
            userId: user.id,
            achievementId: achievements[1].id // Esperto Quiz
          }
        });
      }
    }

    console.log('✅ Database seed completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   • ${categories.length} categories`);
    console.log(`   • ${await prisma.question.count()} questions`);
    console.log(`   • ${questionSets.length} question sets`);
    console.log(`   • ${achievements.length} achievements`);
    console.log(`   • ${users.length} demo users`);

    console.log('\n🎮 Test credentials:');
    console.log('   🛡️  ADMIN: admin@brainbrawler.com / admin123 (Level 99, Super powers)');
    console.log('   💎 PREMIUM: premium@brainbrawler.com / premium123 (Level 15, Ad-free)');
    console.log('   🆓 FREE 1: test1@brainbrawler.com / test123 (Level 5, With ads)');
    console.log('   🆓 FREE 2: test2@brainbrawler.com / test456 (Level 3, With ads)');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

module.exports = { seedQuestions }; 