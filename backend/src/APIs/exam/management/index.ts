import { Router } from 'express'
import examManagementController from './exam-management.controller'
import { validateCreateExam, validateUpdateExam, validateGetExamsQuery } from './validation/validations'

const router = Router()

// Create exam
router.post('/', validateCreateExam, examManagementController.createExam)

// Get all exams (with optional filters)
router.get('/', validateGetExamsQuery, examManagementController.getAllExams)

// Get exam by ID
router.get('/:examId', examManagementController.getExamById)

// Update exam
router.put('/:examId', validateUpdateExam, examManagementController.updateExam)

// Delete exam
router.delete('/:examId', examManagementController.deleteExam)

export default router
