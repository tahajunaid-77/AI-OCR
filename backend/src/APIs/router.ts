import { Router } from 'express'
import controller from './controller'
import rateLimiter from '../middlewares/rateLimiter'
import examRouter from './exam'

const router = Router()

router.route('/self').get(rateLimiter, controller.self)
router.route('/health').get(controller.health)

// Exam routes
router.use('/exam', examRouter)

export default router
