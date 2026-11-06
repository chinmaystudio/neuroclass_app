import { neuroClassApi } from "@/lib/neuroclass-api";
import { supabase } from "@/lib/supabase";
import type { Assignment, AssignmentSubmission } from "@/lib/neuroclass-types";

/**
 * AI tutor + teacher assignment management for the NeuroClass mobile app.
 *
 * Everything here talks to the same backend and database as the web app:
 *  - The AI tutor is `POST /api/ai/classroom-answer` on the production
 *    Vercel API (the same endpoint the web `ClassroomLearningBot` uses).
 *    Conversation history lives in the shared Supabase tables
 *    `learning_threads` / `learning_messages`, which this file reads
 *    directly under RLS, like the rest of the app reads shared tables.
 *  - Assignment creation, status changes and grading are the teacher
 *    `/api/v1` routes from `backend/modules/assignments/service.ts` on the
 *    web repo, so work created or graded here is immediately visible on
 *    the web, and vice versa.
 */

/* ------------------------------ AI tutor ------------------------------ */

export type TutorAnswer = {
  answer: string;
  citations?: unknown;
  confidence?: number | null;
  answerState?: string | null;
  followUp?: string | null;
};

export type TutorAnswerResponse = {
  success: boolean;
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
  answer: TutorAnswer;
  sources: string[];
};

export type TutorThread = {
  id: string;
  classroomId: string;
  title: string | null;
  createdAt: string;
};

export type TutorMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  /** Material names / citation labels attached to an assistant answer. */
  citations: string[];
  confidence: number | null;
  createdAt: string;
};

/** Ask the classroom AI tutor a question. Pass the current threadId (when
 *  known) so follow-up questions stay in the same learning thread. */
export async function askClassroomTutor(
  classroomId: string,
  question: string,
  threadId?: string | null,
): Promise<TutorAnswerResponse> {
  return neuroClassApi<TutorAnswerResponse>("/api/ai/classroom-answer", {
    method: "POST",
    body: threadId ? { classroomId, question, threadId } : { classroomId, question },
  });
}

function normalizeCitations(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const label = record.name ?? record.title ?? record.source ?? record.material;
          return typeof label === "string" ? label : null;
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }
  if (typeof raw === "string") return [raw];
  return [];
}

type LearningThreadRow = {
  id: string;
  classroom_id: string;
  title: string | null;
  created_at: string;
};

type LearningMessageRow = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  citations: unknown;
  confidence: number | null;
  created_at: string;
};

/**
 * Load the signed-in user's latest tutor thread for a classroom, plus its
 * messages, straight from the shared Supabase tables. This never throws:
 * if the tables are not readable under RLS the caller simply gets an empty
 * history and the chat still works for new questions.
 */
export async function loadTutorHistory(
  classroomId: string,
  userId: string,
): Promise<{ thread: TutorThread | null; messages: TutorMessage[] }> {
  try {
    const { data: threadRows, error: threadError } = await supabase
      .from("learning_threads")
      .select("id,classroom_id,title,created_at")
      .eq("classroom_id", classroomId)
      .eq("student_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (threadError || !threadRows || threadRows.length === 0) return { thread: null, messages: [] };

    const row = threadRows[0] as LearningThreadRow;
    const thread: TutorThread = { id: row.id, classroomId: row.classroom_id, title: row.title, createdAt: row.created_at };

    const { data: messageRows, error: messageError } = await supabase
      .from("learning_messages")
      .select("id,thread_id,role,content,citations,confidence,created_at")
      .eq("thread_id", row.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (messageError || !messageRows) return { thread, messages: [] };

    const messages = (messageRows as LearningMessageRow[])
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        id: message.id,
        threadId: message.thread_id,
        role: message.role as "user" | "assistant",
        content: message.content,
        citations: normalizeCitations(message.citations),
        confidence: typeof message.confidence === "number" ? message.confidence : null,
        createdAt: message.created_at,
      }));
    return { thread, messages };
  } catch {
    return { thread: null, messages: [] };
  }
}

/* --------------------- Assignment create / status --------------------- */

/** Mirrors `latePolicySchema` in backend/modules/assignments/service.ts. */
export type LatePolicy = {
  allowLate: boolean;
  /** 0..100, deducted per late day. */
  penaltyPercentPerDay: number;
  /** 0..60; 0 means no cap beyond allowLate. */
  maxLateDays: number;
};

/** Mirrors the `assignmentType` enum in `assignmentSchema`. */
export type AssignmentTypeId = "text" | "file" | "document" | "coding" | "mixed";

export const ASSIGNMENT_TYPES: { id: AssignmentTypeId; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "file", label: "File upload" },
  { id: "document", label: "Document" },
  { id: "coding", label: "Coding" },
  { id: "mixed", label: "Mixed" },
];

/** Mirrors SUPPORTED_EXTENSIONS in backend/modules/core/storage.ts. */
export const SUPPORTED_FILE_EXTENSIONS = [
  "pdf", "png", "jpg", "jpeg", "webp", "zip", "docx", "pptx", "xlsx",
  "txt", "md", "csv", "py", "js", "ts", "java", "c", "cpp", "ipynb",
] as const;

/** Mirrors LANGUAGE_IDS in backend/modules/coding/languages.ts. */
export const CODING_LANGUAGE_IDS = [
  "c", "cpp", "java", "python", "javascript", "typescript", "csharp", "go", "rust", "php", "ruby", "kotlin", "swift",
] as const;

/**
 * Mirrors `assignmentSchema` in backend/modules/assignments/service.ts.
 * `coding` is required by the server (superRefine) whenever the type is
 * "coding" or "mixed"; for other types it may be omitted entirely.
 */
export type CreateAssignmentInput = {
  title: string;
  description?: string | null;
  instructions?: string | null;
  assignmentType: AssignmentTypeId;
  availableFrom?: string | null;
  dueAt?: string | null;
  totalMarks: number;
  latePolicy: LatePolicy;
  acceptedFileTypes: string[];
  maxFileSizeMb: number;
  maxFiles: number;
  allowResubmission: boolean;
  coding?: {
    languages: string[];
    starterCode?: Record<string, string>;
    timeLimitMs?: number;
    memoryLimitMb?: number;
  } | null;
};

/** POST /api/v1/classrooms/:classroomId/assignments — creates a draft. */
export async function createAssignment(
  classroomId: string,
  input: CreateAssignmentInput,
): Promise<Assignment & { role?: string }> {
  const body: Record<string, unknown> = {
    title: input.title,
    description: input.description ?? null,
    instructions: input.instructions ?? null,
    assignmentType: input.assignmentType,
    availableFrom: input.availableFrom ?? null,
    dueAt: input.dueAt ?? null,
    totalMarks: input.totalMarks,
    latePolicy: input.latePolicy,
    acceptedFileTypes: input.acceptedFileTypes,
    maxFileSizeMb: input.maxFileSizeMb,
    maxFiles: input.maxFiles,
    allowResubmission: input.allowResubmission,
  };
  if (input.coding) {
    body.coding = {
      languages: input.coding.languages,
      starterCode: input.coding.starterCode ?? {},
      timeLimitMs: input.coding.timeLimitMs ?? 3000,
      memoryLimitMb: input.coding.memoryLimitMb ?? 256,
    };
  }
  return neuroClassApi<Assignment & { role?: string }>(`/api/v1/classrooms/${classroomId}/assignments`, {
    method: "POST",
    body,
  });
}

export type AssignmentStatusAction = "publish" | "unpublish" | "close" | "reopen" | "archive";

/** POST /api/v1/assignments/:assignmentId/<action> with an empty body. */
export async function setAssignmentStatus(
  assignmentId: string,
  action: AssignmentStatusAction,
): Promise<Assignment & { role?: string }> {
  return neuroClassApi<Assignment & { role?: string }>(`/api/v1/assignments/${assignmentId}/${action}`, {
    method: "POST",
    body: {},
  });
}

export async function publishAssignment(assignmentId: string): Promise<Assignment & { role?: string }> {
  return setAssignmentStatus(assignmentId, "publish");
}

/* ------------------------------- Grading ------------------------------ */

export type GradeSubmissionInput = {
  /** 0..assignment totalMarks (the server rejects anything above it). */
  score: number;
  feedback?: string | null;
  /** Always true from this app: grading returns the work to the student. */
  returnToStudent: true;
  waiveLatePenalty?: boolean;
};

/** POST /api/v1/submissions/:submissionId/grade — returns the updated submission. */
export async function gradeSubmission(
  submissionId: string,
  input: GradeSubmissionInput,
): Promise<AssignmentSubmission> {
  return neuroClassApi<AssignmentSubmission>(`/api/v1/submissions/${submissionId}/grade`, {
    method: "POST",
    body: {
      score: input.score,
      feedback: input.feedback ?? null,
      returnToStudent: true,
      waiveLatePenalty: Boolean(input.waiveLatePenalty),
    },
  });
}
