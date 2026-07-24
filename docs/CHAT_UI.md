# Chat UI

The chat panel (`src/components/workspace/ChatPanel.tsx`) is built on
`@ai-sdk/react` `useChat` with a same-origin transport that attaches the
Supabase bearer token to every request.

## Rendering pipeline

Each `UIMessage` is split into three groups of `parts`:

1. **`tool-*` parts** — rendered inside a collapsible `AgentActivity` card
   showing per-step progress. Statuses:
   - `input-streaming` / `input-available` → spinner, "running"
   - `output-available` + `output.ok` → green check
   - `output-available` + `!output.ok` → red X + error text
2. **`text` parts** — rendered as GitHub-flavoured markdown with
   syntax-highlighted code blocks that also expose Copy / Apply.
3. **Streaming cursor** — appended to the last assistant message while
   `status === "streaming"`.

## Thinking box

Before the assistant's first token arrives, `ThinkingBox` shows the current
stage (`🧠 Analyzing → 📖 Reading → ✏️ Patching → …`) with elapsed time. Once
tokens stream, the same activity moves inside the assistant bubble as
`AgentActivity`, so the user always sees one active surface.

## Rollback per message

Every assistant reply that mutated files stores a `file_snapshots` batch keyed
by message id. Hovering an assistant message reveals an **Undo** button that
calls `rollbackMessage()` — the server restores each snapshotted path,
deletes/recreates as needed, and invalidates the files query.

## Composer

- `@filename` — fuzzy file mention (top-8 matches, inserted with a space).
- `/search`, `/create`, `/refactor`, `/explain`, `/diff`, `/rollback` —
  slash commands populate a template.
- Enter submits; Shift+Enter for a newline; textarea auto-grows 2 → 6 rows.

## Design tokens

Status colors are semantic (`text-primary`, `text-emerald-500`,
`text-destructive`). Never hardcode brand colors.
