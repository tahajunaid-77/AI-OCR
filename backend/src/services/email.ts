import { Resend } from 'resend'
import config from '../config/config'
import logger from '../handlers/logger'

let resend: Resend | null = null

function getResendClient(): Resend | null {
    if (!config.EMAIL_API_KEY) {
        return null
    }
    if (!resend) {
        resend = new Resend(config.EMAIL_API_KEY)
    }
    return resend
}

export default {
    sendEmail: async (to: string[], subject: string, text: string) => {
        try {
            const client = getResendClient()
            if (!client) {
                logger.warn('Email service not configured. Skipping email send.')
                return
            }

            await client.emails.send({
                from: `Coderatory <onboarding@resend.dev>`,
                to,
                subject,
                text
            })
        } catch (error) {
            logger.error('Failed to send email', error)
            throw error
        }
    }
}
