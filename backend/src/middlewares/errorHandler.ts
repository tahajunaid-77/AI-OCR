import { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { THttpError } from '../types/types'
import { CustomError } from '../utils/errors'
import logger from '../handlers/logger'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default (err: THttpError | Error | CustomError | multer.MulterError, req: Request, res: Response, _: NextFunction) => {
    if (err instanceof multer.MulterError) {
        const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
        const response: THttpError = {
            success: false,
            statusCode,
            request: {
                ip: req.ip || null,
                method: req.method,
                url: req.originalUrl
            },
            message: err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : err.message,
            data: null
        }

        logger.warn('Handled multer error', { meta: response })
        return res.status(statusCode).json(response)
    }

    const statusCode =
        'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500
    const message = err instanceof Error ? err.message : 'Something went wrong'

    const response: THttpError = {
        success: false,
        statusCode,
        request: {
            ip: req.ip || null,
            method: req.method,
            url: req.originalUrl
        },
        message,
        data: null
    }

    logger.error('Unhandled request error', { meta: { statusCode, message, error: err } })

    return res.status(statusCode).json(response)
}
