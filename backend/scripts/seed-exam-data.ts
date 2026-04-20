/**
 * Seed script to create sample exam data for testing
 * Run with: npx ts-node scripts/seed-exam-data.ts
 */

import mongoose from 'mongoose'
import config from '../src/config/config'
import ExamModel from '../src/APIs/exam/_shared/models/exam.model'
import { QuestionType } from '../src/APIs/exam/_shared/types/exam.interface'

const sampleExams = [
    {
        title: 'Physics Mid-Term Exam',
        subject: 'Physics',
        totalMarks: 40,
        createdBy: 'teacher-user-id',
        questions: [
            {
                questionNumber: 1,
                questionText: 'What is the SI unit of force?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'Newton'
            },
            {
                questionNumber: 2,
                questionText: 'State Newton\'s First Law of Motion.',
                questionType: QuestionType.SHORT_ANSWER,
                marks: 3,
                correctAnswer: 'An object at rest stays at rest and an object in motion stays in motion unless acted upon by an external force'
            },
            {
                questionNumber: 3,
                questionText: 'What is the speed of light in vacuum?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: '3 × 10^8 m/s'
            },
            {
                questionNumber: 4,
                questionText: 'Explain the difference between speed and velocity with examples.',
                questionType: QuestionType.PARAGRAPH,
                marks: 8,
                keyConcepts: ['speed', 'scalar', 'velocity', 'vector', 'direction', 'magnitude', 'example'],
                rubric: 'Answer should define both terms, explain scalar vs vector, and provide clear examples'
            },
            {
                questionNumber: 5,
                questionText: 'What is the formula for kinetic energy?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'KE = 1/2 mv²'
            },
            {
                questionNumber: 6,
                questionText: 'Define acceleration and write its SI unit.',
                questionType: QuestionType.SHORT_ANSWER,
                marks: 3,
                correctAnswer: 'Acceleration is the rate of change of velocity. SI unit is m/s²'
            },
            {
                questionNumber: 7,
                questionText: 'Explain the law of conservation of energy with a real-world example.',
                questionType: QuestionType.PARAGRAPH,
                marks: 10,
                keyConcepts: ['energy', 'conserved', 'transformed', 'not created', 'not destroyed', 'example', 'potential', 'kinetic'],
                rubric: 'Answer should state the law clearly and provide a detailed real-world example'
            },
            {
                questionNumber: 8,
                questionText: 'What is the value of gravitational acceleration on Earth?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: '9.8 m/s²'
            },
            {
                questionNumber: 9,
                questionText: 'Calculate the force required to accelerate a 5 kg object at 2 m/s².',
                questionType: QuestionType.SHORT_ANSWER,
                marks: 3,
                correctAnswer: '10 N (F = ma = 5 × 2 = 10 N)'
            },
            {
                questionNumber: 10,
                questionText: 'Describe the three laws of motion proposed by Isaac Newton.',
                questionType: QuestionType.PARAGRAPH,
                marks: 5,
                keyConcepts: ['first law', 'inertia', 'second law', 'F=ma', 'third law', 'action', 'reaction'],
                rubric: 'Answer should clearly state all three laws with brief explanations'
            }
        ]
    },
    {
        title: 'Pakistan Studies Mid-Term Exam',
        subject: 'Pakistan Studies',
        totalMarks: 50,
        createdBy: 'teacher-user-id',
        questions: [
            {
                questionNumber: 1,
                questionText: 'Who is known as the founder of Pakistan?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'Quaid-e-Azam Muhammad Ali Jinnah'
            },
            {
                questionNumber: 2,
                questionText: 'When was Pakistan created?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: '14 August 1947'
            },
            {
                questionNumber: 3,
                questionText: 'Explain the Two-Nation Theory and its significance in the creation of Pakistan.',
                questionType: QuestionType.PARAGRAPH,
                marks: 10,
                keyConcepts: [
                    'Allama Iqbal',
                    'Muhammad Ali Jinnah',
                    'Muslims',
                    'Hindus',
                    'separate nation',
                    'Pakistan',
                    'partition'
                ],
                rubric:
                    'Answer should explain the theory, mention key figures (Iqbal and Jinnah), and discuss its role in Pakistan creation'
            },
            {
                questionNumber: 4,
                questionText: 'Describe the role of Allama Iqbal in the Pakistan Movement.',
                questionType: QuestionType.PARAGRAPH,
                marks: 8,
                keyConcepts: ['poet', 'philosopher', 'Allahabad Address', '1930', 'separate Muslim state', 'vision'],
                rubric: 'Answer should mention his Allahabad Address and vision for a separate Muslim state'
            },
            {
                questionNumber: 5,
                questionText: 'What is the national language of Pakistan?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'Urdu'
            }
        ]
    },
    {
        title: 'General Knowledge Quiz',
        subject: 'General Knowledge',
        totalMarks: 20,
        createdBy: 'teacher-user-id',
        questions: [
            {
                questionNumber: 1,
                questionText: 'What is the capital of France?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'Paris'
            },
            {
                questionNumber: 2,
                questionText: 'Who wrote "Romeo and Juliet"?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'William Shakespeare'
            },
            {
                questionNumber: 3,
                questionText: 'What is the largest planet in our solar system?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'Jupiter'
            },
            {
                questionNumber: 4,
                questionText: 'Explain the process of photosynthesis.',
                questionType: QuestionType.PARAGRAPH,
                marks: 8,
                keyConcepts: ['plants', 'sunlight', 'chlorophyll', 'carbon dioxide', 'oxygen', 'glucose', 'energy'],
                rubric: 'Answer should explain how plants convert sunlight into energy'
            },
            {
                questionNumber: 5,
                questionText: 'What is the speed of light?',
                questionType: QuestionType.SHORT_ANSWER,
                marks: 2,
                correctAnswer: '299,792,458 meters per second'
            },
            {
                questionNumber: 6,
                questionText: 'Who painted the Mona Lisa?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'Leonardo da Vinci'
            },
            {
                questionNumber: 7,
                questionText: 'What is the chemical symbol for gold?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: 'Au'
            }
        ]
    },
    {
        title: 'Mathematics Basic Test',
        subject: 'Mathematics',
        totalMarks: 30,
        createdBy: 'teacher-user-id',
        questions: [
            {
                questionNumber: 1,
                questionText: 'What is 5 + 7?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: '12'
            },
            {
                questionNumber: 2,
                questionText: 'What is 15 × 3?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: '45'
            },
            {
                questionNumber: 3,
                questionText: 'Solve: 2x + 5 = 15',
                questionType: QuestionType.SHORT_ANSWER,
                marks: 3,
                correctAnswer: 'x = 5'
            },
            {
                questionNumber: 4,
                questionText: 'Explain the Pythagorean theorem with an example.',
                questionType: QuestionType.PARAGRAPH,
                marks: 10,
                keyConcepts: ['right triangle', 'hypotenuse', 'a² + b² = c²', 'sides', 'square'],
                rubric: 'Answer should state the theorem and provide a numerical example'
            },
            {
                questionNumber: 5,
                questionText: 'What is the value of π (pi) approximately?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: '3.14159'
            },
            {
                questionNumber: 6,
                questionText: 'Calculate the area of a circle with radius 5 cm.',
                questionType: QuestionType.SHORT_ANSWER,
                marks: 3,
                correctAnswer: '78.54 cm²'
            },
            {
                questionNumber: 7,
                questionText: 'What is 100 ÷ 4?',
                questionType: QuestionType.MCQ,
                marks: 2,
                correctAnswer: '25'
            },
            {
                questionNumber: 8,
                questionText: 'Explain what a prime number is and give three examples.',
                questionType: QuestionType.PARAGRAPH,
                marks: 6,
                keyConcepts: ['divisible', 'only by 1 and itself', 'examples', '2', '3', '5', '7'],
                rubric: 'Answer should define prime numbers and provide at least 3 examples'
            }
        ]
    }
]

async function seedExams() {
    try {
        // Connect to database
        await mongoose.connect(config.DATABASE_URL as string)
        console.log('✅ Connected to database')

        // Clear existing exams (optional - comment out if you want to keep existing data)
        // await ExamModel.deleteMany({})
        // console.log('🗑️  Cleared existing exams')

        // Insert sample exams
        const insertedExams = await ExamModel.insertMany(sampleExams)
        console.log(`✅ Inserted ${insertedExams.length} sample exams`)

        insertedExams.forEach((exam) => {
            console.log(`   - ${exam.title} (ID: ${exam._id})`)
        })

        console.log('\n📝 Sample exams created successfully!')
        console.log('\n💡 Note: Update the createdBy field with actual user IDs from your database')

        process.exit(0)
    } catch (error) {
        console.error('❌ Error seeding exams:', error)
        process.exit(1)
    }
}

// Run the seed function
seedExams()
