import axios from 'axios'
import config from '../config/config'
import logger from '../handlers/logger'
import { IQuestion, IEvaluationResult, QuestionType } from '../APIs/exam/_shared/types/exam.interface'

// interface SemanticSimilarityResult {
//     similarity: number
//     keyConcepts: {
//         concept: string
//         present: boolean
//     }[]
// }

class EvaluationService {
    private formatProviderError(error: any): string {
        const status = error?.response?.status
        const apiMessage =
            error?.response?.data?.error?.message ||
            error?.response?.data?.message ||
            error?.message ||
            'Unknown provider error'

        return status ? `${status}: ${apiMessage}` : String(apiMessage)
    }

    private toReasonText(error: unknown): string {
        if (error instanceof Error) {
            return this.formatProviderError(error)
        }

        return String(error || 'Unknown NLP provider error')
    }

    private extractOpenAIText(responseData: any): string {
        if (typeof responseData?.output_text === 'string' && responseData.output_text.trim()) {
            return responseData.output_text
        }

        const outputs = Array.isArray(responseData?.output) ? responseData.output : []
        for (const output of outputs) {
            const content = Array.isArray(output?.content) ? output.content : []
            for (const item of content) {
                if (item?.type === 'output_text' && typeof item.text === 'string' && item.text.trim()) {
                    return item.text
                }
            }
        }

        throw new Error('No text content in OpenAI response')
    }

    private async callOpenAIResponses(
        systemPrompt: string,
        userPrompt: string,
        maxTokens: number,
        temperature: number
    ): Promise<string> {
        const apiKey = config.AI.OPENAI.API_KEY
        const apiUrl = config.AI.OPENAI.API_URL
        const model = config.AI.OPENAI.MODEL

        if (!apiKey || !apiKey.trim()) {
            throw new Error('OpenAI API key not configured')
        }

        const response = await axios.post(
            `${apiUrl}/responses`,
            {
                model,
                input: [
                    {
                        role: 'system',
                        content: [{ type: 'input_text', text: systemPrompt }]
                    },
                    {
                        role: 'user',
                        content: [{ type: 'input_text', text: userPrompt }]
                    }
                ],
                max_output_tokens: maxTokens,
                temperature
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 25000
            }
        )

        return this.extractOpenAIText(response.data)
    }

    private async callTextModelWithFallback(
        systemPrompt: string,
        userPrompt: string,
        maxTokens: number,
        temperature: number,
        maxRetries: number = 1
    ): Promise<string> {
        const groqApiKey = config.AI.GROQ.API_KEY
        const groqApiUrl = config.AI.GROQ.API_URL
        const preferredProvider = config.AI.NLP_PROVIDER

        const tryGroq = async () => {
            if (!groqApiKey || !groqApiKey.trim()) {
                throw new Error('Groq API key not configured')
            }

            const response = await this.callGroqWithRetry(groqApiUrl, groqApiKey, {
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature,
                max_tokens: maxTokens
            }, maxRetries)

            const content = response.data.choices[0]?.message?.content
            if (!content) {
                throw new Error('No Groq response content')
            }

            logger.info('NLP provider used: groq')
            return content
        }

        const tryOpenAI = async () => {
            const content = await this.callOpenAIResponses(systemPrompt, userPrompt, maxTokens, temperature)
            logger.info('NLP provider used: openai')
            return content
        }

        const providers =
            preferredProvider === 'openai'
                ? [{ name: 'openai', run: tryOpenAI }]
                : preferredProvider === 'groq'
                    ? [{ name: 'groq', run: tryGroq }]
                    : [
                        { name: 'groq', run: tryGroq },
                        { name: 'openai', run: tryOpenAI }
                    ]

        logger.info('NLP provider selection', {
            preferredProvider,
            fallbackEnabled: preferredProvider === 'auto',
            availableProviders: providers.map((provider) => provider.name)
        })

        let lastError: unknown
        for (const provider of providers) {
            try {
                return await provider.run()
            } catch (error) {
                lastError = error
                logger.warn(`NLP provider failed: ${provider.name} (${this.formatProviderError(error)})`)
            }
        }

        throw lastError instanceof Error ? lastError : new Error('No NLP provider available')
    }

    private normalizeOCRLine(line: string): string {
        return line
            .replace(/\t+/g, ' ')
            .replace(/[ ]{2,}/g, ' ')
            .replace(/[|]/g, 'I')
            .trim()
    }

    private sanitizeOCRText(text: string): string {
        return text
            .replace(/[•●·]/g, '* ')
            .replace(/[→⇒➜]/g, '->')
            .replace(/\t+/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[ ]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }

    private isShortUppercaseNoise(line: string): boolean {
        const compact = line.replace(/[^A-Za-z]/g, '')
        return compact.length > 0 && compact.length <= 4 && line === line.toUpperCase()
    }

    private isNoiseLine(line: string): boolean {
        const normalized = line.trim().toLowerCase()
        if (!normalized) return true

        return (
            normalized.includes('scanned with') ||
            normalized.includes('page#') ||
            normalized.includes('page #') ||
            normalized.includes('oken scanner') ||
            normalized === 'or' ||
            normalized === 'facts' ||
            normalized === 'wai' ||
            normalized === 'wai.' ||
            this.isShortUppercaseNoise(line.trim()) ||
            normalized.length < 2
        )
    }

    private isLikelyParagraphHeading(line: string): boolean {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('*')) return false
        if (trimmed.length > 100) return false
        if (this.isNoiseLine(trimmed)) return false
        if (this.isShortUppercaseNoise(trimmed)) return false

        const normalized = trimmed.toLowerCase()
        const wordCount = trimmed.split(/\s+/).length
        const hasHeadingSeparator = /(:|=>|->|-)/.test(trimmed)
        const looksLikeQuestion = trimmed.endsWith('?')
        const titleLike = /^[0-9ivxlcdm\.\)\s-]*[a-z][a-z\s()'",&-]{2,}$/i.test(trimmed)
        const sentenceLike = /[.]{2,}|[,:;].+\s.+/.test(trimmed) && trimmed.length > 60

        if (normalized.startsWith('example') || normalized.startsWith('examples')) {
            return false
        }

        if (sentenceLike && !hasHeadingSeparator && !looksLikeQuestion) {
            return false
        }

        return looksLikeQuestion || hasHeadingSeparator || (titleLike && wordCount <= 8)
    }

    private isTopLevelSectionHeading(line: string): boolean {
        const trimmed = this.normalizeOCRLine(line)
        if (!trimmed || trimmed.length > 120) return false
        if (this.isNoiseLine(trimmed)) return false

        const numberedHeading = /^\d+\s*[\.\)]\s*[A-Za-z]/.test(trimmed)
        const romanHeading = /^(?:[ivxlcdm]+)\s*[\.\)]\s*[A-Za-z]/i.test(trimmed)

        return numberedHeading || romanHeading
    }

    private looksLikeContinuationOfPreviousLine(previousLine: string, currentLine: string): boolean {
        const prev = previousLine.trim()
        const current = currentLine.trim()

        if (!prev || !current) return false
        if (this.isTopLevelSectionHeading(current)) return false

        const previousEndsOpen = /(?:->|=>|:|,|and|or|of|with|the|a|an)$/i.test(prev)
        const currentStartsLower = /^[a-z(]/.test(current)
        const currentShort = current.split(/\s+/).length <= 6

        return previousEndsOpen || currentStartsLower || currentShort
    }

    private cleanHeadingText(line: string): string {
        return this.normalizeOCRLine(line)
            .replace(/^[0-9ivxlcdm]+\s*[\.\)]\s*/i, '')
            .replace(/^[\-\*]+\s*/, '')
            .replace(/[*]+$/g, '')
            .replace(/\s*(=>|->|:)\s*$/g, '')
            .trim()
    }

    private parseInlineHeading(line: string): { heading: string; remainder: string } | null {
        const trimmed = this.normalizeOCRLine(line)
        const match = trimmed.match(/^([^:=>\-→][^=>:→]{2,50}?)(?:\s*(?:=>|->|:|→)\s*)(.+)$/)
        if (!match) {
            return null
        }

        const heading = this.cleanHeadingText(match[1])
        const remainder = match[2].trim()

        if (!heading || !remainder) {
            return null
        }

        return { heading, remainder }
    }

    private splitEmbeddedHeadingSegments(line: string): string[] {
        const normalized = this.normalizeOCRLine(line)
        const pattern = /([A-Za-z][A-Za-z\s#()]{2,50}?)\s*(?:=>|->|:|→)\s*/g
        const matches = Array.from(normalized.matchAll(pattern))

        if (matches.length <= 1) {
            return [normalized]
        }

        const segments: string[] = []
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index ?? 0
            const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length
            const segment = normalized.slice(start, end).trim()
            if (segment) {
                segments.push(segment)
            }
        }

        return segments.length > 0 ? segments : [normalized]
    }

    private shouldTreatAsSupportHeading(heading: string): boolean {
        const normalized = heading.trim().toLowerCase()
        return (
            normalized.startsWith('note') ||
            normalized.startsWith('example') ||
            normalized.startsWith('examples') ||
            normalized.startsWith('facts') ||
            normalized.startsWith('# of') ||
            normalized.startsWith('types of') ||
            normalized.startsWith('main types') ||
            normalized.startsWith('types') ||
            normalized.startsWith('features') ||
            normalized.startsWith('main features') ||
            normalized.startsWith('key features') ||
            normalized.startsWith('characteristics') ||
            normalized.startsWith('main characteristics') ||
            normalized.startsWith('properties of') ||
            normalized.startsWith('const') ||
            /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)[\)\.]?$/i.test(normalized)
        )
    }

    private shouldMergeHeadingIntoCurrentBlock(heading: string, currentBlock: { heading: string; lines: string[] } | null): boolean {
        if (!currentBlock || currentBlock.lines.length === 0) {
            return false
        }

        const normalized = heading.trim().toLowerCase()
        const isShortHeading = normalized.split(/\s+/).length <= 4

        return this.shouldTreatAsSupportHeading(heading) || isShortHeading
    }

    private estimateParagraphMarks(answerText: string): number {
        const wordCount = answerText.split(/\s+/).filter(Boolean).length
        if (wordCount >= 120) return 5
        if (wordCount >= 80) return 4
        if (wordCount >= 45) return 3
        if (wordCount >= 20) return 2
        return 1
    }

    private countMCQMarkers(text: string): number {
        const inlineAsterisks = (text.match(/\*/g) || []).length
        const numberedQuestions = (text.match(/\b\d+\s*[\.\)]/g) || []).length
        return inlineAsterisks + numberedQuestions
    }

    private looksLikeMCQDocument(ocrText: string): boolean {
        const normalized = ocrText.toLowerCase()
        const inlineAsterisks = (ocrText.match(/\*/g) || []).length
        const numberedQuestions = (ocrText.match(/\b\d+\s*[\.\)]/g) || []).length
        const hasMCQInstruction =
            normalized.includes('encircle the right option') ||
            normalized.includes('multiple choice') ||
            normalized.includes('(mcqs)') ||
            normalized.includes('read the statements and encircle')

        return hasMCQInstruction || (inlineAsterisks >= 8 && numberedQuestions >= 2)
    }

    private isLikelyMCQNoise(line: string): boolean {
        const normalized = this.normalizeOCRLine(line).toLowerCase()

        return (
            this.isNoiseLine(normalized) ||
            normalized.includes('page#') ||
            normalized.includes('unit#') ||
            normalized.includes('scanned with') ||
            normalized === 'ph' ||
            normalized === 'olon' ||
            normalized === 'onglish' ||
            normalized.includes('democratic citizenship') ||
            normalized.startsWith('xi-english')
        )
    }

    private splitMCQSegments(ocrText: string): string[] {
        const rawParts = ocrText
            .split(/\t+|\r?\n+/)
            .map((part) => this.normalizeOCRLine(part))
            .filter(Boolean)

        const segments: string[] = []

        for (const part of rawParts) {
            if (this.isLikelyMCQNoise(part)) {
                continue
            }

            const cleanedPart = part.replace(/\s+\*/g, ' *')
            const starMatches = cleanedPart.match(/\*[^*]+/g)
            const prefix = cleanedPart.split('*')[0].trim()

            if (prefix) {
                segments.push(prefix)
            }

            if (starMatches && starMatches.length > 0) {
                starMatches
                    .map((match) => this.normalizeOCRLine(match))
                    .filter(Boolean)
                    .forEach((match) => segments.push(match))
                continue
            }

            if (!prefix) {
                segments.push(cleanedPart)
            }
        }

        return segments
    }

    private cleanMCQQuestionText(text: string): string {
        return this.normalizeOCRLine(text)
            .replace(/^\d+\s*[\.\)]\s*/, '')
            .replace(/^question\s*\d+\s*[:\-]?\s*/i, '')
            .trim()
    }

    private extractParagraphBlocksFallback(ocrText: string): {
        questions: IQuestion[]
        answers: { questionNumber: number; extractedText: string }[]
        totalMarks: number
    } {
        const cleanedText = this.sanitizeOCRText(ocrText)
        const rawLines = cleanedText.split('\n').map((line) => line.trim()).filter((line) => !this.isNoiseLine(line))

        const topLevelHeadingIndexes = rawLines
            .map((line, index) => (this.isTopLevelSectionHeading(line) ? index : -1))
            .filter((index) => index >= 0)

        if (topLevelHeadingIndexes.length > 0) {
            const questions: IQuestion[] = []
            const answers: { questionNumber: number; extractedText: string }[] = []

            topLevelHeadingIndexes.forEach((startIndex, blockIndex) => {
                const endIndex = blockIndex + 1 < topLevelHeadingIndexes.length ? topLevelHeadingIndexes[blockIndex + 1] : rawLines.length
                const heading = this.cleanHeadingText(rawLines[startIndex])
                const bodyLines = rawLines.slice(startIndex + 1, endIndex).filter((line) => !this.isTopLevelSectionHeading(line))
                const extractedText = bodyLines.join(' ').replace(/\s+/g, ' ').trim()

                if (!extractedText) {
                    return
                }

                const questionNumber = questions.length + 1
                const marks = this.estimateParagraphMarks(extractedText)

                questions.push({
                    questionNumber,
                    questionText: heading || `Answer ${questionNumber}`,
                    marks,
                    questionType: QuestionType.PARAGRAPH
                })

                answers.push({
                    questionNumber,
                    extractedText
                })
            })

            if (questions.length > 0) {
                return {
                    questions,
                    answers,
                    totalMarks: questions.reduce((sum, question) => sum + question.marks, 0)
                }
            }
        }

        const blocks: Array<{ heading: string; lines: string[] }> = []
        let currentBlock: { heading: string; lines: string[] } | null = null

        for (const line of rawLines) {
            if (this.isLikelyParagraphHeading(line)) {
                const heading = this.cleanHeadingText(line)

                if (this.shouldMergeHeadingIntoCurrentBlock(heading, currentBlock)) {
                    currentBlock?.lines.push(`${heading}:`)
                    continue
                }

                if (currentBlock && currentBlock.lines.length > 0) {
                    blocks.push(currentBlock)
                }

                currentBlock = {
                    heading,
                    lines: []
                }
                continue
            }

            if (!currentBlock) {
                currentBlock = {
                    heading: 'Answer 1',
                    lines: []
                }
            }

            currentBlock.lines.push(line)
        }

        if (currentBlock && currentBlock.lines.length > 0) {
            blocks.push(currentBlock)
        }

        if (blocks.length === 0) {
            const fallbackAnswer = cleanedText.substring(0, 1200)
            return {
                questions: [
                    {
                        questionNumber: 1,
                        questionText: 'Answer 1',
                        marks: this.estimateParagraphMarks(fallbackAnswer),
                        questionType: QuestionType.PARAGRAPH
                    }
                ],
                answers: [
                    {
                        questionNumber: 1,
                        extractedText: fallbackAnswer
                    }
                ],
                totalMarks: this.estimateParagraphMarks(fallbackAnswer)
            }
        }

        const questions: IQuestion[] = []
        const answers: { questionNumber: number; extractedText: string }[] = []

        blocks.forEach((block) => {
            const extractedText = block.lines.join(' ').replace(/\s+/g, ' ').trim()
            if (!extractedText) {
                return
            }

            const questionNumber = questions.length + 1
            const marks = this.estimateParagraphMarks(extractedText)

            questions.push({
                questionNumber,
                questionText: block.heading || `Answer ${questionNumber}`,
                marks,
                questionType: QuestionType.PARAGRAPH
            })

            answers.push({
                questionNumber,
                extractedText
            })
        })

        return {
            questions,
            answers,
            totalMarks: questions.reduce((sum, question) => sum + question.marks, 0)
        }
    }

    private extractSpecificQuestionAnswerFormat(ocrText: string): {
        questions: IQuestion[]
        answers: { questionNumber: number; extractedText: string }[]
        totalMarks: number
    } | null {
        const cleanedText = this.sanitizeOCRText(ocrText)
        const rawLines = cleanedText
            .split('\n')
            .map((line) => this.normalizeOCRLine(line))
            .filter((line) => !this.isNoiseLine(line))

        const sectionIndexes = rawLines
            .map((line, index) => (this.isTopLevelSectionHeading(line) ? index : -1))
            .filter((index) => index >= 0)

        if (sectionIndexes.length === 0) {
            return null
        }

        const questions: IQuestion[] = []
        const answers: { questionNumber: number; extractedText: string }[] = []

        sectionIndexes.forEach((startIndex, blockIndex) => {
            const endIndex = blockIndex + 1 < sectionIndexes.length ? sectionIndexes[blockIndex + 1] : rawLines.length
            const sectionHeading = this.cleanHeadingText(rawLines[startIndex])
            const bodyLines = rawLines.slice(startIndex + 1, endIndex).filter((line) => !this.isNoiseLine(line))
            let currentQuestionHeading = sectionHeading
            let currentAnswerLines: string[] = []

            const flushCurrentQuestion = () => {
                const extractedText = currentAnswerLines.join('\n').trim()
                if (!currentQuestionHeading || !extractedText) {
                    currentAnswerLines = []
                    return
                }

                const questionNumber = questions.length + 1
                const marks = this.estimateParagraphMarks(extractedText)

                questions.push({
                    questionNumber,
                    questionText: currentQuestionHeading,
                    marks,
                    questionType: QuestionType.PARAGRAPH
                })

                answers.push({
                    questionNumber,
                    extractedText
                })

                currentAnswerLines = []
            }

            for (const rawLine of bodyLines) {
                const segments = this.splitEmbeddedHeadingSegments(rawLine)

                for (const segment of segments) {
                    const inlineHeading = this.parseInlineHeading(segment)

                    if (
                        inlineHeading &&
                        !this.shouldTreatAsSupportHeading(inlineHeading.heading) &&
                        currentAnswerLines.join(' ').split(/\s+/).filter(Boolean).length >= 20
                    ) {
                        flushCurrentQuestion()
                        currentQuestionHeading = inlineHeading.heading
                        currentAnswerLines.push(inlineHeading.remainder)
                        continue
                    }

                    if (inlineHeading && this.shouldTreatAsSupportHeading(inlineHeading.heading)) {
                        currentAnswerLines.push(`${inlineHeading.heading}: ${inlineHeading.remainder}`)
                        continue
                    }

                    const line = inlineHeading && currentAnswerLines.length === 0
                        ? `${inlineHeading.heading} -> ${inlineHeading.remainder}`
                        : segment

                    if (currentAnswerLines.length > 0) {
                        const previousLine = currentAnswerLines[currentAnswerLines.length - 1]
                        if (this.looksLikeContinuationOfPreviousLine(previousLine, line)) {
                            currentAnswerLines[currentAnswerLines.length - 1] = `${previousLine} ${line}`.replace(/\s+/g, ' ').trim()
                            continue
                        }
                    }

                    currentAnswerLines.push(line)
                }
            }

            flushCurrentQuestion()
        })

        if (questions.length === 0) {
            return null
        }

        return {
            questions,
            answers,
            totalMarks: questions.reduce((sum, question) => sum + question.marks, 0)
        }
    }

    /**
     * Call Groq API with automatic retry on rate limit (429)
     */
    private async callGroqWithRetry(
        apiUrl: string,
        apiKey: string,
        payload: any,
        maxRetries: number = 2
    ): Promise<any> {
        let lastError: any

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.post(
                    `${apiUrl}/chat/completions`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 25000
                    }
                )
                return response
            } catch (error: any) {
                lastError = error

                // Check if it's a rate limit error (429)
                if (error.response?.status === 429) {
                    const waitTime = attempt * 1500
                    logger.warn(`Groq rate limit hit (429), retrying in ${waitTime/1000}s... (attempt ${attempt}/${maxRetries})`)
                    
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, waitTime))
                        continue
                    }
                }

                // If not 429 or max retries reached, throw error
                throw error
            }
        }

        throw lastError
    }

    private normalizeQuestionText(text: string): string {
        return text
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9 ]+/g, '')
            .trim()
    }

    private normalizeMCQAnswer(question: IQuestion, answer: string): string {
        const trimmedAnswer = answer.trim()
        const options = question.options || []
        const labelMatch = trimmedAnswer.match(/^([a-d])(?:[\)\].:\-\s]|$)/i)

        if (labelMatch) {
            const optionIndex = labelMatch[1].toUpperCase().charCodeAt(0) - 65
            if (optionIndex >= 0 && optionIndex < options.length) {
                return options[optionIndex]
            }
        }

        return trimmedAnswer
    }

    private normalizeSequentialMCQExtraction(
        rawQuestions: any[],
        rawAnswers: any[]
    ): {
        questions: IQuestion[]
        answers: { questionNumber: number; extractedText: string }[]
        totalMarks: number
    } {
        const normalizedQuestions: IQuestion[] = []
        const normalizedAnswers: { questionNumber: number; extractedText: string }[] = []
        const seenQuestionTexts = new Set<string>()

        rawQuestions.forEach((rawQuestion, index) => {
            const questionText = String(rawQuestion?.questionText || '').trim()
            const options = Array.isArray(rawQuestion?.options)
                ? rawQuestion.options.map((option: unknown) => String(option).trim()).filter(Boolean)
                : []

            if (questionText.length < 8 || options.length < 2) {
                return
            }

            const normalizedText = this.normalizeQuestionText(questionText)
            if (!normalizedText || seenQuestionTexts.has(normalizedText)) {
                return
            }
            seenQuestionTexts.add(normalizedText)

            const nextQuestionNumber = normalizedQuestions.length + 1
            const originalQuestionNumber = Number(rawQuestion?.questionNumber)
            const matchingAnswer =
                rawAnswers.find((answer) => Number(answer?.questionNumber) === originalQuestionNumber) ||
                rawAnswers[index]

            normalizedQuestions.push({
                questionNumber: nextQuestionNumber,
                questionText,
                marks: Number(rawQuestion?.marks) > 0 ? Number(rawQuestion.marks) : 1,
                questionType: QuestionType.MCQ,
                options
            })

            normalizedAnswers.push({
                questionNumber: nextQuestionNumber,
                extractedText: String(matchingAnswer?.extractedText || '').trim()
            })
        })

        return {
            questions: normalizedQuestions,
            answers: normalizedAnswers,
            totalMarks: normalizedQuestions.reduce((sum, question) => sum + question.marks, 0)
        }
    }

    /**
     * Calculate cosine similarity between two texts (simple implementation)
     */
    private calculateCosineSimilarity(text1: string, text2: string): number {
        const words1 = text1.toLowerCase().split(/\s+/)
        const words2 = text2.toLowerCase().split(/\s+/)

        const allWords = Array.from(new Set([...words1, ...words2]))
        const vector1 = allWords.map((word) => words1.filter((w) => w === word).length)
        const vector2 = allWords.map((word) => words2.filter((w) => w === word).length)

        const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0)
        const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0))
        const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0))

        if (magnitude1 === 0 || magnitude2 === 0) return 0

        return dotProduct / (magnitude1 * magnitude2)
    }

    /**
     * Check for key concepts in student answer
     */
    private checkKeyConcepts(studentAnswer: string, keyConcepts: string[]): {
        concept: string
        present: boolean
    }[] {
        const answerLower = studentAnswer.toLowerCase()

        return keyConcepts.map((concept) => ({
            concept,
            present: answerLower.includes(concept.toLowerCase())
        }))
    }

    /**
     * Use fallback evaluation (Grok disabled due to 403 errors)
     */
    private async evaluateWithGrokAPI(
        question: IQuestion,
        studentAnswer: string
    ): Promise<{
        score: number
        feedback: string
        similarity: number
        correctAnswer?: string
        keyConcepts?: string[]
    }> {
        const prompt = `You are grading a student's paragraph answer in a lenient, practical way.

HEADING / QUESTION:
${question.questionText}

STUDENT ANSWER:
${studentAnswer}

MAX MARKS:
${question.marks}

INSTRUCTIONS:
1. Grade kindly but honestly. Do not be too strict on spelling, handwriting OCR noise, or wording.
2. Focus on whether the student understood the topic under the heading.
3. Give partial credit normally when the main idea is correct but incomplete.
4. Return short, helpful feedback.
5. If the answer is correct enough, give a high score even if the wording is simple.
6. Return JSON only.

JSON:
{
  "score": number,
  "similarity": number,
  "feedback": "short feedback",
  "correctAnswer": "brief ideal answer",
  "keyConcepts": ["concept 1", "concept 2", "concept 3"]
}`

        const content = await this.callTextModelWithFallback(
            'You are a supportive human examiner. Grade handwritten paragraph answers leniently but sensibly. Return only valid JSON.',
            prompt,
            220,
            0.1
        )
        if (!content) {
            throw new Error('No response from model provider')
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('Invalid paragraph grading response from NLP provider')
        }

        const parsed = JSON.parse(jsonMatch[0])
        const rawScore = Number(parsed.score)
        const boundedScore = Number.isFinite(rawScore)
            ? Math.min(question.marks, Math.max(0, rawScore))
            : question.marks * 0.6
        const rawSimilarity = Number(parsed.similarity)
        const similarity = Number.isFinite(rawSimilarity)
            ? Math.min(1, Math.max(0, rawSimilarity))
            : boundedScore / Math.max(question.marks, 1)

        return {
            score: Math.round(boundedScore * 10) / 10,
            feedback: String(parsed.feedback || `Good effort. Score: ${boundedScore}/${question.marks}`),
            similarity,
            correctAnswer: parsed.correctAnswer ? String(parsed.correctAnswer) : undefined,
            keyConcepts: Array.isArray(parsed.keyConcepts)
                ? parsed.keyConcepts.map((concept: unknown) => String(concept).trim()).filter(Boolean)
                : undefined
        }
    }

    private async evaluateParagraphBatchWithGrok(
        questions: IQuestion[],
        answers: any[]
    ): Promise<Map<number, IEvaluationResult>> {
        const payloadQuestions = questions.map((question) => {
            const answer = answers.find((item) => item.questionNumber === question.questionNumber)
            return {
                questionNumber: question.questionNumber,
                heading: question.questionText,
                maxMarks: question.marks,
                studentAnswer: String(answer?.extractedText || '').trim()
            }
        })

        const prompt = `Grade these handwritten paragraph answers in one batch.

INSTRUCTIONS:
1. Grade kindly but honestly.
2. Do not be too strict about OCR mistakes, spelling, or wording.
3. Focus on whether the student understood the heading/topic.
4. Give partial credit normally.
5. Return JSON only.

JSON FORMAT:
{
  "results": [
    {
      "questionNumber": 1,
      "score": 2,
      "similarity": 0.8,
      "feedback": "short feedback",
      "correctAnswer": "brief ideal answer",
      "keyConcepts": ["concept 1", "concept 2"]
    }
  ]
}

INPUT:
${JSON.stringify(payloadQuestions)}`

        const content = await this.callTextModelWithFallback(
            'You are a supportive human examiner. Grade handwritten paragraph answers in batch. Return only valid JSON.',
            prompt,
            700,
            0.1,
            1
        )
        if (!content) {
            throw new Error('No response from model provider')
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('Invalid paragraph batch grading response from NLP provider')
        }

        const parsed = JSON.parse(jsonMatch[0])
        const results = Array.isArray(parsed.results) ? parsed.results : []
        const evaluationMap = new Map<number, IEvaluationResult>()

        for (const question of questions) {
            const answer = answers.find((item) => item.questionNumber === question.questionNumber)
            const studentAnswer = String(answer?.extractedText || '').trim()
            const graded = results.find((item: any) => Number(item?.questionNumber) === question.questionNumber)

            if (!graded) {
                continue
            }

            const rawScore = Number(graded.score)
            const boundedScore = Number.isFinite(rawScore)
                ? Math.min(question.marks, Math.max(0, rawScore))
                : question.marks * 0.6
            const rawSimilarity = Number(graded.similarity)
            const similarity = Number.isFinite(rawSimilarity)
                ? Math.min(1, Math.max(0, rawSimilarity))
                : boundedScore / Math.max(question.marks, 1)
            const percentage = (boundedScore / Math.max(question.marks, 1)) * 100
            const keyConcepts = Array.isArray(graded.keyConcepts)
                ? graded.keyConcepts.map((concept: unknown) => String(concept).trim()).filter(Boolean)
                : undefined

            evaluationMap.set(question.questionNumber, {
                questionNumber: question.questionNumber,
                questionText: question.questionText,
                marksObtained: Math.round(boundedScore * 10) / 10,
                maxMarks: question.marks,
                feedback: String(graded.feedback || `Good effort. Score: ${boundedScore}/${question.marks}`),
                correctAnswer: graded.correctAnswer ? String(graded.correctAnswer) : undefined,
                studentAnswer,
                isCorrect: percentage >= 50,
                similarity,
                keyConcepts: keyConcepts ? this.checkKeyConcepts(studentAnswer, keyConcepts) : undefined
            })
        }

        return evaluationMap
    }

    /**
     * Evaluate MCQ answer with configured NLP provider
     */
    private async evaluateMCQWithGrok(question: IQuestion, studentAnswer: string): Promise<IEvaluationResult> {
        try {
            const optionsList = (question.options || []).map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')

            const prompt = `You are evaluating a multiple choice question. Determine the CORRECT answer based on your knowledge, then check if the student's answer matches.

QUESTION: ${question.questionText}

OPTIONS:
${optionsList}

STUDENT'S ANSWER: ${studentAnswer}

INSTRUCTIONS:
1. First, determine which option is CORRECT based on your knowledge
2. Then check if the student's answer matches the correct option
3. Be lenient with spelling/formatting differences
4. Return JSON only

RESPOND WITH JSON:
{"isCorrect": true/false, "correctAnswer": "the correct option text", "explanation": "brief reason"}`

            const content = await this.callTextModelWithFallback(
                'You are an expert exam evaluator. Determine correct answers based on knowledge and validate student responses. Return only JSON.',
                prompt,
                90,
                0.1
            )
            logger.info('MCQ validation response received', { content: content?.substring(0, 200) })
            
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0])
                const resolvedStudentAnswer = this.normalizeMCQAnswer(question, studentAnswer)
                const feedback = result.isCorrect 
                    ? 'Correct!' 
                    : `Incorrect. The correct answer is: ${result.correctAnswer}${result.explanation ? ` (${result.explanation})` : ''}`
                
                logger.info('MCQ evaluation completed', {
                    questionNumber: question.questionNumber,
                    studentAnswer,
                    isCorrect: result.isCorrect,
                    correctAnswer: result.correctAnswer
                })
                
                return {
                    questionNumber: question.questionNumber,
                    questionText: question.questionText,
                    marksObtained: result.isCorrect ? question.marks : 0,
                    maxMarks: question.marks,
                    feedback,
                    correctAnswer: result.isCorrect ? undefined : result.correctAnswer,
                    studentAnswer: resolvedStudentAnswer,
                    isCorrect: result.isCorrect,
                    options: question.options || [],
                    similarity: result.isCorrect ? 1 : 0
                }
            }
        } catch (error) {
            const reason = this.toReasonText(error)
            logger.warn(`MCQ NLP evaluation failed, using fallback (${reason})`)
            return this.evaluateMCQFallback(question, studentAnswer, reason)
        }

        return this.evaluateMCQFallback(question, studentAnswer)
    }

    /**
     * Fallback MCQ evaluation
     * If NLP validation is unavailable, do not guess correctness from stored data.
     */
    private evaluateMCQFallback(question: IQuestion, studentAnswer: string, reason?: string): IEvaluationResult {
        const resolvedStudentAnswer = this.normalizeMCQAnswer(question, studentAnswer)
        const feedback = reason
            ? `Automatic MCQ validation is unavailable because the NLP provider failed: ${reason}`
            : 'Automatic MCQ validation is unavailable because the NLP provider could not be reached. Please retry.'

        logger.info('Fallback MCQ evaluation', {
            questionNumber: question.questionNumber,
            studentAnswer: resolvedStudentAnswer
        })

        return {
            questionNumber: question.questionNumber,
            questionText: question.questionText,
            marksObtained: 0,
            maxMarks: question.marks,
            feedback,
            studentAnswer: resolvedStudentAnswer,
            isCorrect: false,
            options: question.options || [],
            similarity: 0
        }
    }

    /**
     * Evaluate paragraph answer using AI and semantic analysis
     */
    private async evaluateParagraph(question: IQuestion, studentAnswer: string): Promise<IEvaluationResult> {
        try {
            const modelResult = await this.evaluateWithGrokAPI(question, studentAnswer)

            // Check key concepts if provided
            let keyConceptsResult
            const keyConcepts = question.keyConcepts && question.keyConcepts.length > 0
                ? question.keyConcepts
                : modelResult.keyConcepts

            if (keyConcepts && keyConcepts.length > 0) {
                keyConceptsResult = this.checkKeyConcepts(studentAnswer, keyConcepts)
            }

            // Determine if answer is correct, partial, or wrong
            const percentage = (modelResult.score / question.marks) * 100
            const isCorrect = percentage >= 90
            const isPartial = percentage >= 50 && percentage < 90

            let enhancedFeedback = modelResult.feedback
            let gradePrefix = ''
            
            if (isCorrect) {
                gradePrefix = '✓ EXCELLENT: '
            } else if (isPartial) {
                gradePrefix = '⚠ COULD BE BETTER: '
            } else {
                gradePrefix = '✗ NEEDS IMPROVEMENT: '
            }

            enhancedFeedback = gradePrefix + modelResult.feedback

            return {
                questionNumber: question.questionNumber,
                questionText: question.questionText,
                marksObtained: modelResult.score,
                maxMarks: question.marks,
                feedback: enhancedFeedback,
                correctAnswer: modelResult.correctAnswer,
                studentAnswer,
                isCorrect,
                similarity: modelResult.similarity,
                keyConcepts: keyConceptsResult
            }
        } catch (error) {
            const reason = this.toReasonText(error)
            logger.warn(`Paragraph NLP evaluation failed, using fallback evaluation (${reason})`)

            // Fallback to simple semantic analysis
            return this.evaluateParagraphFallback(question, studentAnswer, reason)
        }
    }

    /**
     * Fallback evaluation for paragraph answers (without AI API)
     */
    private evaluateParagraphFallback(question: IQuestion, studentAnswer: string, reason?: string): IEvaluationResult {
        let score = 0
        let feedback = ''
        let gradePrefix = ''
        const keyConcepts = question.keyConcepts || []
        const reasonSuffix = reason ? ` NLP provider error: ${reason}` : ''

        if (keyConcepts.length > 0) {
            const conceptsCheck = this.checkKeyConcepts(studentAnswer, keyConcepts)
            const presentConcepts = conceptsCheck.filter((c) => c.present).length
            const totalConcepts = keyConcepts.length

            // Calculate score with partial credit consideration
            const conceptPercentage = presentConcepts / totalConcepts
            score = conceptPercentage * question.marks
            const percentage = (score / question.marks) * 100

            if (presentConcepts === totalConcepts) {
                gradePrefix = '✓ EXCELLENT: '
                feedback = `${gradePrefix}Outstanding work! You have successfully covered all required key concepts: ${keyConcepts.join(', ')}. Your answer demonstrates comprehensive understanding and clear reasoning. Keep up the excellent work!${reasonSuffix}`
            } else if (presentConcepts >= totalConcepts * 0.7) {
                gradePrefix = '⚠ GOOD - COULD BE BETTER: '
                const missingConcepts = conceptsCheck.filter((c) => !c.present).map((c) => c.concept)
                const presentConceptsList = conceptsCheck.filter((c) => c.present).map((c) => c.concept)
                feedback = `${gradePrefix}Good effort! You demonstrated solid understanding by covering: ${presentConceptsList.join(', ')}. To improve your response, consider including: ${missingConcepts.join(', ')}. You're on the right track - just expand on these additional concepts to achieve a complete answer.${reasonSuffix}`
            } else if (presentConcepts >= totalConcepts * 0.4) {
                gradePrefix = '⚠ FAIR - NEEDS DEVELOPMENT: '
                const missingConcepts = conceptsCheck.filter((c) => !c.present).map((c) => c.concept)
                const presentConceptsList = conceptsCheck.filter((c) => c.present).map((c) => c.concept)
                feedback = `${gradePrefix}You've shown some understanding by mentioning: ${presentConceptsList.join(', ')}. However, your answer would benefit from including these important concepts: ${missingConcepts.join(', ')}. Review these topics and try to provide more complete explanations that address all key points.${reasonSuffix}`
            } else {
                gradePrefix = '✗ NEEDS IMPROVEMENT: '
                const missingConcepts = conceptsCheck.filter((c) => !c.present).map((c) => c.concept)
                feedback = `${gradePrefix}Your answer needs further development. The response is missing several important concepts: ${missingConcepts.join(', ')}. Please review the topic thoroughly to understand these fundamental points. Focus on building a complete answer that addresses all key aspects of the question. Don't be discouraged - with more study, you can improve significantly.${reasonSuffix}`
            }

            return {
                questionNumber: question.questionNumber,
                questionText: question.questionText,
                marksObtained: Math.round(score * 10) / 10,
                maxMarks: question.marks,
                feedback,
                correctAnswer: percentage < 70 && question.correctAnswer ? question.correctAnswer : undefined,
                studentAnswer,
                isCorrect: percentage >= 50,
                keyConcepts: conceptsCheck,
                similarity: conceptPercentage
            }
        }

        // If no key concepts, use basic similarity with flexible grading
        const similarity = question.correctAnswer
            ? this.calculateCosineSimilarity(studentAnswer, question.correctAnswer)
            : 0.5

        // Apply partial credit based on similarity
        score = similarity * question.marks
        const percentage = (score / question.marks) * 100

        if (similarity >= 0.8) {
            gradePrefix = '✓ EXCELLENT: '
            feedback = `${gradePrefix}Excellent work! Your answer is comprehensive, accurate, and well-explained. You have demonstrated strong understanding of the topic with clear reasoning and relevant details. This is exactly the kind of response expected. Keep it up!${reasonSuffix}`
        } else if (similarity >= 0.6) {
            gradePrefix = '⚠ GOOD - COULD BE BETTER: '
            feedback = `${gradePrefix}Good attempt! Your answer shows solid understanding and covers the main points adequately. To elevate your response, consider adding more specific examples, deeper explanations, or supporting information. You're demonstrating good knowledge - just expand on it for a more complete answer.${reasonSuffix}`
        } else if (similarity >= 0.4) {
            gradePrefix = '⚠ FAIR - PARTIAL CREDIT: '
            feedback = `${gradePrefix}Fair effort. Your answer shows some understanding and includes a few correct points, which is good. However, the response needs more accuracy, detail, and clarity to be complete. Review the topic more thoroughly and ensure you address all aspects of the question. You're on the right path - keep building on what you know.${reasonSuffix}`
        } else if (similarity >= 0.2) {
            gradePrefix = '✗ NEEDS IMPROVEMENT: '
            feedback = `${gradePrefix}Your answer requires significant improvement. While there may be some relevant points, the response lacks the accuracy and detail needed. Please thoroughly review the topic, understand the key concepts, and provide a more complete answer that directly addresses the question. With focused study, you can improve considerably.${reasonSuffix}`
        } else {
            gradePrefix = '✗ INSUFFICIENT: '
            feedback = `${gradePrefix}Your answer does not adequately address the question. The response needs substantial development in terms of accuracy, relevance, and completeness. Please dedicate more time to studying this topic, seek help if needed, and ensure you understand the fundamental concepts before attempting similar questions. Remember, improvement comes with practice and effort.${reasonSuffix}`
        }

        return {
            questionNumber: question.questionNumber,
            questionText: question.questionText,
            marksObtained: Math.round(score * 10) / 10,
            maxMarks: question.marks,
            feedback,
            correctAnswer: percentage < 70 && question.correctAnswer ? question.correctAnswer : undefined,
            studentAnswer,
            isCorrect: percentage >= 50,
            similarity
        }
    }

    /**
     * Evaluate a single question
     */
    async evaluateQuestion(question: IQuestion, studentAnswer: string): Promise<IEvaluationResult> {
        if (!studentAnswer || studentAnswer.trim().length === 0) {
            return {
                questionNumber: question.questionNumber,
                questionText: question.questionText,
                marksObtained: 0,
                maxMarks: question.marks,
                feedback: 'No answer provided.',
                studentAnswer: '',
                isCorrect: false,
                options: question.options || [],
                similarity: 0
            }
        }

        switch (question.questionType) {
            case QuestionType.MCQ:
                return await this.evaluateMCQWithGrok(question, studentAnswer)

            case QuestionType.PARAGRAPH:
            case QuestionType.SHORT_ANSWER:
                return await this.evaluateParagraph(question, studentAnswer)

            default:
                throw new Error(`Unsupported question type: ${question.questionType}`)
        }
    }

    /**
     * Evaluate all questions in an exam
     */
    async evaluateExam(questions: IQuestion[], studentAnswers: Map<number, string>): Promise<IEvaluationResult[]> {
        const results: IEvaluationResult[] = []

        for (const question of questions) {
            const studentAnswer = studentAnswers.get(question.questionNumber) || ''
            const result = await this.evaluateQuestion(question, studentAnswer)
            results.push(result)
        }

        return results
    }

    /**
     * Generate overall feedback for the exam
     */
    generateOverallFeedback(results: IEvaluationResult[], totalMarks: number, marksObtained: number): string {
        const percentage = (marksObtained / totalMarks) * 100
        const totalQuestions = results.length
        const correctAnswers = results.filter(r => r.marksObtained === r.maxMarks).length
        const partialAnswers = results.filter(r => r.marksObtained > 0 && r.marksObtained < r.maxMarks).length
        const wrongAnswers = results.filter(r => r.marksObtained === 0).length

        let feedback = `PROFESSIONAL EVALUATION SUMMARY\n\n`
        feedback += `Total Score: ${marksObtained}/${totalMarks} marks (${percentage.toFixed(1)}%)\n`
        feedback += `Performance Breakdown: ${correctAnswers} correct, ${partialAnswers} partial, ${wrongAnswers} incorrect out of ${totalQuestions} questions.\n\n`

        // Grade and performance assessment
        if (percentage >= 90) {
            feedback += `Grade: A+ (Outstanding)\n`
            feedback += `EXCELLENT PERFORMANCE: You have demonstrated exceptional understanding of the subject matter. Your answers show comprehensive knowledge, clarity, and accuracy. Keep up the outstanding work!`
        } else if (percentage >= 80) {
            feedback += `Grade: A (Excellent)\n`
            feedback += `EXCELLENT WORK: You have shown strong mastery of the material with very good understanding. Your performance is commendable. Minor improvements in some areas will help you achieve perfection.`
        } else if (percentage >= 70) {
            feedback += `Grade: B (Good)\n`
            feedback += `GOOD PERFORMANCE: You have demonstrated solid understanding of most concepts. Your answers show good knowledge, though there is room for improvement in certain areas. Focus on strengthening weaker topics.`
        } else if (percentage >= 60) {
            feedback += `Grade: C (Satisfactory)\n`
            feedback += `SATISFACTORY WORK: You have shown adequate understanding of the basic concepts. However, your performance indicates the need for more thorough study and practice. Review the material carefully and work on improving accuracy and completeness.`
        } else if (percentage >= 50) {
            feedback += `Grade: D (Needs Improvement)\n`
            feedback += `NEEDS IMPROVEMENT: Your performance suggests gaps in understanding key concepts. Significant additional study and practice are required. Focus on understanding fundamental principles and seek help where needed.`
        } else {
            feedback += `Grade: F (Unsatisfactory)\n`
            feedback += `REQUIRES IMMEDIATE ATTENTION: Your performance indicates serious gaps in understanding the subject matter. Comprehensive review and additional support are strongly recommended. Please dedicate more time to studying and consider seeking tutoring or additional resources.`
        }

        // Specific recommendations based on weak areas
        const weakQuestions = results.filter((r) => (r.marksObtained / r.maxMarks) < 0.5)
        if (weakQuestions.length > 0) {
            feedback += `\n\nAREAS REQUIRING ATTENTION:\n`
            feedback += `Questions ${weakQuestions.map((q) => q.questionNumber).join(', ')} need special focus. Review these topics thoroughly and ensure you understand the underlying concepts before attempting similar questions.`
        }

        // Positive reinforcement for strong areas
        const strongQuestions = results.filter((r) => r.marksObtained === r.maxMarks)
        if (strongQuestions.length > 0) {
            feedback += `\n\nSTRENGTHS:\n`
            feedback += `You performed excellently on questions ${strongQuestions.map((q) => q.questionNumber).join(', ')}. Continue building on this strong foundation.`
        }

        return feedback
    }

    /**
     * Intelligently extract questions and answers from OCR text using AI
     */
    async extractQuestionsAndAnswers(ocrText: string): Promise<{
        questions: IQuestion[]
        answers: any[]
        subject: string
        totalMarks: number
    }> {
        try {
            if (
                (!config.AI.GROQ.API_KEY || !config.AI.GROQ.API_KEY.trim()) &&
                (!config.AI.OPENAI.API_KEY || !config.AI.OPENAI.API_KEY.trim())
            ) {
                logger.warn('No AI provider configured, using fallback extraction')
                return this.extractQuestionsAndAnswersFallback(ocrText)
            }

            logger.info('Analyzing document type and extracting questions', { 
                ocrTextLength: ocrText.length
            })

            // First, detect document type
            const documentType = await this.detectDocumentType(ocrText)
            logger.info('Document type detected', { documentType })

            if (documentType === 'MCQ') {
                return await this.extractMCQDocument(ocrText)
            } else {
                return await this.extractParagraphDocument(ocrText)
            }
        } catch (error) {
            logger.error('Failed to extract questions and answers with AI, using fallback', error)
            return this.extractQuestionsAndAnswersFallback(ocrText)
        }
    }

    /**
     * Detect if document is MCQ or Paragraph type
     */
    private async detectDocumentType(ocrText: string): Promise<'MCQ' | 'PARAGRAPH'> {
        try {
            // Quick heuristic check first (faster than API call)
            const asteriskCount = (ocrText.match(/\*/g) || []).length
            const hasNumberedQuestions = /\b(vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx|\d+[\.\)])/gi.test(ocrText)
            
            // If lots of asterisks and numbered questions, it's MCQ
            if (this.looksLikeMCQDocument(ocrText) || (asteriskCount > 8 && hasNumberedQuestions)) {
                logger.info('Document type detected as MCQ (heuristic)', { asteriskCount })
                return 'MCQ'
            }
            
            // If very few asterisks, it's likely paragraph
            if (asteriskCount < 3) {
                logger.info('Document type detected as PARAGRAPH (heuristic)', { asteriskCount })
                return 'PARAGRAPH'
            }

            // Use AI for ambiguous cases
            const prompt = `Analyze this exam paper and determine if it's MCQ or PARAGRAPH type.

TEXT SAMPLE:
${ocrText.substring(0, 600)}

RULES:
- MCQ: Has multiple choice options marked with * or bullets, numbered questions (1, 2, 3...), options like A/B/C/D or asterisk lists
- PARAGRAPH: Has headings/questions followed by written paragraph answers, no multiple choice options

Respond with ONLY one word: MCQ or PARAGRAPH`

            const content = (await this.callTextModelWithFallback(
                'You are an expert at analyzing exam papers. Respond with only MCQ or PARAGRAPH.',
                prompt,
                6,
                0.1
            )).trim().toUpperCase()
            
            if (content?.includes('MCQ')) {
                return 'MCQ'
            } else if (content?.includes('PARAGRAPH')) {
                return 'PARAGRAPH'
            }
            
            // Fallback to heuristic
            return asteriskCount > 5 ? 'MCQ' : 'PARAGRAPH'
        } catch (error) {
            logger.error('Document type detection failed, using heuristic', error)
            // Fallback to heuristic
            const asteriskCount = (ocrText.match(/\*/g) || []).length
            const result = this.looksLikeMCQDocument(ocrText) || asteriskCount > 5 ? 'MCQ' : 'PARAGRAPH'
            logger.info('Document type detected (fallback)', { type: result, asteriskCount })
            return result
        }
    }

    /**
     * Extract MCQ document
     */
    private async extractMCQDocument(ocrText: string): Promise<{
        questions: IQuestion[]
        answers: any[]
        subject: string
        totalMarks: number
    }> {
        logger.info('Extracting MCQ document with NLP provider')
        
        try {
            // Enhanced prompt for better extraction
            const prompt = `Extract ALL MCQs from this exam paper. The student's answer may be marked with:
- An asterisk (*) before the option
- Highlighted/bold text
- Underlined text
- A checkmark or tick mark

TEXT:
${ocrText.substring(0, 2500)}

INSTRUCTIONS:
1. Find ALL questions in the exact order they appear.
2. If OCR missed or duplicated a question number, intelligently infer the missing number from context and continue the sequence.
3. Do not skip a question just because its visible number is damaged or missing.
4. For each question, extract:
   - Question text
   - ALL options (usually 4 options)
   - Student's chosen answer (look for *, highlighting, bold, underline, or tick marks)
5. If you cannot determine student's answer, use the first option marked with * or the most likely selected option.
6. Return ONLY valid JSON, no explanations.
7. Keep the questions array in document order.

JSON FORMAT:
{
  "subject": "detected subject name",
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "complete question text",
      "marks": 1,
      "questionType": "MCQ",
      "options": ["option1", "option2", "option3", "option4"]
    }
  ],
  "answers": [
    {
      "questionNumber": 1,
      "extractedText": "student's chosen answer"
    }
  ]
}

EXTRACT NOW:`

            const content = await this.callTextModelWithFallback(
                'You are an expert at extracting MCQ questions and detecting student answers from exam papers. Extract ALL questions and identify the chosen answer (marked with *, highlighted, bold, or underlined). Return ONLY valid JSON.',
                prompt,
                2500,
                0.1
            )
            if (!content) throw new Error('No NLP response')

            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (!jsonMatch) throw new Error('No JSON in response')

            const result = JSON.parse(jsonMatch[0])

            if (!result.questions || result.questions.length === 0) {
                throw new Error('NLP provider returned 0 questions')
            }

            const normalizedExtraction = this.normalizeSequentialMCQExtraction(
                Array.isArray(result.questions) ? result.questions : [],
                Array.isArray(result.answers) ? result.answers : []
            )

            if (normalizedExtraction.questions.length === 0) {
                throw new Error('NLP provider returned unusable MCQ extraction')
            }

            logger.info('MCQ extraction successful', { 
                count: normalizedExtraction.questions.length,
                questionNumbers: normalizedExtraction.questions.map(q => q.questionNumber)
            })

            return {
                questions: normalizedExtraction.questions,
                answers: normalizedExtraction.answers,
                subject: result.subject || 'Unknown',
                totalMarks: normalizedExtraction.totalMarks
            }
        } catch (error) {
            logger.error('MCQ extraction provider failed, using fallback', error)
            return this.extractMCQDocumentFallback(ocrText)
        }
    }

    /**
     * Advanced fallback for MCQ extraction
     */
    private extractMCQDocumentFallback(ocrText: string): {
        questions: IQuestion[]
        answers: any[]
        subject: string
        totalMarks: number
    } {
        return this.extractMCQDocumentFallbackStructured(ocrText)

        logger.info('Using advanced MCQ fallback extraction')

        const questionsMap = new Map<number, { questionText: string; options: string[]; studentAnswer: string }>()
        let subject = 'English' // Default from the document

        // Split by TABS first (this document uses tabs), then by newlines
        let lines = ocrText.split(/\t+/)
        
        // If that doesn't work, try newlines
        if (lines.length < 10) {
            lines = ocrText.split(/[\r\n]+/)
        }
        
        // Clean and filter
        lines = lines.map(l => l.trim()).filter(l => l.length > 3)

        logger.info('Processing lines', { 
            totalLines: lines.length,
            firstTenLines: lines.slice(0, 10)
        })

        // Find question patterns: "1.", "2.", "3." OR "1)", "2)", "3)"
        const questionMarkers: { lineIndex: number; questionNumber: number }[] = []
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            
            // Pattern 1: "3." or "4." at start
            let match = line.match(/^(\d+)\.\s/)
            if (!match) {
                // Pattern 2: "3)" or "4)" at start
                match = line.match(/^(\d+)\)/)
            }
            if (!match) {
                // Pattern 3: just the number alone
                match = line.match(/^(\d+)$/)
            }
            
            if (match) {
                const matchedNumber = match?.[1] || '0'
                const num = parseInt(matchedNumber)
                if (num >= 1 && num <= 50) {
                    questionMarkers.push({
                        lineIndex: i,
                        questionNumber: num
                    })
                    logger.info(`✓ Found Q${num} at line ${i}: "${line.substring(0, 60)}"`)
                }
            }
        }

        logger.info(`Total question markers found: ${questionMarkers.length}`)

        // Extract each question
        for (let qIdx = 0; qIdx < questionMarkers.length; qIdx++) {
            const marker = questionMarkers[qIdx]
            const startLine = marker.lineIndex
            const endLine = qIdx + 1 < questionMarkers.length ? questionMarkers[qIdx + 1].lineIndex : lines.length

            logger.info(`Processing Q${marker.questionNumber} (lines ${startLine} to ${endLine})`)

            // Extract question text (remove number)
            let questionText = lines[startLine]
                .replace(/^\d+\.\s*/, '')
                .replace(/^\d+\)\s*/, '')
                .replace(/^\d+\s+/, '')
                .trim()
            
            // If question text is too short, look for it in surrounding lines
            if (questionText.length < 10) {
                // Look backwards for question text (before the number)
                for (let i = startLine - 1; i >= Math.max(0, startLine - 3); i--) {
                    const prevLine = lines[i].trim()
                    if (!prevLine.startsWith('*') && prevLine.length > 10 && prevLine.length < 300) {
                        questionText = prevLine
                        break
                    }
                }
                
                // If still short, look forward
                if (questionText.length < 10 && startLine + 1 < endLine) {
                    const nextLine = lines[startLine + 1].trim()
                    if (!nextLine.startsWith('*') && nextLine.length > 10) {
                        questionText = nextLine
                    }
                }
            }

            logger.info(`  Question text: "${questionText.substring(0, 80)}"`)

            // Extract options (lines starting with *)
            const options: string[] = []
            let studentAnswer = ''

            for (let i = startLine; i < endLine; i++) {
                const line = lines[i].trim()
                
                if (line.startsWith('*')) {
                    const optionText = line.replace(/^\*+\s*/, '').trim()
                    if (optionText.length > 0 && optionText.length < 200) {
                        options.push(optionText)
                        // First option is student's answer
                        if (options.length === 1) {
                            studentAnswer = optionText
                        }
                        logger.info(`  Option ${options.length}: "${optionText.substring(0, 50)}"`)
                    }
                }
            }

            logger.info(`  Total options: ${options.length}, Student answer: "${studentAnswer.substring(0, 40)}"`)

            // Add question if valid (use Map to avoid duplicates)
            if (questionText.length >= 10 && options.length >= 2) {
                // Check if this question number already exists
                if (!questionsMap.has(marker.questionNumber)) {
                    questionsMap.set(marker.questionNumber, {
                        questionText,
                        options,
                        studentAnswer: studentAnswer || options[0]
                    })
                    logger.info(`✓ Successfully extracted Q${marker.questionNumber}`)
                } else {
                    logger.warn(`✗ Duplicate Q${marker.questionNumber} found, skipping`)
                }
            } else {
                logger.warn(`✗ Skipped Q${marker.questionNumber} - questionLen: ${questionText.length}, options: ${options.length}`)
            }
        }

        const rawQuestions = Array.from(questionsMap.values()).map((qData, index) => ({
            questionNumber: index + 1,
            questionText: qData.questionText,
            marks: 1,
            questionType: QuestionType.MCQ,
            options: qData.options
        }))

        const rawAnswers = Array.from(questionsMap.values()).map((qData, index) => ({
            questionNumber: index + 1,
            extractedText: qData.studentAnswer
        }))

        const normalizedExtraction = this.normalizeSequentialMCQExtraction(rawQuestions, rawAnswers)

        logger.info('MCQ extraction completed', {
            questionsExtracted: normalizedExtraction.questions.length,
            answersExtracted: normalizedExtraction.answers.length,
            questionNumbers: normalizedExtraction.questions.map((question) => question.questionNumber)
        })

        return {
            questions: normalizedExtraction.questions,
            answers: normalizedExtraction.answers,
            subject,
            totalMarks: normalizedExtraction.totalMarks
        }
    }

    private extractMCQDocumentFallbackStructured(ocrText: string): {
        questions: IQuestion[]
        answers: any[]
        subject: string
        totalMarks: number
    } {
        logger.info('Using structured MCQ fallback extraction')

        const subject = 'English'
        const segments = this.splitMCQSegments(ocrText)
        const rawQuestions: Array<{
            questionNumber: number
            questionText: string
            marks: number
            questionType: QuestionType
            options: string[]
        }> = []
        const rawAnswers: { questionNumber: number; extractedText: string }[] = []

        logger.info('Processing MCQ segments', {
            segmentCount: segments.length,
            markerCount: this.countMCQMarkers(ocrText),
            firstSegments: segments.slice(0, 12)
        })

        let currentQuestionText = ''
        let currentOptions: string[] = []
        let leadingOptions: string[] = []
        let sawQuestionMarker = false

        const flushQuestion = () => {
            const cleanedQuestionText = this.cleanMCQQuestionText(currentQuestionText)
            const uniqueOptions = Array.from(
                new Set(currentOptions.map((option) => option.trim()).filter(Boolean))
            )

            if (cleanedQuestionText.length < 10 || uniqueOptions.length < 2) {
                currentQuestionText = ''
                currentOptions = []
                leadingOptions = []
                return
            }

            const questionNumber = rawQuestions.length + 1
            rawQuestions.push({
                questionNumber,
                questionText: cleanedQuestionText,
                marks: 1,
                questionType: QuestionType.MCQ,
                options: uniqueOptions
            })

            rawAnswers.push({
                questionNumber,
                extractedText: uniqueOptions[0] || ''
            })

            currentQuestionText = ''
            currentOptions = []
            leadingOptions = []
        }

        for (const segment of segments) {
            if (this.isLikelyMCQNoise(segment)) {
                continue
            }

            const numberedOnly = segment.match(/^(\d+)\s*[\.\)]$/)
            const numberedWithText = segment.match(/^(\d+)\s*[\.\)]\s+(.+)$/)

            if (numberedOnly) {
                if (currentQuestionText && currentOptions.length >= 2) {
                    flushQuestion()
                }
                sawQuestionMarker = true
                continue
            }

            if (numberedWithText) {
                if (currentQuestionText && currentOptions.length >= 2) {
                    flushQuestion()
                }
                currentQuestionText = numberedWithText[2].trim()
                currentOptions = []
                sawQuestionMarker = true
                continue
            }

            if (segment.startsWith('*')) {
                const optionText = segment.replace(/^\*+\s*/, '').trim()
                if (!optionText) {
                    continue
                }

                if (!currentQuestionText) {
                    if (sawQuestionMarker) {
                        leadingOptions.push(optionText)
                    }
                    continue
                }

                currentOptions.push(optionText)
                continue
            }

            if (!currentQuestionText) {
                currentQuestionText = segment
                if (leadingOptions.length > 0) {
                    currentOptions.push(...leadingOptions)
                    leadingOptions = []
                }
                continue
            }

            if (currentOptions.length === 0) {
                currentQuestionText = `${currentQuestionText} ${segment}`.replace(/\s+/g, ' ').trim()
                continue
            }

            if (currentOptions.length >= 2) {
                flushQuestion()
                currentQuestionText = segment
                continue
            }

            currentQuestionText = `${currentQuestionText} ${segment}`.replace(/\s+/g, ' ').trim()
        }

        if (currentQuestionText && currentOptions.length >= 2) {
            flushQuestion()
        }

        const normalizedExtraction = this.normalizeSequentialMCQExtraction(rawQuestions, rawAnswers)

        logger.info('Structured MCQ extraction completed', {
            questionsExtracted: normalizedExtraction.questions.length,
            answersExtracted: normalizedExtraction.answers.length,
            questionNumbers: normalizedExtraction.questions.map((question) => question.questionNumber)
        })

        return {
            questions: normalizedExtraction.questions,
            answers: normalizedExtraction.answers,
            subject,
            totalMarks: normalizedExtraction.totalMarks
        }
    }

    /**
     * Extract Paragraph document
     */
    private async extractParagraphDocument(ocrText: string): Promise<{
        questions: IQuestion[]
        answers: any[]
        subject: string
        totalMarks: number
    }> {
        try {
            const deterministicExtraction = this.extractSpecificQuestionAnswerFormat(ocrText)
            if (deterministicExtraction && deterministicExtraction.questions.length > 0) {
                logger.info('Paragraph extraction successful with deterministic section parser', {
                    questionsCount: deterministicExtraction.questions.length,
                    questionHeadings: deterministicExtraction.questions.map((question) => question.questionText)
                })

                return {
                    questions: deterministicExtraction.questions,
                    answers: deterministicExtraction.answers,
                    subject: 'General',
                    totalMarks: deterministicExtraction.totalMarks
                }
            }

            logger.info('Extracting Paragraph document')

            const prompt = `Extract ALL heading-answer pairs from this handwritten paragraph answer sheet.

OCR TEXT:
${ocrText.substring(0, 3000)}

INSTRUCTIONS:
1. This is a PARAGRAPH/SHORT ANSWER document.
2. Treat each main numbered section heading as one question block.
3. If there is one main topic with bullet points or subheadings underneath it, keep it as ONE answer block.
3. A heading may look like:
   - "1. Electric charge and fields"
   - "2. Electromagnetic induction"
   - "What is food?"
4. If there are two true top-level headings, return two questions in document order.
5. Subheadings inside a section like "Electrostatics", "Electric charge", "Facts", "Main types", "Milky Way", "Features" are part of the SAME answer block, not separate questions.
6. Ignore OCR junk like isolated short words such as "WAI" or similar scanner noise.
7. Extract the full paragraph answer written under each main heading until the next main heading starts.
8. Estimate marks from answer length using 1-5 marks.
9. Return JSON only.

EXAMPLE:
"What is food?
Food is any substance consumed to provide nutritional support..."

Extract as:
Q1: "What is food?"
Student Answer: "Food is any substance consumed to provide nutritional support..."
Marks: 2

JSON FORMAT:
{
  "subject": "detected subject",
  "totalMarks": <sum of all marks>,
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "question/heading",
      "marks": <1-5 based on answer length>,
      "questionType": "PARAGRAPH"
    }
  ],
  "answers": [
    {"questionNumber": 1, "extractedText": "student's paragraph answer"}
  ]
}

EXTRACT ALL QUESTIONS NOW:`

            const content = await this.callTextModelWithFallback(
                'You extract heading-answer pairs from handwritten study notes or paragraph answer sheets. Each heading should become one question. Return only valid JSON.',
                prompt,
                1800,
                0.1
            )

            if (!content) {
                throw new Error('No response from model provider')
            }

            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (!jsonMatch) {
                throw new Error('Invalid response format from NLP provider')
            }

            const result = JSON.parse(jsonMatch[0])

            logger.info('Paragraph extraction successful', { 
                questionsCount: result.questions?.length,
                answersCount: result.answers?.length
            })

            const fallbackNormalized = this.extractParagraphBlocksFallback(ocrText)

            const questions = Array.isArray(result.questions) && result.questions.length > 0
                ? result.questions.map((question: any, index: number) => ({
                    questionNumber: index + 1,
                    questionText: String(question.questionText || `Answer ${index + 1}`).trim(),
                    marks: Number(question.marks) > 0 ? Number(question.marks) : fallbackNormalized.questions[index]?.marks || 2,
                    questionType: QuestionType.PARAGRAPH
                }))
                : fallbackNormalized.questions

            const answers = Array.isArray(result.answers) && result.answers.length > 0
                ? result.answers.map((answer: any, index: number) => ({
                    questionNumber: index + 1,
                    extractedText: String(answer.extractedText || '').trim()
                })).filter((answer: any) => answer.extractedText.length > 0)
                : fallbackNormalized.answers

            return {
                questions: questions.length > 0 ? questions : fallbackNormalized.questions,
                answers: answers.length > 0 ? answers : fallbackNormalized.answers,
                subject: result.subject || 'Unknown',
                totalMarks: questions.reduce((sum: number, question: IQuestion) => sum + question.marks, 0) || fallbackNormalized.totalMarks
            }
        } catch (error) {
            logger.error('Paragraph extraction failed, using fallback', error)
            const deterministicExtraction = this.extractSpecificQuestionAnswerFormat(ocrText)
            if (deterministicExtraction) {
                return {
                    questions: deterministicExtraction.questions,
                    answers: deterministicExtraction.answers,
                    subject: 'General',
                    totalMarks: deterministicExtraction.totalMarks
                }
            }

            const fallback = this.extractParagraphBlocksFallback(ocrText)
            return {
                questions: fallback.questions,
                answers: fallback.answers,
                subject: 'General',
                totalMarks: fallback.totalMarks
            }
        }
    }

    /**
     * Fallback method to extract questions and answers using basic text parsing
     */
    private extractQuestionsAndAnswersFallback(ocrText: string): {
        questions: IQuestion[]
        answers: any[]
        subject: string
        totalMarks: number
    } {
        logger.info('Using fallback extraction method')

        const questions: IQuestion[] = []
        const answers: any[] = []
        let subject = 'General'

        // Split text into lines
        const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

        // Try to detect subject from first few lines
        const firstLines = lines.slice(0, 5).join(' ').toLowerCase()
        if (firstLines.includes('physics')) subject = 'Physics'
        else if (firstLines.includes('chemistry')) subject = 'Chemistry'
        else if (firstLines.includes('biology')) subject = 'Biology'
        else if (firstLines.includes('mathematics') || firstLines.includes('math')) subject = 'Mathematics'
        else if (firstLines.includes('english')) subject = 'English'
        else if (firstLines.includes('history')) subject = 'History'
        else if (firstLines.includes('geography')) subject = 'Geography'
        else if (firstLines.includes('computer')) subject = 'Computer Science'

        // Check if this looks like MCQ format
        const asteriskCount = (ocrText.match(/\*/g) || []).length
        const isMCQFormat = this.looksLikeMCQDocument(ocrText) || asteriskCount > 5

        logger.info('Fallback extraction - analyzing text', { 
            totalLines: lines.length,
            subject,
            asteriskCount,
            isMCQFormat
        })

        if (isMCQFormat) {
            return this.extractMCQDocumentFallbackStructured(ocrText)
        }

        if (isMCQFormat) {
            // MCQ extraction logic
            const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx']
            
            for (let qNum = 0; qNum < romanNumerals.length; qNum++) {
                const roman = romanNumerals[qNum]
                const pattern = new RegExp(`^${roman}\\)`, 'i')
                
                // Find the line with this question number
                let questionLineIndex = -1
                for (let i = 0; i < lines.length; i++) {
                    if (pattern.test(lines[i])) {
                        questionLineIndex = i
                        break
                    }
                }
                
                if (questionLineIndex === -1) continue
                
                // Extract question text (usually on the same line or next line)
                let questionText = lines[questionLineIndex].replace(pattern, '').trim()
                if (questionText.length < 10 && questionLineIndex + 1 < lines.length) {
                    questionText += ' ' + lines[questionLineIndex + 1]
                }
                
                // Find options (lines with * or •)
                const options: string[] = []
                let studentAnswer = ''
                
                // Look for options near this question (within 10 lines)
                for (let i = Math.max(0, questionLineIndex - 2); i < Math.min(lines.length, questionLineIndex + 10); i++) {
                    const line = lines[i]
                    if (line.match(/^[*•â€¢]\s*(.+)/) || line.match(/^\s+[*•â€¢]\s*(.+)/)) {
                        const optionText = line.replace(/^[*•â€¢\s]+/, '').trim()
                        if (optionText.length > 1 && optionText.length < 100) {
                            options.push(optionText)
                            // First option is student's answer
                            if (options.length === 1) {
                                studentAnswer = optionText
                            }
                        }
                    }
                    
                    // Stop if we hit the next question
                    if (i > questionLineIndex && qNum + 1 < romanNumerals.length) {
                        const nextPattern = new RegExp(`^${romanNumerals[qNum + 1]}\\)`, 'i')
                        if (nextPattern.test(line)) break
                    }
                }
                
                // Only add if we have valid data
                if (questionText.length > 10 && options.length >= 2) {
                    questions.push({
                        questionNumber: qNum + 1,
                        questionText,
                        marks: 1,
                        questionType: QuestionType.MCQ,
                        options
                    })
                    
                    answers.push({
                        questionNumber: qNum + 1,
                        extractedText: studentAnswer || options[0]
                    })
                    
                    logger.info(`Fallback extracted Q${qNum + 1}`, {
                        questionText: questionText.substring(0, 50),
                        optionsCount: options.length,
                        studentAnswer
                    })
                }
            }
        }

        const totalMarks = questions.length

        // If no questions found, create generic structure
        if (questions.length === 0) {
            logger.warn('No MCQ questions detected, trying paragraph fallback blocks')
            const paragraphFallback = this.extractParagraphBlocksFallback(ocrText)

            return {
                questions: paragraphFallback.questions,
                answers: paragraphFallback.answers,
                subject,
                totalMarks: paragraphFallback.totalMarks
            }
        }

        logger.info('Fallback extraction completed', {
            questionsCount: questions.length,
            answersCount: answers.length,
            totalMarks
        })

        return {
            questions,
            answers,
            subject,
            totalMarks: totalMarks || 10
        }
    }

    /**
     * Evaluate answers intelligently without predefined exam
     */
    async evaluateAnswersIntelligently(questions: IQuestion[], answers: any[]): Promise<IEvaluationResult[]> {
        const results: IEvaluationResult[] = []
        const paragraphQuestions = questions.filter(
            (question) => question.questionType === QuestionType.PARAGRAPH || question.questionType === QuestionType.SHORT_ANSWER
        )
        let paragraphResults = new Map<number, IEvaluationResult>()

        if (paragraphQuestions.length > 1) {
            try {
                paragraphResults = await this.evaluateParagraphBatchWithGrok(paragraphQuestions, answers)
            logger.info('Paragraph answers graded in batch with NLP provider', { count: paragraphResults.size })
            } catch (error) {
                logger.warn('Paragraph batch grading failed, falling back to per-question evaluation', error)
            }
        }

        for (const question of questions) {
            const answer = answers.find((a) => a.questionNumber === question.questionNumber)
            const studentAnswer = answer?.extractedText || ''

            const batchedResult = paragraphResults.get(question.questionNumber)
            const result = batchedResult || await this.evaluateQuestion(question, studentAnswer)
            results.push(result)
        }

        return results
    }
}

export default new EvaluationService()
