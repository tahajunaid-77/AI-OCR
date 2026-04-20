import Joi from 'joi'

export const createSubmissionSchema = Joi.object({
    examId: Joi.string().trim().max(100).optional().allow('', 'default')
}).unknown(false)

export const getSubmissionsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
}).unknown(false)

export const mongoIdParamSchema = Joi.object({
    submissionId: Joi.string().trim().hex().length(24).required()
}).unknown(false)

export const examIdParamSchema = Joi.object({
    examId: Joi.string().trim().min(1).max(100).required()
}).unknown(false)
