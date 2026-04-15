// ============================================================
// Shared types for @nibras/grading package
// ============================================================

// ---------- MCQ ----------

export interface MCQQuestion {
  id: string;
  question: string;
  lectureContext?: string; // نص المحاضرة أو ملخصها (optional)
  options: string[]; // ["A. كذا", "B. كذا", ...]
  studentAnswer: string; // الإجابة اللي اختارها الطالب
}

export interface MCQResult {
  questionId: string;
  isCorrect: boolean;
  confidence: number; // 0–1
  correctAnswer: string; // الإجابة الصح حسب الـ AI
  explanation: string; // ليه صح أو غلط
}

export interface MCQGradingResult {
  type: 'mcq';
  totalQuestions: number;
  correctCount: number;
  score: number; // 0–100
  results: MCQResult[];
}

// ---------- Exam / Assignment (JSON model answer) ----------

export interface ExamQuestion {
  id: string;
  question: string;
  type: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
  maxScore: number;
  modelAnswer: string; // الإجابة النموذجية
  gradingCriteria?: string; // معايير التصحيح (optional)
}

export interface StudentAnswer {
  questionId: string;
  answer: string;
}

export interface ExamQuestionResult {
  questionId: string;
  question: string;
  studentAnswer: string;
  modelAnswer: string;
  score: number; // الدرجة اللي اتدتله
  maxScore: number;
  percentage: number; // 0–100
  confidence: number; // 0–1
  feedback: string; // تغذية راجعة
  isFullCredit: boolean;
  needsHumanReview: boolean; // لو الـ confidence واطي
}

export interface ExamGradingResult {
  type: 'exam';
  totalScore: number;
  maxScore: number;
  percentage: number; // 0–100
  confidence: number; // average confidence
  needsHumanReview: boolean;
  results: ExamQuestionResult[];
}

// ---------- File Upload ----------

export interface FileGradingInput {
  fileContent: string; // نص الملف بعد استخراجه
  fileType: 'pdf' | 'text' | 'code' | 'other';
  modelAnswerQuestions: ExamQuestion[]; // نفس structure الـ exam
  assignmentInstructions?: string;
}

export interface FileGradingResult {
  type: 'file';
  totalScore: number;
  maxScore: number;
  percentage: number;
  confidence: number;
  needsHumanReview: boolean;
  results: ExamQuestionResult[];
  extractionNotes?: string; // ملاحظات على استخراج النص من الملف
}

// ---------- Config ----------

export interface GradingConfig {
  apiKey: string;
  model?: string; // default: gpt-4o-mini
  baseURL?: string; // override for Azure/Ollama
  minConfidence?: number; // default: 0.8
  language?: 'ar' | 'en' | 'auto'; // default: auto
  maxRetries?: number; // retry attempts on 429/5xx (default: 2)
  timeoutMs?: number; // per-request timeout in ms (default: none)
}

// ---------- Runner input ----------

export type GradingInput =
  | { type: 'mcq'; questions: MCQQuestion[]; config: GradingConfig }
  | {
      type: 'exam';
      questions: ExamQuestion[];
      studentAnswers: StudentAnswer[];
      config: GradingConfig;
    }
  | { type: 'file'; input: FileGradingInput; config: GradingConfig };

export type GradingResult = MCQGradingResult | ExamGradingResult | FileGradingResult;
