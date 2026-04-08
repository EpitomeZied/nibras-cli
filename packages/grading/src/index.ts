// ============================================================
// @nibras/grading — Public API
// ============================================================

// Main runner
export { grade } from "./runner.js";

// Individual validators (for direct use if needed)
export { gradeMCQ } from "./validators/mcq.js";
export { gradeExam } from "./validators/exam.js";
export { gradeFile } from "./validators/file.js";

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
} from "./types.js";
