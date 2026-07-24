# Batch 2 — Plan

Scope is large; I'll ship it in one pass but grouped so nothing collides. Each group is independent and typechecked before moving on.

## 1. Chat UI — Task Cards + Stage Indicator (`src/components/workspace/ChatPanel.tsx`)
- New `ToolCallCard` component rendered inside assistant messages for each `tool-*` part:
  - Header: lucide icon per tool (`FileText`, `Pencil`, `Search`, `Terminal`, `Database`…), tool name, status pill (thinking=blue / running=amber / success=green / error=red), elapsed ms.
  - Collapsible body (closed by default) with `input` (JSON) and `output` (JSON or text).
  - On error: red banner + reason + "Retry" button (re-sends last user message).
- New `StageIndicator` strip above the streaming assistant message: `Understand → Locate → Plan → Apply → Verify`, current stage animated, completed stages checked. Driven by data-part events emitted from the server (see §3).
- Animated "Agent is thinking… <stage>" shimmer while `status === 'submitted' | 'streaming'`.
- Status color tokens added to `src/styles.css` (`--status-thinking/running/success/error`) — no hardcoded colors in TSX.

## 2. Agent behavior — auto self-review + long-term memory (`src/routes/api/chat.ts`, `src/lib/agent-engine.server.ts`)
- On `verifyPatches` failure: instead of immediate rollback, emit a `data-stage` part `{stage:'verify', status:'retry', issues}`, feed the issues back into a **single** follow-up `streamText` call constrained to `edit_file` only, then re-verify. Rollback only if the retry also fails. Cap at one retry to bound cost.
- Long-term memory: after `onFinish`, if `chat_messages` count for the thread % 20 === 0, spawn a summarizer (`generateText`, small prompt, current model) that condenses the last 20 turns into `{keywords, decisions, open_questions}` and upserts a `project_memory` row with `kind='thread_summary'`. Loaded back into the system prompt on the next turn (RAG-lite: pull top 3 summaries by recency + keyword overlap with `understanding.keywords`).

## 3. Stage streaming
- `chat.ts` writes `data-stage` UI message parts at each stage boundary (`understand`, `locate`, `plan`, `apply`, `verify`, `done`) using `createUIMessageStream` + `writer.write({type:'data-stage', data:{...}})`. Client reads `message.parts` filtered by `type === 'data-stage'` to drive `StageIndicator`.

## 4. Security
- **Rate limiting**: in-memory sliding window per `userId` on `POST /api/chat` (20 req/min). Documented as ad-hoc per project convention (backend has no standard primitive yet); user confirmed by asking for it.
- **CSRF**: `POST /api/chat` and mutating server fns already require Supabase bearer token; add `Origin`/`Referer` allow-list check (same-origin + `*.lovable.app`).
- **Session limits**: server-side `getUser()` re-validation already in `requireSupabaseAuth`; add short-circuit if `claims.exp` is within 60s (forces refresh).

## 5. Performance
- Preload the LCP asset on `/` (`head().links` with `rel="preload"`).
- `Cache-Control: public, max-age=3600, immutable` on `/api/public/*` GETs where safe (sitemap already static).
- React Query defaults: `staleTime: 30_000`, `gcTime: 5*60_000` in `src/router.tsx`.
- Add `<link rel="dns-prefetch">` for the Supabase URL in `__root.tsx`.

## 6. Tests (Vitest — already configured)
- Unit: extend `src/lib/__tests__/agent-engine.test.ts` with cases for the new self-review branch (`verifyPatches` fail → retry → success/fail paths).
- Integration: `src/routes/api/__tests__/chat.test.ts` — mock the gateway model, POST a fake `UIMessage[]`, assert stage parts stream in order and rate-limit kicks in at 21st call.
- Wire `bun test` into the build via `package.json` `scripts.build` prefix (`bun test --run && vite build`).

## 7. Sentry
- Add `@sentry/react` + `@sentry/tanstackstart-react` (edge-compatible). Init in `src/main.tsx` (browser) and `src/server.ts` (worker) gated on `VITE_SENTRY_DSN` / `SENTRY_DSN` env vars. If DSN unset → no-op (safe default; docs note how to set the secret).
- `reportLovableError` already exists — extend to also forward to Sentry when available.

## 8. Repo hygiene / docs
- Rewrite `README.md`: quickstart, env vars, architecture diagram (ASCII), scripts, deploy.
- Move ad-hoc docs into `docs/`:
  - `docs/AGENT_ENGINE.md` (exists — update with self-review + memory)
  - `docs/PROJECT_INDEX.md` (exists)
  - **new** `docs/CHAT_UI.md` (task cards + stage indicator contract)
  - **new** `docs/SECURITY.md` (rate limits, CSRF, RLS map)
  - **new** `docs/DEPLOYMENT.md` (Lovable Cloud, env, publish)
- `.env.example` with every `VITE_*` and server var name (no values).
- `AGENTS.md` updated to reflect the new pipeline.
- `.gitignore` audit; ensure `.lovable/`, `node_modules/`, `.env` local files ignored.

## Not included / deferred
- Full observability dashboard, load testing, e2e Playwright suite in CI, image upload pipeline (no user file-upload feature exists yet — will add only when the app introduces one).

## Technical notes
- Stage parts use AI SDK v5 `createUIMessageStream` with custom data parts; typed as `type UIDataTypes = { stage: {...} }` on both server and client.
- Rate limit map is per-worker-isolate memory; acceptable for current scale, replace with KV/Redis if traffic warrants.
- Sentry edge SDK is tree-shaken to zero cost when DSN is absent.

Reply "go" and I'll execute the whole batch and report every changed file.