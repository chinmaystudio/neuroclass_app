# NeuroClass Mobile

The mobile app for NeuroClass — same account, same Supabase database, and
the same interface as the NeuroClass web app
(`chinmaystudio/neuroclass`).

- **Shared database:** Supabase project `hdjtgyvdlxwntfriqhff`
  (`https://hdjtgyvdlxwntfriqhff.supabase.co`, publishable key only, RLS
  protects the data) plus the production web API at
  `https://neuroclass-swart.vercel.app` (`/api/v1`), authenticated with the
  user's Supabase session — identical to the web frontend.
- **Same interface:** the theme in `theme.config.js` uses the exact web
  design tokens (`--nc-*` from the web's `frontend/index.css`).
- **Features:** role-aware Home / Classes / Attendance / Progress / Profile,
  classroom create & join-by-code, assessments with a native test runner,
  assignments (list, detail, draft + submit, teacher roster), PIN & Face ID
  attendance, materials and AI learning help, results and performance.

See `ANALYSIS.md` for the complete analysis of the web repo and the
Supabase project, and how this app maps to them.

## Run

```bash
pnpm install
npx expo start
```

Sign in with your NeuroClass web account — your classrooms, tests,
attendance, materials, and assignments are already there.
