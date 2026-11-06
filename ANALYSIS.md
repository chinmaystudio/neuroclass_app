# NeuroClass — complete analysis and mobile app build

Date: 2026-11-06. Sources: `chinmaystudio/neuroclass` (web, main @ 0f5aee7),
`chinmaystudio/neuroclass_app` (existing mobile), and the live Supabase
project `hdjtgyvdlxwntfriqhff`. Full deep-dives: `docs-web-analysis.md` and
`docs-existing-app-analysis.md` in this folder.

## 1. NeuroClass web repo — what it is

An AI-assisted classroom platform: classrooms with join codes, Face ID
attendance, classroom materials with an AI tutor, classroom tests with AI
proctoring, a built-in coding IDE, and assignment management.

| Part | Stack | Deploys to |
|---|---|---|
| Web app | React 19 + Vite 6 + Tailwind 4, react-router 7 | Cloudflare Pages (`neuroclass.pages.dev`) |
| API | Next.js route handlers + a versioned `/api/v1` router | Vercel (`https://neuroclass-swart.vercel.app`) |
| ML proctoring | FastAPI | Render |
| Database / auth / storage | Supabase Postgres + RLS | Supabase project `hdjtgyvdlxwntfriqhff` |
| Face recognition | External ArcFace service | Render (`AI_SERVICE_URL`) |
| Code execution | Judge0 / Piston | External (`CODE_RUNNER_URL`) |

Payments (x402/Algorand, Stripe test mode) exist in code but are disabled
by default (`PAYMENTS_ENABLED` / `VITE_PAYMENTS_ENABLED=false`).

### Web screens and flows
- Public: `/` landing, `/about`, `/contact`, `/help` + guides, `/privacy`, `/terms`, `/ui-kit`
- Auth: modal + `/auth/callback` (Supabase Auth, email + Google PKCE). After
  sign-in the user chooses a role once; the role is stored in `public.users`
  (`uid` = Supabase auth uid, `role` teacher/student) and routes to `/teacher/*` or `/student/*`.
- Teacher: dashboard, classroom list (create with join code, delete via API),
  classroom detail (roster, materials incl. Google Drive import, tests,
  assignments, attendance sessions, learning analytics), test editor with AI
  question generation, live test monitor, grading, attempt/proctoring review,
  assignment grading, settings, integrations (MCP tokens).
- Student: dashboard, join class by code, enrolled class detail (materials,
  AI learning bot, tests, assignments), full-screen secure exam (consent,
  camera/Face ID check, server timer, autosave + offline queue, coding IDE),
  attendance (PIN / Face ID, appeals), history, performance, settings.
- Attendance portals: `/attendance/teacher`, `/attendance/student`,
  `/attendance/mobile-handoff`.

### Web interface (design system)
From `frontend/index.css` (`--nc-*` tokens, Inter Variable):
primary `#1a73e8` (dark `#8ab4f8`), canvas `#f8fafd` (dark `#121314`),
surface `#ffffff` (dark `#1e1f22`), ink `#202124` (dark `#e8eaed`),
ink-2 `#5f6368`, line `#dadce0`, success `#188038`, warning `#f9ab00`,
danger `#d93025`, brand gradient `#1a73e8 → #4285f4`, card shadows are
restrained Material-style elevations.

### How the web talks to data
- Direct Supabase (publishable key, RLS-protected) for: `users` profile/role,
  `classrooms`, `students` roster/enrollment, `attendance_appeals`,
  `evaluations`, some attendance reads.
- Backend `/api/v1` (Bearer = Supabase access token) for: tests and attempts
  (`classrooms/:id/tests`, `tests/:id/*`, `attempts/:id/*` incl. proctoring
  consent/identity/heartbeat/events/frame), assignments
  (`classrooms/:id/assignments`, `assignments/:id/*`, submissions, grading),
  code execution (`code/run`, `code/workspace`), and API tokens (`me/tokens`).
- Legacy backend routes for attendance sessions, materials, Google Drive,
  and AI generation, all behind the same Supabase session.

## 2. NeuroClass Supabase project — `hdjtgyvdlxwntfriqhff`

- URL: `https://hdjtgyvdlxwntfriqhff.supabase.co`. The web and mobile apps
  both embed only the publishable key (`sb_publishable_…`, public by design;
  RLS is the security boundary). No service-role key is in any client.
- Schema in the repo: `supabase/schema.sql` (730 lines) plus 24 migrations
  in `supabase/migrations/`, snapshotted for tests in
  `backend/tests/integration/prod-schema-snapshot.sql`.
- Tables (49): core — `users`, `classrooms`, `students`, `classroom_students`;
  assessments — `tests`, `test_questions`, `test_submissions`, `attempts`,
  `attempt_answers`, `test_results`, `assessment_appeals`,
  `assessment_audit_logs`, `proctoring_events`, `evaluations`;
  assignments — `assignments`, `assignment_submissions`,
  `assignment_attachments`, `assignment_submission_files`,
  `assignment_submission_history`, `coding_test_cases`, `coding_workspaces`,
  `code_execution_jobs`; attendance — `attendance`, `attendance_sessions`,
  `attendance_verifications`, `attendance_verification_attempts`,
  `attendance_appeals`, `attendance_corrections`, `attendance_audit_events`,
  `attendance_session_announcements`, `face_profiles`, `face_embeddings`;
  learning — `classroom_materials`, `classroom_material_chunks`,
  `learning_threads`, `learning_messages`, `learning_feedback`,
  `project_ideas`, `google_drive_connections`, `classroom_drive_folders`;
  platform — `api_tokens`, `notification_outbox`, `nc_rate_limits`, and the
  disabled payments set (`x402_*`, `user_wallets`).
- Key shapes: `classrooms(code unique, user_id = teacher)`,
  `students(classroom_id, user_id, unique(classroom_id,email),
  face_descriptor jsonb)`, `tests(classroom_id, questions jsonb,
  proctoring_enabled)`, `attempts(test_id, student_id, status, answers jsonb,
  violations jsonb)`, `attendance(session_id + student_id unique)`.
- Live checks done for this analysis (2026-11-06): the hosted Supabase MCP
  server (`mcp.supabase.com`) still returns HTTP 403 for this Muse
  connection, so live table introspection through MCP was not available;
  the schema above is from the repo, which is the project's source of truth.
  Anonymous PostgREST reads are correctly denied (`42501 permission
  denied`) — production RLS hardening migrations
  (`20261105000300`/`20261105000400`) removed the permissive anonymous
  policies that remain in the base `schema.sql`. Authenticated access is
  the only data path, exactly as the web app uses it.

## 3. Mobile app — what was built

Base: the user's own `chinmaystudio/neuroclass_app` (Expo SDK 54,
expo-router 6, React Native 0.81, NativeWind) — it was already a real
NeuroClass app sharing this Supabase project, not a template. This build
keeps it, closes its two gaps against the current web app, and delivers it
in this folder.

Already present and verified: Supabase Auth with SecureStore session
persistence and `users`-table role resolution; role-aware tabs (Home,
Classes, Attendance, Workspace/Progress, Profile); classroom create/join by
code; classroom detail with roster, assessments, materials, attendance;
native test runner with locally persisted drafts; results/performance;
teacher PIN attendance sessions + student PIN verification; face
registration and attendance scan via the existing backend gateways;
offline/network states; `neuroclass://` deep links.

Changes made in this build:
1. **Same interface as the web.** `theme.config.js` now uses the exact web
   `--nc-*` token values (primary, canvas, surface, ink, muted, border,
   success, warning, danger — light and dark). `design.md` updated to match.
2. **Assignments (was completely missing).** New
   `lib/neuroclass-assignments.ts` calls the same `/api/v1` assignments
   endpoints as the web, with the Supabase session token. New screens:
   `app/assignments/[classroomId].tsx` (list with teacher stats / student
   status) and `app/assignment/[id].tsx` (detail; student text draft save +
   submit; teacher submission roster), linked from classroom detail.
   File/coding assignments are clearly labelled web-handled for now.
3. `lib/neuroclass-api.ts` now also supports `PUT`/`DELETE` (needed for
   draft save), and `lib/neuroclass-types.ts` gained `Assignment` and
   `AssignmentSubmission` types matching the backend's camelCase views.

Same database guarantee: the app contains no database of its own. It uses
the identical Supabase URL + publishable key and the identical production
API base (`https://neuroclass-swart.vercel.app`) as the web, so a classroom,
test, attendance record, or assignment created in one appears in the other.

## 4. Verification

- `pnpm install --frozen-lockfile` — OK
- `npx tsc --noEmit` — passes (exit 0)
- `npx vitest run` — 5 passed, 1 skipped (pre-existing skip)
- `npx expo export --platform android` — succeeds, Hermes bundle 4.66 MB
- `npx expo export --platform web` — fails in Metro on a pre-existing
  NativeWind `react-native-css-interop` cache SHA-1 error, unrelated to
  these changes (no CSS/styling pipeline files were touched); the Android
  (mobile) target is unaffected.

## 5. Run it

```bash
pnpm install
npx expo start        # then open in Expo Go / a dev build, or press a / i
```

Sign in with the same account you use on the NeuroClass web app — you will
see the same classrooms, tests, attendance, materials, and assignments.
