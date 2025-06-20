const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

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
                categoryId: category.id,
                difficulty: difficulty,
                isPublic: true,
                isActive: true
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
              categoryId: category.id,
              difficulty: 'MEDIUM',
              isPublic: true,
              isActive: true
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

    // Crea utenti di esempio
    console.log('👥 Creating demo users...');
    const users = await Promise.all([
      prisma.user.create({
        data: {
          email: 'admin@brainbrawler.com',
          username: 'admin',
          displayName: 'Admin User',
          passwordHash: await bcrypt.hash('admin123', 12),
          level: 5,
          xp: 4500,
          totalGamesPlayed: 25,
          totalWins: 15,
          totalScore: 45000
        }
      }),
      prisma.user.create({
        data: {
          email: 'test@brainbrawler.com',
          username: 'testuser',
          displayName: 'Test Player',
          passwordHash: await bcrypt.hash('test123', 12),
          level: 3,
          xp: 2800,
          totalGamesPlayed: 12,
          totalWins: 7,
          totalScore: 28000
        }
      }),
      prisma.user.create({
        data: {
          email: 'player@brainbrawler.com',
          username: 'player1',
          displayName: 'Quiz Master',
          passwordHash: await bcrypt.hash('player123', 12),
          level: 8,
          xp: 7200,
          totalGamesPlayed: 40,
          totalWins: 28,
          totalScore: 72000
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

    console.log('\n🎮 Demo credentials:');
    console.log('   • Email: admin@brainbrawler.com, Password: admin123');
    console.log('   • Email: test@brainbrawler.com, Password: test123');
    console.log('   • Email: player@brainbrawler.com, Password: player123');

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