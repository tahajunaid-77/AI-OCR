# Quick Start Guide - AI Exam Evaluation System

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- Google Vision API key
- OCR.space API key (optional, for fallback)
- Grok API key (optional, for AI evaluation)

## Step 1: Install Dependencies

```bash
cd ai-ocr-exam/backend
npm install
```

## Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
ENV=development
PORT=3000
SERVER_URL=http://localhost:3000

# Database
DATABASE_URL=mongodb://localhost:27017/exam-system

# Authentication (generate secure random strings)
ACCESS_TOKEN_SECRET=your_access_token_secret_here
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here

# OCR Services
GOOGLE_VISION_API_KEY=your_google_vision_api_key
GOOGLE_VISION_PROJECT_ID=your_google_project_id
OCR_SPACE_API_KEY=your_ocr_space_api_key

# AI Services
GROK_API_KEY=your_grok_api_key
GROK_API_URL=https://api.x.ai/v1

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads/exam-papers
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf
```

## Step 3: Create Upload Directory

```bash
mkdir -p uploads/exam-papers
```

## Step 4: Start MongoDB

```bash
# If using local MongoDB
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Step 5: Start Development Server

```bash
npm run start:dev
```

The server will start on `http://localhost:3000`

## Step 6: Test the API

### 1. Register/Login a User

First, you need to authenticate. Use the existing authentication endpoints:

```bash
# Register
curl -X POST http://localhost:3000/api/v1/user/authentication/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "SecurePass123!",
    "name": "John Teacher"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/user/authentication/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "SecurePass123!"
  }'
```

Save the `accessToken` from the response.

### 2. Create an Exam

```bash
curl -X POST http://localhost:3000/api/v1/exam/management \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sample Quiz",
    "subject": "General Knowledge",
    "totalMarks": 10,
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
        "questionText": "Explain photosynthesis.",
        "questionType": "PARAGRAPH",
        "marks": 8,
        "keyConcepts": ["plants", "sunlight", "chlorophyll", "oxygen", "glucose"],
        "rubric": "Explain how plants convert sunlight to energy"
      }
    ]
  }'
```

Save the `examId` from the response.

### 3. Submit an Exam Paper

Create a test image with answers written clearly:

```
Q1: Paris
Q2: Photosynthesis is the process by which plants use sunlight, chlorophyll, and carbon dioxide to produce glucose and oxygen.
```

Submit the image:

```bash
curl -X POST http://localhost:3000/api/v1/exam/submission \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "examId=YOUR_EXAM_ID" \
  -F "examPaper=@/path/to/your/exam-paper.jpg"
```

Save the `submissionId` from the response.

### 4. Check Submission Status

```bash
curl -X GET http://localhost:3000/api/v1/exam/submission/YOUR_SUBMISSION_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

The status will be:
- `PENDING` - Just uploaded
- `PROCESSING` - OCR and evaluation in progress
- `COMPLETED` - Results ready
- `FAILED` - Processing failed (check `processingError`)

### 5. View Results

Once status is `COMPLETED`, the response will include:

```json
{
  "status": "COMPLETED",
  "totalMarksObtained": 8.5,
  "totalMarks": 10,
  "percentage": 85,
  "feedback": "You scored 8.5 out of 10 marks (85.0%). Great job!",
  "evaluationResults": [
    {
      "questionNumber": 1,
      "marksObtained": 2,
      "maxMarks": 2,
      "feedback": "Correct! Your answer \"Paris\" is correct.",
      "similarity": 1
    },
    {
      "questionNumber": 2,
      "marksObtained": 6.5,
      "maxMarks": 8,
      "feedback": "Good attempt! You covered most key concepts but missed: carbon dioxide.",
      "keyConcepts": [
        { "concept": "plants", "present": true },
        { "concept": "sunlight", "present": true },
        { "concept": "chlorophyll", "present": true },
        { "concept": "oxygen", "present": true },
        { "concept": "glucose", "present": true }
      ],
      "similarity": 0.81
    }
  ]
}
```

## Step 7: Seed Sample Data (Optional)

To quickly test with sample exams:

```bash
# Update the createdBy field in scripts/seed-exam-data.ts with your user ID
# Then run:
npx ts-node scripts/seed-exam-data.ts
```

## Using Postman

1. Import the Postman collection from `docs/POSTMAN_COLLECTION.json`
2. Set the `baseUrl` variable to `http://localhost:3000/api/v1`
3. Set the `token` variable to your access token
4. Use the pre-configured requests

## Troubleshooting

### "Google Vision API key not configured"

Make sure you've added `GOOGLE_VISION_API_KEY` to your `.env` file.

### "Failed to extract text from image"

- Check image quality (minimum 500x500 pixels)
- Ensure good lighting and contrast
- Try a clearer image
- Check OCR API rate limits

### "Exam not found"

Make sure you're using the correct `examId` from the create exam response.

### "You are not authorized"

- Check that your access token is valid
- Make sure you're the creator of the exam (for updates/deletes)
- Make sure you're the student who submitted (for viewing submissions)

### Processing takes too long

- OCR and AI evaluation can take 10-30 seconds
- Check your internet connection
- Verify API keys are correct
- Check API rate limits

## Next Steps

1. Read the full documentation in `docs/EXAM_SYSTEM.md`
2. Explore all API endpoints
3. Integrate with your frontend
4. Customize evaluation logic
5. Add more question types
6. Implement queue system for production

## API Documentation

Full API documentation is available at:
- `docs/EXAM_SYSTEM.md` - Complete system documentation
- `docs/POSTMAN_COLLECTION.json` - Postman collection

## Support

For issues:
1. Check logs in `logs/` directory
2. Review error messages in API responses
3. Check MongoDB connection
4. Verify API keys are valid

## Production Deployment

Before deploying to production:

1. ✅ Set strong `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`
2. ✅ Use production MongoDB instance
3. ✅ Configure proper CORS settings
4. ✅ Set up rate limiting
5. ✅ Implement queue system (Bull/BullMQ)
6. ✅ Use cloud storage for images (AWS S3, Azure Blob)
7. ✅ Set up monitoring and logging
8. ✅ Configure SSL/TLS
9. ✅ Set up backup strategy
10. ✅ Implement proper error handling

Happy coding! 🚀
