// ============================================================
// Grading Runner — الـ main entry point
// بيختار الـ validator الصح بناءً على نوع الـ input
// ============================================================

import { gradeMCQ } from "./validators/mcq.js";
import { gradeExam } from "./validators/exam.js";
import { gradeFile } from "./validators/file.js";
import type { GradingInput, GradingResult } from "./types.js";

export async function grade(input: GradingInput): Promise<GradingResult> {
  switch (input.type) {
    case "mcq":
      return gradeMCQ(input.questions, input.config);

    case "exam":
      return gradeExam(input.questions, input.studentAnswers, input.config);

    case "file":
      return gradeFile(input.input, input.config);

    default:
      throw new Error(`Unknown grading type`);
  }
}
