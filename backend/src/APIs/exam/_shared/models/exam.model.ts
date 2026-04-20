import mongoose, { Schema, Document } from 'mongoose'
import { IExam, IQuestion, QuestionType } from '../types/exam.interface'

export interface IExamDocument extends IExam, Document {}

const QuestionSchema = new Schema<IQuestion>(
    {
        questionNumber: {
            type: Number,
            required: true
        },
        questionText: {
            type: String,
            required: true
        },
        questionType: {
            type: String,
            enum: Object.values(QuestionType),
            required: true
        },
        marks: {
            type: Number,
            required: true,
            min: 0
        },
        options: {
            type: [String],
            default: []
        },
        correctAnswer: {
            type: String
        },
        keyConcepts: {
            type: [String],
            default: []
        },
        rubric: {
            type: String
        }
    },
    { _id: false }
)

const ExamSchema = new Schema<IExamDocument>(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        subject: {
            type: String,
            required: true,
            trim: true
        },
        totalMarks: {
            type: Number,
            required: true,
            min: 0
        },
        questions: {
            type: [QuestionSchema],
            required: true,
            validate: {
                validator: function (questions: IQuestion[]) {
                    return questions.length > 0
                },
                message: 'Exam must have at least one question'
            }
        },
        createdBy: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
)

// Index for faster queries
ExamSchema.index({ createdBy: 1, createdAt: -1 })
ExamSchema.index({ subject: 1 })

export default mongoose.model<IExamDocument>('Exam', ExamSchema)
