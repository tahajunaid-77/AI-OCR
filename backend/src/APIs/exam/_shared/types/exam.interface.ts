export enum QuestionType {
    MCQ = 'MCQ',
    PARAGRAPH = 'PARAGRAPH',
    SHORT_ANSWER = 'SHORT_ANSWER'
}

export enum SubmissionStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export interface IQuestion {
    questionNumber: number
    questionText: string
    questionType: QuestionType
    marks: number
    options?: string[] // For MCQs - all available options
    correctAnswer?: string // For MCQs
    keyConcepts?: string[] // For paragraph answers
    rubric?: string // Grading criteria
}

export interface IExam {
    title: string
    subject: string
    totalMarks: number
    questions: IQuestion[]
    createdBy: string
    createdAt?: Date
    updatedAt?: Date
}

export interface IExtractedAnswer {
    questionNumber: number
    extractedText: string
    confidence?: number
}

export interface IEvaluationResult {
    questionNumber: number
    questionText?: string // The actual question text to display
    marksObtained: number
    maxMarks: number
    feedback: string
    correctAnswer?: string // Show correct answer for wrong answers
    studentAnswer?: string
    isCorrect?: boolean
    options?: string[]
    keyConcepts?: {
        concept: string
        present: boolean
    }[]
    similarity?: number
}

export interface ISubmission {
    examId: string
    studentId: string
    imageUrl: string
    fileName: string
    fileSize: number
    mimeType: string
    status: SubmissionStatus
    extractedText?: string
    extractedAnswers?: IExtractedAnswer[]
    evaluationResults?: IEvaluationResult[]
    totalMarksObtained?: number
    totalMarks?: number
    percentage?: number
    feedback?: string
    processingError?: string
    submittedAt: Date
    processedAt?: Date
    createdAt?: Date
    updatedAt?: Date
}
