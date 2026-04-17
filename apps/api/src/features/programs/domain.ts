import type {
  AcademicTerm,
  CatalogCourseRecord,
  PetitionRecord,
  ProgramApprovalRecord,
  ProgramRecord,
  ProgramSheetSectionRecord,
  ProgramSheetViewRecord,
  ProgramVersionRecord,
  RequirementGroupRecord,
  StudentPlannedCourseRecord,
  StudentProgramPlanRecord,
  StudentProgramRecord,
  StudentRequirementDecisionRecord,
  TrackRecord,
  UserRecord,
} from '../../store';

export const DEFAULT_PROGRAM_TRACKS = [
  'Artificial Intelligence (AI)',
  'Information',
  'Theory',
  'Visual Computing (Graphics)',
  'Computational Bio (Biocomp)',
  'Human-Computer Interaction',
  'Systems',
  'Unspecialized',
  'Individually Designed',
];

export type ProgramSeedBlueprint = {
  program: {
    slug: string;
    title: string;
    code: string;
    academicYear: string;
    totalUnitRequirement: number;
    status: ProgramRecord['status'];
  };
  version: {
    versionLabel: string;
    policyText: string;
    trackSelectionMinYear: number;
    isActive: boolean;
  };
  catalogCourses: Array<{
    key: string;
    subjectCode: string;
    catalogNumber: string;
    title: string;
    defaultUnits: number;
    department: string;
  }>;
  sharedGroups: Array<{
    title: string;
    category: RequirementGroupRecord['category'];
    minUnits: number;
    minCourses: number;
    notes: string;
    sortOrder: number;
    noDoubleCount: boolean;
    rules: Array<{
      ruleType: 'required' | 'choose_n' | 'elective_pool' | 'track_gate';
      pickCount: number | null;
      note: string;
      sortOrder: number;
      courseKeys: string[];
    }>;
  }>;
  tracks: Array<{
    slug: string;
    title: string;
    description: string;
    selectionYearStart: number;
    groups: Array<{
      title: string;
      category: RequirementGroupRecord['category'];
      minUnits: number;
      minCourses: number;
      notes: string;
      sortOrder: number;
      noDoubleCount: boolean;
      rules: Array<{
        ruleType: 'required' | 'choose_n' | 'elective_pool' | 'track_gate';
        pickCount: number | null;
        note: string;
        sortOrder: number;
        courseKeys: string[];
      }>;
    }>;
  }>;
};

function slugifyTrack(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildDefaultProgramSeed(): ProgramSeedBlueprint {
  const catalogCourses: ProgramSeedBlueprint['catalogCourses'] = [
    ['CS101', 'CS', '101', 'Programming Fundamentals', 4, 'Computer Science'],
    ['CS102', 'CS', '102', 'Data Structures', 4, 'Computer Science'],
    ['CS103', 'CS', '103', 'Discrete Mathematics', 3, 'Computer Science'],
    ['MATH111', 'MATH', '111', 'Calculus I', 3, 'Mathematics'],
    ['MATH112', 'MATH', '112', 'Calculus II', 3, 'Mathematics'],
    ['ENG101', 'ENG', '101', 'Academic Writing', 2, 'General Education'],
    ['PHY101', 'PHY', '101', 'Physics for Computing', 3, 'Physics'],
    ['CS201', 'CS', '201', 'Computer Organization', 4, 'Computer Science'],
    ['CS202', 'CS', '202', 'Algorithms', 4, 'Computer Science'],
    ['CS203', 'CS', '203', 'Databases', 3, 'Computer Science'],
    ['CS204', 'CS', '204', 'Operating Systems', 4, 'Computer Science'],
    ['CS205', 'CS', '205', 'Software Engineering Studio', 3, 'Computer Science'],
    ['CS206', 'CS', '206', 'Networks and Security', 3, 'Computer Science'],
    ['CS301', 'CS', '301', 'Research Methods in Computing', 3, 'Computer Science'],
    ['CS302', 'CS', '302', 'Capstone Planning', 2, 'Computer Science'],
    ['CS303', 'CS', '303', 'Senior Capstone', 4, 'Computer Science'],
    ['CS311', 'CS', '311', 'Machine Learning', 3, 'Computer Science'],
    ['CS312', 'CS', '312', 'Natural Language Processing', 3, 'Computer Science'],
    ['CS313', 'CS', '313', 'Computer Vision', 3, 'Computer Science'],
    ['CS321', 'CS', '321', 'Information Retrieval', 3, 'Computer Science'],
    ['CS322', 'CS', '322', 'Knowledge Graphs', 3, 'Computer Science'],
    ['CS323', 'CS', '323', 'Information Visualization', 3, 'Computer Science'],
    ['CS331', 'CS', '331', 'Theory of Computation', 3, 'Computer Science'],
    ['CS332', 'CS', '332', 'Advanced Algorithms', 3, 'Computer Science'],
    ['CS333', 'CS', '333', 'Cryptography Theory', 3, 'Computer Science'],
    ['CS341', 'CS', '341', 'Graphics Programming', 3, 'Computer Science'],
    ['CS342', 'CS', '342', '3D Interaction', 3, 'Computer Science'],
    ['CS343', 'CS', '343', 'Rendering Systems', 3, 'Computer Science'],
    ['CS351', 'CS', '351', 'Computational Genomics', 3, 'Computer Science'],
    ['CS352', 'CS', '352', 'Bioinformatics Algorithms', 3, 'Computer Science'],
    ['CS353', 'CS', '353', 'Data-Driven Biology', 3, 'Computer Science'],
    ['CS361', 'CS', '361', 'Human-Centered Design', 3, 'Computer Science'],
    ['CS362', 'CS', '362', 'Interaction Engineering', 3, 'Computer Science'],
    ['CS363', 'CS', '363', 'Usability Research', 3, 'Computer Science'],
    ['CS371', 'CS', '371', 'Distributed Systems', 3, 'Computer Science'],
    ['CS372', 'CS', '372', 'Compilers', 3, 'Computer Science'],
    ['CS373', 'CS', '373', 'Cloud Infrastructure', 3, 'Computer Science'],
    ['CS381', 'CS', '381', 'Open Track Seminar', 3, 'Computer Science'],
    ['CS382', 'CS', '382', 'Interdisciplinary Computing', 3, 'Computer Science'],
    ['CS383', 'CS', '383', 'Independent Study Design', 3, 'Computer Science'],
  ].map(([key, subjectCode, catalogNumber, title, defaultUnits, department]) => ({
    key: String(key),
    subjectCode: String(subjectCode),
    catalogNumber: String(catalogNumber),
    title: String(title),
    defaultUnits: Number(defaultUnits),
    department: String(department),
  }));

  const sharedGroups: ProgramSeedBlueprint['sharedGroups'] = [
    {
      title: 'Year 1 Foundation',
      category: 'foundation',
      minUnits: 22,
      minCourses: 7,
      notes: 'Common first-year foundation shared by all students before track selection.',
      sortOrder: 10,
      noDoubleCount: true,
      rules: [
        {
          ruleType: 'required',
          pickCount: null,
          note: 'All foundation courses are required.',
          sortOrder: 10,
          courseKeys: ['CS101', 'CS102', 'CS103', 'MATH111', 'MATH112', 'ENG101', 'PHY101'],
        },
      ],
    },
    {
      title: 'Shared CS Core',
      category: 'core',
      minUnits: 21,
      minCourses: 6,
      notes: 'Core CS courses shared across every specialization.',
      sortOrder: 20,
      noDoubleCount: true,
      rules: [
        {
          ruleType: 'required',
          pickCount: null,
          note: 'Core computing spine.',
          sortOrder: 10,
          courseKeys: ['CS201', 'CS202', 'CS203', 'CS204', 'CS205', 'CS206'],
        },
      ],
    },
    {
      title: 'Capstone and Professional Practice',
      category: 'capstone',
      minUnits: 9,
      minCourses: 3,
      notes: 'Final-year integration and professional synthesis.',
      sortOrder: 40,
      noDoubleCount: true,
      rules: [
        {
          ruleType: 'required',
          pickCount: null,
          note: 'Capstone sequence.',
          sortOrder: 10,
          courseKeys: ['CS301', 'CS302', 'CS303'],
        },
      ],
    },
  ];

  const trackCourseMap: Record<string, string[]> = {
    'Artificial Intelligence (AI)': ['CS311', 'CS312', 'CS313'],
    Information: ['CS321', 'CS322', 'CS323'],
    Theory: ['CS331', 'CS332', 'CS333'],
    'Visual Computing (Graphics)': ['CS341', 'CS342', 'CS343'],
    'Computational Bio (Biocomp)': ['CS351', 'CS352', 'CS353'],
    'Human-Computer Interaction': ['CS361', 'CS362', 'CS363'],
    Systems: ['CS371', 'CS372', 'CS373'],
    Unspecialized: ['CS381', 'CS382', 'CS383'],
    'Individually Designed': ['CS381', 'CS382', 'CS383'],
  };

  const tracks = DEFAULT_PROGRAM_TRACKS.map((title, index) => ({
    slug: slugifyTrack(title),
    title,
    description: `Focused depth path for ${title}.`,
    selectionYearStart: 2,
    groups: [
      {
        title: `${title} Depth`,
        category: 'depth' as const,
        minUnits: 9,
        minCourses: 3,
        notes: 'Track-specific depth requirement beginning after Year 1.',
        sortOrder: 100 + index,
        noDoubleCount: true,
        rules: [
          {
            ruleType: 'required' as const,
            pickCount: null,
            note: 'Complete the track depth set.',
            sortOrder: 10,
            courseKeys: trackCourseMap[title],
          },
        ],
      },
      {
        title: `${title} Electives`,
        category: 'elective' as const,
        minUnits: 6,
        minCourses: 2,
        notes: 'Choose additional advanced study that supports the selected track.',
        sortOrder: 200 + index,
        noDoubleCount: true,
        rules: [
          {
            ruleType: 'choose_n' as const,
            pickCount: 2,
            note: 'Choose any two advanced courses from the track-aligned pool.',
            sortOrder: 20,
            courseKeys: [...trackCourseMap[title], 'CS381', 'CS382', 'CS383'],
          },
        ],
      },
    ],
  }));

  return {
    program: {
      slug: 'cs-program',
      title: 'Computer Science Program',
      code: 'CS',
      academicYear: '2026-2027',
      totalUnitRequirement: 120,
      status: 'published',
    },
    version: {
      versionLabel: '2026-2027',
      policyText:
        'Students complete the common Year 1 foundation, select one track from Year 2 onward, and must maintain advisor then department approval for exceptions.',
      trackSelectionMinYear: 2,
      isActive: true,
    },
    catalogCourses,
    sharedGroups,
    tracks,
  };
}

type EvaluatedCourse = {
  instanceId: string;
  plannedCourseId: string;
  catalogCourseId: string;
  subjectCode: string;
  catalogNumber: string;
  title: string;
  units: number;
  plannedYear: number;
  plannedTerm: AcademicTerm;
  sourceType: StudentPlannedCourseRecord['sourceType'];
};

function sortGroups(groups: RequirementGroupRecord[]): RequirementGroupRecord[] {
  return [...groups].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.title.localeCompare(right.title);
  });
}

function buildCourseInstances(args: {
  plannedCourses: StudentPlannedCourseRecord[];
  catalogCourses: CatalogCourseRecord[];
  petitions: PetitionRecord[];
}): EvaluatedCourse[] {
  const courseById = new Map(args.catalogCourses.map((course) => [course.id, course]));
  const planned = args.plannedCourses
    .map((plannedCourse) => {
      const course = courseById.get(plannedCourse.catalogCourseId);
      if (!course) return null;
      return {
        instanceId: plannedCourse.id,
        plannedCourseId: plannedCourse.id,
        catalogCourseId: course.id,
        subjectCode: course.subjectCode,
        catalogNumber: course.catalogNumber,
        title: course.title,
        units: course.defaultUnits,
        plannedYear: plannedCourse.plannedYear,
        plannedTerm: plannedCourse.plannedTerm,
        sourceType: plannedCourse.sourceType,
      } satisfies EvaluatedCourse;
    })
    .filter(Boolean) as EvaluatedCourse[];

  const petitionCredits = args.petitions
    .filter((petition) => petition.status === 'approved')
    .flatMap((petition) =>
      petition.courseLinks.map((link, index) => {
        const courseId = link.substituteCatalogCourseId || link.originalCatalogCourseId;
        const course = courseId ? courseById.get(courseId) : null;
        if (!course) return null;
        return {
          instanceId: `${petition.id}:${index}`,
          plannedCourseId: `${petition.id}:${index}`,
          catalogCourseId: course.id,
          subjectCode: course.subjectCode,
          catalogNumber: course.catalogNumber,
          title: course.title,
          units: course.defaultUnits,
          plannedYear: 1,
          plannedTerm: 'fall' as AcademicTerm,
          sourceType: petition.type === 'transfer_credit' ? 'transfer' : 'petition',
        } satisfies EvaluatedCourse;
      })
    )
    .filter(Boolean) as EvaluatedCourse[];

  return [...planned, ...petitionCredits];
}

type EvaluationResult = {
  sections: ProgramSheetSectionRecord[];
  decisions: StudentRequirementDecisionRecord[];
};

export function evaluateRequirementGroups(args: {
  studentProgram: StudentProgramRecord;
  requirementGroups: RequirementGroupRecord[];
  selectedTrack: TrackRecord | null;
  plannedCourses: StudentPlannedCourseRecord[];
  catalogCourses: CatalogCourseRecord[];
  petitions: PetitionRecord[];
  existingDecisions?: StudentRequirementDecisionRecord[];
}): EvaluationResult {
  const groups = sortGroups(
    args.requirementGroups.filter(
      (group) =>
        !group.trackId || group.trackId === args.selectedTrack?.id || group.category === 'policy'
    )
  );
  const courseInstances = buildCourseInstances({
    plannedCourses: args.plannedCourses,
    catalogCourses: args.catalogCourses,
    petitions: args.petitions,
  });
  const usedInstanceIds = new Set<string>();
  const waivedGroupIds = new Set(
    args.petitions
      .filter((petition) => petition.status === 'approved' && petition.type === 'waiver')
      .map((petition) => petition.targetRequirementGroupId)
      .filter(Boolean) as string[]
  );
  const decisionByGroupId = new Map(
    (args.existingDecisions || []).map((decision) => [decision.requirementGroupId, decision])
  );
  const now = new Date().toISOString();

  const sections = groups.map((group) => {
    if (waivedGroupIds.has(group.id)) {
      return {
        requirementGroupId: group.id,
        title: group.title,
        category: group.category,
        minUnits: group.minUnits,
        minCourses: group.minCourses,
        notes: group.notes,
        matchedCourses: [],
        usedUnits: 0,
        usedCourses: 0,
        status: 'waived' as const,
      };
    }

    const matchedCourses: ProgramSheetSectionRecord['matchedCourses'] = [];
    let everyRequiredRuleSatisfied = true;
    let everyChoiceRuleSatisfied = true;

    for (const rule of [...group.rules].sort((left, right) => left.sortOrder - right.sortOrder)) {
      const allowedCourseIds = new Set(rule.courses.map((course) => course.catalogCourseId));
      const candidates = courseInstances.filter((candidate) => {
        if (!allowedCourseIds.has(candidate.catalogCourseId)) return false;
        if (group.noDoubleCount && usedInstanceIds.has(candidate.instanceId)) return false;
        return true;
      });

      if (rule.ruleType === 'required') {
        for (const course of rule.courses) {
          const match = candidates.find(
            (candidate) => candidate.catalogCourseId === course.catalogCourseId
          );
          if (match) {
            matchedCourses.push({
              plannedCourseId: match.plannedCourseId,
              catalogCourseId: match.catalogCourseId,
              subjectCode: match.subjectCode,
              catalogNumber: match.catalogNumber,
              title: match.title,
              units: match.units,
              plannedYear: match.plannedYear,
              plannedTerm: match.plannedTerm,
              sourceType: match.sourceType,
            });
            if (group.noDoubleCount) usedInstanceIds.add(match.instanceId);
          } else {
            everyRequiredRuleSatisfied = false;
          }
        }
      } else if (rule.ruleType === 'choose_n' || rule.ruleType === 'elective_pool') {
        const needed = rule.pickCount ?? group.minCourses ?? 1;
        const chosen = candidates.slice(0, needed);
        for (const match of chosen) {
          matchedCourses.push({
            plannedCourseId: match.plannedCourseId,
            catalogCourseId: match.catalogCourseId,
            subjectCode: match.subjectCode,
            catalogNumber: match.catalogNumber,
            title: match.title,
            units: match.units,
            plannedYear: match.plannedYear,
            plannedTerm: match.plannedTerm,
            sourceType: match.sourceType,
          });
          if (group.noDoubleCount) usedInstanceIds.add(match.instanceId);
        }
        if (chosen.length < needed) {
          everyChoiceRuleSatisfied = false;
        }
      }
    }

    const usedUnits = matchedCourses.reduce((sum, course) => sum + course.units, 0);
    const usedCourses = matchedCourses.length;
    const satisfied =
      everyRequiredRuleSatisfied &&
      everyChoiceRuleSatisfied &&
      usedUnits >= group.minUnits &&
      usedCourses >= group.minCourses;

    return {
      requirementGroupId: group.id,
      title: group.title,
      category: group.category,
      minUnits: group.minUnits,
      minCourses: group.minCourses,
      notes: group.notes,
      matchedCourses,
      usedUnits,
      usedCourses,
      status: satisfied ? ('satisfied' as const) : ('pending' as const),
    };
  });

  const decisions = sections.map((section) => {
    const existing = decisionByGroupId.get(section.requirementGroupId);
    return {
      id: existing?.id || `decision_${args.studentProgram.id}_${section.requirementGroupId}`,
      studentProgramId: args.studentProgram.id,
      requirementGroupId: section.requirementGroupId,
      status: section.status,
      sourceType:
        section.status === 'waived'
          ? ('waiver' as const)
          : section.matchedCourses.some((course) => course.sourceType === 'transfer')
            ? ('transfer_credit' as const)
            : section.matchedCourses.some((course) => course.sourceType === 'petition')
              ? ('petition' as const)
              : section.matchedCourses.length > 0
                ? ('planned_course' as const)
                : null,
      notes: existing?.notes ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  });

  return { sections, decisions };
}

export function canStudentSelectTrack(args: {
  user: UserRecord;
  version: ProgramVersionRecord;
  selectedTrack: TrackRecord | null;
}): boolean {
  return Boolean(args.selectedTrack) || args.user.yearLevel >= args.version.trackSelectionMinYear;
}

export function buildProgramSheet(args: {
  studentProgram: StudentProgramRecord;
  user: UserRecord;
  program: ProgramRecord;
  version: ProgramVersionRecord;
  selectedTrack: TrackRecord | null;
  requirementGroups: RequirementGroupRecord[];
  plannedCourses: StudentPlannedCourseRecord[];
  catalogCourses: CatalogCourseRecord[];
  petitions: PetitionRecord[];
  approvals: ProgramApprovalRecord[];
  decisions?: StudentRequirementDecisionRecord[];
  generatedAt?: string | null;
}): ProgramSheetViewRecord {
  const canSelectTrack = canStudentSelectTrack({
    user: args.user,
    version: args.version,
    selectedTrack: args.selectedTrack,
  });
  const evaluation = evaluateRequirementGroups({
    studentProgram: args.studentProgram,
    requirementGroups: args.requirementGroups,
    selectedTrack: args.selectedTrack,
    plannedCourses: args.plannedCourses,
    catalogCourses: args.catalogCourses,
    petitions: args.petitions,
    existingDecisions: args.decisions,
  });

  return {
    studentProgramId: args.studentProgram.id,
    student: {
      id: args.user.id,
      username: args.user.username,
      email: args.user.email,
      yearLevel: args.user.yearLevel,
    },
    program: args.program,
    version: args.version,
    selectedTrack: args.selectedTrack,
    status: args.studentProgram.status,
    isLocked: args.studentProgram.isLocked,
    canSelectTrack,
    generatedAt: args.generatedAt ?? null,
    policyText: args.version.policyText,
    sections: evaluation.sections,
    petitions: args.petitions,
    approvals: args.approvals,
  };
}

export function buildStudentProgramPlan(args: {
  studentProgram: StudentProgramRecord;
  user: UserRecord;
  program: ProgramRecord;
  version: ProgramVersionRecord;
  tracks: TrackRecord[];
  selectedTrack: TrackRecord | null;
  requirementGroups: RequirementGroupRecord[];
  catalogCourses: CatalogCourseRecord[];
  plannedCourses: StudentPlannedCourseRecord[];
  petitions: PetitionRecord[];
  approvals: ProgramApprovalRecord[];
  decisions?: StudentRequirementDecisionRecord[];
  latestSheetGeneratedAt?: string | null;
}): StudentProgramPlanRecord {
  const canSelectTrack = canStudentSelectTrack({
    user: args.user,
    version: args.version,
    selectedTrack: args.selectedTrack,
  });
  const evaluation = evaluateRequirementGroups({
    studentProgram: args.studentProgram,
    requirementGroups: args.requirementGroups,
    selectedTrack: args.selectedTrack,
    plannedCourses: args.plannedCourses,
    catalogCourses: args.catalogCourses,
    petitions: args.petitions,
    existingDecisions: args.decisions,
  });
  const latestSheet =
    args.latestSheetGeneratedAt !== undefined
      ? buildProgramSheet({
          studentProgram: args.studentProgram,
          user: args.user,
          program: args.program,
          version: args.version,
          selectedTrack: args.selectedTrack,
          requirementGroups: args.requirementGroups,
          plannedCourses: args.plannedCourses,
          catalogCourses: args.catalogCourses,
          petitions: args.petitions,
          approvals: args.approvals,
          decisions: evaluation.decisions,
          generatedAt: args.latestSheetGeneratedAt,
        })
      : null;

  return {
    id: args.studentProgram.id,
    userId: args.studentProgram.userId,
    program: args.program,
    version: args.version,
    selectedTrack: args.selectedTrack,
    availableTracks: args.tracks,
    status: args.studentProgram.status,
    isLocked: args.studentProgram.isLocked,
    canSelectTrack,
    catalogCourses: args.catalogCourses,
    requirementGroups: sortGroups(
      args.requirementGroups.filter(
        (group) => !group.trackId || group.trackId === args.selectedTrack?.id
      )
    ),
    plannedCourses: args.plannedCourses,
    decisions: evaluation.decisions,
    petitions: args.petitions,
    approvals: args.approvals,
    latestSheet,
  };
}
