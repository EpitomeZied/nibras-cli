import { FastifyInstance } from 'fastify';
import {
  CatalogCourseSchema,
  CreateCatalogCourseRequestSchema,
  CreatePetitionRequestSchema,
  CreateProgramRequestSchema,
  CreateProgramVersionRequestSchema,
  CreateRequirementGroupRequestSchema,
  CreateTrackRequestSchema,
  PetitionSchema,
  ProgramApprovalRequestSchema,
  ProgramApprovalSchema,
  ProgramSheetViewSchema,
  ProgramSummarySchema,
  ProgramVersionDetailSchema,
  ProgramVersionSummarySchema,
  SelectTrackRequestSchema,
  StudentProgramPlanSchema,
  TrackSummarySchema,
  UpdatePetitionRequestSchema,
  UpdateRequirementGroupRequestSchema,
  UpdateStudentPlanRequestSchema,
  UpdateTrackRequestSchema,
} from '@nibras/contracts';
import { requireUser } from '../../lib/auth';
import { Errors, apiError } from '../../lib/errors';
import { requestBaseUrl } from '../../lib/request-base-url';
import { validateId } from '../../lib/validate';
import { AppStore } from '../../store';
import { canApproveProgramStage, canManagePrograms } from './policies/access';

export function registerProgramRoutes(app: FastifyInstance, store: AppStore): void {
  app.get(
    '/v1/programs',
    { schema: { tags: ['programs'], summary: 'List academic programs' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const programs = await store.listPrograms(requestBaseUrl(request));
      return programs.map((program) => ProgramSummarySchema.parse(program));
    }
  );

  app.post(
    '/v1/programs',
    { schema: { tags: ['programs'], summary: 'Create a new academic program' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = CreateProgramRequestSchema.parse(request.body);
      const program = await store.createProgram(requestBaseUrl(request), auth.user.id, payload);
      reply.code(201);
      return ProgramSummarySchema.parse(program);
    }
  );

  app.get(
    '/v1/programs/:programId/versions/:versionId',
    { schema: { tags: ['programs'], summary: 'Get a program version detail' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { programId: string; versionId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      if (!validateId(params.versionId, reply, 'versionId')) return;
      const detail = await store.getProgramVersionDetail(
        requestBaseUrl(request),
        params.programId,
        params.versionId
      );
      if (!detail) {
        reply.code(404).send(Errors.notFound('Program version'));
        return;
      }
      return ProgramVersionDetailSchema.parse(detail);
    }
  );

  app.post(
    '/v1/programs/:programId/versions',
    { schema: { tags: ['programs'], summary: 'Create a program version' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      const payload = CreateProgramVersionRequestSchema.parse(request.body);
      const version = await store.createProgramVersion(
        requestBaseUrl(request),
        auth.user.id,
        params.programId,
        payload
      );
      reply.code(201);
      return ProgramVersionSummarySchema.parse(version);
    }
  );

  app.post(
    '/v1/programs/:programId/catalog-courses',
    { schema: { tags: ['programs'], summary: 'Create a catalog course' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      const payload = CreateCatalogCourseRequestSchema.parse(request.body);
      const course = await store.createCatalogCourse(
        requestBaseUrl(request),
        auth.user.id,
        params.programId,
        payload
      );
      reply.code(201);
      return CatalogCourseSchema.parse(course);
    }
  );

  app.post(
    '/v1/programs/:programId/requirement-groups',
    { schema: { tags: ['programs'], summary: 'Create a requirement group' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      const payload = CreateRequirementGroupRequestSchema.parse(request.body);
      const group = await store.createRequirementGroup(
        requestBaseUrl(request),
        auth.user.id,
        params.programId,
        payload
      );
      reply.code(201);
      return group;
    }
  );

  app.patch(
    '/v1/programs/:programId/requirement-groups/:groupId',
    { schema: { tags: ['programs'], summary: 'Update a requirement group' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string; groupId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      if (!validateId(params.groupId, reply, 'groupId')) return;
      const payload = UpdateRequirementGroupRequestSchema.parse(request.body);
      const group = await store.updateRequirementGroup(
        requestBaseUrl(request),
        auth.user.id,
        params.programId,
        params.groupId,
        payload
      );
      if (!group) {
        reply.code(404).send(Errors.notFound('Requirement group'));
        return;
      }
      return group;
    }
  );

  app.post(
    '/v1/programs/:programId/tracks',
    { schema: { tags: ['programs'], summary: 'Create a track' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      const payload = CreateTrackRequestSchema.parse(request.body);
      const track = await store.createTrack(
        requestBaseUrl(request),
        auth.user.id,
        params.programId,
        payload
      );
      reply.code(201);
      return TrackSummarySchema.parse(track);
    }
  );

  app.patch(
    '/v1/programs/:programId/tracks/:trackId',
    { schema: { tags: ['programs'], summary: 'Update a track' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string; trackId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      if (!validateId(params.trackId, reply, 'trackId')) return;
      const payload = UpdateTrackRequestSchema.parse(request.body);
      const track = await store.updateTrack(
        requestBaseUrl(request),
        auth.user.id,
        params.programId,
        params.trackId,
        payload
      );
      if (!track) {
        reply.code(404).send(Errors.notFound('Track'));
        return;
      }
      return TrackSummarySchema.parse(track);
    }
  );

  app.post(
    '/v1/programs/:programId/enroll',
    { schema: { tags: ['programs'], summary: 'Enroll the current student in a program' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { programId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      const plan = await store.enrollInProgram(
        requestBaseUrl(request),
        auth.user.id,
        params.programId
      );
      reply.code(201);
      return StudentProgramPlanSchema.parse(plan);
    }
  );

  app.get(
    '/v1/programs/student/me',
    { schema: { tags: ['programs'], summary: 'Get the current student plan' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const plan = await store.getStudentProgramPlan(requestBaseUrl(request), auth.user.id);
      if (!plan) {
        reply.code(404).send(Errors.notFound('Student program'));
        return;
      }
      return StudentProgramPlanSchema.parse(plan);
    }
  );

  app.post(
    '/v1/programs/student/me/select-track',
    { schema: { tags: ['programs'], summary: 'Select a specialization track' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const payload = SelectTrackRequestSchema.parse(request.body);
      const plan = await store.selectStudentTrack(
        requestBaseUrl(request),
        auth.user.id,
        payload.trackId
      );
      if (!plan) {
        reply.code(409).send(apiError('CONFLICT', 'Track cannot be selected yet.'));
        return;
      }
      return StudentProgramPlanSchema.parse(plan);
    }
  );

  app.patch(
    '/v1/programs/student/me/plan',
    { schema: { tags: ['programs'], summary: 'Update the current student plan' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const payload = UpdateStudentPlanRequestSchema.parse(request.body);
      const plan = await store.updateStudentProgramPlan(
        requestBaseUrl(request),
        auth.user.id,
        payload
      );
      if (!plan) {
        reply.code(409).send(apiError('CONFLICT', 'Plan is locked or missing.'));
        return;
      }
      return StudentProgramPlanSchema.parse(plan);
    }
  );

  app.get(
    '/v1/programs/student/me/sheet',
    { schema: { tags: ['programs'], summary: 'Get the printable program sheet view' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const sheet = await store.getStudentProgramSheet(requestBaseUrl(request), auth.user.id);
      if (!sheet) {
        reply.code(404).send(Errors.notFound('Program sheet'));
        return;
      }
      return ProgramSheetViewSchema.parse(sheet);
    }
  );

  app.post(
    '/v1/programs/student/me/generate-sheet',
    { schema: { tags: ['programs'], summary: 'Generate and snapshot the printable sheet' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const sheet = await store.generateStudentProgramSheet(requestBaseUrl(request), auth.user.id);
      if (!sheet) {
        reply.code(404).send(Errors.notFound('Student program'));
        return;
      }
      reply.code(201);
      return ProgramSheetViewSchema.parse(sheet);
    }
  );

  app.post(
    '/v1/programs/student/me/petitions',
    { schema: { tags: ['programs'], summary: 'Submit a petition for the current student' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const payload = CreatePetitionRequestSchema.parse(request.body);
      const petition = await store.createStudentPetition(
        requestBaseUrl(request),
        auth.user.id,
        payload
      );
      if (!petition) {
        reply.code(404).send(Errors.notFound('Student program'));
        return;
      }
      reply.code(201);
      return PetitionSchema.parse(petition);
    }
  );

  app.get(
    '/v1/programs/student/me/petitions',
    { schema: { tags: ['programs'], summary: 'List petitions for the current student' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const petitions = await store.listStudentPetitions(requestBaseUrl(request), auth.user.id);
      return petitions.map((petition) => PetitionSchema.parse(petition));
    }
  );

  app.get(
    '/v1/programs/:programId/petitions',
    { schema: { tags: ['programs'], summary: 'List petitions for a program' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      const petitions = await store.listProgramPetitions(requestBaseUrl(request), params.programId);
      return petitions.map((petition) => PetitionSchema.parse(petition));
    }
  );

  app.patch(
    '/v1/programs/:programId/petitions/:petitionId',
    { schema: { tags: ['programs'], summary: 'Update petition status' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canManagePrograms(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string; petitionId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      if (!validateId(params.petitionId, reply, 'petitionId')) return;
      const payload = UpdatePetitionRequestSchema.parse(request.body);
      const petition = await store.updateProgramPetition(
        requestBaseUrl(request),
        params.programId,
        params.petitionId,
        auth.user.id,
        payload
      );
      if (!petition) {
        reply.code(404).send(Errors.notFound('Petition'));
        return;
      }
      return PetitionSchema.parse(petition);
    }
  );

  app.post(
    '/v1/programs/:programId/approvals/:studentProgramId/advisor',
    { schema: { tags: ['programs'], summary: 'Record advisor approval for a student program' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canApproveProgramStage(auth, 'advisor')) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string; studentProgramId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      if (!validateId(params.studentProgramId, reply, 'studentProgramId')) return;
      const payload = ProgramApprovalRequestSchema.parse(request.body ?? {});
      const approval = await store.setProgramApproval(
        requestBaseUrl(request),
        params.programId,
        params.studentProgramId,
        'advisor',
        auth.user.id,
        payload
      );
      if (!approval) {
        reply.code(404).send(Errors.notFound('Program approval'));
        return;
      }
      return ProgramApprovalSchema.parse(approval);
    }
  );

  app.post(
    '/v1/programs/:programId/approvals/:studentProgramId/department',
    { schema: { tags: ['programs'], summary: 'Record department approval for a student program' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!canApproveProgramStage(auth, 'department')) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const params = request.params as { programId: string; studentProgramId: string };
      if (!validateId(params.programId, reply, 'programId')) return;
      if (!validateId(params.studentProgramId, reply, 'studentProgramId')) return;
      const payload = ProgramApprovalRequestSchema.parse(request.body ?? {});
      const approval = await store.setProgramApproval(
        requestBaseUrl(request),
        params.programId,
        params.studentProgramId,
        'department',
        auth.user.id,
        payload
      );
      if (!approval) {
        reply.code(409).send(apiError('CONFLICT', 'Advisor approval is required first.'));
        return;
      }
      return ProgramApprovalSchema.parse(approval);
    }
  );
}
