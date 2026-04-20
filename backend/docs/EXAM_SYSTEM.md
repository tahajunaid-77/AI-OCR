# AI Exam Paper Evaluation System - Documentation

## Overview

The AI Exam Paper Evaluation System is a comprehensive solution that allows students to upload images of their handwritten or printed exam papers. The system uses OCR (Optical Character Recognition) to extract text, then automatically evaluates and grades the answers using AI-powered analysis.

## Features

### Core Features
- ✅ **OCR Text Extraction**: Extract text from exam paper images using Google Vision API with OCR.space fallback
- ✅ **Image Quality Checks**: Validate image quality before processing
- ✅ **Image Preprocessing**: Enhance images for better OCR accuracy
- ✅ **Answer Parsing**: Intelligently parse extracted text to identify individual answers
- ✅ **MCQ Evaluation**: Automatic grading for multiple-choice questions
- ✅ **Paragraph Evaluation**: AI-powered semantic analysis for descriptive answers
- ✅ **Key Concept Detection**: Check for required concepts in paragraph answers
- ✅ **Detailed Feedback**: Provide constructive feedback for each question
- ✅ **Overall Grading**: Calculate total marks and percentage
- ✅ **Student Statistics**: Track performance over time
- ✅ **Retry Failed Submissions**: Reprocess failed submissions

## Architecture

### Folder Structure
```
src/APIs/exam/
├── _shared/
│   ├── models/
│   │   ├── exam.model.ts          # Exam schema
│   │   └── submission.model.ts    # Submission schema
│   ├── repo/
│   │   ├── exam.repository.ts     # Exam database operations
│   │   └── submission.repository.ts # Submission database operations
│   └── types/
│       └── exam.interface.ts      # TypeScript interfaces
├── management/
│   ├── exam-management.controller.ts
│   ├── exam-management.service.ts
│   ├── validation/
│   │   ├── validation.schema.ts
│   │   └── validations.ts
│   └── index.ts
├── submission/
│   ├── submission.controller.ts
│   ├── submission.service.ts
│   ├── validation/
│   │   ├── validation.schema.ts
│   │   └── validations.ts
│   └── index.ts
└── index.ts

src/services/
├── ocr.service.ts              # OCR integration (Google Vision + fallback)
├── evaluation.service.ts       # AI-powered answer evaluation
└── textParser.service.ts       # Parse OCR text to extract answers
```

## API Endpoints

### Exam Management

#### 1. Create Exam
```http
POST /api/v1/exam/management
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "History Mid-Term Exam",
  "subject": "History",
  "totalMarks": 50,
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "What is the capital of France?",
      "questionType": "MCQ",
      "marks": 2,
      "correctAnswer": "Paris"
    },
    {
      "questionNumber": 2,
      "questionText": "Explain the Two-Nation Theory.",
      "questionType": "PARAGRAPH",
      "marks": 10,
      "keyConcepts": ["Iqbal", "Jinnah", "Pakistan", "partition"],
      "rubric": "Answer should mention key figures and explain the concept"
    }
  ]
}
```

#### 2. Get All Exams
```http
GET /api/v1/exam/management?page=1&limit=10&subject=History
Authorization: Bearer <token>
```

#### 3. Get My Exams
```http
GET /api/v1/exam/management/my-exams?page=1&limit=10
Authorization: Bearer <token>
```

#### 4. Get Exam by ID
```http
GET /api/v1/exam/management/:examId
Authorization: Bearer <token>
```

#### 5. Update Exam
```http
PUT /api/v1/exam/management/:examId
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Exam Title",
  "questions": [...]
}
```

#### 6. Delete Exam
```http
DELETE /api/v1/exam/management/:examId
Authorization: Bearer <token>
```

### Exam Submission

#### 1. Submit Exam Paper
```http
POST /api/v1/exam/submission
Authorization: Bearer <token>
Content-Type: multipart/form-data

examId: <exam-id>
examPaper: <image-file>
```

**Supported Formats**: JPG, PNG, PDF
**Max File Size**: 10MB (configurable)

#### 2. Get My Submissions
```http
GET /api/v1/exam/submission/my-submissions?page=1&limit=10
Authorization: Bearer <token>
```

#### 3. Get Submission by ID
```http
GET /api/v1/exam/submission/:submissionId
Authorization: Bearer <token>
```

#### 4. Get Submissions by Exam
```http
GET /api/v1/exam/submission/exam/:examId?page=1&limit=10
Authorization: Bearer <token>
```

#### 5. Get Student Statistics
```http
GET /api/v1/exam/submission/stats
Authorization: Bearer <token>
```

**Response**:
```json
{
  "totalSubmissions": 15,
  "averageScore": 78.5,
  "highestScore": 95,
  "lowestScore": 45
}
```

#### 6. Retry Failed Submission
```http
POST /api/v1/exam/submission/:submissionId/retry
Authorization: Bearer <token>
```

#### 7. Delete Submission
```http
DELETE /api/v1/exam/submission/:submissionId
Authorization: Bearer <token>
```

## Data Models

### Exam Model
```typescript
{
  title: string
  subject: string
  totalMarks: number
  questions: [
    {
      questionNumber: number
      questionText: string
      questionType: 'MCQ' | 'PARAGRAPH' | 'SHORT_ANSWER'
      marks: number
      correctAnswer?: string
      keyConcepts?: string[]
      rubric?: string
    }
  ]
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
```

### Submission Model
```typescript
{
  examId: string
  studentId: string
  imageUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  extractedText?: string
  extractedAnswers?: [
    {
      questionNumber: number
      extractedText: string
      confidence: number
    }
  ]
  evaluationResults?: [
    {
      questionNumber: number
      marksObtained: number
      maxMarks: number
      feedback: string
      keyConcepts?: [
        {
          concept: string
          present: boolean
        }
      ]
      similarity?: number
    }
  ]
  totalMarksObtained?: number
  totalMarks?: number
  percentage?: number
  feedback?: string
  processingError?: string
  submittedAt: Date
  processedAt?: Date
}
```

## Processing Pipeline

### 1. Image Upload
- Student uploads exam paper image
- File validation (type, size)
- Store file on disk
- Create submission record with PENDING status

### 2. OCR Processing
- Update status to PROCESSING
- Check image quality
- Preprocess image (grayscale, sharpen, normalize)
- Extract text using Google Vision API
- Fallback to OCR.space if Google Vision fails

### 3. Text Parsing
- Parse extracted text to identify individual answers
- Support multiple formats:
  - `Q1: answer`
  - `Question 1: answer`
  - `1. answer`
  - `Answer 1: answer`
- Extract MCQ answers (A, B, C, D format)

### 4. Answer Evaluation

#### MCQ Evaluation
- Direct string comparison with correct answer
- Full marks for correct, zero for incorrect
- Simple feedback

#### Paragraph Evaluation
- Use Grok API for semantic analysis
- Check for key concepts
- Calculate similarity score
- Fallback to cosine similarity if API fails
- Provide detailed feedback

### 5. Grading
- Calculate marks for each question
- Sum total marks obtained
- Calculate percentage
- Generate overall feedback

### 6. Result Storage
- Update submission with results
- Set status to COMPLETED
- Store evaluation results and feedback

## Configuration

### Environment Variables

```env
# OCR Services
GOOGLE_VISION_API_KEY=your_google_vision_api_key
GOOGLE_VISION_PROJECT_ID=your_project_id
OCR_SPACE_API_KEY=your_ocr_space_api_key

# AI Services
GROK_API_KEY=your_grok_api_key
GROK_API_URL=https://api.x.ai/v1

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads/exam-papers
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf
```

### Getting API Keys

#### Google Vision API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Vision API
4. Create credentials (API Key)
5. Copy API key to `.env`

#### OCR.space (Fallback)
1. Go to [OCR.space](https://ocr.space/ocrapi)
2. Sign up for free API key
3. Copy API key to `.env`

#### Grok API
1. Go to [X.AI](https://x.ai/)
2. Sign up and get API access
3. Copy API key to `.env`

## Installation

### 1. Install Dependencies
```bash
npm install
```

New dependencies added:
- `axios` - HTTP client for API calls
- `multer` - File upload handling
- `sharp` - Image processing
- `form-data` - Form data for OCR.space

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Create Upload Directory
```bash
mkdir -p uploads/exam-papers
```

### 4. Run Migrations (if needed)
```bash
npm run migrate:dev
```

### 5. Start Development Server
```bash
npm run start:dev
```

## Usage Examples

### Creating an Exam

```javascript
const exam = {
  title: "Pakistan Studies Final Exam",
  subject: "Pakistan Studies",
  totalMarks: 50,
  questions: [
    {
      questionNumber: 1,
      questionText: "Who is known as the founder of Pakistan?",
      questionType: "MCQ",
      marks: 2,
      correctAnswer: "Quaid-e-Azam Muhammad Ali Jinnah"
    },
    {
      questionNumber: 2,
      questionText: "Explain the Two-Nation Theory and its significance.",
      questionType: "PARAGRAPH",
      marks: 10,
      keyConcepts: [
        "Allama Iqbal",
        "Muhammad Ali Jinnah",
        "Muslims and Hindus",
        "separate nation",
        "creation of Pakistan"
      ],
      rubric: "Answer should explain the theory, mention key figures, and discuss its role in Pakistan's creation"
    }
  ]
}
```

### Submitting an Exam Paper

```javascript
const formData = new FormData()
formData.append('examId', 'exam-id-here')
formData.append('examPaper', fileInput.files[0])

const response = await fetch('/api/v1/exam/submission', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
```

### Checking Submission Status

```javascript
const response = await fetch(`/api/v1/exam/submission/${submissionId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const submission = await response.json()

if (submission.status === 'COMPLETED') {
  console.log('Total Marks:', submission.totalMarksObtained, '/', submission.totalMarks)
  console.log('Percentage:', submission.percentage, '%')
  console.log('Feedback:', submission.feedback)
  
  submission.evaluationResults.forEach(result => {
    console.log(`Q${result.questionNumber}: ${result.marksObtained}/${result.maxMarks}`)
    console.log(`Feedback: ${result.feedback}`)
  })
}
```

## Error Handling

### Common Errors

#### Image Quality Issues
```json
{
  "error": "Image width is too small. Please upload a higher resolution image."
}
```

#### OCR Failure
```json
{
  "error": "Failed to extract text from image. Please ensure the image is clear and try again."
}
```

#### Invalid File Type
```json
{
  "error": "Invalid file type. Allowed types: image/jpeg, image/png, application/pdf"
}
```

## Performance Considerations

### Async Processing
- Submissions are processed asynchronously
- Status updates from PENDING → PROCESSING → COMPLETED/FAILED
- Client should poll for status or use webhooks (future enhancement)

### Scalability
- OCR and evaluation are CPU/API intensive
- Consider implementing a queue system (Bull/BullMQ) for production
- Use worker processes for parallel processing
- Implement caching for frequently accessed exams

### Rate Limiting
- Google Vision API: 1800 requests/minute (free tier)
- OCR.space: 500 requests/day (free tier)
- Grok API: Check your plan limits

## Testing

### Manual Testing with Postman

1. **Create an exam** using the exam management endpoint
2. **Upload a test image** with clear handwriting
3. **Check submission status** periodically
4. **View results** once processing is complete

### Test Images
- Use clear, high-resolution images
- Ensure good lighting and contrast
- Write answers in a structured format (Q1:, Q2:, etc.)
- For MCQs, clearly mark answers (A, B, C, or D)

## Future Enhancements

### Planned Features
- [ ] PDF support with page extraction
- [ ] Handwriting recognition improvements
- [ ] Real-time processing status via WebSockets
- [ ] Bulk submission processing
- [ ] Teacher dashboard for exam analytics
- [ ] Export results to PDF/Excel
- [ ] Plagiarism detection
- [ ] Multi-language support
- [ ] Mobile app integration
- [ ] Advanced AI models (GPT-4, Claude)

### Optimization Opportunities
- [ ] Implement queue system (Bull/BullMQ)
- [ ] Add Redis caching
- [ ] Optimize image preprocessing
- [ ] Batch processing for multiple submissions
- [ ] CDN for uploaded images
- [ ] Database indexing optimization

## Troubleshooting

### OCR Not Working
1. Check API keys in `.env`
2. Verify image quality
3. Check API rate limits
4. Review logs for detailed errors

### Low Accuracy
1. Improve image quality
2. Use better lighting when capturing
3. Ensure clear handwriting
4. Try different OCR providers

### Slow Processing
1. Check API response times
2. Optimize image size
3. Implement queue system
4. Use worker processes

## Support

For issues and questions:
- Check logs in `logs/` directory
- Review error messages in submission records
- Contact development team

## License

MIT License
