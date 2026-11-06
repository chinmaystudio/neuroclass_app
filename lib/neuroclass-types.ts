export type AppRole = "teacher" | "student";

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  mobileNumber: string | null;
  role: AppRole | null;
};

export type Classroom = {
  id: string;
  name: string;
  code: string;
  subject: string | null;
  user_id: string;
  students: number | null;
  attendance: string | null;
  status: string | null;
  created_at: string;
};

export type StudentRecord = {
  id: string;
  classroom_id: string | null;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  roll_number: string | null;
  face_registration_status: string | null;
};

export type AssessmentQuestion = {
  id: string;
  prompt: string;
  options: string[];
  type: "multiple_choice" | "text";
  marks: number;
};

export type Assessment = {
  id: string;
  classroom_id: string | null;
  title: string;
  subject: string | null;
  duration_mins: number | null;
  total_marks: number | null;
  questions: unknown;
  proctoring_enabled: boolean | null;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
};

export type AttendanceSession = {
  id: string;
  classroom_id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

export type AttendanceRecord = {
  id: string;
  classroom_id: string | null;
  session_id: string | null;
  student_id: string;
  student_name: string;
  status: string | null;
  verified_at: string;
  verified_method: string | null;
};

export type ClassroomOverview = {
  classroom: Classroom;
  roster: StudentRecord[];
  assessments: Assessment[];
  sessions: AttendanceSession[];
  attendance: AttendanceRecord[];
  studentRecord: StudentRecord | null;
};

export type ClassroomMaterial = {
  id: string;
  classroom_id: string;
  name: string;
  mime_type: string;
  extraction_status: "ready" | "pending" | "failed" | string;
  size_bytes: number;
  chunk_count: number;
  created_at: string;
  processed_at: string | null;
  extraction_error?: string | null;
};

export type AssessmentSubmission = {
  id: string;
  test_id: string | null;
  student_id: string;
  student_name: string;
  marks_obtained: number | null;
  total_marks: number | null;
  percentage: number | null;
  grade: string | null;
  feedback: string | null;
  submitted_at: string;
  proctoring_violations: unknown;
};

export type StudentPerformance = {
  totalAttempts: number;
  averagePercentage: number | null;
  highestPercentage: number | null;
  completedSubmissions: AssessmentSubmission[];
};


export type Assignment = {
  id: string;
  classroomId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  assignmentType: "text" | "file" | "document" | "coding" | "mixed" | string;
  status: string;
  availableFrom: string | null;
  dueAt: string | null;
  totalMarks: number;
  allowResubmission: boolean;
  // Present on the student list response from /api/v1
  myStatus?: string | null;
  mySubmission?: { status: string; submittedAt: string | null; isLate: boolean; finalScore: number | null } | null;
  // Present on the teacher list response from /api/v1
  stats?: { enrolled: number; submitted: number; late: number; evaluated: number; pending: number } | null;
};

export type AssignmentSubmission = {
  id: string;
  status: string;
  textResponse: string | null;
  code: { language: string; source: string } | null;
  submittedAt: string | null;
  isLate: boolean;
  revision: number;
  updatedAt: string;
  files: { id: string; name: string; mime: string; size: number; createdAt: string }[];
  finalScore?: number | null;
  feedback?: string | null;
};
