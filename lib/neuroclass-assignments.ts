import { neuroClassApi } from "@/lib/neuroclass-api";
import type { Assignment, AssignmentSubmission } from "@/lib/neuroclass-types";

/**
 * Assignments use the same backend and database as the NeuroClass web app:
 * every call goes to the production Vercel API (`/api/v1/...`) with the
 * signed-in user's Supabase access token, exactly like
 * `frontend/features/lms/api.ts` on the web. The API reads and writes the
 * shared `assignments`, `assignment_submissions`, and related tables in the
 * `hdjtgyvdlxwntfriqhff` Supabase project, so work done in this app is
 * immediately visible on the web, and vice versa.
 */

export async function listAssignments(classroomId: string): Promise<Assignment[]> {
  const payload = await neuroClassApi<{ assignments: Assignment[] }>(
    `/api/v1/classrooms/${classroomId}/assignments`,
  );
  return payload.assignments ?? [];
}

export async function getAssignment(assignmentId: string): Promise<Assignment & { role?: string }> {
  return neuroClassApi<Assignment & { role?: string }>(`/api/v1/assignments/${assignmentId}`);
}

export async function getMySubmission(
  assignmentId: string,
): Promise<{ submission: AssignmentSubmission | null; assignment: Assignment }> {
  return neuroClassApi<{ submission: AssignmentSubmission | null; assignment: Assignment }>(
    `/api/v1/assignments/${assignmentId}/my-submission`,
  );
}

export async function saveAssignmentDraft(
  assignmentId: string,
  textResponse: string,
): Promise<{ savedAt: string }> {
  return neuroClassApi<{ savedAt: string }>(`/api/v1/assignments/${assignmentId}/my-submission`, {
    method: "PUT",
    body: { textResponse },
  });
}

export async function submitAssignment(assignmentId: string): Promise<{ alreadySubmitted?: boolean }> {
  return neuroClassApi<{ alreadySubmitted?: boolean }>(
    `/api/v1/assignments/${assignmentId}/my-submission/submit`,
    { method: "POST", body: {} },
  );
}

export async function listAssignmentSubmissions(
  assignmentId: string,
): Promise<{
  assignment: Assignment;
  students: {
    student: { id: string; name: string; email: string | null; rollNumber: string | null };
    submission: AssignmentSubmission | null;
  }[];
}> {
  return neuroClassApi(`/api/v1/assignments/${assignmentId}/submissions`);
}
