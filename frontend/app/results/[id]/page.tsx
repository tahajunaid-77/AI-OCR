'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { submissionAPI, type Submission } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatPercentage, getGradeColor } from '@/lib/utils'
import toast from 'react-hot-toast'
import { RefreshCw, CheckCircle, XCircle, AlertCircle, TrendingUp, Home, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const submissionId = params.id as string
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [showExtractedText, setShowExtractedText] = useState(false)

  useEffect(() => {
    void loadSubmission()
    const interval = setInterval(() => {
      if (submission?.status === 'PROCESSING' || submission?.status === 'PENDING') {
        void loadSubmission()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [submissionId, submission?.status])

  const loadSubmission = async () => {
    try {
      setIsLoading(true)
      const submissionData = await submissionAPI.getSubmissionById(submissionId)
      setSubmission(submissionData)
    } catch (error: any) {
      toast.error('Failed to load submission details')
      router.push('/')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = async () => {
    if (!submission) return

    setIsRetrying(true)
    try {
      await submissionAPI.retrySubmission(submission._id)
      toast.success('Retry initiated. Refreshing...')
      setTimeout(() => void loadSubmission(), 2000)
    } catch (error: any) {
      toast.error('Failed to retry submission')
    } finally {
      setIsRetrying(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      COMPLETED: 'success',
      PROCESSING: 'info',
      PENDING: 'warning',
      FAILED: 'danger'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const getStudentAnswer = (questionNumber: number): string => {
    const answer = submission?.extractedAnswers?.find((item) => item.questionNumber === questionNumber)
    return answer?.extractedText || 'No answer detected'
  }

  const normalizeAnswer = (value: string) =>
    value
      .toLowerCase()
      .replace(/^[a-d][)\].:\-\s]+/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (!submission) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
              <p className="text-gray-600 mt-2">AI-Evaluated Exam Paper</p>
            </div>
            {getStatusBadge(submission.status)}
          </div>
        </div>

        {submission.status === 'PENDING' && (
          <Card className="mb-6 bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">Submission Pending</p>
                  <p className="text-sm text-yellow-700">Your exam paper is queued for processing.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {submission.status === 'PROCESSING' && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-medium text-blue-900">Processing...</p>
                  <p className="text-sm text-blue-700">
                    We&apos;re extracting text and validating your answers with AI. This may take 10-30 seconds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {submission.status === 'FAILED' && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">Processing Failed</p>
                    <p className="text-sm text-red-700">{submission.processingError}</p>
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={handleRetry} isLoading={isRetrying}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {submission.status === 'COMPLETED' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600 mb-2">Total Score</p>
                    <p className={`text-5xl font-bold ${getGradeColor(submission.percentage || 0)}`}>
                      {formatPercentage(submission.percentage || 0)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {submission.totalMarksObtained} / {submission.totalMarks} marks
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <TrendingUp className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-gray-900 mb-2">Overall Feedback</p>
                      <p className="text-gray-700">{submission.feedback}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {submission.extractedText && (
              <Card className="mb-8">
                <CardHeader>
                  <button
                    onClick={() => setShowExtractedText(!showExtractedText)}
                    className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                  >
                    <div>
                      <CardTitle>Extracted Text from OCR</CardTitle>
                      <CardDescription>View the raw text extracted from your exam paper</CardDescription>
                    </div>
                    {showExtractedText ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>
                </CardHeader>
                {showExtractedText && (
                  <CardContent>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {submission.extractedText}
                      </pre>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Question-wise Results</CardTitle>
                <CardDescription>Detailed feedback for each question</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {submission.evaluationResults?.map((result, index) => {
                    const isCorrect = result.isCorrect ?? result.marksObtained === result.maxMarks
                    const studentAnswer = result.studentAnswer || getStudentAnswer(result.questionNumber)
                    const isMCQ =
                      Boolean(result.options?.length) ||
                      (result.maxMarks === 1 && (result.marksObtained === 0 || result.marksObtained === 1))

                    return (
                      <div
                        key={index}
                        className={`border rounded p-2 text-xs ${
                          isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs text-gray-900">Q{result.questionNumber}</span>
                            {isCorrect ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                          <p className={`text-sm font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {result.marksObtained}/{result.maxMarks}
                          </p>
                        </div>

                        {result.questionText && (
                          <div className="mb-1.5 bg-blue-50 rounded p-1.5 border border-blue-200">
                            <p className="text-xs text-gray-900">{result.questionText}</p>
                          </div>
                        )}

                        <div className="mb-1.5 bg-white rounded p-1.5 border border-gray-200">
                          <span className="font-semibold text-gray-600">Your Answer: </span>
                          <span className="text-gray-900">{studentAnswer}</span>
                        </div>

                        <div
                          className={`rounded p-1.5 mb-1.5 ${
                            isCorrect ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'
                          }`}
                        >
                          <span className="font-semibold text-gray-700">{isCorrect ? 'Correct: ' : 'Review: '}</span>
                          <span className="text-gray-800">{result.feedback}</span>
                        </div>

                        {!isCorrect && result.correctAnswer && (
                          <div className="bg-blue-50 rounded p-1.5 border border-blue-200 mb-1.5">
                            <span className="font-semibold text-blue-700">Correct Answer: </span>
                            <span className="text-blue-900">{result.correctAnswer}</span>
                          </div>
                        )}

                        {isMCQ && result.options && result.options.length > 0 && (
                          <div className="grid grid-cols-1 gap-1 mb-1.5">
                            {result.options.map((option, optionIndex) => {
                              const optionLabel = String.fromCharCode(65 + optionIndex)
                              const isSelected = normalizeAnswer(studentAnswer) === normalizeAnswer(option)
                              const isCorrectOption = result.correctAnswer
                                ? normalizeAnswer(result.correctAnswer) === normalizeAnswer(option)
                                : false

                              return (
                                <div
                                  key={`${result.questionNumber}-${optionLabel}`}
                                  className={`rounded border px-2 py-1 ${
                                    isCorrectOption
                                      ? 'border-green-300 bg-green-100'
                                      : isSelected
                                        ? 'border-yellow-300 bg-yellow-100'
                                        : 'border-gray-200 bg-white'
                                  }`}
                                >
                                  <span className="font-semibold text-gray-700">{optionLabel}) </span>
                                  <span className="text-gray-900">{option}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {result.keyConcepts && result.keyConcepts.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {result.keyConcepts.map((concept, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-full text-xs ${
                                  concept.present ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {concept.present ? 'Yes' : 'No'} {concept.concept}
                              </span>
                            ))}
                          </div>
                        )}

                        {!isMCQ && result.similarity !== undefined && (
                          <div className="mt-1.5 pt-1.5 border-t border-gray-200 flex justify-between">
                            <span className="text-gray-600">Similarity:</span>
                            <span className="font-semibold text-gray-900">{formatPercentage(result.similarity * 100)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 text-center">
              <Link href="/">
                <Button size="lg">Submit Another Exam</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
