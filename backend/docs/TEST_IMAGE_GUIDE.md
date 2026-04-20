# Test Image Guide - Creating Exam Papers for OCR

## Overview

This guide helps you create test exam paper images that work well with the OCR system.

## Image Requirements

### Technical Requirements
- **Format**: JPG, PNG
- **Minimum Size**: 500x500 pixels
- **Recommended Size**: 1200x1600 pixels or higher
- **File Size**: Under 10MB
- **Color**: Color or grayscale (will be converted to grayscale)
- **DPI**: 300 DPI recommended

### Quality Requirements
- ✅ Clear, legible handwriting or printed text
- ✅ Good lighting (no shadows)
- ✅ High contrast (dark text on light background)
- ✅ Straight orientation (not tilted)
- ✅ No blur or motion
- ✅ Clean background

## Answer Format

### Supported Formats

The system recognizes multiple answer formats:

#### Format 1: Q1, Q2, etc.
```
Q1: Paris
Q2: Photosynthesis is the process...
Q3: B
```

#### Format 2: Question 1, Question 2, etc.
```
Question 1: Paris
Question 2: Photosynthesis is the process...
Question 3: B
```

#### Format 3: Numbered with period
```
1. Paris
2. Photosynthesis is the process...
3. B
```

#### Format 4: Answer 1, Answer 2, etc.
```
Answer 1: Paris
Answer 2: Photosynthesis is the process...
Answer 3: B
```

#### Format 5: Ans 1, Ans 2, etc.
```
Ans 1: Paris
Ans 2: Photosynthesis is the process...
Ans 3: B
```

## Sample Exam Papers

### Example 1: MCQ Only

```
Name: John Student
Date: April 15, 2026

Q1: Paris
Q2: William Shakespeare
Q3: Jupiter
Q4: Leonardo da Vinci
Q5: Au
```

### Example 2: Mixed (MCQ + Paragraph)

```
Name: Sarah Student
Subject: Pakistan Studies

Q1: Quaid-e-Azam Muhammad Ali Jinnah

Q2: 14 August 1947

Q3: The Two-Nation Theory was the idea that Muslims and Hindus 
were two separate nations with different cultures, religions, 
and ways of life. It was proposed by Allama Iqbal in his 
Allahabad Address in 1930. Muhammad Ali Jinnah used this 
theory to argue for the creation of Pakistan as a separate 
homeland for Muslims. This theory led to the partition of 
India and the creation of Pakistan in 1947.

Q4: Allama Iqbal was a great poet and philosopher who played 
a key role in the Pakistan Movement. In his famous Allahabad 
Address of 1930, he proposed the idea of a separate Muslim 
state in northwestern India. His vision and poetry inspired 
Muslims to work towards creating Pakistan.

Q5: Urdu
```

### Example 3: Paragraph Only

```
Student: Ahmed Khan
Exam: History Essay

Question 1: Explain the causes of World War I.

Answer 1: World War I was caused by several factors including 
militarism, alliances, imperialism, and nationalism. The 
assassination of Archduke Franz Ferdinand in 1914 was the 
immediate trigger. European powers had formed complex alliance 
systems that pulled multiple nations into the conflict. The 
arms race and colonial competition also contributed to tensions.

Question 2: Describe the impact of the Industrial Revolution.

Answer 2: The Industrial Revolution transformed society by 
introducing mechanized production, factories, and new 
technologies. It led to urbanization as people moved to cities 
for factory jobs. While it increased productivity and wealth, 
it also created poor working conditions and social inequality. 
The revolution changed transportation with railways and 
steamships, and communication with the telegraph.
```

## Creating Test Images

### Method 1: Handwritten (Recommended for Testing)

1. **Write on white paper** with a black or blue pen
2. **Use clear, legible handwriting**
3. **Follow one of the answer formats** above
4. **Take a photo** with good lighting
5. **Ensure the paper fills most of the frame**
6. **Keep the camera steady** (no blur)

### Method 2: Printed (Best for Accuracy)

1. **Type answers** in a document editor
2. **Use a clear font** (Arial, Times New Roman, 12-14pt)
3. **Follow one of the answer formats** above
4. **Print on white paper**
5. **Scan or photograph** the printed page

### Method 3: Digital (For Quick Testing)

1. **Create a simple image** in Paint, Photoshop, or online tools
2. **White background, black text**
3. **Use a clear font** (Arial, 16-20pt)
4. **Follow one of the answer formats** above
5. **Save as JPG or PNG**

## Photography Tips

### Lighting
- ✅ Use natural daylight or bright indoor lighting
- ✅ Avoid shadows on the paper
- ✅ Ensure even lighting across the page
- ❌ Don't use flash (can create glare)

### Camera Position
- ✅ Hold camera directly above the paper
- ✅ Keep camera parallel to the paper
- ✅ Fill the frame with the paper
- ❌ Don't tilt the camera

### Focus
- ✅ Tap to focus on the text (smartphones)
- ✅ Ensure text is sharp and clear
- ✅ Check the image before submitting
- ❌ Don't submit blurry images

## Common Issues and Solutions

### Issue: "Image quality too low"
**Solution**: 
- Use higher resolution camera
- Ensure good lighting
- Keep camera steady
- Move closer to the paper

### Issue: "No text detected"
**Solution**:
- Check if text is clearly visible
- Ensure good contrast (dark text, light background)
- Verify answer format is correct
- Try better lighting

### Issue: "Wrong answers detected"
**Solution**:
- Use clearer handwriting
- Follow standard answer formats (Q1:, Q2:, etc.)
- Ensure numbers are clear
- Check for smudges or corrections

### Issue: "Missing answers"
**Solution**:
- Ensure all answers are visible in the image
- Don't cut off any text at edges
- Use consistent answer format
- Number answers sequentially

## Sample Test Scenarios

### Scenario 1: Quick MCQ Test
```
Create an exam with 5 MCQ questions
Write answers: Q1: A, Q2: B, Q3: C, Q4: D, Q5: A
Take a clear photo
Submit and check results
```

### Scenario 2: Paragraph Test
```
Create an exam with 2 paragraph questions
Write detailed answers with key concepts
Take a clear photo
Submit and check feedback on key concepts
```

### Scenario 3: Mixed Test
```
Create an exam with 3 MCQs and 2 paragraphs
Write all answers clearly
Take a clear photo
Submit and check both MCQ and paragraph evaluation
```

## Tools for Creating Test Images

### Online Tools
- **Canva** - Create clean text images
- **Google Docs** - Type and screenshot
- **Microsoft Word** - Type and save as image

### Mobile Apps
- **CamScanner** - Professional document scanning
- **Adobe Scan** - High-quality scans
- **Microsoft Lens** - Document capture

### Desktop Tools
- **Paint** - Simple text images
- **GIMP** - Advanced image editing
- **Photoshop** - Professional editing

## Best Practices

### DO:
✅ Use clear, legible writing
✅ Follow standard answer formats
✅ Ensure good lighting
✅ Keep camera steady
✅ Check image before submitting
✅ Use high contrast (dark on light)
✅ Number answers sequentially

### DON'T:
❌ Use cursive or fancy fonts
❌ Write too small
❌ Take photos in dim lighting
❌ Submit blurry images
❌ Use colored backgrounds
❌ Skip question numbers
❌ Mix different answer formats

## Example Test Workflow

1. **Create Exam** via API with 3 questions
2. **Write Answers** on paper:
   ```
   Q1: Paris
   Q2: William Shakespeare
   Q3: Photosynthesis is the process by which plants 
   use sunlight, chlorophyll, and carbon dioxide to 
   produce glucose and oxygen for energy.
   ```
3. **Take Photo** with good lighting
4. **Submit** via API
5. **Wait** 10-30 seconds for processing
6. **Check Results** - should show:
   - Q1: 2/2 marks (correct)
   - Q2: 2/2 marks (correct)
   - Q3: 7-8/10 marks (good paragraph with key concepts)

## Troubleshooting

### Low OCR Confidence
- Improve handwriting clarity
- Use printed text instead
- Increase image resolution
- Better lighting

### Incorrect Answer Parsing
- Use standard formats (Q1:, Q2:, etc.)
- Ensure clear question numbers
- Don't skip numbers
- Keep consistent format

### Poor Evaluation Scores
- Include key concepts in paragraph answers
- Write complete sentences
- Be specific and detailed
- Follow the question requirements

## Ready-to-Use Test Images

For quick testing, you can create these simple images:

### Test 1: Simple MCQ
```
Q1: A
Q2: B
Q3: C
```

### Test 2: Simple Paragraph
```
Q1: The capital of France is Paris. It is located in 
northern France and is known for the Eiffel Tower.
```

### Test 3: Mixed
```
Q1: Paris
Q2: Photosynthesis is how plants make food using sunlight, 
chlorophyll, carbon dioxide, and water to produce glucose 
and oxygen.
```

---

**Tip**: Start with simple, printed text for your first test to ensure the system is working correctly, then move to handwritten tests.
