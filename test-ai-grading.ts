// test-ai-grading.ts
import { GradingService } from './packages/grading/src/services/grader.service';

// تهيئة الـ Service
const gradingService = new GradingService();

async function runTests() {
  console.log('🚀 Starting AI Grading Tests...\n');

  // 🔹 اختبار 1: Mini Quiz (MCQ)
  console.log('📝 Test 1: MCQ Grading');
  try {
    const mcqResult = await gradingService.gradeMCQ({
      question: 'What is the capital of France?',
      studentAnswer: 'Paris',
      correctOption: 'Paris',
    });
    console.log('✅ MCQ Result:', JSON.stringify(mcqResult, null, 2));
  } catch (err) {
    console.error('❌ MCQ Error:', err);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 🔹 اختبار 2: Exam (Mixed Question)
  console.log('📚 Test 2: Exam Grading');
  try {
    const examResult = await gradingService.gradeExam({
      question: 'Explain the concept of Encapsulation in OOP.',
      modelAnswer: 'Encapsulation is bundling data and methods that operate on that data within a single unit, and restricting direct access to some components.',
      studentAnswer: 'Encapsulation means putting data and functions together in a class and hiding the internal details from outside.',
      rubric: 'Must mention: data hiding, bundling, controlled access.',
    });
    console.log('✅ Exam Result:', JSON.stringify(examResult, null, 2));
  } catch (err) {
    console.error('❌ Exam Error:', err);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 🔹 اختبار 3: Project Grading (Text Submission)
  console.log('📁 Test 3: Project Grading');
  try {
    const projectResult = await gradingService.gradeProject({
      projectBrief: 'Build a simple calculator with add, subtract, multiply, divide.',
      modelSolution: 'A class Calculator with 4 methods, error handling for division by zero, and input validation.',
      studentSubmission: 'I made a Calculator class. It has add() and subtract(). I also added a check for divide by zero.',
      requirements: 'Must have 4 operations, error handling, clean code.',
    });
    console.log('✅ Project Result:', JSON.stringify(projectResult, null, 2));
  } catch (err) {
    console.error('❌ Project Error:', err);
  }

  console.log('\n🏁 Tests completed!');
}

// تشغيل الاختبارات
runTests().catch(console.error);
