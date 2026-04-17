import { z } from 'zod';

export const ProgramStatusSchema = z.enum(['draft', 'published', 'archived']);
export const RequirementGroupCategorySchema = z.enum([
  'foundation',
  'core',
  'depth',
  'elective',
  'capstone',
  'policy',
]);
export const RequirementRuleTypeSchema = z.enum([
  'required',
  'choose_n',
  'elective_pool',
  'track_gate',
]);
export const StudentProgramStatusSchema = z.enum([
  'enrolled',
  'track_selected',
  'submitted_for_advisor',
  'advisor_approved',
  'department_approved',
]);
export const PlannedCourseSourceTypeSchema = z.enum(['standard', 'transfer', 'petition', 'manual']);
export const StudentRequirementDecisionStatusSchema = z.enum([
  'pending',
  'satisfied',
  'waived',
  'petition_pending',
]);
export const RequirementDecisionSourceTypeSchema = z.enum([
  'planned_course',
  'transfer_credit',
  'petition',
  'waiver',
]);
export const PetitionTypeSchema = z.enum(['transfer_credit', 'substitution', 'waiver']);
export const PetitionStatusSchema = z.enum([
  'pending_advisor',
  'pending_department',
  'approved',
  'rejected',
]);
export const ApprovalStageSchema = z.enum(['advisor', 'department']);
export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const AcademicTermSchema = z.enum(['fall', 'spring']);

export const ProgramSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  code: z.string().min(1),
  academicYear: z.string().min(1),
  totalUnitRequirement: z.number().int().positive(),
  status: ProgramStatusSchema,
  activeVersionId: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProgramVersionSummarySchema = z.object({
  id: z.string().min(1),
  programId: z.string().min(1),
  versionLabel: z.string().min(1),
  effectiveFrom: z.string().datetime().nullable().default(null),
  effectiveTo: z.string().datetime().nullable().default(null),
  isActive: z.boolean(),
  policyText: z.string().default(''),
  trackSelectionMinYear: z.number().int().min(1).max(4).default(2),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TrackSummarySchema = z.object({
  id: z.string().min(1),
  programVersionId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  selectionYearStart: z.number().int().min(1).max(4).default(2),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CatalogCourseSchema = z.object({
  id: z.string().min(1),
  programId: z.string().min(1),
  subjectCode: z.string().min(1),
  catalogNumber: z.string().min(1),
  title: z.string().min(1),
  defaultUnits: z.number().int().positive(),
  department: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const RequirementCourseSchema = z.object({
  id: z.string().min(1),
  requirementRuleId: z.string().min(1),
  catalogCourseId: z.string().min(1),
});

export const RequirementRuleSchema = z.object({
  id: z.string().min(1),
  requirementGroupId: z.string().min(1),
  ruleType: RequirementRuleTypeSchema,
  pickCount: z.number().int().positive().nullable().default(null),
  note: z.string().default(''),
  sortOrder: z.number().int().nonnegative().default(0),
  courses: z.array(RequirementCourseSchema).default([]),
});

export const RequirementGroupSchema = z.object({
  id: z.string().min(1),
  programVersionId: z.string().min(1),
  trackId: z.string().min(1).nullable().default(null),
  title: z.string().min(1),
  category: RequirementGroupCategorySchema,
  minUnits: z.number().int().nonnegative().default(0),
  minCourses: z.number().int().nonnegative().default(0),
  notes: z.string().default(''),
  sortOrder: z.number().int().nonnegative().default(0),
  noDoubleCount: z.boolean().default(true),
  rules: z.array(RequirementRuleSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProgramVersionDetailSchema = z.object({
  program: ProgramSummarySchema,
  version: ProgramVersionSummarySchema,
  tracks: z.array(TrackSummarySchema),
  catalogCourses: z.array(CatalogCourseSchema),
  requirementGroups: z.array(RequirementGroupSchema),
});

export const StudentPlannedCourseSchema = z.object({
  id: z.string().min(1),
  studentProgramId: z.string().min(1),
  catalogCourseId: z.string().min(1),
  plannedYear: z.number().int().min(1).max(4),
  plannedTerm: AcademicTermSchema,
  sourceType: PlannedCourseSourceTypeSchema,
  note: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StudentRequirementDecisionSchema = z.object({
  id: z.string().min(1),
  studentProgramId: z.string().min(1),
  requirementGroupId: z.string().min(1),
  status: StudentRequirementDecisionStatusSchema,
  sourceType: RequirementDecisionSourceTypeSchema.nullable().default(null),
  notes: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PetitionCourseLinkSchema = z.object({
  id: z.string().min(1),
  petitionId: z.string().min(1),
  originalCatalogCourseId: z.string().min(1).nullable().default(null),
  substituteCatalogCourseId: z.string().min(1).nullable().default(null),
});

export const PetitionSchema = z.object({
  id: z.string().min(1),
  studentProgramId: z.string().min(1),
  type: PetitionTypeSchema,
  status: PetitionStatusSchema,
  justification: z.string().min(1),
  targetRequirementGroupId: z.string().min(1).nullable().default(null),
  submittedByUserId: z.string().min(1),
  reviewerUserId: z.string().min(1).nullable().default(null),
  reviewerNotes: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  courseLinks: z.array(PetitionCourseLinkSchema).default([]),
});

export const ProgramApprovalSchema = z.object({
  id: z.string().min(1),
  studentProgramId: z.string().min(1),
  stage: ApprovalStageSchema,
  status: ApprovalStatusSchema,
  reviewerUserId: z.string().min(1).nullable().default(null),
  notes: z.string().nullable().default(null),
  decidedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProgramSheetSectionCourseSchema = z.object({
  plannedCourseId: z.string().min(1),
  catalogCourseId: z.string().min(1),
  subjectCode: z.string().min(1),
  catalogNumber: z.string().min(1),
  title: z.string().min(1),
  units: z.number().int().positive(),
  plannedYear: z.number().int().min(1).max(4),
  plannedTerm: AcademicTermSchema,
  sourceType: PlannedCourseSourceTypeSchema,
});

export const ProgramSheetSectionSchema = z.object({
  requirementGroupId: z.string().min(1),
  title: z.string().min(1),
  category: RequirementGroupCategorySchema,
  minUnits: z.number().int().nonnegative(),
  minCourses: z.number().int().nonnegative(),
  notes: z.string().default(''),
  matchedCourses: z.array(ProgramSheetSectionCourseSchema),
  usedUnits: z.number().int().nonnegative(),
  usedCourses: z.number().int().nonnegative(),
  status: StudentRequirementDecisionStatusSchema,
});

export const ProgramSheetViewSchema = z.object({
  studentProgramId: z.string().min(1),
  student: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    email: z.string().email(),
    yearLevel: z.number().int().min(1).max(4),
  }),
  program: ProgramSummarySchema,
  version: ProgramVersionSummarySchema,
  selectedTrack: TrackSummarySchema.nullable().default(null),
  status: StudentProgramStatusSchema,
  isLocked: z.boolean(),
  canSelectTrack: z.boolean(),
  generatedAt: z.string().datetime().nullable().default(null),
  policyText: z.string().default(''),
  sections: z.array(ProgramSheetSectionSchema),
  petitions: z.array(PetitionSchema),
  approvals: z.array(ProgramApprovalSchema),
});

export const StudentProgramPlanSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  program: ProgramSummarySchema,
  version: ProgramVersionSummarySchema,
  selectedTrack: TrackSummarySchema.nullable().default(null),
  availableTracks: z.array(TrackSummarySchema),
  status: StudentProgramStatusSchema,
  isLocked: z.boolean(),
  canSelectTrack: z.boolean(),
  catalogCourses: z.array(CatalogCourseSchema),
  requirementGroups: z.array(RequirementGroupSchema),
  plannedCourses: z.array(StudentPlannedCourseSchema),
  decisions: z.array(StudentRequirementDecisionSchema),
  petitions: z.array(PetitionSchema),
  approvals: z.array(ProgramApprovalSchema),
  latestSheet: ProgramSheetViewSchema.nullable().default(null),
});

export const CreateProgramRequestSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1),
  code: z.string().min(1),
  academicYear: z.string().min(1),
  totalUnitRequirement: z.number().int().positive().default(120),
  status: ProgramStatusSchema.default('draft'),
});

export const CreateProgramVersionRequestSchema = z.object({
  versionLabel: z.string().min(1),
  effectiveFrom: z.string().datetime().nullable().default(null),
  effectiveTo: z.string().datetime().nullable().default(null),
  isActive: z.boolean().default(false),
  policyText: z.string().default(''),
  trackSelectionMinYear: z.number().int().min(1).max(4).default(2),
});

export const CreateCatalogCourseRequestSchema = z.object({
  subjectCode: z.string().min(1),
  catalogNumber: z.string().min(1),
  title: z.string().min(1),
  defaultUnits: z.number().int().positive(),
  department: z.string().min(1),
});

const RequirementCourseRefSchema = z.object({
  catalogCourseId: z.string().min(1),
});

const RequirementRuleInputSchema = z.object({
  ruleType: RequirementRuleTypeSchema,
  pickCount: z.number().int().positive().nullable().default(null),
  note: z.string().default(''),
  sortOrder: z.number().int().nonnegative().default(0),
  courses: z.array(RequirementCourseRefSchema).default([]),
});

export const CreateRequirementGroupRequestSchema = z.object({
  programVersionId: z.string().min(1),
  trackId: z.string().min(1).nullable().default(null),
  title: z.string().min(1),
  category: RequirementGroupCategorySchema,
  minUnits: z.number().int().nonnegative().default(0),
  minCourses: z.number().int().nonnegative().default(0),
  notes: z.string().default(''),
  sortOrder: z.number().int().nonnegative().default(0),
  noDoubleCount: z.boolean().default(true),
  rules: z.array(RequirementRuleInputSchema).default([]),
});

export const UpdateRequirementGroupRequestSchema =
  CreateRequirementGroupRequestSchema.partial().omit({ programVersionId: true });

export const CreateTrackRequestSchema = z.object({
  programVersionId: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1),
  description: z.string().default(''),
  selectionYearStart: z.number().int().min(1).max(4).default(2),
});

export const UpdateTrackRequestSchema = CreateTrackRequestSchema.partial().omit({
  programVersionId: true,
});

export const SelectTrackRequestSchema = z.object({
  trackId: z.string().min(1),
});

export const UpdateStudentPlanRequestSchema = z.object({
  plannedCourses: z.array(
    z.object({
      catalogCourseId: z.string().min(1),
      plannedYear: z.number().int().min(1).max(4),
      plannedTerm: AcademicTermSchema,
      sourceType: PlannedCourseSourceTypeSchema.default('standard'),
      note: z.string().nullable().default(null),
    })
  ),
});

export const CreatePetitionRequestSchema = z.object({
  type: PetitionTypeSchema,
  justification: z.string().min(1),
  targetRequirementGroupId: z.string().min(1).nullable().default(null),
  originalCatalogCourseId: z.string().min(1).nullable().default(null),
  substituteCatalogCourseId: z.string().min(1).nullable().default(null),
});

export const UpdatePetitionRequestSchema = z.object({
  status: PetitionStatusSchema,
  reviewerNotes: z.string().nullable().default(null),
});

export const ProgramApprovalRequestSchema = z.object({
  status: ApprovalStatusSchema.default('approved'),
  notes: z.string().nullable().default(null),
});

export type ProgramSummary = z.infer<typeof ProgramSummarySchema>;
export type ProgramVersionSummary = z.infer<typeof ProgramVersionSummarySchema>;
export type TrackSummary = z.infer<typeof TrackSummarySchema>;
export type CatalogCourse = z.infer<typeof CatalogCourseSchema>;
export type RequirementCourse = z.infer<typeof RequirementCourseSchema>;
export type RequirementRule = z.infer<typeof RequirementRuleSchema>;
export type RequirementGroup = z.infer<typeof RequirementGroupSchema>;
export type ProgramVersionDetail = z.infer<typeof ProgramVersionDetailSchema>;
export type StudentPlannedCourse = z.infer<typeof StudentPlannedCourseSchema>;
export type StudentRequirementDecision = z.infer<typeof StudentRequirementDecisionSchema>;
export type PetitionCourseLink = z.infer<typeof PetitionCourseLinkSchema>;
export type Petition = z.infer<typeof PetitionSchema>;
export type ProgramApproval = z.infer<typeof ProgramApprovalSchema>;
export type ProgramSheetView = z.infer<typeof ProgramSheetViewSchema>;
export type StudentProgramPlan = z.infer<typeof StudentProgramPlanSchema>;
export type CreateProgramRequest = z.infer<typeof CreateProgramRequestSchema>;
export type CreateProgramVersionRequest = z.infer<typeof CreateProgramVersionRequestSchema>;
export type CreateCatalogCourseRequest = z.infer<typeof CreateCatalogCourseRequestSchema>;
export type CreateRequirementGroupRequest = z.infer<typeof CreateRequirementGroupRequestSchema>;
export type UpdateRequirementGroupRequest = z.infer<typeof UpdateRequirementGroupRequestSchema>;
export type CreateTrackRequest = z.infer<typeof CreateTrackRequestSchema>;
export type UpdateTrackRequest = z.infer<typeof UpdateTrackRequestSchema>;
export type SelectTrackRequest = z.infer<typeof SelectTrackRequestSchema>;
export type UpdateStudentPlanRequest = z.infer<typeof UpdateStudentPlanRequestSchema>;
export type CreatePetitionRequest = z.infer<typeof CreatePetitionRequestSchema>;
export type UpdatePetitionRequest = z.infer<typeof UpdatePetitionRequestSchema>;
export type ProgramApprovalRequest = z.infer<typeof ProgramApprovalRequestSchema>;
