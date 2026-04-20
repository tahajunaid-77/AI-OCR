import { Request, Response } from 'express'
import submissionService from './submission.service'
import httpResponse from '../../../handlers/httpResponse'
import asyncHandler from '../../../handlers/async'
import responseMessage from '../../../constant/responseMessage'

class SubmissionController {
    /**
     * Submit exam paper (upload image)
     * POST /api/v1/exam/submission
     */
    createSubmission = asyncHandler(async (req: Request, res: Response) => {
        const { examId } = req.body
        const file = req.file as Express.Multer.File

        const submission = await submissionService.createSubmission(examId, file)

        httpResponse(res, req, 201, 'Exam paper submitted successfully. Processing started.', submission)
    })

    /**
     * Get submission by ID
     * GET /api/v1/exam/submission/:submissionId
     */
    getSubmissionById = asyncHandler(async (req: Request, res: Response) => {
        const { submissionId } = req.params

        const submission = await submissionService.getSubmissionById(submissionId)

        httpResponse(res, req, 200, responseMessage.SUCCESS, submission)
    })

    /**
     * Get all submissions
     * GET /api/v1/exam/submission
     */
    getAllSubmissions = asyncHandler(async (req: Request, res: Response) => {
        const { page, limit } = req.query

        const result = await submissionService.getAllSubmissions(
            Number(page) || 1,
            Number(limit) || 10
        )

        httpResponse(res, req, 200, responseMessage.SUCCESS, result)
    })

    /**
     * Get all submissions for a specific exam
     * GET /api/v1/exam/submission/exam/:examId
     */
    getSubmissionsByExam = asyncHandler(async (req: Request, res: Response) => {
        const { examId } = req.params
        const { page, limit } = req.query

        const result = await submissionService.getSubmissionsByExam(
            examId,
            Number(page) || 1,
            Number(limit) || 10
        )

        httpResponse(res, req, 200, responseMessage.SUCCESS, result)
    })

    /**
     * Retry failed submission
     * POST /api/v1/exam/submission/:submissionId/retry
     */
    retrySubmission = asyncHandler(async (req: Request, res: Response) => {
        const { submissionId } = req.params

        await submissionService.retrySubmission(submissionId)

        httpResponse(res, req, 200, 'Submission retry initiated', null)
    })

    /**
     * Delete submission
     * DELETE /api/v1/exam/submission/:submissionId
     */
    deleteSubmission = asyncHandler(async (req: Request, res: Response) => {
        const { submissionId } = req.params

        const result = await submissionService.deleteSubmission(submissionId)

        httpResponse(res, req, 200, responseMessage.SUCCESS, result)
    })
}

export default new SubmissionController()
