import { Request, Response, NextFunction } from 'express'
import { createExamSchema, updateExamSchema, getExamsQuerySchema } from './validation.schema'
import { CustomError } from '../../../../utils/errors'

export const validateCreateExam = (req: Request, _res: Response, next: NextFunction) => {
    const { error } = createExamSchema.validate(req.body, { abortEarly: false })

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ')
        return next(new CustomError(errorMessage, 400))
    }

    next()
}

export const validateUpdateExam = (req: Request, _res: Response, next: NextFunction) => {
    const { error } = updateExamSchema.validate(req.body, { abortEarly: false })

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ')
        return next(new CustomError(errorMessage, 400))
    }

    next()
}

export const validateGetExamsQuery = (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = getExamsQuerySchema.validate(req.query, { abortEarly: false })

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ')
        return next(new CustomError(errorMessage, 400))
    }

    req.query = value
    next()
}
