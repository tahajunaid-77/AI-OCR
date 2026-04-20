import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default api

// API Types
export interface Question {
  questionNumber: number
  questionText: string
  questionType: 'MCQ' | 'PARAGRAPH' | 'SHORT_ANSWER'
  marks: number
  options?: string[]
  correctAnswer?: string
  keyConcepts?: string[]
  rubric?: string
}

export interface Exam {
  _id: string
  title: string
  subject: string
  totalMarks: number
  questions: Question[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateExamRequest {
  title: string
  subject: string
  totalMarks: number
  questions: Question[]
}

export interface EvaluationResult {
  questionNumber: number
  questionText?: string
  marksObtained: number
  maxMarks: number
  feedback: string
  correctAnswer?: string
  studentAnswer?: string
  isCorrect?: boolean
  options?: string[]
  keyConcepts?: {
    concept: string
    present: boolean
  }[]
  similarity?: number
}

export interface ExtractedAnswer {
  questionNumber: number
  extractedText: string
  confidence?: number
}

export interface Submission {
  _id: string
  examId: string
  studentId: string
  imageUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  extractedText?: string
  extractedAnswers?: ExtractedAnswer[]
  evaluationResults?: EvaluationResult[]
  totalMarksObtained?: number
  totalMarks?: number
  percentage?: number
  feedback?: string
  processingError?: string
  submittedAt: string
  processedAt?: string
}

export interface PaginatedResponse<T> {
  exams?: T[]
  submissions?: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// API Functions
export const examAPI = {
  createExam: async (data: CreateExamRequest): Promise<Exam> => {
    const response = await api.post('/exam/management', data)
    return response.data.data
  },

  getAllExams: async (page = 1, limit = 10, subject?: string): Promise<PaginatedResponse<Exam>> => {
    const params: any = { page, limit }
    if (subject) params.subject = subject
    const response = await api.get('/exam/management', { params })
    return response.data.data
  },

  getExamById: async (examId: string): Promise<Exam> => {
    const response = await api.get(`/exam/management/${examId}`)
    return response.data.data
  },

  updateExam: async (examId: string, data: Partial<CreateExamRequest>): Promise<Exam> => {
    const response = await api.put(`/exam/management/${examId}`, data)
    return response.data.data
  },

  deleteExam: async (examId: string): Promise<void> => {
    await api.delete(`/exam/management/${examId}`)
  }
}

export const submissionAPI = {
  submitExam: async (examId: string, file: File): Promise<Submission> => {
    const formData = new FormData()
    formData.append('examId', examId)
    formData.append('examPaper', file)

    const response = await api.post('/exam/submission', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data.data
  },

  getAllSubmissions: async (page = 1, limit = 10): Promise<PaginatedResponse<Submission>> => {
    const response = await api.get('/exam/submission', { params: { page, limit } })
    return response.data.data
  },

  getSubmissionById: async (submissionId: string): Promise<Submission> => {
    const response = await api.get(`/exam/submission/${submissionId}`)
    return response.data.data
  },

  getSubmissionsByExam: async (examId: string, page = 1, limit = 10): Promise<PaginatedResponse<Submission>> => {
    const response = await api.get(`/exam/submission/exam/${examId}`, { params: { page, limit } })
    return response.data.data
  },

  retrySubmission: async (submissionId: string): Promise<void> => {
    await api.post(`/exam/submission/${submissionId}/retry`)
  },

  deleteSubmission: async (submissionId: string): Promise<void> => {
    await api.delete(`/exam/submission/${submissionId}`)
  }
}
