DO $$
BEGIN
  CREATE TYPE "ProgramStatus" AS ENUM ('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RequirementGroupCategory" AS ENUM (
    'foundation',
    'core',
    'depth',
    'elective',
    'capstone',
    'policy'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RequirementRuleType" AS ENUM (
    'required',
    'choose_n',
    'elective_pool',
    'track_gate'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudentProgramStatus" AS ENUM (
    'enrolled',
    'track_selected',
    'submitted_for_advisor',
    'advisor_approved',
    'department_approved'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PlannedCourseSourceType" AS ENUM ('standard', 'transfer', 'petition', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudentRequirementDecisionStatus" AS ENUM (
    'pending',
    'satisfied',
    'waived',
    'petition_pending'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RequirementDecisionSourceType" AS ENUM (
    'planned_course',
    'transfer_credit',
    'petition',
    'waiver'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PetitionType" AS ENUM ('transfer_credit', 'substitution', 'waiver');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PetitionStatus" AS ENUM (
    'pending_advisor',
    'pending_department',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ApprovalStage" AS ENUM ('advisor', 'department');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AcademicTerm" AS ENUM ('fall', 'spring');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Program" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "totalUnitRequirement" INTEGER NOT NULL,
  "status" "ProgramStatus" NOT NULL DEFAULT 'draft',
  "activeVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Program_slug_key" ON "Program"("slug");

CREATE TABLE IF NOT EXISTS "ProgramVersion" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "versionLabel" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "policyText" TEXT NOT NULL DEFAULT '',
  "trackSelectionMinYear" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgramVersion_programId_isActive_idx"
  ON "ProgramVersion"("programId", "isActive");

CREATE TABLE IF NOT EXISTS "Track" (
  "id" TEXT NOT NULL,
  "programVersionId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "selectionYearStart" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Track_programVersionId_slug_key"
  ON "Track"("programVersionId", "slug");

CREATE TABLE IF NOT EXISTS "CatalogCourse" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "subjectCode" TEXT NOT NULL,
  "catalogNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "defaultUnits" INTEGER NOT NULL,
  "department" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogCourse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogCourse_programId_subjectCode_catalogNumber_key"
  ON "CatalogCourse"("programId", "subjectCode", "catalogNumber");

CREATE TABLE IF NOT EXISTS "RequirementGroup" (
  "id" TEXT NOT NULL,
  "programVersionId" TEXT NOT NULL,
  "trackId" TEXT,
  "title" TEXT NOT NULL,
  "category" "RequirementGroupCategory" NOT NULL,
  "minUnits" INTEGER NOT NULL DEFAULT 0,
  "minCourses" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "noDoubleCount" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequirementGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RequirementGroup_programVersionId_trackId_sortOrder_idx"
  ON "RequirementGroup"("programVersionId", "trackId", "sortOrder");

CREATE TABLE IF NOT EXISTS "RequirementRule" (
  "id" TEXT NOT NULL,
  "requirementGroupId" TEXT NOT NULL,
  "ruleType" "RequirementRuleType" NOT NULL,
  "pickCount" INTEGER,
  "note" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RequirementRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RequirementRule_requirementGroupId_sortOrder_idx"
  ON "RequirementRule"("requirementGroupId", "sortOrder");

CREATE TABLE IF NOT EXISTS "RequirementCourse" (
  "id" TEXT NOT NULL,
  "requirementRuleId" TEXT NOT NULL,
  "catalogCourseId" TEXT NOT NULL,
  CONSTRAINT "RequirementCourse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RequirementCourse_requirementRuleId_catalogCourseId_key"
  ON "RequirementCourse"("requirementRuleId", "catalogCourseId");

CREATE TABLE IF NOT EXISTS "StudentProgram" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "programVersionId" TEXT NOT NULL,
  "selectedTrackId" TEXT,
  "status" "StudentProgramStatus" NOT NULL DEFAULT 'enrolled',
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentProgram_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentProgram_userId_programVersionId_idx"
  ON "StudentProgram"("userId", "programVersionId");

CREATE TABLE IF NOT EXISTS "StudentPlannedCourse" (
  "id" TEXT NOT NULL,
  "studentProgramId" TEXT NOT NULL,
  "catalogCourseId" TEXT NOT NULL,
  "plannedYear" INTEGER NOT NULL,
  "plannedTerm" "AcademicTerm" NOT NULL,
  "sourceType" "PlannedCourseSourceType" NOT NULL DEFAULT 'standard',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentPlannedCourse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentPlannedCourse_studentProgramId_plannedYear_plannedTerm_idx"
  ON "StudentPlannedCourse"("studentProgramId", "plannedYear", "plannedTerm");

CREATE TABLE IF NOT EXISTS "StudentRequirementDecision" (
  "id" TEXT NOT NULL,
  "studentProgramId" TEXT NOT NULL,
  "requirementGroupId" TEXT NOT NULL,
  "status" "StudentRequirementDecisionStatus" NOT NULL,
  "sourceType" "RequirementDecisionSourceType",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentRequirementDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentRequirementDecision_studentProgramId_requirementGroupId_key"
  ON "StudentRequirementDecision"("studentProgramId", "requirementGroupId");

CREATE TABLE IF NOT EXISTS "Petition" (
  "id" TEXT NOT NULL,
  "studentProgramId" TEXT NOT NULL,
  "type" "PetitionType" NOT NULL,
  "status" "PetitionStatus" NOT NULL DEFAULT 'pending_advisor',
  "justification" TEXT NOT NULL,
  "targetRequirementGroupId" TEXT,
  "submittedByUserId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "reviewerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Petition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PetitionCourseLink" (
  "id" TEXT NOT NULL,
  "petitionId" TEXT NOT NULL,
  "originalCatalogCourseId" TEXT,
  "substituteCatalogCourseId" TEXT,
  CONSTRAINT "PetitionCourseLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProgramApproval" (
  "id" TEXT NOT NULL,
  "studentProgramId" TEXT NOT NULL,
  "stage" "ApprovalStage" NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
  "reviewerUserId" TEXT,
  "notes" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramApproval_studentProgramId_stage_key"
  ON "ProgramApproval"("studentProgramId", "stage");

CREATE TABLE IF NOT EXISTS "ProgramSheetSnapshot" (
  "id" TEXT NOT NULL,
  "studentProgramId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "renderedPayload" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramSheetSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgramSheetSnapshot_studentProgramId_generatedAt_idx"
  ON "ProgramSheetSnapshot"("studentProgramId", "generatedAt");

ALTER TABLE "ProgramVersion"
  ADD CONSTRAINT "ProgramVersion_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Track"
  ADD CONSTRAINT "Track_programVersionId_fkey"
  FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogCourse"
  ADD CONSTRAINT "CatalogCourse_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementGroup"
  ADD CONSTRAINT "RequirementGroup_programVersionId_fkey"
  FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementGroup"
  ADD CONSTRAINT "RequirementGroup_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "Track"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RequirementRule"
  ADD CONSTRAINT "RequirementRule_requirementGroupId_fkey"
  FOREIGN KEY ("requirementGroupId") REFERENCES "RequirementGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementCourse"
  ADD CONSTRAINT "RequirementCourse_requirementRuleId_fkey"
  FOREIGN KEY ("requirementRuleId") REFERENCES "RequirementRule"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementCourse"
  ADD CONSTRAINT "RequirementCourse_catalogCourseId_fkey"
  FOREIGN KEY ("catalogCourseId") REFERENCES "CatalogCourse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentProgram"
  ADD CONSTRAINT "StudentProgram_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentProgram"
  ADD CONSTRAINT "StudentProgram_programVersionId_fkey"
  FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentProgram"
  ADD CONSTRAINT "StudentProgram_selectedTrackId_fkey"
  FOREIGN KEY ("selectedTrackId") REFERENCES "Track"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentPlannedCourse"
  ADD CONSTRAINT "StudentPlannedCourse_studentProgramId_fkey"
  FOREIGN KEY ("studentProgramId") REFERENCES "StudentProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentPlannedCourse"
  ADD CONSTRAINT "StudentPlannedCourse_catalogCourseId_fkey"
  FOREIGN KEY ("catalogCourseId") REFERENCES "CatalogCourse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentRequirementDecision"
  ADD CONSTRAINT "StudentRequirementDecision_studentProgramId_fkey"
  FOREIGN KEY ("studentProgramId") REFERENCES "StudentProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentRequirementDecision"
  ADD CONSTRAINT "StudentRequirementDecision_requirementGroupId_fkey"
  FOREIGN KEY ("requirementGroupId") REFERENCES "RequirementGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Petition"
  ADD CONSTRAINT "Petition_studentProgramId_fkey"
  FOREIGN KEY ("studentProgramId") REFERENCES "StudentProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Petition"
  ADD CONSTRAINT "Petition_targetRequirementGroupId_fkey"
  FOREIGN KEY ("targetRequirementGroupId") REFERENCES "RequirementGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Petition"
  ADD CONSTRAINT "Petition_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Petition"
  ADD CONSTRAINT "Petition_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PetitionCourseLink"
  ADD CONSTRAINT "PetitionCourseLink_petitionId_fkey"
  FOREIGN KEY ("petitionId") REFERENCES "Petition"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PetitionCourseLink"
  ADD CONSTRAINT "PetitionCourseLink_originalCatalogCourseId_fkey"
  FOREIGN KEY ("originalCatalogCourseId") REFERENCES "CatalogCourse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PetitionCourseLink"
  ADD CONSTRAINT "PetitionCourseLink_substituteCatalogCourseId_fkey"
  FOREIGN KEY ("substituteCatalogCourseId") REFERENCES "CatalogCourse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProgramApproval"
  ADD CONSTRAINT "ProgramApproval_studentProgramId_fkey"
  FOREIGN KEY ("studentProgramId") REFERENCES "StudentProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramApproval"
  ADD CONSTRAINT "ProgramApproval_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProgramSheetSnapshot"
  ADD CONSTRAINT "ProgramSheetSnapshot_studentProgramId_fkey"
  FOREIGN KEY ("studentProgramId") REFERENCES "StudentProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramSheetSnapshot"
  ADD CONSTRAINT "ProgramSheetSnapshot_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ProgramVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
