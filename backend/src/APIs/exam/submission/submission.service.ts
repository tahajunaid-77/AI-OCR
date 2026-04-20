import submissionRepository from '../_shared/repo/submission.repository'
import examRepository from '../_shared/repo/exam.repository'
import ocrService from '../../../services/ocr.service'
import textParserService from '../../../services/textParser.service'
import evaluationService from '../../../services/evaluation.service'
import { ISubmission, SubmissionStatus } from '../_shared/types/exam.interface'
import { CustomError } from '../../../utils/errors'
import logger from '../../../handlers/logger'
import fs from 'fs/promises'

class SubmissionService {
    private readonly processingStartStatuses = [SubmissionStatus.PENDING, SubmissionStatus.FAILED]

    /**
     * Create a new submission (upload exam paper)
     */
    async createSubmission(examId: string | undefined, file: Express.Multer.File): Promise<ISubmission> {
        try {
            if (!file?.path) {
                throw new CustomError('Exam paper image is required', 400)
            }

            // Create submission record without requiring a specific exam
            const submission = await submissionRepository.create({
                examId: examId?.trim() || 'auto-detected',
                studentId: 'anonymous',
                imageUrl: file.path,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                status: SubmissionStatus.PENDING,
                submittedAt: new Date()
            })

            logger.info('Submission created', { submissionId: submission._id })

            // Process submission asynchronously
            void this.processSubmissionInBackground(submission._id as string)

            return submission
        } catch (error) {
            logger.error('Failed to create submission', error)
            throw error
        }
    }

    private async processSubmissionInBackground(submissionId: string): Promise<void> {
        try {
            await this.processSubmissionIntelligently(submissionId)
        } catch (error) {
            logger.error('Async submission processing failed', { submissionId, error })
        }
    }

    /**
     * Intelligent processing: Extract questions, answers, and evaluate without predefined exam
     */
    async processSubmissionIntelligently(submissionId: string): Promise<void> {
        try {
            const claimedSubmission = await submissionRepository.updateStatusIfCurrent(
                submissionId,
                this.processingStartStatuses,
                SubmissionStatus.PROCESSING
            )

            if (!claimedSubmission) {
                logger.warn('Skipping submission processing because status is not retryable', { submissionId })
                return
            }

            const submission = await submissionRepository.findById(submissionId)
            if (!submission) {
                throw new Error('Submission not found')
            }

            logger.info('Starting intelligent submission processing', { submissionId })

            // Step 1: OCR - Extract text from image
            const ocrResult = await ocrService.extractText(submission.imageUrl)
            logger.info('OCR completed', { submissionId, textLength: ocrResult.text.length })

            // IMMEDIATELY truncate OCR text to prevent BSON overflow
            const maxOCRTextLength = 100000 // 100KB max for processing
            const truncatedOCRText = ocrResult.text.length > maxOCRTextLength 
                ? ocrResult.text.substring(0, maxOCRTextLength)
                : ocrResult.text
            
            if (ocrResult.text.length > maxOCRTextLength) {
                logger.warn('OCR text truncated for processing', { 
                    originalLength: ocrResult.text.length,
                    truncatedLength: truncatedOCRText.length 
                })
            }

            // Step 2: Use AI to extract questions and answers from the text
            const { questions, answers, subject, totalMarks } = await evaluationService.extractQuestionsAndAnswers(
                truncatedOCRText
            )
            logger.info('Questions and answers extracted', { 
                submissionId, 
                questionsCount: questions.length,
                subject 
            })

            // Step 3: Use AI to evaluate each answer
            const evaluationResults = await evaluationService.evaluateAnswersIntelligently(questions, answers)
            logger.info('Evaluation completed', { submissionId, resultsCount: evaluationResults.length })

            // Step 4: Calculate total marks
            const totalMarksObtained = evaluationResults.reduce((sum, r) => sum + r.marksObtained, 0)
            const percentage = totalMarks > 0 ? (totalMarksObtained / totalMarks) * 100 : 0

            // Step 5: Generate overall feedback
            const overallFeedback = evaluationService.generateOverallFeedback(
                evaluationResults,
                totalMarks,
                totalMarksObtained
            )

            // Step 6: Update submission with results
            // Truncate extracted text for storage (MongoDB BSON limit is 16MB)
            const maxStorageTextLength = 20000 // Store max 20KB of text
            const finalTruncatedText = truncatedOCRText.length > maxStorageTextLength 
                ? truncatedOCRText.substring(0, maxStorageTextLength) + '\n\n[Text truncated for display...]'
                : truncatedOCRText

            // Also truncate any large text in answers
            const truncatedAnswers = answers.map(answer => ({
                ...answer,
                extractedText: answer.extractedText && answer.extractedText.length > 5000
                    ? answer.extractedText.substring(0, 5000) + '...'
                    : answer.extractedText
            }))

            // Truncate feedback in evaluation results if too large
            const truncatedEvaluationResults = evaluationResults.map(result => ({
                ...result,
                feedback: result.feedback && result.feedback.length > 2000
                    ? result.feedback.substring(0, 2000) + '...'
                    : result.feedback,
                correctAnswer: result.correctAnswer && result.correctAnswer.length > 2000
                    ? result.correctAnswer.substring(0, 2000) + '...'
                    : result.correctAnswer
            }))

            await submissionRepository.update(submissionId, {
                extractedText: finalTruncatedText,
                extractedAnswers: truncatedAnswers,
                evaluationResults: truncatedEvaluationResults,
                totalMarksObtained,
                totalMarks,
                percentage,
                feedback: overallFeedback.length > 5000 ? overallFeedback.substring(0, 5000) + '...' : overallFeedback,
                status: SubmissionStatus.COMPLETED,
                processedAt: new Date()
            })

            logger.info('Intelligent submission processing completed successfully', {
                submissionId,
                subject,
                totalMarksObtained,
                totalMarks,
                percentage
            })
        } catch (error) {
            logger.error('Intelligent submission processing failed', { submissionId, error })

            // Update submission with error
            await submissionRepository.update(submissionId, {
                status: SubmissionStatus.FAILED,
                processingError: error instanceof Error ? error.message : 'Unknown error occurred'
            })

            throw error
        }
    }

    /**
     * Process submission: OCR -> Parse -> Evaluate
     */
    async processSubmission(submissionId: string): Promise<void> {
        try {
            // Update status to processing
            await submissionRepository.updateStatus(submissionId, SubmissionStatus.PROCESSING)

            const submission = await submissionRepository.findById(submissionId)
            if (!submission) {
                throw new Error('Submission not found')
            }

            const exam = await examRepository.findById(submission.examId)
            if (!exam) {
                throw new Error('Exam not found')
            }

            logger.info('Starting submission processing', { submissionId })

            // Step 1: OCR - Extract text from image
            const ocrResult = await ocrService.extractText(submission.imageUrl)
            logger.info('OCR completed', { submissionId, textLength: ocrResult.text.length, provider: ocrResult.provider })

            // Step 2: Parse extracted text to identify answers
            const extractedAnswers = textParserService.parseAnswers(ocrResult.text, exam.questions.length)
            logger.info('Text parsing completed', { submissionId, answersFound: extractedAnswers.length })

            // Step 3: Evaluate answers
            const answerMap = new Map(extractedAnswers.map((a) => [a.questionNumber, a.extractedText]))
            const evaluationResults = await evaluationService.evaluateExam(exam.questions, answerMap)
            logger.info('Evaluation completed', { submissionId, resultsCount: evaluationResults.length })

            // Step 4: Calculate total marks
            const totalMarksObtained = evaluationResults.reduce((sum, r) => sum + r.marksObtained, 0)
            const percentage = (totalMarksObtained / exam.totalMarks) * 100

            // Step 5: Generate overall feedback
            const overallFeedback = evaluationService.generateOverallFeedback(
                evaluationResults,
                exam.totalMarks,
                totalMarksObtained
            )

            // Step 6: Update submission with results
            await submissionRepository.update(submissionId, {
                extractedText: ocrResult.text,
                extractedAnswers,
                evaluationResults,
                totalMarksObtained,
                totalMarks: exam.totalMarks,
                percentage,
                feedback: overallFeedback,
                status: SubmissionStatus.COMPLETED,
                processedAt: new Date()
            })

            logger.info('Submission processing completed successfully', {
                submissionId,
                totalMarksObtained,
                percentage
            })
        } catch (error) {
            logger.error('Submission processing failed', { submissionId, error })

            // Update submission with error
            await submissionRepository.update(submissionId, {
                status: SubmissionStatus.FAILED,
                processingError: error instanceof Error ? error.message : 'Unknown error occurred'
            })

            throw error
        }
    }

    /**
     * Get submission by ID
     */
    async getSubmissionById(submissionId: string): Promise<ISubmission> {
        try {
            const submission = await submissionRepository.findById(submissionId)

            if (!submission) {
                throw new CustomError('Submission not found', 404)
            }

            return submission
        } catch (error) {
            logger.error('Failed to get submission', error)
            throw error
        }
    }

    /**
     * Get all submissions
     */
    async getAllSubmissions(page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit
            const submissions = await submissionRepository.findAll(limit, skip)
            const total = await submissionRepository.count()

            return {
                submissions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        } catch (error) {
            logger.error('Failed to get all submissions', error)
            throw error
        }
    }

    /**
     * Get all submissions for an exam
     */
    async getSubmissionsByExam(examId: string, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit
            const submissions = await submissionRepository.findByExam(examId, limit, skip)
            const total = await submissionRepository.count({ examId })

            return {
                submissions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        } catch (error) {
            logger.error('Failed to get submissions by exam', error)
            throw error
        }
    }

    /**
     * Retry failed submission
     */
    async retrySubmission(submissionId: string): Promise<void> {
        try {
            const submission = await submissionRepository.findById(submissionId)

            if (!submission) {
                throw new CustomError('Submission not found', 404)
            }

            if (submission.status !== SubmissionStatus.FAILED) {
                throw new CustomError('Only failed submissions can be retried', 400)
            }

            // Reset submission status
            await submissionRepository.update(submissionId, {
                status: SubmissionStatus.PENDING,
                processingError: undefined
            })

            // Process again using intelligent processing
            void this.processSubmissionInBackground(submissionId)
        } catch (error) {
            logger.error('Failed to retry submission', error)
            throw error
        }
    }

    /**
     * Delete submission
     */
    async deleteSubmission(submissionId: string) {
        try {
            const submission = await submissionRepository.findById(submissionId)

            if (!submission) {
                throw new CustomError('Submission not found', 404)
            }

            // Delete file from filesystem
            try {
                await fs.unlink(submission.imageUrl)
            } catch (fileError) {
                logger.warn('Failed to delete submission file', fileError)
            }

            await submissionRepository.delete(submissionId)

            logger.info('Submission deleted', { submissionId })

            return { message: 'Submission deleted successfully' }
        } catch (error) {
            logger.error('Failed to delete submission', error)
            throw error
        }
    }
}

export default new SubmissionService()
