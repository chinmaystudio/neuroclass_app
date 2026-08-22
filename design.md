# NeuroClass Mobile Design Plan

## Product Direction

NeuroClass Mobile is a portrait-first academic companion for the existing NeuroClass ecosystem. It uses the shared Supabase account and records, with one-handed flows for classes, assessments, attendance, learning materials, and profile settings. The app follows mainstream iOS conventions: safe-area-aware layouts, large touch targets, concise navigation, native-feeling sheets, clear loading states, and restrained haptic feedback.

## Screen List

| Screen | Primary content and functionality |
|---|---|
| Welcome and sign in | Email/password sign-in, account creation, password recovery, and a teacher/student selector that is treated only as a registration preference. |
| Home | Role-aware summary of classrooms, active assessments, attendance status, recent results, learning help, and next actions. |
| Classes | Teacher-owned classrooms or student enrollments, search, class creation for teachers, and class-code joining for students. |
| Classroom detail | Class metadata, roster or enrollment state, assessments, materials, attendance summary, analytics, and role-specific actions. |
| Assessment detail | Test instructions, duration, marks, availability, attempt status, and start/resume action. |
| Test runner | One question at a time, progress, answer selection or text entry, locally persisted draft answers, review state, and submission. |
| Attendance | Student attendance history and PIN verification, plus teacher session creation, active-session controls, participation, and closing. |
| Materials and learning | Shared classroom resources, extracted-material status, grounded classroom questions, and useful recovery states when offline. |
| Results and performance | Submitted attempt result, score breakdown, trends, and teacher-facing classroom aggregates. |
| Profile | Identity, resolved role, Supabase connection state, appearance and biometric lock settings, deep-link guidance, and secure sign-out. |

## Key User Flows

| User | Flow |
|---|---|
| Returning user | Open app → restore the Supabase session securely → resolve role from shared profile/enrollment/ownership data → load Home. |
| Teacher creates a classroom | Classes → Add classroom → enter name and subject → Create → refresh shared classroom list and open the new class. |
| Student joins a classroom | Classes → Join with code → enter class code → confirm → create the shared enrollment record → open class detail. |
| Teacher manages attendance | Classroom → Attendance → open a PIN session → share PIN → review participation → close the session. |
| Student verifies attendance | Classroom → Attendance → select active session → enter teacher PIN → request backend verification → show confirmation or recovery guidance. |
| Student takes a test | Home or Classroom → Assessment → review instructions → start/resume → answer questions → review → submit → open result. |
| Teacher reviews work | Classroom → assessments/roster → inspect activity, submissions, analytics, and material status from shared records. |

## Color Choices

| Token | Light | Dark | Purpose |
|---|---:|---:|---|
| NeuroClass indigo | `#3949AB` | `#A5B4FC` | Navigation, primary actions, and brand identity. |
| Porcelain background | `#F8F9FC` | `#101322` | Quiet reading canvas. |
| Surface white | `#FFFFFF` | `#1A1E31` | Cards, sheets, and grouped content. |
| Ink navy | `#18213A` | `#F1F5FF` | Primary text and controls. |
| Muted slate | `#667085` | `#A8B1CB` | Supporting labels and metadata. |
| Success mint | `#0F9D7A` | `#5DE0B4` | Submitted, present, and healthy states. |
| Attention coral | `#E76F51` | `#FFAA95` | Time-sensitive and corrective actions. |

## Layout and Data Boundaries

The app uses four thumb-reachable tabs: Home, Classes, Attendance, and Profile. Classroom, assessment, test, result, face-registration, and attendance-scan routes use stack navigation. All screens use the shared `ScreenContainer` for safe-area handling. The client bundles only the Supabase URL and publishable key; service-role credentials, database passwords, AI secrets, face embeddings, and proctoring secrets remain behind the existing authenticated backend gateways.
