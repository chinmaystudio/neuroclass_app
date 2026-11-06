import { neuroClassApi } from "@/lib/neuroclass-api";

/**
 * Tests (the `/api/v1` assessments module) use the same backend and database
 * as the NeuroClass web app: every call goes to the production Vercel API
 * with the signed-in user's Supabase access token, exactly like
 * `frontend/features/lms/api.ts` on the web. The API reads and writes the
 * shared `tests`, `test_questions`, `attempts`, and `attempt_answers` tables
 * in the `hdjtgyvdlxwntfriqhff` Supabase project, so tests created or graded
 * in this app are immediately visible on the web, and vice versa.
 *
 * Field shapes below mirror the backend implementation in
 * `backend/modules/assessments/{domain,repo,teacher,student}.ts`.
 */

export type QuestionType =
  | "mcq"
  | "multiple_select"
  | "true_false"
  | "short_answer"
  | "long_answer"
  | "numerical"
  | "fill_blank"
  | "coding"
  | "file_upload";

export const QUESTION_TYPES: QuestionType[] = [
  "mcq",
  "multiple_select",
  "true_false",
  "short_answer",
  "long_answer",
  "numerical",
  "fill_blank",
  "coding",
  "file_upload",
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Single choice",
  multiple_select: "Multiple choice",
  true_false: "True / False",
  short_answer: "Short answer",
  long_answer: "Long answer",
  numerical: "Numerical",
  fill_blank: "Fill in the blank",
  coding: "Coding",
  file_upload: "File upload",
};

/** Mirrors LANGUAGE_IDS in backend/modules/coding/languages.ts. */
export const CODING_LANGUAGE_IDS = [
  "c",
  "cpp",
  "java",
  "python",
  "javascript",
  "typescript",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
  "kotlin",
  "swift",
] as const;

export const CODING_LANGUAGE_LABELS: Record<string, string> = {
  c: "C",
  cpp: "C++",
  java: "Java",
  python: "Python 3",
  javascript: "JavaScript",
  typescript: "TypeScript",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  kotlin: "Kotlin",
  swift: "Swift",
};

export type TestStatus = "draft" | "published" | "closed" | "archived";
export type TestAvailability = "draft" | "scheduled" | "active" | "ended" | "archived";
export type ExamMode = "standard" | "coding";

export type TestConfig = {
  attemptLimit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  negativeMarking: boolean;
  allowBackNavigation: boolean;
  releaseResultsImmediately: boolean;
  showCorrectAnswers: boolean;
  submissionGraceSeconds: number;
};

export type TestSecurityThresholds = {
  lookAwaySeconds: number;
  headYawDegrees: number;
  headPitchDegrees: number;
  faceAbsentSeconds: number;
  multiFaceSeconds: number;
  cooldownSeconds: number;
};

export type TestSecurity = {
  requireCamera: boolean;
  requireIdentityVerification: boolean;
  livenessCheck: boolean;
  requireFullscreen: boolean;
  tabSwitchDetection: boolean;
  blockClipboard: boolean;
  liveProctoring: boolean;
  identityRecheckSeconds: number;
  proctoringFailurePolicy: "block" | "warn" | "manual_review" | string;
  cameraDisconnectPolicy: "flag" | "pause" | string;
  fullscreenExitPolicy: "flag" | "pause" | string;
  warningEscalationThreshold: number;
  thresholds: TestSecurityThresholds;
  evidenceRetentionDays: number;
};

export const DEFAULT_TEST_CONFIG: TestConfig = {
  attemptLimit: 1,
  shuffleQuestions: false,
  shuffleOptions: false,
  negativeMarking: false,
  allowBackNavigation: true,
  releaseResultsImmediately: false,
  showCorrectAnswers: false,
  submissionGraceSeconds: 20,
};

export const DEFAULT_TEST_SECURITY: TestSecurity = {
  requireCamera: false,
  requireIdentityVerification: false,
  livenessCheck: true,
  requireFullscreen: true,
  tabSwitchDetection: true,
  blockClipboard: true,
  liveProctoring: false,
  identityRecheckSeconds: 180,
  proctoringFailurePolicy: "warn",
  cameraDisconnectPolicy: "flag",
  fullscreenExitPolicy: "flag",
  warningEscalationThreshold: 5,
  thresholds: {
    lookAwaySeconds: 4,
    headYawDegrees: 35,
    headPitchDegrees: 25,
    faceAbsentSeconds: 5,
    multiFaceSeconds: 2,
    cooldownSeconds: 20,
  },
  evidenceRetentionDays: 30,
};

/** Body accepted by POST /tests and (partially) PATCH /tests/:id. */
export type TestMetaInput = {
  title: string;
  subject?: string | null;
  description?: string | null;
  instructions?: string | null;
  durationMinutes: number;
  passingMarks?: number | null;
  examMode: ExamMode;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  config: TestConfig;
  security: TestSecurity;
};

export type TestSummary = {
  id: string;
  classroomId: string;
  title: string;
  subject: string | null;
  description: string | null;
  instructions: string | null;
  status: TestStatus;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  examMode: ExamMode;
  resultsReleased: boolean;
  config: TestConfig;
  security: TestSecurity;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  questionCount?: number;
};

export type TeacherTestListItem = TestSummary & {
  availability: TestAvailability;
  stats: { active: number; submitted: number; pendingReview: number };
};

/** Student list items come from listStudentTests and carry attempt state. */
export type StudentTestListItem = {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  instructions: string | null;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  examMode: ExamMode;
  availability: TestAvailability;
  proctored?: boolean;
  requirements?: { camera: boolean; identity: boolean; fullscreen: boolean };
  attemptLimit?: number;
  attemptsUsed?: number;
  openAttemptId?: string | null;
  canStart?: boolean;
  myStatus?: string;
  result?: { attemptId: string; score: number | null; maxScore: number | null; percentage: number | null } | null;
  lastAttemptId?: string | null;
  submittedAt?: string | null;
};

export type ClassroomTestsPayload =
  | { role: "teacher"; tests: TeacherTestListItem[] }
  | { role: "student"; tests: StudentTestListItem[] };

export type QuestionOption = { id?: string; text: string; isCorrect: boolean };

export type QuestionTestCase = {
  id?: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
};

export type CodingQuestionConfig = {
  languages: string[];
  starterCode: Record<string, string>;
  timeLimitMs: number;
  memoryLimitMb: number;
};

/** One question as sent to PUT /tests/:id/questions. */
export type QuestionInput = {
  id?: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[];
  marks: number;
  negativeMarks: number;
  explanation?: string | null;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  numericAnswer?: number | null;
  numericTolerance?: number;
  partialCredit?: boolean;
  modelAnswer?: string | null;
  coding?: CodingQuestionConfig | null;
  testCases?: QuestionTestCase[];
};

/** One question as returned to teachers (options carry stored ids). */
export type EditableQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  marks: number;
  negativeMarks: number;
  explanation: string | null;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  numericAnswer: number | null;
  numericTolerance: number;
  partialCredit: boolean;
  modelAnswer: string | null;
  coding: CodingQuestionConfig | null;
  testCases: QuestionTestCase[];
};

export type TeacherTestDetail = TestSummary & {
  availability: TestAvailability;
  attemptCount: number;
  questionsLocked: boolean;
  questions: EditableQuestion[];
};

/* ------------------------------- Results ------------------------------- */

export type TestResultsMetrics = {
  enrolled: number;
  started: number;
  submitted: number;
  inProgress: number;
  pendingManualReview: number;
  average: number;
  median: number;
  highest: number;
  passRate: number | null;
};

export type TestResultAttempt = {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  startedAt: string | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
  integrityScore: number | null;
  riskLevel: string | null;
  warningCount: number | null;
  identityStatus: string | null;
  attemptNumber: number | null;
  submissionSource: string | null;
  student: { id: string | null; name: string; email: string | null; rollNumber: string | null };
};

export type PerQuestionStat = {
  questionId: string;
  position: number;
  prompt: string;
  type: QuestionType;
  marks: number;
  answeredCount: number;
  averageMarks: number;
  averagePercent: number;
};

export type TestResults = {
  test: TestSummary & { availability: TestAvailability };
  metrics: TestResultsMetrics;
  attempts: TestResultAttempt[];
  perQuestion: PerQuestionStat[];
};

/* --------------------------- Attempt review ---------------------------- */

export type AttemptAnswerReview = {
  response: unknown;
  autoScore: number | null;
  manualScore: number | null;
  awardedMarks: number | null;
  needsManualReview: boolean;
  feedback: string | null;
  evaluation: unknown;
  savedAt: string | null;
};

export type ReviewQuestion = EditableQuestion & { answer: AttemptAnswerReview | null };

export type AttemptReview = {
  attempt: {
    id: string;
    status: string;
    score: number | null;
    maxScore: number | null;
    percentage: number | null;
    startedAt: string | null;
    expiresAt: string | null;
    submittedAt: string | null;
    evaluatedAt: string | null;
    integrityScore: number | null;
    riskLevel: string | null;
    warningCount: number | null;
    identityStatus: string | null;
    submissionSource: string | null;
  };
  // Raw `students` row from the backend: roll number is snake_case here.
  student: { id: string; name: string; email: string | null; roll_number?: string | null; rollNumber?: string | null } | null;
  test: TestSummary;
  questions: ReviewQuestion[];
  proctoring?: {
    events?: unknown[];
    integrityScore?: number | null;
    riskLevel?: string | null;
  } | null;
  appeals?: unknown[];
};

export type GradeEntry = { questionId: string; manualScore: number | null; feedback?: string | null };

export type GradeOutcome = { score: number; max: number; percentage: number; pendingManual: boolean; status: string };

/* ------------------------------ AI generate ---------------------------- */

export type GenerateTestInput = {
  topic: string;
  subject: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Adaptive";
  questionCount: number;
  durationMins: number;
  totalMarks: number;
  instructions?: string;
};

/* ------------------------------- Client -------------------------------- */

export async function listClassroomTests(classroomId: string): Promise<ClassroomTestsPayload> {
  return neuroClassApi<ClassroomTestsPayload>(`/api/v1/classrooms/${classroomId}/tests`);
}

export async function createTest(classroomId: string, meta: TestMetaInput): Promise<TestSummary> {
  return neuroClassApi<TestSummary>(`/api/v1/classrooms/${classroomId}/tests`, {
    method: "POST",
    body: { ...meta },
  });
}

export async function getTeacherTest(testId: string): Promise<TeacherTestDetail> {
  return neuroClassApi<TeacherTestDetail>(`/api/v1/tests/${testId}`);
}

export async function updateTestMeta(testId: string, meta: Partial<TestMetaInput>): Promise<TestSummary> {
  return neuroClassApi<TestSummary>(`/api/v1/tests/${testId}`, {
    method: "PATCH",
    body: { ...meta },
  });
}

export async function replaceTestQuestions(testId: string, questions: QuestionInput[]): Promise<TeacherTestDetail> {
  // The endpoint expects a raw JSON array, not an object wrapper.
  return neuroClassApi<TeacherTestDetail>(`/api/v1/tests/${testId}/questions`, {
    method: "PUT",
    body: questions as unknown as Record<string, unknown>,
  });
}

export async function publishTest(
  testId: string,
  schedule: { scheduledStart?: string | null; scheduledEnd?: string | null } = {},
): Promise<TestSummary & { availability: TestAvailability }> {
  return neuroClassApi(`/api/v1/tests/${testId}/publish`, { method: "POST", body: { ...schedule } });
}

export async function unpublishTest(testId: string): Promise<TestSummary> {
  return neuroClassApi(`/api/v1/tests/${testId}/unpublish`, { method: "POST", body: {} });
}

export async function closeTest(testId: string): Promise<TestSummary> {
  return neuroClassApi(`/api/v1/tests/${testId}/close`, { method: "POST", body: {} });
}

export async function reopenTest(testId: string): Promise<TestSummary> {
  return neuroClassApi(`/api/v1/tests/${testId}/reopen`, { method: "POST", body: {} });
}

export async function archiveTest(testId: string): Promise<TestSummary> {
  return neuroClassApi(`/api/v1/tests/${testId}/archive`, { method: "POST", body: {} });
}

export async function duplicateTest(testId: string, classroomId?: string): Promise<TeacherTestDetail> {
  return neuroClassApi<TeacherTestDetail>(`/api/v1/tests/${testId}/duplicate`, {
    method: "POST",
    body: classroomId ? { classroomId } : {},
  });
}

export async function deleteTest(testId: string): Promise<{ deleted: boolean }> {
  return neuroClassApi(`/api/v1/tests/${testId}`, { method: "DELETE" });
}

export async function getTestResults(testId: string): Promise<TestResults> {
  return neuroClassApi<TestResults>(`/api/v1/tests/${testId}/results`);
}

export async function releaseTestResults(testId: string, released: boolean): Promise<{ released: boolean }> {
  return neuroClassApi(`/api/v1/tests/${testId}/release-results`, { method: "POST", body: { released } });
}

export async function getAttemptReview(attemptId: string): Promise<AttemptReview> {
  return neuroClassApi<AttemptReview>(`/api/v1/attempts/${attemptId}/review`);
}

export async function gradeAttempt(attemptId: string, grades: GradeEntry[], finalize: boolean): Promise<GradeOutcome> {
  return neuroClassApi<GradeOutcome>(`/api/v1/attempts/${attemptId}/grade`, {
    method: "POST",
    body: { grades, finalize },
  });
}

export async function generateTestWithAi(input: GenerateTestInput): Promise<{ success: boolean; test: unknown }> {
  return neuroClassApi<{ success: boolean; test: unknown }>(`/api/ai/generate-test`, {
    method: "POST",
    body: { ...input },
  });
}

/* ------------------------- AI output mapping --------------------------- */

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as LooseRecord) : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function asMarks(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Maps the AI generator's loose output ({ text, type: "mcq"|"short-answer",
 * options: string[], correctAnswer }) into editor-ready QuestionInput items.
 * Anything that cannot satisfy the server validation rules is downgraded to
 * a long-answer question (or skipped when it has no prompt at all).
 */
export function mapGeneratedQuestions(generatedTest: unknown): QuestionInput[] {
  const test = asRecord(generatedTest);
  const rawQuestions = Array.isArray(test?.questions) ? test.questions : Array.isArray(generatedTest) ? generatedTest : [];
  const mapped: QuestionInput[] = [];

  for (const raw of rawQuestions) {
    const q = asRecord(raw);
    if (!q) continue;
    const prompt = asText(q.prompt ?? q.text ?? q.question ?? q.questionText).trim();
    if (!prompt) continue;
    const marks = asMarks(q.marks ?? q.points, 1);
    const explanation = asText(q.explanation).trim() || null;
    const correctAnswer = asText(q.correctAnswer ?? q.answer ?? q.correct_answer).trim();
    const rawType = asText(q.type).toLowerCase().replace(/[\s-]+/g, "_");
    const base: QuestionInput = {
      type: "long_answer",
      prompt,
      options: [],
      marks,
      negativeMarks: 0,
      explanation,
      modelAnswer: correctAnswer || null,
    };

    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const optionTexts = rawOptions
      .map((option) => {
        const record = asRecord(option);
        return asText(record ? (record.text ?? record.label) : option).trim();
      })
      .filter(Boolean);

    if ((rawType === "mcq" || rawType === "multiple_choice" || rawType === "single_choice") && optionTexts.length >= 2) {
      const correctIndexRaw = Number(q.correctIndex ?? q.correct_answer_index);
      const options = optionTexts.slice(0, 12).map((text, index) => {
        const record = asRecord(rawOptions[index]);
        const flagged = Boolean(record?.isCorrect ?? record?.correct);
        return {
          text,
          isCorrect: flagged || text === correctAnswer || (Number.isInteger(correctIndexRaw) && index === correctIndexRaw),
        };
      });
      // Keep only the first correct option so the question stays a valid MCQ.
      let seenCorrect = false;
      for (const option of options) {
        if (option.isCorrect && seenCorrect) option.isCorrect = false;
        if (option.isCorrect) seenCorrect = true;
      }
      if (!options.some((option) => option.isCorrect)) options[0].isCorrect = true;
      mapped.push({ ...base, type: "mcq", options, modelAnswer: null });
      continue;
    }
    if (rawType === "multiple_select" && optionTexts.length >= 2) {
      const options = optionTexts.slice(0, 12).map((text) => ({ text, isCorrect: text === correctAnswer }));
      if (options.some((option) => option.isCorrect)) {
        mapped.push({ ...base, type: "multiple_select", options, modelAnswer: null });
        continue;
      }
    }
    if (rawType === "true_false") {
      mapped.push({
        ...base,
        type: "true_false",
        options: [
          { text: "True", isCorrect: correctAnswer.toLowerCase() !== "false" },
          { text: "False", isCorrect: correctAnswer.toLowerCase() === "false" },
        ],
        modelAnswer: null,
      });
      continue;
    }
    if (rawType === "numerical" && correctAnswer && Number.isFinite(Number(correctAnswer))) {
      mapped.push({ ...base, type: "numerical", numericAnswer: Number(correctAnswer), numericTolerance: 0, modelAnswer: null });
      continue;
    }
    if ((rawType === "short_answer" || rawType === "fill_blank") && correctAnswer && correctAnswer.length <= 200) {
      mapped.push({ ...base, type: "short_answer", acceptedAnswers: [correctAnswer], caseSensitive: false });
      continue;
    }
    mapped.push(base);
  }
  return mapped;
}

/** Mirrors the server-side question rules so teachers see errors before saving. */
export function validateQuestion(question: QuestionInput, index: number): string | null {
  const label = `Question ${index + 1}`;
  if (!question.prompt.trim()) return `${label}: add a question prompt.`;
  if (question.marks < 0) return `${label}: marks cannot be negative.`;
  if (question.negativeMarks > question.marks) return `${label}: negative marks cannot exceed the question marks.`;
  const correct = question.options.filter((option) => option.isCorrect).length;
  if (question.type === "mcq" || question.type === "multiple_select") {
    if (question.options.length < 2) return `${label}: add at least two options.`;
    if (question.options.some((option) => !option.text.trim())) return `${label}: every option needs text.`;
    if (correct < 1) return `${label}: mark at least one correct option.`;
    if (question.type === "mcq" && correct > 1) return `${label}: a single-choice question can only have one correct option.`;
  }
  if (question.type === "true_false" && correct !== 1) return `${label}: choose whether the statement is true or false.`;
  if (question.type === "numerical" && (question.numericAnswer === undefined || question.numericAnswer === null || !Number.isFinite(question.numericAnswer))) {
    return `${label}: enter the correct numerical answer.`;
  }
  if ((question.type === "short_answer" || question.type === "fill_blank") && !(question.acceptedAnswers ?? []).some((answer) => answer.trim())) {
    return `${label}: add at least one accepted answer.`;
  }
  if (question.type === "coding") {
    if (!question.coding || question.coding.languages.length === 0) return `${label}: choose at least one programming language.`;
    if (!(question.testCases ?? []).length) return `${label}: add at least one test case.`;
  }
  return null;
}
