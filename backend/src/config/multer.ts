import multer from 'multer'
import path from 'path'
import fs from 'fs'
import config from './config'
import { CustomError } from '../utils/errors'

// Ensure upload directory exists
const uploadDir = config.UPLOAD.UPLOAD_DIR
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir)
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
        const ext = path.extname(file.originalname).toLowerCase()
        const rawName = path.basename(file.originalname, ext)
        const sanitizedBaseName = rawName
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80)

        const safeFileName = sanitizedBaseName || 'exam-paper'
        cb(null, `${safeFileName}-${uniqueSuffix}${ext}`)
    }
})

// File filter
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = config.UPLOAD.ALLOWED_FILE_TYPES
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.pdf'])
    const extension = path.extname(file.originalname).toLowerCase()

    if (allowedTypes.includes(file.mimetype) && allowedExtensions.has(extension)) {
        cb(null, true)
    } else {
        cb(new CustomError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`, 400) as any)
    }
}

// Create multer instance
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.UPLOAD.MAX_FILE_SIZE
    }
})

export default upload
