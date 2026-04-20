import { Router } from 'express'
import examManagementRouter from './management'
import submissionRouter from './submission'

const router = Router()

// Exam management routes
router.use('/management', examManagementRouter)

// Submission routes
router.use('/submission', submissionRouter)

export default router
