# Security

## Authentication

- Supabase Auth via `@lovable.dev/cloud-auth-js`. Email/password + Google are
  enabled; anonymous signups are disabled.
- Sessions live in `localStorage` (Supabase JS default). The
  `_authenticated/` route layout is `ssr: false` and redirects to `/auth`
  when there is no user.
- Password HIBP checking is enabled — leaked passwords are refused at
  signup and change time.

## Row Level Security

Every user-facing table has RLS enabled and scopes all policies to
`auth.uid()`. The `service_role` key is used only inside server functions,
never in the browser, and never for ordinary reads.

## Chat endpoint hardening (`src/routes/api/chat.ts`)

- **Bearer required** — every request must supply
  `Authorization: Bearer <supabase-jwt>`; the server re-validates with
  `supabase.auth.getUser(token)`.
- **Origin check** — cross-origin requests are rejected with `403 Forbidden`
  before the token is validated (CSRF defence).
- **Rate limit** — 20 requests / 60 seconds per user, per Worker isolate.
  Excess returns `429` with `retry-after: 60`.
- **Body schema** — validated with Zod; `openFiles ≤ 20`, `content ≤ 1 MB`,
  `allFilePaths ≤ 2000`, messages capped at 200.
- **Path allow-list** — every write tool checks `PATH_RE` before touching
  the DB.

## Secrets

`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and
`SUPABASE_PUBLISHABLE_KEY` are injected by Lovable Cloud. They are read
inside server-only handlers and never exposed via `VITE_*` variables.
