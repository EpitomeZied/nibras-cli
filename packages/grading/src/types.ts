import { z } from 'zod';

export const MCQGradingSchema = z.object({
  score: z.number().min(0).max(1),
  is_correct: z.boolean(),
  feedback: z.string(),
  explanation: z.string(),
});

export type MCQGradingOutput = z.infer<typeof MCQGradingSchema>;

export const ExamGradingSchema = z.object({
  overall_score: z.number().min(0).max(100),
  criteria_breakdown: z.object({
    accuracy: z.object({ score: z.number(), comment: z.string() }),
    completeness: z.object({ score: z.number(), comment: z.string() }),
    clarity: z.object({ score: z.number(), comment: z.string() }),
  }),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  flag_for_review: z.boolean(),
});

export type ExamGradingOutput = z.infer<typeof ExamGradingSchema>;

export const ProjectGradingSchema = z.object({
  overall_score: z.number().min(0).max(100),
  category_scores: z.object({
    functionality: z.number(),
    code_quality: z.number(),
    problem_solving: z.number(),
    originality: z.number(),
  }),
  detailed_feedback: z.string(),
  code_issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  flag_for_review: z.boolean(),
});

export type ProjectGradingOutput = z.infer<typeof ProjectGradingSchema>;