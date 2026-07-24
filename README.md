# CodeMind

CodeMind is an AI pair-programmer that reads, patches, and refactors your
project files in real time. It ships as a full-stack TanStack Start app on
Lovable Cloud, with a staged Agent Engine, per-project symbol index, and a
first-class chat UI.

## Features

- **Staged Agent Engine** — every turn runs through 8 explicit stages
  (Receive → Understand → Locate → Read → Plan → Apply → Verify → Save) with
  automatic snapshotting and rollback on verification failure.
- **Project Index** — regex-based, Worker-safe symbol cache that lets the
  agent locate files without re-reading the whole tree.
- **Google Gemini 3.6 Flash** via the Lovable AI Gateway — fast reasoning,
  low token cost, no external API keys to manage.
- **Chat UI** built on AI SDK UI with tool-call cards, streaming stage
  indicators, and rollback per assistant message.
- **GitHub Sync** — link a repo, import or commit changes without leaving
  the workspace.
- **Rate limiting + CSRF origin checks** on the streaming chat endpoint.

## Getting started

```bash
bun install       # install dependencies
bun run dev       # start Vite on :8080
bun run test      # unit tests (agent-engine, verify, rollback)
bun run build     # production build (runs tests first)
```

Environment variables live in `.env` — see `.env.example` for the full list.
On Lovable Cloud all keys are injected automatically.

## Documentation

The `docs/` folder contains the deep-dives:

- [Agent Engine](docs/AGENT_ENGINE.md) — pipeline stages and failure modes
- [Project Index](docs/PROJECT_INDEX.md) — symbol cache and lifecycle
- [GitHub Sync](docs/GITHUB_SYNC.md) — repo linking and commit flow
- [Chat UI](docs/CHAT_UI.md) — how the chat renders tool calls and stages
- [Security](docs/SECURITY.md) — auth, RLS, rate limiting, CSRF
- [Deployment](docs/DEPLOYMENT.md) — publish to Lovable Cloud

## License

MIT — see [LICENSE](LICENSE).
