# NeuroClass Web-to-Mobile Feature Matrix

The mobile client reuses the existing Supabase Auth account, `users`, `classrooms`, `students`, `tests`, `attempts`, `test_submissions`, attendance, face-profile, and learning-materials records. No mobile-specific identity or classroom database is introduced.

| Capability | Existing web implementation | Mobile integration approach | Status |
|---|---|---|---|
| Shared identity and session | Supabase Auth plus `users.uid` role profile | SecureStore-backed Supabase session, profile role resolution from the existing `users` record | Implemented; enhance sign-in guidance and recovery |
| Teacher/student classroom sync | `classrooms` and `students` | Existing shared queries and role-aware classroom detail | Implemented; add realtime refresh |
| Attendance sessions | Vercel `/api/attendance/session`, `/active`, `/verify` | Existing PIN session management; add teacher camera-frame delegation | In progress |
| Face enrollment | Vercel `/api/students/face-registration` → Render AI | Front-camera sample capture and multipart upload; backend remains authoritative | In progress |
| Test design and AI generation | Connected test portal and `/api/ai/generate-test` | Secure test-portal handoff, preserving the authoritative authoring UI | Implemented with native limitation documented |
| Test attempts and results | `attempts`, `test_submissions`, `/api/exams/attempt/*` | Existing native runner; add history/result and performance surfaces | In progress |
| Proctoring | Backend-proxied, with browser-specific signals on web | Mobile displays applicable server-driven status and does not claim unsupported OS tab monitoring | Documented limitation |
| Materials and grounded learning | Vercel `/api/materials`, `/api/ai/classroom-answer` | Native material list/upload plus classroom-scoped AI answer route | In progress |
| Analytics | Vercel `/api/ai/classroom-analytics`, shared submissions | Teacher aggregate cards and student performance from shared records | In progress |
| Offline and realtime | Supabase data source | Network state banner, safe local test draft, efficient table subscriptions | In progress |
| Deep links and notifications | App configuration/notification permission foundation | `neuroclass://classroom/:id`, test, attendance, and result routes; notification-ready config | In progress |

## Mobile-Specific Boundaries

The native client sends face samples and attendance frames only to the existing authenticated backend gateway. It does not generate embeddings, expose biometric vectors, call the Render AI services directly, embed service-role credentials, or claim browser-only focus/tab monitoring. Native test authoring remains available through the secured existing test portal rather than a duplicate mobile implementation.

