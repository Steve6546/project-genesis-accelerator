# AGENTS.md — CodeMind project rules

Rules injected into every agent turn. Keep it short and imperative.

## Stack

- TanStack Start v1 (Vite 7, React 19, Tailwind v4).
- Supabase via Lovable Cloud for auth, DB, storage.
- AI SDK 6 + Lovable AI Gateway. Default model: `google/gemini-3.6-flash`.

## Non-negotiables

- Read a file before you edit it. `edit_file` on unread files is forbidden.
- Never delete files or folders without explicit user consent in the same
  turn ("delete", "remove", "احذف").
- Preserve existing imports, exports, types, and unrelated code.
- Match the project's style — TypeScript strict, no `any`, named exports,
  Tailwind, shadcn.
- Finish with a single short report sentence: "Updated X to do Y."

## Design tokens

Colors, gradients, shadows live in `src/styles.css` as semantic tokens.
Never hardcode Tailwind color classes (`text-white`, `bg-black`, `bg-[#...]`).
