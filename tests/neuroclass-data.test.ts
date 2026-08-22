import { describe, expect, it } from "vitest";

import { makeClassroomCode, normalizeAppRole, normalizeQuestions, summarizeSubmissionPerformance } from "../lib/neuroclass-helpers";

describe("NeuroClass mobile data helpers", () => {
  it("normalizes compatible assessment question shapes for the native test runner", () => {
    const questions = normalizeQuestions([
      { id: "q-1", question: "Which layer routes packets?", options: ["Transport", "Network"], marks: 2 },
      { questionText: "Explain encapsulation.", points: 5 },
      { choices: ["Ignored without a prompt"] },
    ]);

    expect(questions).toEqual([
      { id: "q-1", prompt: "Which layer routes packets?", options: ["Transport", "Network"], type: "multiple_choice", marks: 2 },
      { id: "question-2", prompt: "Explain encapsulation.", options: [], type: "text", marks: 5 },
    ]);
  });

  it("creates a compact shareable classroom code with a name-derived prefix", () => {
    const code = makeClassroomCode("Data Structures");
    expect(code).toMatch(/^DS-[A-Z0-9]{5}$/);
  });

  it("returns an empty question set for unsupported input", () => {
    expect(normalizeQuestions({ question: "Not a list" })).toEqual([]);
  });

  it("normalizes the established instructor profile aliases to teacher access", () => {
    expect(normalizeAppRole("Instructor")).toBe("teacher");
    expect(normalizeAppRole("teacher")).toBe("teacher");
    expect(normalizeAppRole("student")).toBe("student");
    expect(normalizeAppRole("guest")).toBeNull();
  });

  it("summarizes only published numeric result percentages without inventing a score", () => {
    const submissions = [
      { id: "a", percentage: 80, student_id: "s", student_name: "Student", test_id: "t", marks_obtained: 8, total_marks: 10, grade: "A", feedback: null, submitted_at: "2026-08-22T00:00:00.000Z", proctoring_violations: [] },
      { id: "b", percentage: null, student_id: "s", student_name: "Student", test_id: "t2", marks_obtained: null, total_marks: null, grade: "Pending", feedback: null, submitted_at: "2026-08-23T00:00:00.000Z", proctoring_violations: [] },
      { id: "c", percentage: 60, student_id: "s", student_name: "Student", test_id: "t3", marks_obtained: 6, total_marks: 10, grade: "B", feedback: null, submitted_at: "2026-08-24T00:00:00.000Z", proctoring_violations: [] },
    ];
    expect(summarizeSubmissionPerformance(submissions)).toMatchObject({ totalAttempts: 3, averagePercentage: 70, highestPercentage: 80 });
  });
});
