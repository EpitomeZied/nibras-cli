// ============================================================
// @nibras/grading — Public API
// ============================================================

// Main runner
export { grade } from './runner';

// Individual validators (for direct use if needed)
export { gradeMCQ } from './validators/mcq';
export { gradeExam } from './validators/exam';
export { gradeFile } from './validators/file';

// Backwards compatibility: old semantic grading API for @nibras/worker
export { gradeSemanticAnswer } from './compat';

// Types
export type {
  // Config
  GradingConfig,

  // MCQ
  MCQQuestion,
  MCQResult,
  MCQGradingResult,

  // Exam
  ExamQuestion,
  StudentAnswer,
  ExamQuestionResult,
  ExamGradingResult,

  // File
  FileGradingInput,
  FileGradingResult,

  // Union types
  GradingInput,
  GradingResult,
} from './types';

// Backwards compatibility types
export type {
  AiConfig,
  GradingQuestion,
  GradingRubricItem,
  GradingExample,
  CriterionScore,
  AiGradeResult,
} from './compat';
