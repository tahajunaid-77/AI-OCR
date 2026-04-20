'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submissionAPI } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { Upload, CheckCircle, AlertCircle, GraduationCap, Sparkles } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPG or PNG image')
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setSelectedFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) {
      toast.error('Please upload an exam paper image')
      return
    }

    setIsLoading(true)

    try {
      // Submit without exam ID - AI will analyze the paper
      const submission = await submissionAPI.submitExam('auto', selectedFile)
      toast.success('Exam paper submitted successfully! AI is analyzing your paper...')
      router.push(`/results/${submission._id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit exam paper')
    } finally {
      setIsLoading(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setPreview('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <GraduationCap className="h-20 w-20 text-blue-600" />
              <Sparkles className="h-8 w-8 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            AI Exam Paper Evaluator
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload your exam paper and get instant AI-powered evaluation with detailed feedback.
            No need to select exam type - our AI automatically detects and evaluates any subject!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">

          {/* Upload File */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-6 w-6 text-blue-600" />
                <span>Upload Your Exam Paper</span>
              </CardTitle>
              <CardDescription>Upload a clear image of your completed exam paper</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedFile ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-900 mb-2">Click to upload exam paper</p>
                    <p className="text-sm text-gray-500">JPG or PNG (max 10MB)</p>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={clearFile}>
                      Remove
                    </Button>
                  </div>

                  {preview && (
                    <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                      <img src={preview} alt="Preview" className="w-full h-auto" />
                    </div>
                  )}
                </div>
              )}

              {/* Tips */}
              <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">Tips for best results:</h4>
                    <ul className="text-sm text-blue-800 space-y-1.5">
                      <li>• Use good lighting and avoid shadows</li>
                      <li>• Ensure text is clear and legible</li>
                      <li>• Keep the camera steady (no blur)</li>
                      <li>• Write answers in format: Q1:, Q2:, etc.</li>
                      <li>• Make sure all answers are visible in the image</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              disabled={!selectedFile}
              className="px-12 py-4 text-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <Upload className="h-5 w-5 mr-2" />
              Submit Exam Paper
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
