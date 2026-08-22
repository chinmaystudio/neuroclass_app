import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { makeClassroomCode, normalizeAppRole, summarizeSubmissionPerformance } from "./neuroclass-helpers";
export { formatDate, formatDateTime, makeClassroomCode, normalizeAppRole, normalizeQuestions } from "./neuroclass-helpers";
import type {
  AppRole,
  Assessment,
  AttendanceRecord,
  AttendanceSession,
  Classroom,
  ClassroomOverview,
  StudentRecord,
  AssessmentSubmission,
  StudentPerformance,
} from "@/lib/neuroclass-types";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getRoleForUser(user: User): Promise<AppRole | null> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("uid", user.id)
    .maybeSingle();
  const resolvedProfileRole = !profileError ? normalizeAppRole(profile?.role) : null;
  if (resolvedProfileRole) {
    return resolvedProfileRole;
  }

  const { data: ownedClassroom, error: ownerError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!ownerError && ownedClassroom) {
    return "teacher";
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!studentError && student) return "student";
  return null;
}

export async function listClassrooms(userId: string, role: AppRole): Promise<Classroom[]> {
  if (role === "teacher") {
    const { data, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    throwIfError(error);
    return (data ?? []) as Classroom[];
  }

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("students")
    .select("classroom_id")
    .eq("user_id", userId);
  throwIfError(enrollmentError);
  const classroomIds = (enrollments ?? []).map((enrollment) => enrollment.classroom_id).filter(Boolean) as string[];
  if (classroomIds.length === 0) return [];
  const { data, error } = await supabase
    .from("classrooms")
    .select("*")
    .in("id", classroomIds)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as Classroom[];
}

export async function getClassroom(classroomId: string): Promise<Classroom> {
  const { data, error } = await supabase.from("classrooms").select("*").eq("id", classroomId).single();
  throwIfError(error);
  return data as Classroom;
}

export async function getStudentRecord(userId: string, classroomId: string): Promise<StudentRecord | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id,classroom_id,user_id,name,email,phone,roll_number,face_registration_status")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  return (data as StudentRecord | null) ?? null;
}

export async function getClassroomOverview(classroomId: string, userId: string, role: AppRole): Promise<ClassroomOverview> {
  const classroom = await getClassroom(classroomId);
  const [rosterResult, testsResult, sessionsResult, studentRecord] = await Promise.all([
    supabase.from("students").select("id,classroom_id,user_id,name,email,phone,roll_number,face_registration_status").eq("classroom_id", classroomId).order("name"),
    supabase.from("tests").select("*").eq("classroom_id", classroomId).order("created_at", { ascending: false }),
    supabase.from("attendance_sessions").select("id,classroom_id,title,status,starts_at,ends_at,created_at").eq("classroom_id", classroomId).order("created_at", { ascending: false }).limit(12),
    role === "student" ? getStudentRecord(userId, classroomId) : Promise.resolve(null),
  ]);
  throwIfError(rosterResult.error);
  throwIfError(testsResult.error);
  throwIfError(sessionsResult.error);

  const attendanceQuery = supabase
    .from("attendance")
    .select("id,classroom_id,session_id,student_id,student_name,status,verified_at,verified_method")
    .eq("classroom_id", classroomId)
    .order("verified_at", { ascending: false })
    .limit(30);
  const attendanceResult = role === "student" && studentRecord
    ? await attendanceQuery.eq("student_id", studentRecord.id)
    : await attendanceQuery;
  throwIfError(attendanceResult.error);

  return {
    classroom,
    roster: (rosterResult.data ?? []) as StudentRecord[],
    assessments: (testsResult.data ?? []) as Assessment[],
    sessions: (sessionsResult.data ?? []) as AttendanceSession[],
    attendance: (attendanceResult.data ?? []) as AttendanceRecord[],
    studentRecord,
  };
}

export async function createClassroom(input: { name: string; subject: string; userId: string }): Promise<Classroom> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter a classroom name with at least two characters.");
  const { data, error } = await supabase
    .from("classrooms")
    .insert({
      name,
      subject: input.subject.trim() || "General Studies",
      code: makeClassroomCode(name),
      user_id: input.userId,
      status: "Active",
      students: 0,
      attendance: "0%",
    })
    .select("*")
    .single();
  throwIfError(error);
  return data as Classroom;
}

export async function joinClassroom(input: { code: string; userId: string; name: string; email: string; phone?: string }): Promise<Classroom> {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Enter the classroom code shared by your instructor.");
  const { data: classroom, error: classError } = await supabase
    .from("classrooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  throwIfError(classError);
  if (!classroom) throw new Error("We could not find a classroom for that code.");

  const { error: joinError } = await supabase.from("students").upsert(
    {
      classroom_id: classroom.id,
      user_id: input.userId,
      name: input.name.trim() || "NeuroClass student",
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
    },
    { onConflict: "classroom_id,email" },
  );
  throwIfError(joinError);
  return classroom as Classroom;
}

export async function getAssessment(assessmentId: string): Promise<Assessment> {
  const { data, error } = await supabase.from("tests").select("*").eq("id", assessmentId).single();
  throwIfError(error);
  return data as Assessment;
}

export async function getInProgressAttempt(testId: string, studentId: string) {
  const { data, error } = await supabase
    .from("attempts")
    .select("id,answers,status,started_at")
    .eq("test_id", testId)
    .eq("student_id", studentId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return data as { id: string; answers: unknown; status: string; started_at: string } | null;
}

export async function createAttempt(testId: string, studentId: string) {
  const { data, error } = await supabase
    .from("attempts")
    .insert({ test_id: testId, student_id: studentId, status: "in_progress", answers: {}, violations: [] })
    .select("id,answers,status,started_at")
    .single();
  throwIfError(error);
  return data as { id: string; answers: unknown; status: string; started_at: string };
}

export async function saveAttemptAnswers(attemptId: string, answers: Record<string, string>) {
  const { error } = await supabase.from("attempts").update({ answers }).eq("id", attemptId).eq("status", "in_progress");
  throwIfError(error);
}

export async function submitAttempt(input: {
  attemptId: string;
  testId: string;
  student: StudentRecord;
  answers: Record<string, string>;
  totalMarks: number;
}) {
  const submittedAt = new Date().toISOString();
  const { error: attemptError } = await supabase
    .from("attempts")
    .update({ answers: input.answers, status: "submitted", submitted_at: submittedAt, finished_at: submittedAt })
    .eq("id", input.attemptId)
    .eq("status", "in_progress");
  throwIfError(attemptError);

  const { error: submissionError } = await supabase.from("test_submissions").insert({
    test_id: input.testId,
    student_id: input.student.id,
    student_name: input.student.name,
    answers: input.answers,
    total_marks: input.totalMarks,
    marks_obtained: 0,
    percentage: 0,
    grade: "Pending review",
    feedback: "Answers submitted from NeuroClass Mobile. Instructor review is pending.",
    proctoring_violations: [],
  });
  throwIfError(submissionError);
}

export async function listStudentSubmissions(userId: string): Promise<AssessmentSubmission[]> {
  const { data: enrollments, error: enrollmentError } = await supabase.from("students").select("id").eq("user_id", userId);
  throwIfError(enrollmentError);
  const studentIds = (enrollments ?? []).map((student) => student.id);
  if (!studentIds.length) return [];
  const { data, error } = await supabase
    .from("test_submissions")
    .select("id,test_id,student_id,student_name,marks_obtained,total_marks,percentage,grade,feedback,submitted_at,proctoring_violations")
    .in("student_id", studentIds)
    .order("submitted_at", { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []) as AssessmentSubmission[];
}

export async function getStudentPerformance(userId: string): Promise<StudentPerformance> {
  const completedSubmissions = await listStudentSubmissions(userId);
  return summarizeSubmissionPerformance(completedSubmissions);
}
