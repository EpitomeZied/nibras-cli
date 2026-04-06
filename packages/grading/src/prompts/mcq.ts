import type { MCQQuestion } from '@nibras/contracts';

export function getMCQPrompt(question: MCQQuestion, studentAnswer: string): string {
  return `You are an expert academic grader. Grade this MCQ based strictly on the provided content.

Lecture Summary: ${question.lectureSummary || 'General academic knowledge'}
Question: ${question.question}
Options: ${question.options.join(', ')}
Student Answer: ${studentAnswer}

Return ONLY valid JSON:
{
  "is_correct": boolean,
  "correct_option": "A/B/C/D",
  "explanation": "شرح مختصر بالعربي"
}`;
}