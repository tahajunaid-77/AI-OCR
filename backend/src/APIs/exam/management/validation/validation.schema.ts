import Joi from 'joi'
import { QuestionType } from '../../_shared/types/exam.interface'

export const createExamSchema = Joi.object({
    title: Joi.string().required().trim().min(3).max(200).messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 3 characters',
        'string.max': 'Title must not exceed 200 characters'
    }),
    subject: Joi.string().required().trim().min(2).max(100).messages({
        'string.empty': 'Subject is required',
        'string.min': 'Subject must be at least 2 characters',
        'string.max': 'Subject must not exceed 100 characters'
    }),
    totalMarks: Joi.number().required().min(1).messages({
        'number.base': 'Total marks must be a number',
        'number.min': 'Total marks must be at least 1'
    }),
    questions: Joi.array()
        .items(
            Joi.object({
                questionNumber: Joi.number().required().min(1),
                questionText: Joi.string().required().trim().min(5),
                questionType: Joi.string()
                    .required()
                    .valid(...Object.values(QuestionType)),
                marks: Joi.number().required().min(0),
                correctAnswer: Joi.string().trim().allow(''),
                keyConcepts: Joi.array().items(Joi.string()),
                rubric: Joi.string().trim().allow('')
            })
        )
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one question is required'
        })
})

export const updateExamSchema = Joi.object({
    title: Joi.string().trim().min(3).max(200),
    subject: Joi.string().trim().min(2).max(100),
    totalMarks: Joi.number().min(1),
    questions: Joi.array().items(
        Joi.object({
            questionNumber: Joi.number().required().min(1),
            questionText: Joi.string().required().trim().min(5),
            questionType: Joi.string()
                .required()
                .valid(...Object.values(QuestionType)),
            marks: Joi.number().required().min(0),
            correctAnswer: Joi.string().trim().allow(''),
            keyConcepts: Joi.array().items(Joi.string()),
            rubric: Joi.string().trim().allow('')
        })
    )
}).min(1)

export const getExamsQuerySchema = Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    subject: Joi.string().trim()
})
