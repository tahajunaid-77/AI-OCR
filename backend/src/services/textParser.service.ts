import logger from '../handlers/logger'
import { IExtractedAnswer } from '../APIs/exam/_shared/types/exam.interface'

class TextParserService {
    /**
     * Parse extracted text to identify individual answers
     * Supports various formats:
     * - Q1: answer
     * - Question 1: answer
     * - 1. answer
     * - Answer 1: answer
     */
    parseAnswers(extractedText: string, totalQuestions: number): IExtractedAnswer[] {
        const answers: IExtractedAnswer[] = []

        try {
            // Split text into lines
            const lines = extractedText.split('\n').map((line) => line.trim())

            // Patterns to match question numbers
            const patterns = [
                /^Q\.?\s*(\d+)[:\s\-\.)]+(.+)/i, // Q1: answer or Q.1: answer
                /^Question\s+(\d+)[:\s\-\.)]+(.+)/i, // Question 1: answer
                /^(\d+)[\.\)\:\s\-]+(.+)/, // 1. answer or 1) answer
                /^Answer\s+(\d+)[:\s\-\.)]+(.+)/i, // Answer 1: answer
                /^Ans\.?\s*(\d+)[:\s\-\.)]+(.+)/i // Ans 1: answer or Ans.1: answer
            ]

            let currentQuestion: number | null = null
            let currentAnswer = ''

            for (const line of lines) {
                if (!line) continue

                let matched = false

                // Try to match question patterns
                for (const pattern of patterns) {
                    const match = line.match(pattern)
                    if (match) {
                        // Save previous answer if exists
                        if (currentQuestion !== null && currentAnswer.trim()) {
                            answers.push({
                                questionNumber: currentQuestion,
                                extractedText: currentAnswer.trim(),
                                confidence: 0.8
                            })
                        }

                        // Start new answer
                        currentQuestion = parseInt(match[1])
                        currentAnswer = match[2] || ''
                        matched = true
                        break
                    }
                }

                // If no pattern matched and we have a current question, append to current answer
                if (!matched && currentQuestion !== null) {
                    currentAnswer += ' ' + line
                }
            }

            // Save last answer
            if (currentQuestion !== null && currentAnswer.trim()) {
                answers.push({
                    questionNumber: currentQuestion,
                    extractedText: currentAnswer.trim(),
                    confidence: 0.8
                })
            }

            // Sort by question number
            answers.sort((a, b) => a.questionNumber - b.questionNumber)

            // Validate that we have answers for all questions
            if (answers.length < totalQuestions) {
                logger.warn(`Only found ${answers.length} answers out of ${totalQuestions} questions`)
            }

            // Fill missing questions with empty answers
            for (let i = 1; i <= totalQuestions; i++) {
                if (!answers.find((a) => a.questionNumber === i)) {
                    answers.push({
                        questionNumber: i,
                        extractedText: '',
                        confidence: 0
                    })
                }
            }

            // Sort again after filling
            answers.sort((a, b) => a.questionNumber - b.questionNumber)

            logger.info(`Parsed ${answers.length} answers from extracted text`)

            return answers
        } catch (error) {
            logger.error('Failed to parse answers from text', error)

            // Return empty answers for all questions as fallback
            return Array.from({ length: totalQuestions }, (_, i) => ({
                questionNumber: i + 1,
                extractedText: '',
                confidence: 0
            }))
        }
    }

    /**
     * Clean and normalize extracted text
     */
    cleanText(text: string): string {
        return (
            text
                // Remove extra whitespace
                .replace(/\s+/g, ' ')
                // Remove special characters that might interfere
                .replace(/[^\w\s\.\,\?\!\:\;\-\(\)]/g, '')
                // Trim
                .trim()
        )
    }

    /**
     * Extract MCQ answers specifically (A, B, C, D format)
     */
    extractMCQAnswers(extractedText: string, totalQuestions: number): IExtractedAnswer[] {
        const answers: IExtractedAnswer[] = []

        try {
            // Pattern to match MCQ answers: Q1: A, Question 1: B, 1. C, etc.
            const mcqPattern = /(?:Q\.?|Question|Ans\.?)\s*(\d+)[:\s\-\.)]+([A-Da-d])/gi

            let match
            while ((match = mcqPattern.exec(extractedText)) !== null) {
                const questionNumber = parseInt(match[1])
                const answer = match[2].toUpperCase()

                answers.push({
                    questionNumber,
                    extractedText: answer,
                    confidence: 0.9
                })
            }

            // Sort by question number
            answers.sort((a, b) => a.questionNumber - b.questionNumber)

            // Fill missing questions
            for (let i = 1; i <= totalQuestions; i++) {
                if (!answers.find((a) => a.questionNumber === i)) {
                    answers.push({
                        questionNumber: i,
                        extractedText: '',
                        confidence: 0
                    })
                }
            }

            answers.sort((a, b) => a.questionNumber - b.questionNumber)

            return answers
        } catch (error) {
            logger.error('Failed to extract MCQ answers', error)
            return Array.from({ length: totalQuestions }, (_, i) => ({
                questionNumber: i + 1,
                extractedText: '',
                confidence: 0
            }))
        }
    }

    /**
     * Detect if the text contains mostly MCQ answers or paragraph answers
     */
    detectAnswerType(extractedText: string): 'MCQ' | 'PARAGRAPH' | 'MIXED' {
        const mcqPattern = /(?:Q\.?|Question|Ans\.?)\s*\d+[:\s\-\.)]+[A-Da-d](?:\s|$)/gi
        const mcqMatches = extractedText.match(mcqPattern)

        const lines = extractedText.split('\n').filter((line) => line.trim().length > 0)
        const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length

        if (mcqMatches && mcqMatches.length > 3) {
            return 'MCQ'
        } else if (avgLineLength > 50) {
            return 'PARAGRAPH'
        } else {
            return 'MIXED'
        }
    }
}

export default new TextParserService()
