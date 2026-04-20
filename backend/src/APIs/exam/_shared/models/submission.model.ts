import mongoose, { Schema, Document } from 'mongoose'
import { ISubmission, IExtractedAnswer, IEvaluationResult, SubmissionStatus } from '../types/exam.interface'

export interface ISubmissionDocument extends ISubmission, Document {}

const ExtractedAnswerSchema = new Schema<IExtractedAnswer>(
    {
        questionNumber: {
            type: Number,
            required: true
        },
        extractedText: {
            type: String,
            required: false,
            default: ''
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1
        }
    },
    { _id: false }
)

const EvaluationResultSchema = new Schema<IEvaluationResult>(
    {
        questionNumber: {
            type: Number,
            required: true
        },
        questionText: {
            type: String,
            required: false
        },
        marksObtained: {
            type: Number,
            required: true,
            min: 0
        },
        maxMarks: {
            type: Number,
            required: true,
            min: 0
        },
        feedback: {
            type: String,
            required: true
        },
        correctAnswer: {
            type: String,
            required: false
        },
        studentAnswer: {
            type: String,
            required: false
        },
        isCorrect: {
            type: Boolean,
            required: false
        },
        options: {
            type: [String],
            default: []
        },
        keyConcepts: [
            {
                concept: String,
                present: Boolean
            }
        ],
        similarity: {
            type: Number,
            min: 0,
            max: 1
        }
    },
    { _id: false }
)

const SubmissionSchema = new Schema<ISubmissionDocument>(
    {
        examId: {
            type: String,
            required: true,
            ref: 'Exam'
        },
        studentId: {
            type: String,
            required: true,
            ref: 'User'
        },
        imageUrl: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: Object.values(SubmissionStatus),
            default: SubmissionStatus.PENDING
        },
        extractedText: {
            type: String
        },
        extractedAnswers: {
            type: [ExtractedAnswerSchema],
            default: []
        },
        evaluationResults: {
            type: [EvaluationResultSchema],
            default: []
        },
        totalMarksObtained: {
            type: Number,
            min: 0
        },
        totalMarks: {
            type: Number,
            min: 0
        },
        percentage: {
            type: Number,
            min: 0,
            max: 100
        },
        feedback: {
            type: String
        },
        processingError: {
            type: String
        },
        submittedAt: {
            type: Date,
            default: Date.now
        },
        processedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
)

// Indexes for faster queries
SubmissionSchema.index({ studentId: 1, submittedAt: -1 })
SubmissionSchema.index({ examId: 1, studentId: 1 })
SubmissionSchema.index({ status: 1 })

export default mongoose.model<ISubmissionDocument>('Submission', SubmissionSchema)
