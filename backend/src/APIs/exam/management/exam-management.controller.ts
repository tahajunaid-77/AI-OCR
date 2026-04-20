import { Request, Response } from 'express'
import examManagementService from './exam-management.service'
import httpResponse from '../../../handlers/httpResponse'
import asyncHandler from '../../../handlers/async'
import responseMessage from '../../../constant/responseMessage'

class ExamManagementController {
    /**
     * Create a new exam
     * POST /api/v1/exam/management
     */
    createExam = asyncHandler(async (req: Request, res: Response) => {
        const examData = req.body

        const exam = await examManagementService.createExam(examData, 'system')

        httpResponse(res, req, 201, responseMessage.SUCCESS, exam)
    })

    /**
     * Get exam by ID
     * GET /api/v1/exam/management/:examId
     */
    getExamById = asyncHandler(async (req: Request, res: Response) => {
        const { examId } = req.params

        const exam = await examManagementService.getExamById(examId)

        httpResponse(res, req, 200, responseMessage.SUCCESS, exam)
    })

    /**
     * Get all exams (with optional subject filter)
     * GET /api/v1/exam/management
     */
    getAllExams = asyncHandler(async (req: Request, res: Response) => {
        const { page, limit, subject } = req.query

        const result = await examManagementService.getAllExams(
            Number(page) || 1,
            Number(limit) || 10,
            subject as string
        )

        httpResponse(res, req, 200, responseMessage.SUCCESS, result)
    })

    /**
     * Update an exam
     * PUT /api/v1/exam/management/:examId
     */
    updateExam = asyncHandler(async (req: Request, res: Response) => {
        const { examId } = req.params
        const updateData = req.body

        const exam = await examManagementService.updateExam(examId, updateData)

        httpResponse(res, req, 200, responseMessage.SUCCESS, exam)
    })

    /**
     * Delete an exam
     * DELETE /api/v1/exam/management/:examId
     */
    deleteExam = asyncHandler(async (req: Request, res: Response) => {
        const { examId } = req.params

        const result = await examManagementService.deleteExam(examId)

        httpResponse(res, req, 200, responseMessage.SUCCESS, result)
    })
}

export default new ExamManagementController()
