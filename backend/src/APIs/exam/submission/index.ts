import { Router } from 'express'
import submissionController from './submission.controller'
import {
    validateCreateSubmission,
    validateExamIdParam,
    validateGetSubmissionsQuery,
    validateSubmissionIdParam
} from './validation/validations'
import { upload } from '../../../config/multer'

const router = Router()

// Submit exam paper (with file upload)
router.post('/', upload.single('examPaper'), validateCreateSubmission, submissionController.createSubmission)

// Get all submissions
router.get('/', validateGetSubmissionsQuery, submissionController.getAllSubmissions)

// Get submissions by exam
router.get('/exam/:examId', validateExamIdParam, validateGetSubmissionsQuery, submissionController.getSubmissionsByExam)

// Get submission by ID
router.get('/:submissionId', validateSubmissionIdParam, submissionController.getSubmissionById)

// Retry failed submission
router.post('/:submissionId/retry', validateSubmissionIdParam, submissionController.retrySubmission)

// Delete submission
router.delete('/:submissionId', validateSubmissionIdParam, submissionController.deleteSubmission)

export default router
