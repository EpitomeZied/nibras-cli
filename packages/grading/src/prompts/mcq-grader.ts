export const MCQ_GRADING_PROMPT = `
You are an expert educational evaluator. Grade this Multiple Choice Question (MCQ).

QUESTION: {question}
STUDENT_ANSWER: {student_answer}
CORRECT_OPTION: {correct_option}

Instructions:
1. Compare the STUDENT_ANSWER with the CORRECT_OPTION.
2. Return ONLY a valid JSON object with this EXACT structure:
{
  "score": 1 or 0,
  "is_correct": true or false,
  "feedback": "Short encouraging message",
  "explanation": "Brief explanation of the correct answer"
}

Do NOT include any text outside the JSON.
`;