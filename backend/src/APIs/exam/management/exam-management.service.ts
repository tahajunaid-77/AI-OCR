import examRepository from '../_shared/repo/exam.repository'
import { IExam } from '../_shared/types/exam.interface'
import { CustomError } from '../../../utils/errors'
import logger from '../../../handlers/logger'

class ExamManagementService {
    /**
     * Create a new exam
     */
    async createExam(examData: IExam, creatorId: string = 'system') {
        try {
            // Validate total marks matches sum of question marks
            const calculatedTotal = examData.questions.reduce((sum, q) => sum + q.marks, 0)

            if (calculatedTotal !== examData.totalMarks) {
                throw new CustomError(`Total marks mismatch. Sum of question marks (${calculatedTotal}) does not match totalMarks (${examData.totalMarks})`, 400)
            }

            const exam = await examRepository.create({
                ...examData,
                createdBy: creatorId
            })

            logger.info(`Exam created successfully`, { examId: exam._id, creatorId })

            return exam
        } catch (error) {
            logger.error('Failed to create exam', error)
            throw error
        }
    }

    /**
     * Get exam by ID
     */
    async getExamById(examId: string) {
        try {
            const exam = await examRepository.findById(examId)

            if (!exam) {
                throw new CustomError('Exam not found', 404)
            }

            return exam
        } catch (error) {
            logger.error('Failed to get exam', error)
            throw error
        }
    }

    /**
     * Get all exams (with pagination)
     */
    async getAllExams(page = 1, limit = 10, subject?: string) {
        try {
            const skip = (page - 1) * limit

            let exams
            let total

            if (subject) {
                exams = await examRepository.findBySubject(subject, limit, skip)
                total = await examRepository.count({ subject })
            } else {
                exams = await examRepository.findAll(limit, skip)
                total = await examRepository.count()
            }

            return {
                exams,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        } catch (error) {
            logger.error('Failed to get all exams', error)
            throw error
        }
    }

    /**
     * Update an exam
     */
    async updateExam(examId: string, updateData: Partial<IExam>) {
        try {
            const exam = await examRepository.findById(examId)

            if (!exam) {
                throw new CustomError('Exam not found', 404)
            }

            // Validate total marks if questions are being updated
            if (updateData.questions) {
                const calculatedTotal = updateData.questions.reduce((sum, q) => sum + q.marks, 0)
                updateData.totalMarks = calculatedTotal
            }

            const updatedExam = await examRepository.update(examId, updateData)

            logger.info(`Exam updated successfully`, { examId })

            return updatedExam
        } catch (error) {
            logger.error('Failed to update exam', error)
            throw error
        }
    }

    /**
     * Delete an exam
     */
    async deleteExam(examId: string) {
        try {
            const exam = await examRepository.findById(examId)

            if (!exam) {
                throw new CustomError('Exam not found', 404)
            }

            await examRepository.delete(examId)

            logger.info(`Exam deleted successfully`, { examId })

            return { message: 'Exam deleted successfully' }
        } catch (error) {
            logger.error('Failed to delete exam', error)
            throw error
        }
    }
}

export default new ExamManagementService()
