import express, { Application } from 'express'
import path from 'path'
import router from './APIs'
import errorHandler from './middlewares/errorHandler'
import notFound from './handlers/notFound'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import config from './config/config'

const app: Application = express()
const allowedOrigins = [config.SERVER_URL, 'http://localhost:3000', 'http://localhost:5000'].filter(
    (origin): origin is string => Boolean(origin)
)

//Middlewares
app.use(helmet())
app.disable('x-powered-by')
app.use(cookieParser())
app.use(
    cors({
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PUT', 'PATCH'],
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true)
            }

            return callback(new Error('Origin not allowed by CORS'))
        },
        credentials: true
    })
)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(express.static(path.join(__dirname, '../', 'public')))

//Router
// app.use('/v1', router)
router(app)

//404 handler
app.use(notFound)

//Handlers as Middlewares
app.use(errorHandler)

export default app
