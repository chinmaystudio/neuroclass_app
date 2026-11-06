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
| NeuroClass blue (web `--nc-primary`) | `#1a73e8` | `#8ab4f8` | Navigation, primary actions, and brand identity — identical to the web app. |
| Canvas background (web `--nc-canvas`) | `#f8fafd` | `#121314` | Quiet reading canvas — identical to the web app. |
| Surface white (web `--nc-surface`) | `#FFFFFF` | `#1e1f22` | Cards, sheets, and grouped content. |
| Ink (web `--nc-ink`) | `#202124` | `#e8eaed` | Primary text and controls. |
| Muted (web `--nc-ink-2`) | `#5f6368` | `#bdc1c6` | Supporting labels and metadata. |
| Success (web `--nc-success`) | `#188038` | `#81c995` | Submitted, present, and healthy states. |
| Danger (web `--nc-danger`) | `#d93025` | `#f28b82` | Time-sensitive and corrective actions. |

## Layout and Data Boundaries

The app uses four thumb-reachable tabs: Home, Classes, Attendance, and Profile. Classroom, assessment, test, result, face-registration, and attendance-scan routes use stack navigation. All screens use the shared `ScreenContainer` for safe-area handling. The client bundles only the Supabase URL and publishable key; service-role credentials, database passwords, AI secrets, face embeddings, and proctoring secrets remain behind the existing authenticated backend gateways.
