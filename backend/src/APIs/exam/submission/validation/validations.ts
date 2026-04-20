import { Request, Response, NextFunction } from 'express'
import fs from 'fs/promises'
import {
    createSubmissionSchema,
    examIdParamSchema,
    getSubmissionsQuerySchema,
    mongoIdParamSchema
} from './validation.schema'
import { CustomError } from '../../../../utils/errors'

const deleteUploadedFile = async (filePath?: string) => {
    if (!filePath) {
        return
    }

    try {
        await fs.unlink(filePath)
    } catch {
        // Best-effort cleanup only.
    }
}

export const validateCreateSubmission = (req: Request, _res: Response, next: NextFunction) => {
    const { error } = createSubmissionSchema.validate(req.body, { abortEarly: false })

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ')
        void deleteUploadedFile(req.file?.path)
        return next(new CustomError(errorMessage, 400))
    }

    // Check if file is uploaded
    if (!req.file) {
        return next(new CustomError('Exam paper image is required', 400))
    }

    next()
}

export const validateGetSubmissionsQuery = (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = getSubmissionsQuerySchema.validate(req.query, { abortEarly: false })

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ')
        return next(new CustomError(errorMessage, 400))
    }

    req.query = value
    next()
}

export const validateSubmissionIdParam = (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = mongoIdParamSchema.validate(req.params, { abortEarly: false })

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ')
        return next(new CustomError(errorMessage, 400))
    }

    req.params = value
    next()
}

export const validateExamIdParam = (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = examIdParamSchema.validate(req.params, { abortEarly: false })

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ')
        return next(new CustomError(errorMessage, 400))
    }

    req.params = value
    next()
}
