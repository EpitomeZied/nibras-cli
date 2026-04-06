import { OpenAIGradingClient } from './openai-client';
import { MCQGradingSchema, ExamGradingSchema, ProjectGradingSchema } from '../types';
import { MCQ_GRADING_PROMPT } from '../prompts/mcq-grader';
import { EXAM_GRADING_PROMPT } from '../prompts/exam-grader';
import { PROJECT_GRADING_PROMPT } from '../prompts/project-grader';

export class GradingService {
  private aiClient: OpenAIGradingClient;
  private minConfidence: number;

  constructor() {
    this.aiClient = new OpenAIGradingClient();
    // نحدد عتبة الثقة من ملف .env أو نخليها 0.8 بشكل افتراضي
    this.minConfidence = parseFloat(process.env.NIBRAS_AI_MIN_CONFIDENCE || '0.8');
  }

  // 1. تصحيح Mini Quiz (MCQ)
  async gradeMCQ(params: {
    question: string;
    studentAnswer: string;
    correctOption: string;
  }) {
    const prompt = MCQ_GRADING_PROMPT
      .replace('{question}', params.question)
      .replace('{student_answer}', params.studentAnswer)
      .replace('{correct_option}', params.correctOption);

    const result = await this.aiClient.gradeWithSchema(prompt, MCQGradingSchema);
    return result;
  }

  // 2. تصحيح الامتحان (Mixed)
  async gradeExam(params: {
    question: string;
    modelAnswer: string;
    studentAnswer: string;
    rubric: string;
  }) {
    const prompt = EXAM_GRADING_PROMPT
      .replace('{question}', params.question)
      .replace('{model_answer}', params.modelAnswer)
      .replace('{student_answer}', params.studentAnswer)
      .replace('{rubric_criteria}', params.rubric);

    const result = await this.aiClient.gradeWithSchema(prompt, ExamGradingSchema);
    
    // فحص الثقة (Confidence Check)
    if (result.confidence < this.minConfidence) {
      result.flag_for_review = true;
    }

    return result;
  }

  // 3. تصحيح المشاريع (Projects)
  async gradeProject(params: {
    projectBrief: string;
    modelSolution: string;
    studentSubmission: string;
    requirements: string;
  }) {
    const prompt = PROJECT_GRADING_PROMPT
      .replace('{project_description}', params.projectBrief)
      .replace('{model_answer}', params.modelSolution)
      .replace('{extracted_text}', params.studentSubmission)
      .replace('{checklist}', params.requirements);

    const result = await this.aiClient.gradeWithSchema(prompt, ProjectGradingSchema);

    // فحص الثقة
    if (result.confidence < this.minConfidence) {
      result.flag_for_review = true;
    }

    return result;
  }
}
