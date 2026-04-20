import SubmissionModel, { ISubmissionDocument } from '../models/submission.model'
import { ISubmission, SubmissionStatus } from '../types/exam.interface'

class SubmissionRepository {
    async create(submissionData: Partial<ISubmission>): Promise<ISubmissionDocument> {
        const submission = new SubmissionModel(submissionData)
        return await submission.save()
    }

    async findById(submissionId: string): Promise<ISubmissionDocument | null> {
        return await SubmissionModel.findById(submissionId)
    }

    async findByStudent(studentId: string, limit = 10, skip = 0): Promise<ISubmissionDocument[]> {
        return await SubmissionModel.find({ studentId }).sort({ submittedAt: -1 }).limit(limit).skip(skip)
    }

    async findAll(limit = 10, skip = 0): Promise<ISubmissionDocument[]> {
        return await SubmissionModel.find().sort({ submittedAt: -1 }).limit(limit).skip(skip)
    }

    async findByExam(examId: string, limit = 10, skip = 0): Promise<ISubmissionDocument[]> {
        return await SubmissionModel.find({ examId }).sort({ submittedAt: -1 }).limit(limit).skip(skip)
    }

    async findByExamAndStudent(examId: string, studentId: string): Promise<ISubmissionDocument[]> {
        return await SubmissionModel.find({ examId, studentId }).sort({ submittedAt: -1 })
    }

    async findByStatus(status: SubmissionStatus, limit = 10, skip = 0): Promise<ISubmissionDocument[]> {
        return await SubmissionModel.find({ status }).sort({ submittedAt: -1 }).limit(limit).skip(skip)
    }

    async update(submissionId: string, updateData: Partial<ISubmission>): Promise<ISubmissionDocument | null> {
        try {
            return await SubmissionModel.findByIdAndUpdate(submissionId, updateData, { new: true, runValidators: true })
        } catch (error) {
            // If BSON size error, try with more aggressive truncation
            if (error instanceof Error && error.message.includes('offset')) {
                console.error('BSON size error detected, applying emergency truncation')
                
                // Emergency truncation
                const emergencyData = { ...updateData }
                if (emergencyData.extractedText && typeof emergencyData.extractedText === 'string') {
                    emergencyData.extractedText = emergencyData.extractedText.substring(0, 5000) + '\n[Truncated]'
                }
                if (emergencyData.feedback && typeof emergencyData.feedback === 'string') {
                    emergencyData.feedback = emergencyData.feedback.substring(0, 2000) + '\n[Truncated]'
                }
                if (Array.isArray(emergencyData.extractedAnswers)) {
                    emergencyData.extractedAnswers = emergencyData.extractedAnswers.map((ans: any) => ({
                        ...ans,
                        extractedText: ans.extractedText ? String(ans.extractedText).substring(0, 500) : ''
                    }))
                }
                if (Array.isArray(emergencyData.evaluationResults)) {
                    emergencyData.evaluationResults = emergencyData.evaluationResults.map((res: any) => ({
                        ...res,
                        feedback: res.feedback ? String(res.feedback).substring(0, 500) : '',
                        correctAnswer: res.correctAnswer ? String(res.correctAnswer).substring(0, 500) : undefined
                    }))
                }
                
                return await SubmissionModel.findByIdAndUpdate(submissionId, emergencyData, { new: true, runValidators: true })
            }
            throw error
        }
    }

    async updateStatus(submissionId: string, status: SubmissionStatus): Promise<ISubmissionDocument | null> {
        return await SubmissionModel.findByIdAndUpdate(submissionId, { status }, { new: true })
    }

    async updateStatusIfCurrent(
        submissionId: string,
        currentStatuses: SubmissionStatus[],
        nextStatus: SubmissionStatus
    ): Promise<ISubmissionDocument | null> {
        return await SubmissionModel.findOneAndUpdate(
            { _id: submissionId, status: { $in: currentStatuses } },
            { status: nextStatus },
            { new: true }
        )
    }

    async delete(submissionId: string): Promise<ISubmissionDocument | null> {
        return await SubmissionModel.findByIdAndDelete(submissionId)
    }

    async count(filter: Record<string, unknown> = {}): Promise<number> {
        return await SubmissionModel.countDocuments(filter)
    }

    async getStudentStats(studentId: string): Promise<{
        totalSubmissions: number
        averageScore: number
        highestScore: number
        lowestScore: number
    }> {
        const stats = await SubmissionModel.aggregate([
            { $match: { studentId, status: SubmissionStatus.COMPLETED } },
            {
                $group: {
                    _id: null,
                    totalSubmissions: { $sum: 1 },
                    averageScore: { $avg: '$percentage' },
                    highestScore: { $max: '$percentage' },
                    lowestScore: { $min: '$percentage' }
                }
            }
        ])

        return stats[0] || { totalSubmissions: 0, averageScore: 0, highestScore: 0, lowestScore: 0 }
    }
}

export default new SubmissionRepository()
