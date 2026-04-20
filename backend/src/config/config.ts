import path from 'path'
import Joi from 'joi'
import dotenvFlow from 'dotenv-flow'

dotenvFlow.config()

const runtimeEnv = process.env.ENV || process.env.NODE_ENV || (process.env.JEST_WORKER_ID ? 'test' : 'development')

const envSchema = Joi.object({
    ENV: Joi.string().valid('development', 'production', 'test').default(runtimeEnv),
    PORT: Joi.number().port().default(5000),
    SERVER_URL: Joi.string().uri().optional(),
    DATABASE_URL: Joi.when('ENV', {
        is: 'test',
        then: Joi.string().empty('').default('mongodb://127.0.0.1:27017/base-server-test'),
        otherwise: Joi.string().required()
    }),
    EMAIL_SERVICE_API_KEY: Joi.string().allow('', null).optional(),
    ACCESS_TOKEN_SECRET: Joi.when('ENV', {
        is: 'test',
        then: Joi.string().empty('').min(8).default('test-access-secret'),
        otherwise: Joi.string().min(16).required()
    }),
    REFRESH_TOKEN_SECRET: Joi.when('ENV', {
        is: 'test',
        then: Joi.string().empty('').min(8).default('test-refresh-secret'),
        otherwise: Joi.string().min(16).required()
    }),
    API4AI_API_KEY: Joi.string().allow('', null).optional(),
    OCR_SPACE_API_KEY: Joi.string().allow('', null).optional(),
    GROK_API_KEY: Joi.string().allow('', null).optional(),
    GROK_API_URL: Joi.string().uri().default('https://api.x.ai/v1'),
    GROQ_API_KEY: Joi.string().allow('', null).optional(),
    GROQ_API_URL: Joi.string().uri().default('https://api.groq.com/openai/v1'),
    OPENAI_API_KEY: Joi.string().allow('', null).optional(),
    OPENAI_API_URL: Joi.string().uri().default('https://api.openai.com/v1'),
    OPENAI_MODEL: Joi.string().default('gpt-4.1-mini'),
    NLP_PROVIDER: Joi.string().valid('auto', 'groq', 'openai').default('auto'),
    MAX_FILE_SIZE: Joi.number().integer().min(1024).max(20 * 1024 * 1024).default(10 * 1024 * 1024),
    UPLOAD_DIR: Joi.string().default('uploads/exam-papers'),
    ALLOWED_FILE_TYPES: Joi.string()
        .default('image/jpeg,image/png,application/pdf')
})
    .unknown(true)

const { error, value: env } = envSchema.validate(process.env, {
    abortEarly: false,
    convert: true
})

if (error) {
    throw new Error(`Invalid environment configuration: ${error.details.map((detail) => detail.message).join(', ')}`)
}

const backendRoot = path.resolve(__dirname, '../../')
const uploadDir = path.resolve(backendRoot, env.UPLOAD_DIR)

export default {
    // General
    ENV: env.ENV,
    PORT: env.PORT,
    SERVER_URL: env.SERVER_URL,

    // Database
    DATABASE_URL: env.DATABASE_URL,

    //Email
    EMAIL_API_KEY: env.EMAIL_SERVICE_API_KEY,

    //Tokens
    TOKENS: {
        ACCESS: {
            SECRET: env.ACCESS_TOKEN_SECRET as string,
            EXPIRY: 3600
        },
        REFRESH: {
            SECRET: env.REFRESH_TOKEN_SECRET as string,
            EXPIRY: 3600 * 24 * 365
        }
    },

    // OCR Services
    OCR: {
        API4AI: {
            API_KEY: env.API4AI_API_KEY
        },
        OCR_SPACE: {
            API_KEY: env.OCR_SPACE_API_KEY
        }
    },

    // AI Services
    AI: {
        GROK: {
            API_KEY: env.GROK_API_KEY,
            API_URL: env.GROK_API_URL
        },
        GROQ: {
            API_KEY: env.GROQ_API_KEY,
            API_URL: env.GROQ_API_URL
        },
        OPENAI: {
            API_KEY: env.OPENAI_API_KEY,
            API_URL: env.OPENAI_API_URL,
            MODEL: env.OPENAI_MODEL
        },
        NLP_PROVIDER: env.NLP_PROVIDER
    },

    // File Upload
    UPLOAD: {
        MAX_FILE_SIZE: env.MAX_FILE_SIZE,
        UPLOAD_DIR: uploadDir,
        ALLOWED_FILE_TYPES: (env.ALLOWED_FILE_TYPES as string).split(',').map((fileType) => fileType.trim()).filter(Boolean)
    }
}
