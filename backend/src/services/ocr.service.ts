import axios from 'axios'
import fs from 'fs/promises'
import config from '../config/config'
import logger from '../handlers/logger'
import sharp from 'sharp'

interface OCRResult {
    text: string
    confidence: number
    provider: 'api4ai' | 'ocr-space'
}

class OCRService {
    private normalizeExtractedText(text: string): string {
        return text
            .replace(/\r/g, '\n')
            .replace(/\t+/g, '\n')
            .replace(/[•●·]/g, '* ')
            .replace(/[‐‑–—]/g, '-')
            .replace(/[→⇒➜]/g, '->')
            .replace(/[ ]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }

    /**
     * Extract text using API4AI OCR API
     */
    private async extractWithAPI4AI(imagePath: string): Promise<OCRResult> {
        try {
            const apiKey = config.OCR.API4AI.API_KEY

            logger.info('Using API4AI OCR')

            // Read image file
            const imageBuffer = await fs.readFile(imagePath)

            // Create form data
            const FormData = require('form-data')
            const formData = new FormData()
            formData.append('image', imageBuffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            })

            // Choose endpoint based on API key availability
            let endpoint: string
            let headers: any

            if (apiKey && apiKey.trim().length > 0) {
                // Use RapidAPI endpoint with key
                endpoint = 'https://ocr43.p.rapidapi.com/v1/results'
                headers = {
                    ...formData.getHeaders(),
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': 'ocr43.p.rapidapi.com'
                }
                logger.info('Using RapidAPI endpoint with API key')
            } else {
                // Use free demo endpoint (no key required)
                endpoint = 'https://demo.api4ai.cloud/ocr/v1/results'
                headers = formData.getHeaders()
                logger.info('Using demo endpoint (no API key)')
            }

            const response = await axios.post(endpoint, formData, {
                headers,
                timeout: 60000
            })

            // Extract text from API4AI response
            let extractedText = ''
            
            if (response.data?.results && Array.isArray(response.data.results)) {
                // API4AI returns results array with entities
                for (const result of response.data.results) {
                    if (result.entities && Array.isArray(result.entities)) {
                        for (const entity of result.entities) {
                            if (entity.text) {
                                extractedText += entity.text + '\n'
                            }
                        }
                    }
                }
            }

            const normalizedText = this.normalizeExtractedText(extractedText)

            if (!normalizedText || normalizedText.trim().length === 0) {
                throw new Error('No text detected')
            }

            logger.info('API4AI OCR successful', { textLength: normalizedText.length })

            return {
                text: normalizedText,
                confidence: 0.9,
                provider: 'api4ai'
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error('API4AI OCR failed', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                })
            } else {
                logger.error('API4AI OCR failed', error)
            }
            throw error
        }
    }

    /**
     * Check image quality before processing
     */
    private async checkImageQuality(imagePath: string): Promise<{ isGood: boolean; message?: string }> {
        try {
            const metadata = await sharp(imagePath).metadata()

            // Check minimum dimensions
            if (metadata.width && metadata.width < 500) {
                return { isGood: false, message: 'Image width is too small. Please upload a higher resolution image.' }
            }

            if (metadata.height && metadata.height < 500) {
                return {
                    isGood: false,
                    message: 'Image height is too small. Please upload a higher resolution image.'
                }
            }

            // Check file size (too small might indicate poor quality)
            const stats = await fs.stat(imagePath)
            if (stats.size < 50000) {
                // Less than 50KB
                return { isGood: false, message: 'Image file size is too small. Please upload a clearer image.' }
            }

            return { isGood: true }
        } catch (error) {
            logger.error('Image quality check failed', error)
            return { isGood: true } // Proceed if quality check fails
        }
    }

    /**
     * Extract text using OCR.space API
     */
    private async extractWithOCRSpace(imagePath: string): Promise<OCRResult> {
        try {
            const apiKey = config.OCR.OCR_SPACE.API_KEY

            if (!apiKey) {
                throw new Error('OCR.space API key not configured')
            }

            logger.info('Preparing image for OCR.space')
            
            // Optimize image for faster processing
            let imageBuffer: Buffer
            try {
                imageBuffer = await sharp(imagePath)
                    .resize(1200, 1200, { // Smaller size for faster processing
                        fit: 'inside',
                        withoutEnlargement: false
                    })
                    .grayscale() // Improves OCR accuracy
                    .median(1) // Light denoising helps handwriting scans
                    .normalize() // Better contrast
                    .linear(1.08, -6) // Slight contrast boost without crushing text
                    .sharpen() // Enhance text edges
                    .jpeg({ quality: 90, force: true }) // High quality
                    .toBuffer()
                
                logger.info('Image optimized for OCR', { bufferSize: imageBuffer.length })
            } catch (sharpError) {
                logger.error('Sharp processing failed', sharpError)
                imageBuffer = await fs.readFile(imagePath)
            }

            return await this.sendToOCRSpace(imageBuffer)
        } catch (error) {
            logger.error('OCR.space failed', error)
            throw error
        }
    }

    /**
     * Send image buffer to OCR.space API
     */
    private async sendToOCRSpace(imageBuffer: Buffer): Promise<OCRResult> {
        const apiKey = config.OCR.OCR_SPACE.API_KEY
        const base64Image = imageBuffer.toString('base64')
        
        logger.info('Sending to OCR.space', { bufferSize: imageBuffer.length })

        const FormData = require('form-data')
        const formData = new FormData()
        formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`)
        formData.append('language', 'eng')
        formData.append('isOverlayRequired', 'false')
        formData.append('detectOrientation', 'true')
        formData.append('scale', 'true')
        formData.append('OCREngine', '2') // Engine 2 for better accuracy
        formData.append('isTable', 'true') // Better for structured content

        const response = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: {
                ...formData.getHeaders(),
                apikey: apiKey
            },
            timeout: 120000, // Increased to 120 seconds
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        })

        logger.info('OCR.space response received')

        if (response.data.IsErroredOnProcessing) {
            const errorMsg = response.data.ErrorMessage?.[0] || 'OCR processing failed'
            logger.error('OCR.space processing error')
            throw new Error(errorMsg)
        }

        const extractedText = response.data.ParsedResults?.[0]?.ParsedText

        const normalizedText = this.normalizeExtractedText(extractedText || '')

        if (!normalizedText) {
            throw new Error('No text detected in the image')
        }

        logger.info('OCR.space successful', { textLength: normalizedText.length })

        return {
            text: normalizedText,
            confidence: 0.8,
            provider: 'ocr-space'
        }
    }

    /**
     * Extract text from image - OCR.space primary, API4AI fallback
     */
    async extractText(imagePath: string): Promise<OCRResult> {
        // Check image quality first
        const qualityCheck = await this.checkImageQuality(imagePath)
        if (!qualityCheck.isGood) {
            throw new Error(qualityCheck.message)
        }

        // Try OCR.space first (more reliable)
        try {
            logger.info('Attempting OCR.space OCR')
            return await this.extractWithOCRSpace(imagePath)
        } catch (ocrSpaceError) {
            const errorMsg = ocrSpaceError instanceof Error ? ocrSpaceError.message : 'Unknown error'
            logger.warn('OCR.space failed, trying API4AI fallback', { error: errorMsg })

            // Fallback to API4AI
            try {
                logger.info('Attempting API4AI fallback')
                return await this.extractWithAPI4AI(imagePath)
            } catch (api4aiError) {
                const api4aiErrorMsg = api4aiError instanceof Error ? api4aiError.message : 'Unknown'
                logger.error('All OCR services failed', { 
                    ocrSpaceError: errorMsg,
                    api4aiError: api4aiErrorMsg
                })
                throw new Error(
                    'Failed to extract text from image. Please ensure the image is clear and try again.'
                )
            }
        }
    }

    /**
     * Extract text from PDF (convert to images first)
     */
    async extractTextFromPDF(_pdfPath: string): Promise<OCRResult> {
        // TODO: Implement PDF to image conversion and OCR
        // This would require pdf-parse or pdf2pic library
        throw new Error('PDF processing not yet implemented')
    }
}

export default new OCRService()
