# Deployment

CodeMind is designed to deploy on Lovable Cloud with zero manual
configuration. The runtime is Cloudflare Workers (`workerd` + `nodejs_compat`).

## Publish from Lovable

1. Open the project in Lovable.
2. Click **Publish** in the top bar.
3. The site is served at
   `https://<project-slug>.lovable.app`. A custom domain can be attached
   from the same panel.

## Managed services

- **Auth, database, storage** — Supabase, provisioned per project. Managed
  via `supabase--migration` tool calls; do not edit `.env` values directly.
- **AI Gateway** — `LOVABLE_API_KEY` is minted automatically. The gateway
  serves `google/gemini-3.6-flash` for chat and pre-analysis stages.

## Build pipeline

`bun run build` runs the vitest suite first (`prebuild`), then Vite. A red
test fails the build.

## Health checks

- `/api/chat` — POST with a valid bearer + JSON body streams
  `text/event-stream`.
- `/sitemap.xml` — public, served for SEO.
- `/robots.txt` — public.

## Rollback

Every mutating turn snapshots the touched files in `file_snapshots`. The
last 10 assistant messages per thread keep their snapshots. From the chat
panel, hover an assistant reply and click **Undo** to restore its writes.
