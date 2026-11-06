# NeuroClass Web — Complete Analysis

Sources read (repo at `~/workspace/neuroclass-analysis/web`, not modified): `README.md`,
`docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/DESIGN_SYSTEM.md`,
`frontend/App.tsx`, `frontend/database/supabase.ts`, `frontend/types.ts`, `frontend/.env.example`,
`frontend/index.css`, `frontend/context/ThemeContext.tsx`, `frontend/config/apiConfig.ts`,
`frontend/config/features.ts`, `frontend/services/authService.ts`, dashboards
(`InstructorDashboard.tsx`, `StudentDashboard.tsx`, `ClassroomDetail.tsx`, `EnrolledClassDetail.tsx`),
`supabase/schema.sql` (730 lines, base schema) and all files in `supabase/migrations/`.
Env var **names only** are listed; no secret values are reproduced.

## 1. Stack

| Part | Tech | Folder / deploy |
|---|---|---|
| Web app | React 19, Vite 6, TypeScript ~5.8, Tailwind CSS 4 (`@tailwindcss/vite`), React Router DOM 7, Motion (`motion/react`), Recharts 3 | `frontend/` (root Vite config, `index.html`) → **Cloudflare Pages**; dev `:5173` |
| API | Next.js 14.2 (App Router route handlers, single catch-all), TypeScript, Zod, `@supabase/supabase-js` 2.104 (service-role, server only), `@google/genai`, `googleapis`, Nodemailer, `pdf-parse`/`mammoth` (material ingestion), Stripe SDK, Vitest | `backend/` → **Vercel**; dev `:3000` |
| ML proctoring | Python, FastAPI 0.115, Uvicorn 0.34 — per-attempt robust baseline (median/MAD) + temporal rules, numeric features only, no frames. Auth header `X-Proctoring-Service-Key` | `ml-service/` → **Render** |
| Database / Auth / Storage | Supabase PostgreSQL + RLS (incl. `pgvector` for face embeddings), Supabase Auth, private Storage buckets | `supabase/` (`schema.sql` for new projects, `migrations/` in order for existing) |
| Face recognition | External ArcFace service (existing) — browser never calls it | Render, via backend (`AI_SERVICE_URL`) |
| Code execution | Judge0 or Piston sandbox (isolated, no network) — browser never calls it | External host (`CODE_RUNNER_URL`) |
| On-device exam vision | MediaPipe Tasks Vision Face Landmarker + optional TensorFlow.js / COCO-SSD (phone check), Monaco Editor (bundled locally) for coding IDE | Browser only; no video leaves device |
| Payments | x402 / Algorand + Stripe test mode — **temporarily disabled** in code behind flags (see §2) | — |

Key libraries (frontend): `@supabase/supabase-js`, `@mediapipe/tasks-vision`, `@tensorflow/tfjs`,
`@tensorflow-models/coco-ssd`, `@monaco-editor/react` + `monaco-editor`, `@google/genai`,
`@fontsource-variable/inter`, `@fontsource/playfair-display`, `react-markdown`, `react-rnd`, `uuid`.

Layout: `frontend/features/` = `lms`, `tests`, `exam`, `coding`, `assignments`, `landing`, `auth`,
`public`, `shell`, `integrations`, `settings`, `ui-kit`; `frontend/components/` = legacy screens
(`instructor`, `student`, `ai`, `attendance`, `auth`, `common`, `evaluation`, `payments`, `ui`).
Backend: `backend/app/api/v1/[...path]/route.ts` → `backend/modules/router.ts` →
`modules/{core, assessments, proctoring, coding, assignments}`; legacy routes alongside (see §3).

## 2. Environment variables (names only)

### Frontend — `frontend/.env.example`, all `VITE_*`, public / embedded in bundle
- Required: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Fallback/legacy names read in code: `VITE_SUPABASE_ANON_KEY` (fallback for publishable key in
  `supabase.ts`), `VITE_BACKEND_URL` (alias for `VITE_API_URL` in `apiConfig.ts`)
- Flags: `VITE_PAYMENTS_ENABLED` (default `false`; read by `frontend/config/features.ts` as `FEATURES.payments`)
- Optional: `VITE_MEDIAPIPE_WASM_URL`, `VITE_FACE_LANDMARKER_MODEL_URL`
- Legacy payments (only if re-enabled): `VITE_ALGOD_SERVER_URL`, `VITE_NEUROCLASS_TREASURY_ADDRESS`,
  `VITE_X402_NETWORK`, `VITE_X402_USDC_ASSET_ID`

### Backend — `backend/.env.example`, server secrets (never in frontend)
`NODE_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, `GEMINI_API_KEY`,
`CRON_SECRET`, `AI_SERVICE_URL`, `AI_SERVICE_SECRET`, `AI_LIVENESS_PATH`, `AI_EXAM_FACE_PATH`,
`EXAM_FACE_MATCH_THRESHOLD`, `ML_PROCTORING_URL`, `ML_PROCTORING_API_KEY`,
`CODE_RUNNER_PROVIDER`, `CODE_RUNNER_URL`, `CODE_RUNNER_AUTH_HEADER`, `CODE_RUNNER_AUTH_TOKEN`,
`CODE_RUNNER_RAPIDAPI_HOST`, `CODE_RUNNER_LANGUAGES`, `CODE_RUNNER_HOURLY_LIMIT`,
`CLASSROOM_MATERIALS_BUCKET`, `ASSIGNMENT_FILES_BUCKET`,
`GOOGLE_SMTP_HOST`, `GOOGLE_SMTP_PORT`, `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_APP_PASSWORD`, `GOOGLE_SMTP_FROM`,
`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`,
`GOOGLE_DRIVE_FRONTEND_ORIGIN`, `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_DRIVE_STATE_SECRET`,
`PAYMENTS_ENABLED`, plus (in example/comments) Stripe- and x402-related names gated by that flag.

### ML service
`ML_SERVICE_API_KEY` (same value must be set as backend `ML_PROCTORING_API_KEY`).

## 3. Backend API base-URL config

- Single source: `frontend/config/apiConfig.ts` → `getBackendBaseUrl()` / `getApiUrl(endpoint)`.
  Resolution order: `VITE_API_URL` → `VITE_BACKEND_URL` (alias) → fallback.
- Production fallback (hardcoded): `https://neuroclass-swart.vercel.app`. In production a
  localhost/127.0.0.1 value is ignored and the fallback is used; if no URL is set in production the
  fallback is also used (never send API calls to the static Cloudflare host).
- Local dev: no URL set → `''` (same-origin relative paths). README flow: run API on `:3000` and set
  `VITE_API_URL=http://localhost:3000` (no trailing slash; code strips a trailing `/`).
- LMS API: `POST/GET … {base}/api/v1/*` — one catch-all route + explicit route table in the backend.
  All `/api/v1` calls require `Authorization: Bearer <Supabase access token>`, return JSON, errors are
  `{error, code, details?}` (400/401/403/404-not-yours/409/413/415/429/503). IDs must be UUIDs.
- Legacy/other API routes (unchanged, on same base): `/api/attendance/*`,
  `/api/students/face-registration`, `/api/materials*`, `/api/google-drive/*`,
  `/api/ai/classroom-answer`, `/api/ai/classroom-analytics`, `/api/ai/feedback`,
  `/api/ai/generate-test|generate-assignment|project-idea` (now auth-required + rate-limited),
  `/api/evaluate/*`, `/api/analyze-question-paper`, `/api/workers/material-ingestion`, `/api/health`,
  `/api/stripe/create-checkout-session` (503 while payments disabled).
  Removed: `/api/test-portal/handoff`, `/api/exams/attempt/*` → replaced by `/api/v1`.
- Supabase client: `frontend/database/supabase.ts` — `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY || VITE_SUPABASE_ANON_KEY)`,
  with **hardcoded fallback URL and publishable key in code** if env is absent (values omitted here).
  Browser talks directly only to Supabase Auth + Supabase (RLS-guarded reads, e.g. `classrooms`,
  `students`, `users`, realtime channel on `attendance_session_announcements` in StudentDashboard);
  everything else goes through the Vercel API. Export: `supabase`, `isSupabaseConfigured()`.

## 4. Auth method

- **Supabase Auth only** (“one app, one auth”). Client config in `supabase.ts`: `persistSession: true`,
  `autoRefreshToken: true`, `detectSessionInUrl: true`, `flowType: 'pkce'`.
- Methods (`frontend/services/authService.ts`): **email + password** (`signUp` / `signInWithPassword`,
  email normalised to lower-case) and **Google OAuth** (`signInWithOAuth({provider:'google'})`,
  redirect to `{origin}/auth/callback`, `prompt=select_account`). No magic-link/OTP/phone login in code.
- Role: exactly two roles, `'teacher' | 'student'` (`users.role`, default `'teacher'` in base schema).
  Profile row in `public.users` is created server-side by trigger `nc_on_auth_user_created` on
  `auth.users` (migration `20261105000300`). First Google sign-in with no chosen role → `RoleChooser`
  overlay / pending-role in `localStorage` → `authService.chooseRole()` → RPC `nc_choose_role`
  (server ignores later changes). `getRoleState()` reads `users.role, role_chosen_at` by `uid`.
- Guards: `AuthProvider` (`frontend/context/AuthContext.tsx`) + `SessionGuardian` (optionally
  `allowedRole`) wrap `/teacher/*`, `/student/*`, `/attendance/teacher`, `/attendance/student`.
  `AuthModal` success navigates to `/{role}`. `/auth/callback` = `AuthCallbackPage`.
- Server-side per-request (`/api/v1`): `authenticate()` validates the Supabase access token (30 s cache);
  role is **not** trusted from the client — `resolveClassroomAccess()` derives it: teacher iff
  `classrooms.user_id = auth uid`, student iff an enrolment row exists in `students`
  (`user_id`, or verified email for legacy unlinked rows), else **404** (existence not revealed).
  Student attempts also require `attempts.student_id = auth uid`; drafts/unpublished → 404 to students.

## 5. Routes / screens and role flows

### Top-level routes — `frontend/App.tsx` (React Router, `BrowserRouter`)
Providers: `AuthProvider > ThemeProvider > FeedbackProvider`; chrome: `Navbar`, `RoleChooser`, `AuthModal`.

| Path | Screen |
|---|---|
| `/` | `Landing` (public; Sign in/up opens `AuthModal`) |
| `/auth/callback` | `AuthCallbackPage` (Google OAuth PKCE callback) |
| `/help`, `/help/:slug` | `HelpIndexPage`, `GuidePage` |
| `/about`, `/contact`, `/privacy`, `/terms` | Public info pages |
| `/ui-kit` | `UIKitShowcase` (living design-system reference) |
| `/attendance/mobile-handoff` | `MobileAttendanceHandoff` (hands off to mobile attendance flow; supports `neuroclass://attendance-return` deep link seen in StudentDashboard) |
| `/attendance/teacher` | `MobileTeacherAttendancePortal` (SessionGuardian, any signed-in role) |
| `/attendance/student` | `MobileStudentAttendancePortal` (SessionGuardian) |
| `/teacher/*` | `InstructorDashboard` (SessionGuardian `allowedRole="teacher"`, lazy-loaded) |
| `/student/*` | `StudentDashboard` (SessionGuardian `allowedRole="student"`, lazy-loaded) |
| `*` | `NotFoundPage` (real 404, noindex) |

Also: `AIModuleDashboard` exists as a lazy overlay component in `App.tsx` (`showAIModule` state, not a route).

### Teacher — `/teacher/<section>[/<classroomId>[/<tab>]]`, shell = `RoleShell` (sidebar groups Teach / Account)
Sections (`InstructorDashboard.tsx`): `classrooms` (default; aliases `dashboard`, `classroom-detail`),
`tests`, `attendance`, `proctoring`, `reports`, `settings`, `integrations`, `stripe`
(stripe/payment nav only rendered if `FEATURES.payments`, currently off).

- Classrooms: `ClassroomList` → create/open classroom (join `code`); `tests` and `attendance` sections
  first force classroom selection, then deep-link into that classroom/session.
- Classroom detail (`/teacher/classrooms/:id[/tests]`, `ClassroomDetail.tsx`) tabs:
  **Students** (roster `DataTable`), **Tests** (`TeacherTestsPanel`), **Assignments**
  (`TeacherAssignmentsPanel`), **Materials** (`ClassroomMaterialsPanel`, incl. Google Drive handoff),
  **Attendance** (`AttendanceSystem`), **Proctoring**, **Settings**.
- Attendance: start teacher-authorised session for a classroom (`AttendanceSystem`).
- Proctoring: `ProctoringSystem`; Analytics/Reports: `AnalyticsDashboard` (+ per-classroom
  `ClassroomLearningAnalytics`); Settings: `InstructorSettings`; Integrations: `IntegrationsPage`.
- **Teacher test flow** (features/tests + `/api/v1`): create draft test in a classroom
  (types: `mcq, multiple_select, true_false, short_answer, fill_blank, numerical, long_answer, coding`
  — plus `file_upload` in DB check; modes `standard|coding`) → add/edit questions (max 300,
  answer keys only in `test_questions.answer_key`, server-only) → optional AI question suggestions
  (review before save) → set duration/schedule/attempts/shuffle/negative marking/proctoring →
  preview → publish (needs ≥1 question, test cases for every coding question) → live monitor
  (`tests/:id/monitor`: online/camera/identity/warnings/risk/time left) → review attempt
  (answers + keys, proctoring timeline, appeals) → grade / re-evaluate coding / identity override /
  dismiss-or-flag proctoring events → release results. Lifecycle: `draft → published → closed → archived`.
- **Teacher assignment flow**: create (types `text|file|document|coding|mixed`) → attachments →
  publish → roster of submissions → grade (`score, feedback, returnToStudent, waiveLatePenalty`) /
  evaluate code. Lifecycle: `draft → published → closed → archived`.

### Student — `/student[/<section>]`, shell = `RoleShell` (groups Learn / Study help / Account)
Sections (`StudentDashboard.tsx`): `''`=Home (`StudentOverview`), `classes` (`EnrolledClasses`),
`tests` (`StudentTestsPanel` — published tests from all joined classrooms, `me/tests`),
`performance` (`StudentPerformance`), `history` (`StudentHistory`),
`project-advisor` (`ProjectAdvisor`), `learning-bot` (`ClassroomLearningBot` — AI tutor over
classroom materials), `settings` (`StudentSettings`, incl. Face registration entry), `integrations`.

- Join flow: `JoinClassWizard` (from Home/Classes/settings) — join by classroom `code`, incl. face
  sample registration for biometric attendance.
- Class detail (`EnrolledClassDetail.tsx`) tabs: **Tests, Assignments, Materials**
  (`StudentClassroomMaterials`), **Attendance**.
- Attendance: realtime (Supabase channel on `attendance_session_announcements`) + 15 s polling of
  `GET /api/attendance/active` alerts the student when a session starts → `StudentAttendanceModal` /
  mobile portal (PIN + teacher-face + geofence/liveness checks per session policy).
- **Secure exam flow** (`features/exam/SecureExam`, lazy): start/resume attempt
  (`calibrating`, no questions/timer yet) → consent → camera check → Face ID identity verify
  (photo ≤2.5 MB to face service via API) → `begin` (server sets `expires_at = min(begin+duration, scheduled_end)`)
  → `in_progress`: full-screen, server timer, autosave + offline localStorage queue (revision-numbered),
  attempt-seeded question/option shuffle, browser + on-device vision proctoring signals, heartbeat,
  periodic identity re-checks (default 180 s) → submit (idempotent, exactly-once) / auto-submit on expiry
  → result only when teacher releases it (correct answers only if teacher enabled) → appeal.
  Attempt states: `calibrating → in_progress → submitted|auto_submitted → evaluated`
  (+ `abandoned`, `flagged`, `expired`). One open attempt per student per test (DB partial unique index).
- **Student assignment flow**: view published assignment (hidden test cases never sent) →
  save draft (`textResponse` and/or code in `CodingWorkspace`/Monaco) → upload files → submit
  (idempotent; `late` if past due) → reopen only before grading if resubmission allowed →
  view score/feedback when returned. Submission states: `draft → submitted|late → evaluated → returned`.
- Coding (both roles, `features/coding/CodingWorkspace`): run code vs custom input / visible sample
  tests via `POST /api/v1/code/run`; hidden tests run server-side only on submission/evaluation.

## 6. UI design system

Source of truth: `frontend/index.css` (tokens) + `docs/DESIGN_SYSTEM.md`; components in
`frontend/components/ui/` (import from `components/ui`); live reference at `/ui-kit`.
Principles: Google-Classroom clarity, calm white cards on soft canvas, one primary (blue) action per
area, status colours only for status, WCAG 2.2 AA, sentence case, visible labels (icons support, never replace).

### Theme (`frontend/context/ThemeContext.tsx`)
- App theme is binary **`light | dark`** only: `ThemeContext {theme, toggleTheme}`, default **light**
  (one-time migration key `theme-default-version = light-default-v1` forces old dark-default users to light),
  persisted in `localStorage` key `theme`, applied by toggling `.dark` class on `<html>`.
  `useTheme()` hook; wrapped in `App` as `ThemeProvider`.
- Tokens are `--nc-*` CSS vars in `:root` / `.dark`; Tailwind `@theme inline` maps them to utilities
  (`bg-canvas`, `text-ink`, `bg-primary`, `border-line`, `shadow-card`, `text-page`, …).
  Components must use token names, never hex / `dark:` colour overrides — dark mode is free via tokens.
- Distinct, unrelated: `frontend/types.ts` `Theme` enum (`default, dark, serene, vibrant, professional,
  midnight, nature`) is a **per-test appearance** setting in the legacy test model, not the app theme.

### Colours (light → dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` / `primary-hover` / `primary-dark` | `#1a73e8` / `#1558c0` / `#174ea6` | `#8ab4f8` / `#aecbfa` / `#d2e3fc` | Primary action, links, active tab, focus ring |
| `primary-light` / `primary-soft` / `on-primary` | `#e8f0fe` / `#d2e3fc` / `#ffffff` | blue 14% / blue 24% / `#062e6f` | Selected nav, secondary surfaces, text on primary |
| `canvas` / `surface` / `surface-2` | `#f8fafd` / `#ffffff` / `#f1f3f4` | `#121314` / `#1e1f22` / `#2a2b2e` | App bg / cards, dialogs, top bar / subtle fills |
| `ink` / `ink-2` / `ink-3` | `#202124` / `#5f6368` / `#80868b` | `#e8eaed` / `#bdc1c6` / `#9aa0a6` | Primary / supporting / placeholder-only text |
| `line` / `line-2` / `overlay` | `#dadce0` / `#e8eaed` / `rgb(32 33 36/.5)` | `#3c4043` / `#303134` / `rgb(0 0 0/.6)` | Borders / hairlines / modal overlay |
| `success` (fill/ink/bg) | `#188038` / `#137333` / `#e6f4ea` | `#81c995` / same / 14% tint | Status |
| `warning` | `#f9ab00` / `#8a5300` / `#fef7e0` | `#fdd663` / same / 14% tint | Status (fill never used as text) |
| `danger` | `#d93025` / `#b3261e` / `#fce8e6` | `#f28b82` / same / 14% tint | Status |
| `info` | `#1a73e8` / `#174ea6` / `#e8f0fe` | `#8ab4f8` / same / 14% tint | Status |
| Brand gradient | `linear-gradient(110deg,#1a73e8,#287ae6 55%,#4285f4)` | deeper-blue variant | `bg-brand-gradient` — classroom covers/highlights only |

### Type, shape, elevation, motion
- Font: **Inter Variable** (`@fontsource-variable/inter`, `--font-sans`: Inter Variable → Inter →
  Roboto → system-ui → Arial), antialiased. Playfair Display is a package dependency but not the UI font.
- Scale: `text-page` 28/36 w650 · `text-section` 20/28 w600 · `text-card` 16/24 w600 ·
  `text-body` 15/24 · `text-support` 13/20 · `text-meta` 12/16 · `text-button` 14/20 w500.
  Changing numbers use `tabular-nums`.
- Radius: `rounded-control` 4px · `rounded-button` 5px · `rounded-card`/`rounded-dialog` 8px ·
  `rounded-full` only avatars/icon buttons/switches. Spacing on 4px scale; card padding 20px;
  page max-width 1152px; control heights buttons 32/36/44, inputs 40, tabs/nav 44/40.
- Elevation: `shadow-card` (resting), `shadow-raised` (hover/menus/toasts), `shadow-dialog` (dialogs/drawer)
  — Material-style, restrained. No glassmorphism/glows/full-page gradients.
- Motion: `--ease-standard cubic-bezier(.2,0,0,1)`, `--duration-fast` 120ms, `--duration-base` 180ms;
  global `prefers-reduced-motion` kill-switch in `index.css`. `index.css` also carries legacy
  (pre-design-system) shadow rules for non-`[data-ui]` buttons/cards, being removed screen by screen,
  plus utilities `bg-brand-gradient` and `focus-ring` (2px primary outline).

### Components (`frontend/components/ui/`, + shell)
`Button` (+`buttonClasses`), `Card`/`CardHeader`/`CardFooter`, `Avatar`, `Badge`/`StatusBadge`,
`Form`/`Field`/`Textarea`/`SearchInput`, `Navigation`/`PageHeader`/`Breadcrumbs`/`Tabs`/`TabPanel`,
`Overlay`/`Modal`, `Table`/`DataTable`, `Feedback` (`FeedbackProvider`, `Spinner`, toasts/`useToast`),
`EmptyState`, `ErrorState`, `Skeleton`/`SkeletonText`, `ClassroomBanner`, `InfoCard`, `Meta`,
`icons.tsx` (in-house 24px/1.75-stroke line icons, **no Lucide**) + `icons-compat.tsx` (legacy names),
`chart.ts` (chart colours). Shell: `frontend/features/shell/RoleShell.tsx` — 64px top bar
(brand/search/notifications/account), fixed 256px labelled sidebar ≥1024px, drawer below, `PageBody`
container; tables stack below 640px, dialogs become bottom sheets on phones.
LMS compatibility layer: `frontend/features/lms/ui.tsx`.

### Legacy frontend model (`frontend/types.ts`)
Separate from the LMS API question model (§5): `QuestionType` (`single-choice, multiple-select,
true-false, short-answer, essay, fill-in-blank, rating-scale, match-pairs`), `Question{id,type,title,
options[{id,text,isCorrect}],marks,negativeMarks,timeLimit,required}`, `Section`, `Test{settings:
TestSettings, proctoring: ProctoringSettings{enabled,level:basic|strict|full-ai,…}, sections, layout:
LayoutModule[] (drag/drop layout builder types), appearance}`. A mobile client should follow the
`/api/v1` question object in `docs/API.md`, not this file, for live tests/assignments.

## 7. Supabase tables

All in `public`, RLS enabled; API uses service-role server-side and enforces auth in code, RLS is
defence-in-depth (helpers `nc_is_classroom_owner(uuid)`, `nc_is_classroom_member(uuid)`, SECURITY DEFINER).
Note base `schema.sql` still contains legacy anonymous policies for `users`/`classrooms`/`tests`;
migrations `20261105000100` + `20261105000300` + `20261105000400` remove/tighten them (anon: none;
students see only published tests, without the `questions` column).

### Core identity & classrooms (from `schema.sql`)
| Table | Key columns |
|---|---|
| `users` | `id` uuid PK, `uid` TEXT UNIQUE ( = `auth.users` id as text), `email`, `displayName`, `photoURL`, `mobile_number`, `role` (default `teacher`; + `role_chosen_at` in later migrations), `createdAt` |
| `classrooms` | `id` PK, `name`, `code` TEXT UNIQUE (join code), `subject`, `user_id` TEXT (owner/teacher), `students` count, `attendance`, `status`, `created_at` |
| `students` (enrolment) | `id` PK, `classroom_id` FK→classrooms, `user_id` TEXT, `name`, `roll_number`, `phone`, `email`, `face_samples` JSONB, `face_descriptor` JSONB (128-d), `face_registration_status` (`PENDING\|REGISTERED\|FAILED`), `joined_at`; UNIQUE(`classroom_id`,`email`) |
| `classroom_students` (legacy, migration `20260812`) | `id`, `classroom_id` FK, `student_id` TEXT, `student_name`, `joined_at` |

### Tests, attempts & LMS assessment (base + migration `20261105000100`, extends `tests`/`attempts`)
| Table | Key columns |
|---|---|
| `tests` | Base: `id`, `classroom_id` FK, `title`, `subject`, `duration_mins`, `total_marks` (→NUMERIC), `questions` JSONB legacy (normalised lazily into `test_questions`, then cleared; hidden from client roles), `proctoring_enabled`. Extended: `description`, `instructions`, `status` (`draft\|published\|closed\|archived`), `passing_marks`, `scheduled_start/end`, `created_by`, `user_id`, `published_at`, `closed_at`, `config` JSONB, `security` JSONB, `results_released` bool, `exam_mode` (`standard\|coding`), `legacy_source`, `updated_at` |
| `test_questions` | `id`, `test_id` FK, `position`, `type` (`mcq\|multiple_select\|true_false\|short_answer\|long_answer\|numerical\|fill_blank\|coding\|file_upload`), `prompt`, `options` JSONB (no correctness), **`answer_key` JSONB — server-only**, `marks`, `negative_marks`, `explanation`, `coding` JSONB {languages, starterCode, timeLimitMs, memoryLimitMb}; UNIQUE(`test_id`,`position`) |
| `attempts` | Base: `id`, `test_id` FK, `student_id` TEXT, `status`, `score`, `answers` JSONB, `violations` JSONB, `started_at`, `finished_at`, `submitted_at`. Extended: `classroom_id` FK, `student_record_id` FK→students, `attempt_number`, `expires_at`, `last_activity_at`, `question_order`/`option_order` JSONB, `max_score`, `percentage`, `evaluated_at/by`, `identity_status` (`not_required\|pending\|verified\|failed\|manual_review`), `identity_verified_at`, `identity_checks`, `integrity_score`, `risk_level`, `warning_count`, `proctoring_baseline`/`proctoring_state` JSONB, `consent_at`, `camera_status`, `heartbeat_at`. Status (final): `calibrating\|in_progress\|submitted\|auto_submitted\|evaluated\|abandoned\|flagged\|expired` |
| `attempt_answers` | `id`, `attempt_id` FK, `question_id` FK→test_questions, `response` JSONB, `marked_for_review`, `auto_score`, `manual_score`, `awarded_marks`, `needs_manual_review`, `feedback`, `evaluation` JSONB, `revision`, `saved_at`; UNIQUE(`attempt_id`,`question_id`) |
| `test_submissions` (legacy) | `id`, `test_id` FK, `student_id`, `student_name`, `marks_obtained`, `total_marks`, `percentage`, `grade`, `feedback`, `answers` JSONB, `proctoring_violations` JSONB, `submitted_at` |
| `test_results` (legacy, migration `03`) | `id`, `test_id` FK, `student_id` FK→students, `score`, `answers` JSONB, `submitted_at`; UNIQUE(`test_id`,`student_id`) |
| `proctoring_events` | `id`, `attempt_id`/`test_id`/`classroom_id` FKs, `student_user_id`, `event_type`, `category` (`browser\|vision\|identity\|service\|environment`), `severity` (`info\|low\|medium\|high\|critical`, server-assigned), `confidence`, `source` (`browser\|ml_service\|face_service\|server`), `details` JSONB, `bbox` JSONB, `occurred_at`, `review_status` (`pending\|dismissed\|concern`), `reviewed_by/at`, `review_note` |
| `assessment_appeals` | `id`, `attempt_id` FK, `classroom_id` FK, `student_user_id`, `reason`, `status` (`open\|accepted\|rejected`), `resolution`, `resolved_by/at`, `created_at` |
| `assessment_audit_logs` | `id`, `actor_user_id`, `classroom_id`, `entity_type`, `entity_id`, `action`, `details` JSONB, `created_at` |
| `evaluations` | `id` TEXT PK, `type`, `studentName`, `rollNumber`, `subject`, `assessmentName`, `marksObtained`, `totalMarks`, `percentage`, `grade`, `feedback`, `strengths`/`weaknesses`/`improvementSuggestions` JSONB, `owner_user_id`, `date` |

### Assignments & coding (migration `20261105000100`)
| Table | Key columns |
|---|---|
| `assignments` | `id`, `classroom_id` FK, `created_by`, `title`, `description`, `instructions`, `assignment_type` (`text\|file\|document\|coding\|mixed`), `status` (`draft\|published\|closed\|archived`), `available_from`, `due_at`, `total_marks`, `late_policy` JSONB, `accepted_file_types` TEXT[], `max_file_size_mb`, `max_files`, `allow_resubmission`, `coding` JSONB, `published_at` |
| `assignment_attachments` | `id`, `assignment_id` FK, `classroom_id` FK, `storage_path` UNIQUE, `file_name`, `mime_type`, `size_bytes`, `uploaded_by` |
| `assignment_submissions` | `id`, `assignment_id` FK, `classroom_id` FK, `student_user_id`, `student_record_id` FK, `status` (`draft\|submitted\|late\|evaluated\|returned`), `text_response`, `code` JSONB, `submitted_at`, `is_late`, `late_days`, `score`, `penalty_percent`, `final_score`, `feedback`, `evaluated_by/at`, `returned_at`, `revision`; UNIQUE(`assignment_id`,`student_user_id`) |
| `assignment_submission_files` | `id`, `submission_id` FK, `storage_path` UNIQUE, `file_name`, `mime_type`, `size_bytes` |
| `assignment_submission_history` | `id`, `submission_id` FK, `revision`, `action`, `actor_user_id`, `snapshot` JSONB |
| `coding_test_cases` | `id`, `question_id` FK→test_questions **xor** `assignment_id` FK→assignments (CHECK exactly one), `position`, `input`, `expected_output` (≤64KB each), `is_hidden`, `weight` |
| `coding_workspaces` | `id`, `owner_user_id`, `classroom_id` FK, `context_type` (`test_attempt\|assignment`), `context_id`, `question_id`, `language`, `source` (≤200KB), timestamps; unique per owner/context/question |
| `code_execution_jobs` | `id`, `user_id`, `classroom_id` FK, `context_type`, `context_id`, `question_id`, `language`, `kind` (`run\|evaluate`), `status`, `provider`, `exit_code`, `time_ms`, `memory_kb`, `summary` JSONB (audit + hourly cap) |

### Attendance & biometrics
| Table | Key columns |
|---|---|
| `attendance_sessions` | `id`, `classroom_id` FK, `teacher_id`, `title`, `status` (`open\|closed\|expired`), `nonce` UNIQUE, `starts_at`, `ends_at`, `closed_at`, `challenge_token_hash`, `pin_hash`, `challenge_expires_at/rotated_at`, `verification_policy` JSONB (default `{"pin":true,"teacher_face":true}`; geofence fields added in later migrations) |
| `attendance` | `id`, `classroom_id` FK, `session_id` FK→attendance_sessions, `student_id`, `student_name`, `status` (`Present\|Late\|Excused\|Absent\|Pending Review`), `verified_method`, `capture_metadata` JSONB, `marked_by`, `verified_at`, `correction_version`, `corrected_at/by`, `verification_attempt_id` FK; unique (`session_id`,`student_id`) |
| `attendance_verification_attempts` | `id`, `session_id` FK, `classroom_id` FK, `student_user_id`, `student_id`, `idempotency_key`, `challenge_digest`, `status` (`accepted\|rejected\|replayed\|expired\|duplicate`), `failure_reason`, `device_fingerprint`, `proximity_metadata`/`liveness_metadata` JSONB; UNIQUE(`session_id`,`student_user_id`,`idempotency_key`) |
| `attendance_verifications` (migration `20260822_multilevel`) | `id`, `attendance_session_id` FK, `student_id` FK→students, `student_user_id` FK→auth.users, `classroom_id` FK, level flags `network_connected`, `authentication_verified`, `classroom_verified`, `session_verified`, `face_detected`, … |
| `attendance_session_announcements` (migration `20260822_geofenced`) | `id`, `attendance_session_id` FK, `classroom_id` FK, `event_type` (default `attendance_started`), `session_code`, `radius_meters`, `expires_at` — realtime source for student alerts |
| `attendance_appeals` | `id`, `attendance_id` FK, `classroom_id` FK, `student_id`, `reason`, `status` (`open\|approved\|rejected`), `resolved_by/at` |
| `attendance_corrections` | `id`, `attendance_id` FK, `classroom_id` FK, `old_status`, `new_status`, `reason`, `corrected_by`, `metadata` JSONB |
| `attendance_audit_events` | `id`, `classroom_id` FK, `session_id`, `attendance_id`, `actor_user_id`, `actor_role`, `event_type`, `payload` JSONB |
| `face_profiles` | `id`, `student_id` TEXT, `classroom_id` FK, `status` (`REGISTERED\|PENDING\|REJECTED`), `profile_version`, `enrollment_count`, `verified_count`, `version`; UNIQUE(`student_id`,`classroom_id`). **Never sent to browser** |
| `face_embeddings` | `id`, `profile_id` FK→face_profiles, `student_id`, `classroom_id` FK, `embedding` **vector(512)** (pgvector), `source`, `quality_score`; UNIQUE(`student_id`,`classroom_id`). **Server/AI-service only** |

### Materials, learning & integrations
| Table | Key columns |
|---|---|
| `classroom_materials` | `id`, `classroom_id` FK, `uploader_id`, `name`, `storage_path`, `mime_type`, `extracted_text` (server-written), `extraction_status` (`pending\|processing\|ready\|failed`), `visibility` (`classroom\|teacher_private`), `size_bytes`, `checksum_sha256`, `page_count`, `chunk_count`, `extraction_error`, `retry_count`, `metadata` JSONB, `source_type` (`local_upload\|google_drive`), `drive_file_id` (unique per classroom), `drive_modified_at`, `drive_web_view_url` |
| `classroom_material_chunks` | `id`, `material_id` FK, `classroom_id` FK, `chunk_index`, `content`, `page_number`, `token_count`, `embedding` JSONB; UNIQUE(`material_id`,`chunk_index`) |
| `learning_threads` | `id`, `classroom_id` FK, `student_user_id`, `title`, `learner_profile` JSONB, `last_confidence` (`high\|medium\|low`), `last_source_count` |
| `learning_messages` | `id`, `thread_id` FK, `role` (`user\|assistant\|system`), `content`, `citations` JSONB, `confidence`, `answer_state` (`grounded\|insufficient_context\|error`), `follow_up` |
| `learning_feedback` | `id`, `thread_id` FK, `message_id` FK, `classroom_id` FK, `student_user_id`, `rating` (-1\|1), `note`; UNIQUE(`message_id`,`student_user_id`) |
| `google_drive_connections` | `id`, `teacher_user_id` UNIQUE, `google_email`, `encrypted_refresh_token`, `granted_scopes` JSONB, `status` (`connected\|revoked\|error`), `last_error` |
| `classroom_drive_folders` | `classroom_id` PK/FK, `connection_id` FK, `drive_folder_id` UNIQUE, `folder_name` |
| `project_ideas` | `id`, `student_user_id`, `category`, `answers` JSONB, `result` JSONB, `payment_id` FK→x402_payments, `payment_tx_id` |

### Payments (disabled), platform & misc
| Table | Key columns |
|---|---|
| `x402_payments` | `id`, `tx_hash` UNIQUE, `amount_algo` (legacy, nullable), `service_name`, `payer_address`, `receiver_address`, `status` (`settled\|refund_pending\|refunded`), `network`, `asset_id`, `amount_usdc_micro`, `settlement_tx_id`, `request_path`, `payment_response` JSONB, `owner_user_id`, `verification_status`, `verified_at`, `confirmed_round`, `chain_metadata` JSONB. Server/service-role only, no anon/auth policies |
| `x402_payment_events` | `id`, `payment_id` FK, `event_type`, `details` JSONB, `occurred_at` |
| `x402_entitlements` | `id`, `resource_id`, `subject_id`, `settlement_tx_id` UNIQUE, `status` (`active\|revoked`), `granted_at`, `revoked_at` |
| `x402_payment_attempts` / `x402_refund_cases` (migration `20260813…060000`) | attempts: `attempt_id` UNIQUE, `resource_id`, `user_id`, `status`, `expires_at`; refund cases: `settlement_tx_id`, `resource_id`, `failure_code`, `status`, `refund_tx_id` |
| `api_tokens` (migration `20261105000700`) | `id`, `user_id`, `name`, `token_hash` UNIQUE, `token_prefix`, `last_used_at`, `expires_at`, `revoked_at` |
| `nc_rate_limits` (migration `20261105000400`) | PK (`bucket`,`subject`,`window_start`), `hits`; function `nc_rate_limit_hit(...)` |
| `notification_outbox` (migration `20261105000600`) | `id`, `event_key`, `kind`, `classroom_id`, `recipient_email`, `recipient_user_id`, `subject`, `html`, `body_text`, `status` (`pending\|sent\|failed\|skipped`), `attempts`, `last_error` |
| `user_wallets` | Legacy only — **removed** by migration `20260813053600_remove_legacy_user_wallets.sql`; do not use |

### Migrations list (`supabase/migrations/`, apply in order; 24 files)
`01_add_mobile_number.sql`, `02_students_table.sql`, `03_tests_and_results.sql`, `04_x402_wallets.sql`,
`20260812_init_schema.sql`, `20260813053000_align_production_features.sql`,
`20260813053600_remove_legacy_user_wallets.sql`, `20260813053700_make_legacy_algo_amount_nullable.sql`,
`20260813060000_x402_durable_records.sql`, `20260813070000_attendance_student_rls.sql`,
`20260813090000_production_learning_attendance_x402.sql`, `20260821084500_align_attendance_session_columns.sql`,
`20260822_add_biometric_tables.sql`, `20260822_geofenced_attendance.sql`, `20260822_multilevel_attendance.sql`,
`20260823000100_restore_attendance_persistence_schema.sql`, `20260827000100_google_drive_classroom_materials.sql`,
`20261105000100_lms_assessments_assignments_coding.sql` (core LMS, see above),
`20261105000200_import_test_creation_portal_data.sql` (one-way `tc_*` import, repeatable via `tests.legacy_source`),
`20261105000300_tighten_identity_rls.sql` (profile trigger, removes anon access to `users`/`classrooms`),
`20261105000400_production_rls_hardening.sql`, `20261105000500_fix_function_search_path.sql`,
`20261105000600_google_signin_and_email_notifications.sql`, `20261105000700_api_tokens.sql`.
Rollback for the LMS migration: `supabase/rollback/20261105000100_down.sql`.

## 8. Storage buckets

| Bucket | Visibility | Source / config |
|---|---|---|
| `assignment-files` | **Private**, 50 MB file limit (`52428800`) | Created by migration `20261105000100` (`INSERT INTO storage.buckets … public=false`). Backend env name `ASSIGNMENT_FILES_BUCKET` (default `assignment-files`). Server-mediated only; downloads are signed URLs expiring in **120 s**; storage paths never returned to clients |
| `classroom-materials` | **Private** | Default name in backend code (`services/materialApi.ts`, `materialIngestion.ts`, `googleDriveApi.ts`); backend env name `CLASSROOM_MATERIALS_BUCKET` (default `classroom-materials`). Holds uploaded + Google-Drive-synced material files; row metadata in `classroom_materials.storage_path`. Created outside the LMS migration (present in integration-test schema snapshot as private) |

No other buckets are created in `schema.sql`/migrations. Face images/embeddings are **not** in Storage:
embeddings live in `face_embeddings`, and exam/attendance face checks pass images server-to-server to the face service.

## 9. Implications for a mobile app sharing this database (summary)

- Reuse the **same Supabase project** (same `VITE_SUPABASE_URL`-equivalent URL + publishable key,
  PKCE auth, email/password + Google) and the **same Vercel API base** (`getBackendBaseUrl()` logic,
  `/api/v1` + legacy routes, Bearer Supabase token) — do not query service-role or read
  `test_questions.answer_key`, `face_embeddings`, hidden test cases, or storage paths directly.
- Role is derived server-side from `classrooms.user_id` / `students` enrolment; the client role choice
  only writes `users.role` once via `nc_choose_role`.
- Mirror the design tokens in §6 (primary `#1a73e8`, Inter, 8px cards, light/dark via the same `--nc-*` palette)
  and the route/section structure in §5 to keep the “same interface as web”.
