import ExamModel, { IExamDocument } from '../models/exam.model'
import { IExam } from '../types/exam.interface'

class ExamRepository {
    async create(examData: IExam): Promise<IExamDocument> {
        const exam = new ExamModel(examData)
        return await exam.save()
    }

    async findById(examId: string): Promise<IExamDocument | null> {
        return await ExamModel.findById(examId)
    }

    async findByCreator(creatorId: string, limit = 10, skip = 0): Promise<IExamDocument[]> {
        return await ExamModel.find({ createdBy: creatorId }).sort({ createdAt: -1 }).limit(limit).skip(skip)
    }

    async findBySubject(subject: string, limit = 10, skip = 0): Promise<IExamDocument[]> {
        return await ExamModel.find({ subject }).sort({ createdAt: -1 }).limit(limit).skip(skip)
    }

    async findAll(limit = 10, skip = 0): Promise<IExamDocument[]> {
        return await ExamModel.find().sort({ createdAt: -1 }).limit(limit).skip(skip)
    }

    async update(examId: string, updateData: Partial<IExam>): Promise<IExamDocument | null> {
        return await ExamModel.findByIdAndUpdate(examId, updateData, { new: true, runValidators: true })
    }

    async delete(examId: string): Promise<IExamDocument | null> {
        return await ExamModel.findByIdAndDelete(examId)
    }

    async count(filter: Record<string, unknown> = {}): Promise<number> {
        return await ExamModel.countDocuments(filter)
    }
}

export default new ExamRepository()
