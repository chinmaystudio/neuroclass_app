import type { AssessmentQuestion, AssessmentSubmission, StudentPerformance } from "./neuroclass-types";

export function normalizeAppRole(value: unknown): "teacher" | "student" | null {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["teacher", "instructor", "educator", "admin", "administrator"].includes(role)) return "teacher";
  if (["student", "learner", "pupil"].includes(role)) return "student";
  return null;
}

function compactCode(value: string): string {
  return value.replace(/[^A-Z0-9]/g, "").slice(0, 5) || "CLASS";
}

export function makeClassroomCode(name: string): string {
  const prefix = compactCode(name.toUpperCase().split(/\s+/).map((word) => word[0]).join(""));
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function normalizeQuestions(raw: unknown): AssessmentQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const candidate = (item ?? {}) as Record<string, unknown>;
      const optionsValue = candidate.options ?? candidate.choices;
      const options = Array.isArray(optionsValue)
        ? optionsValue.map((option) => String(typeof option === "object" && option ? (option as Record<string, unknown>).text ?? (option as Record<string, unknown>).label ?? option : option)).filter(Boolean)
        : [];
      const prompt = String(candidate.question ?? candidate.questionText ?? candidate.prompt ?? candidate.text ?? "").trim();
      if (!prompt) return null;
      return {
        id: String(candidate.id ?? candidate.questionId ?? `question-${index + 1}`),
        prompt,
        options,
        type: options.length > 0 ? "multiple_choice" : "text",
        marks: Number(candidate.marks ?? candidate.points ?? 1) || 1,
      } satisfies AssessmentQuestion;
    })
    .filter((question): question is AssessmentQuestion => question !== null);
}

export function summarizeSubmissionPerformance(completedSubmissions: AssessmentSubmission[]): StudentPerformance {
  const scored = completedSubmissions.filter((item) => typeof item.percentage === "number");
  return {
    totalAttempts: completedSubmissions.length,
    averagePercentage: scored.length ? Math.round(scored.reduce((total, item) => total + (item.percentage ?? 0), 0) / scored.length) : null,
    highestPercentage: scored.length ? Math.max(...scored.map((item) => item.percentage ?? 0)) : null,
    completedSubmissions,
  };
}
