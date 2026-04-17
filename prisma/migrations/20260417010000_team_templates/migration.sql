-- Team project templates, applications, formation runs, locked teams, and team-owned submissions.

CREATE TYPE "ProjectTemplateStatus" AS ENUM ('draft', 'active');
CREATE TYPE "TeamFormationStatus" AS ENUM (
  'not_started',
  'application_open',
  'team_review',
  'teams_locked'
);
CREATE TYPE "ProjectRoleApplicationStatus" AS ENUM ('submitted', 'withdrawn');
CREATE TYPE "TeamStatus" AS ENUM ('suggested', 'locked');

ALTER TABLE "Project"
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "applicationOpenAt" TIMESTAMP(3),
  ADD COLUMN "applicationCloseAt" TIMESTAMP(3),
  ADD COLUMN "teamLockAt" TIMESTAMP(3),
  ADD COLUMN "teamFormationStatus" "TeamFormationStatus" NOT NULL DEFAULT 'not_started';

ALTER TABLE "SubmissionAttempt"
  ADD COLUMN "submittedByUserId" TEXT,
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "teamProjectRepoId" TEXT,
  ALTER COLUMN "userProjectRepoId" DROP NOT NULL;

CREATE TABLE "ProjectTemplate" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'team',
  "teamSize" INTEGER,
  "status" "ProjectTemplateStatus" NOT NULL DEFAULT 'active',
  "rubricJson" JSONB,
  "resourcesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTemplateRole" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProjectTemplateRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTemplateMilestone" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL,
  "dueAt" TIMESTAMP(3),
  "isFinal" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ProjectTemplateMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRoleApplication" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "statement" TEXT NOT NULL DEFAULT '',
  "availabilityNote" TEXT NOT NULL DEFAULT '',
  "status" "ProjectRoleApplicationStatus" NOT NULL DEFAULT 'submitted',
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectRoleApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRolePreference" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "templateRoleId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  CONSTRAINT "ProjectRolePreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamFormationRun" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "configJson" JSONB NOT NULL,
  "resultJson" JSONB NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamFormationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "TeamStatus" NOT NULL DEFAULT 'suggested',
  "formationRunId" TEXT,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleKey" TEXT NOT NULL,
  "roleLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamProjectRepo" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "githubRepoId" TEXT,
  "cloneUrl" TEXT,
  "defaultBranch" TEXT NOT NULL,
  "visibility" "RepoVisibility" NOT NULL DEFAULT 'private',
  "installStatus" TEXT NOT NULL DEFAULT 'provisioned',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamProjectRepo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectTemplate_courseId_slug_key" ON "ProjectTemplate"("courseId", "slug");
CREATE UNIQUE INDEX "ProjectTemplateMilestone_templateId_order_key" ON "ProjectTemplateMilestone"("templateId", "order");
CREATE UNIQUE INDEX "ProjectRoleApplication_projectId_userId_key" ON "ProjectRoleApplication"("projectId", "userId");
CREATE UNIQUE INDEX "ProjectRolePreference_applicationId_rank_key" ON "ProjectRolePreference"("applicationId", "rank");
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE UNIQUE INDEX "TeamProjectRepo_teamId_key" ON "TeamProjectRepo"("teamId");
CREATE INDEX "SubmissionAttempt_teamId_idx" ON "SubmissionAttempt"("teamId");

ALTER TABLE "ProjectTemplate"
  ADD CONSTRAINT "ProjectTemplate_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTemplateRole"
  ADD CONSTRAINT "ProjectTemplateRole_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProjectTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTemplateMilestone"
  ADD CONSTRAINT "ProjectTemplateMilestone_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProjectTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRoleApplication"
  ADD CONSTRAINT "ProjectRoleApplication_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRoleApplication"
  ADD CONSTRAINT "ProjectRoleApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRolePreference"
  ADD CONSTRAINT "ProjectRolePreference_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "ProjectRoleApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRolePreference"
  ADD CONSTRAINT "ProjectRolePreference_templateRoleId_fkey"
  FOREIGN KEY ("templateRoleId") REFERENCES "ProjectTemplateRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamFormationRun"
  ADD CONSTRAINT "TeamFormationRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamFormationRun"
  ADD CONSTRAINT "TeamFormationRun_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_formationRunId_fkey"
  FOREIGN KEY ("formationRunId") REFERENCES "TeamFormationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamProjectRepo"
  ADD CONSTRAINT "TeamProjectRepo_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProjectTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubmissionAttempt"
  ADD CONSTRAINT "SubmissionAttempt_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubmissionAttempt"
  ADD CONSTRAINT "SubmissionAttempt_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubmissionAttempt"
  ADD CONSTRAINT "SubmissionAttempt_teamProjectRepoId_fkey"
  FOREIGN KEY ("teamProjectRepoId") REFERENCES "TeamProjectRepo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
