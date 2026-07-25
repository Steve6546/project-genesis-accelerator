import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  FilePlus2,
  Wrench,
  ChevronDown,
  ChevronRight,
  Undo2,
  Pencil,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  ArrowDown,
  History as HistoryIcon,
  Paperclip,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThreadList } from "./ThreadList";
import { supabase } from "@/integrations/supabase/client";
import {
  listMessages,
  createFile,
  updateFile,
  listFiles,
  deleteMessage,
  updateMessage,
  rollbackMessage,
} from "@/lib/workspace.functions";
import { motion, AnimatePresence } from "framer-motion";


type OpenFile = { path: string; language: string | null; content: string };

function CodeBlock({
  code,
  language,
  projectId,
  onApplied,
}: {
  code: string;
  language: string;
  projectId: string;
  onApplied: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const createFn = useServerFn(createFile);
  const updateFn = useServerFn(updateFile);
  const listFn = useServerFn(listFiles);

  const firstLine = code.split("\n", 1)[0] ?? "";
  const m = firstLine.match(/^\s*(?:\/\/|#|<!--)\s*([\w./\-]+\.\w+)\s*(?:-->)?\s*$/);
  const path = m?.[1];
  const bodyCode = path ? code.split("\n").slice(1).join("\n") : code;

  const copy = async () => {
    await navigator.clipboard.writeText(bodyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const apply = async () => {
    if (!path) return;
    setApplying(true);
    try {
      const files = await listFn({ data: { projectId } });
      const existing = files.find((f) => f.path === path && !f.is_folder);
      if (existing) {
        await updateFn({ data: { id: existing.id, content: bodyCode } });
      } else {
        const created = await createFn({ data: { projectId, path } });
        await updateFn({ data: { id: created.id, content: bodyCode } });
      }
      setApplied(true);
      onApplied();
      setTimeout(() => setApplied(false), 2000);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-md border border-border bg-[#1e1e1e]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
        <span className="truncate font-mono">{path ?? language}</span>
        <div className="flex items-center gap-1">
          <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {path && (
            <button
              onClick={apply}
              disabled={applying}
              className="flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {applying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : applied ? (
                <Check className="h-3 w-3" />
              ) : (
                <FilePlus2 className="h-3 w-3" />
              )}
              {applied ? "Applied" : "Apply"}
            </button>
          )}
        </div>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: "0.7rem 0.85rem", fontSize: 13, background: "transparent" }}
        wrapLongLines
      >
        {bodyCode}
      </SyntaxHighlighter>
    </div>
  );
}

function ToolPart({
  part,
}: {
  part: { type: string; state?: string; input?: unknown; output?: unknown; toolName?: string };
}) {
  const toolName = part.toolName ?? part.type.replace(/^tool-/, "");
  const state = part.state ?? "";
  const running = state === "input-streaming" || state === "input-available";
  const output = part.output as
    | { ok?: boolean; action?: string; path?: string; from?: string; to?: string; error?: string; stdout?: string; stderr?: string; summary?: string }
    | undefined;
  const failed = output && !output.ok;
  const done = output?.ok === true;
  // Auto-expand while running so the user sees live progress; collapse once done.
  const [openState, setOpenState] = useState<boolean | null>(null);
  const open = openState ?? (running || failed);

  const verb: Record<string, string> = {
    read_file: "Read",
    write_file: "Wrote",
    edit_file: "Patched",
    delete_file: "Deleted",
    delete_path: "Deleted",
    create_folder: "Created folder",
    rename_file: "Renamed",
    move_path: "Moved",
    list_files: "Listed files",
    grep: "Searched",
    run_typecheck: "Type-checked",
    run_tests: "Ran tests",
    run_lint: "Linted",
  };
  const input = part.input as { path?: string; from?: string; to?: string; pattern?: string } | undefined;
  const target =
    input?.path ?? (input?.from && input?.to ? `${input.from} → ${input.to}` : input?.pattern ?? "");
  const summary = output?.summary
    ? output.summary
    : output?.ok
      ? output.action === "renamed"
        ? `Renamed ${output.from} → ${output.to}`
        : `${verb[toolName] ?? toolName} ${output.path ?? target}`.trim()
      : output && !output.ok
        ? `${toolName} failed: ${output.error ?? "error"}`
        : `${verb[toolName] ?? toolName}${target ? ` ${target}` : "…"}`;

  const Icon = running ? Loader2 : failed ? XCircle : done ? CheckCircle2 : Wrench;

  return (
    <div
      className={`my-1.5 rounded-md border text-[12px] ${
        failed
          ? "border-destructive/40 bg-destructive/5"
          : done
            ? "border-emerald-500/30 bg-emerald-500/5"
            : running
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card/60"
      }`}
    >
      <button onClick={() => setOpenState(!open)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon
          className={`h-3.5 w-3.5 flex-shrink-0 ${
            running ? "animate-spin text-primary" : failed ? "text-destructive" : done ? "text-emerald-500" : "text-primary"
          }`}
        />
        <span className="truncate font-mono">{summary}</span>
        {running && <span className="ml-auto text-[10px] text-primary">streaming…</span>}
      </button>
      {open && (
        <div className="border-t border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground space-y-1.5">
          {part.input != null && (
            <div>
              <div className="opacity-60">input{running ? " (streaming)" : ""}:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            </div>
          )}
          {output?.stdout && (
            <div>
              <div className="opacity-60 text-emerald-500/80">stdout:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all max-h-56 rounded bg-black/30 p-1.5 text-emerald-200/90">
                {output.stdout}
              </pre>
            </div>
          )}
          {output?.stderr && (
            <div>
              <div className="opacity-60 text-destructive/80">stderr:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all max-h-56 rounded bg-black/30 p-1.5 text-destructive/90">
                {output.stderr}
              </pre>
            </div>
          )}
          {output != null && !output.stdout && !output.stderr && (
            <div>
              <div className="opacity-60">output:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
          {done && output?.summary && (
            <div className="mt-1 rounded border-l-2 border-emerald-500 bg-emerald-500/5 px-2 py-1 text-emerald-500/90 text-[11px]">
              ✓ {output.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  projectId,
  threadId,
  openFiles,
  allFilePaths,
  activeFilePath,
  onAgentWrite,
  onAgentTouchPath,
}: {
  projectId: string;
  threadId: string;
  openFiles: OpenFile[];
  allFilePaths: string[];
  activeFilePath?: string;
  onAgentWrite?: (path: string, content: string) => void;
  onAgentTouchPath?: (path: string) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMessages);
  const deleteMsgFn = useServerFn(deleteMessage);
  const updateMsgFn = useServerFn(updateMessage);
  const rollbackFn = useServerFn(rollbackMessage);


  const { data: history } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listFn({ data: { threadId } }),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!history) return [];
    return history.map((m) => ({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: (m.parts as UIMessage["parts"]) ?? [],
    }));
  }, [history]);

  const timestamps = useMemo(() => {
    const map = new Map<string, string>();
    history?.forEach((m) => map.set(m.id, m.created_at));
    return map;
  }, [history]);

  const ctxRef = useRef({ openFiles, allFilePaths });
  ctxRef.current = { openFiles, allFilePaths };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          const bodyObj = init?.body ? JSON.parse(init.body as string) : {};
          const augmented = JSON.stringify({
            ...bodyObj,
            threadId,
            projectId,
            openFiles: ctxRef.current.openFiles,
            allFilePaths: ctxRef.current.allFilePaths,
          });
          return fetch(url, { ...init, headers, body: augmented });
        },
      }),
    [projectId, threadId],
  );

  const { messages, sendMessage, setMessages, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => console.error(e),
  });

  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distance < 80);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, stickToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  // Keep textarea height in sync with content (handles clear-after-submit and
  // programmatic sets from mention/slash insertion).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  const seenToolCallsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let touched = false;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const p of m.parts as Array<{
        type: string;
        state?: string;
        toolCallId?: string;
        toolName?: string;
        input?: { path?: string; from?: string; to?: string; content?: string };
        output?: { ok?: boolean; action?: string };
      }>) {
        if (!p.type.startsWith("tool-")) continue;
        if (p.state !== "output-available") continue;
        const id = p.toolCallId ?? `${m.id}-${p.type}`;
        if (seenToolCallsRef.current.has(id)) continue;
        seenToolCallsRef.current.add(id);
        if (!p.output?.ok) continue;
        const tool = p.toolName ?? p.type.replace(/^tool-/, "");
        touched = true;
        if (tool === "write_file" && p.input?.path && typeof p.input.content === "string") {
          onAgentWrite?.(p.input.path, p.input.content);
        } else if (tool === "edit_file" && p.input?.path) {
          onAgentTouchPath?.(p.input.path);
        } else if (tool === "move_path" || tool === "rename_file") {
          if (p.input?.from) onAgentTouchPath?.(p.input.from);
          if (p.input?.to) onAgentTouchPath?.(p.input.to);
        }
      }
    }
    if (touched) qc.invalidateQueries({ queryKey: ["files", projectId] });
  }, [messages, qc, projectId, onAgentWrite, onAgentTouchPath]);

  const isLoading = status === "submitted" || status === "streaming";
  const lastMsg = messages[messages.length - 1];
  // Only show the standalone ThinkingBox until the assistant message starts streaming.
  // After that, agent activity is rendered INSIDE the assistant bubble via <AgentActivity/>.
  const showThinking = status === "submitted" || (isLoading && lastMsg?.role !== "assistant");

  // When a stream finishes, refresh the thread list so auto-generated titles appear.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      qc.invalidateQueries({ queryKey: ["threads", projectId] });
    }
    prevStatusRef.current = status;
  }, [status, qc, projectId]);

  const [attachments, setAttachments] = useState<Array<{ url: string; mediaType: string; name: string }>>([]);

  const submit = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isLoading) return;
    setInput("");
    const files = attachments;
    setAttachments([]);
    if (files.length > 0) {
      const parts: UIMessage["parts"] = [
        ...(text ? [{ type: "text" as const, text }] : []),
        ...files.map((f) => ({
          type: "file" as const,
          url: f.url,
          mediaType: f.mediaType,
          filename: f.name,
        })),
      ];
      await sendMessage({ role: "user", parts } as never);
    } else {
      await sendMessage({ text });
    }
  };


  const onApplied = () => qc.invalidateQueries({ queryKey: ["files", projectId] });

  const undoMut = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await deleteMsgFn({ data: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", threadId] }),
  });

  const undoLast = () => {
    if (isLoading || messages.length === 0) return;
    // Remove the last assistant turn + the user turn that triggered it
    const toRemove: string[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      toRemove.push(m.id);
      if (m.role === "user") break;
    }
    if (!toRemove.length) return;
    if (!confirm("Undo the last exchange? This cannot be reversed.")) return;
    const removeSet = new Set(toRemove);
    setMessages((prev) => prev.filter((m) => !removeSet.has(m.id)));
    // Only delete persisted messages (skip optimistic IDs that haven't synced)
    undoMut.mutate(toRemove.filter((id) => timestamps.has(id)));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, parts: [{ type: "text", text }] } : m)),
    );
    if (timestamps.has(editingId)) {
      await updateMsgFn({ data: { id: editingId, text } });
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
    }
    setEditingId(null);
    setEditingText("");
  };

  const rollbackOne = async (messageId: string) => {
    if (!confirm("Roll back the file changes from this reply?")) return;
    try {
      const res = await rollbackFn({ data: { projectId, messageId } });
      qc.invalidateQueries({ queryKey: ["files", projectId] });
      if (res.restored === 0) {
        alert("No file changes were recorded for this reply.");
      } else {
        // Force any open tabs to reload from disk
        for (const m of messages) {
          if (m.id !== messageId) continue;
          for (const p of m.parts as Array<{ type: string; input?: { path?: string; from?: string; to?: string } }>) {
            if (!p.type.startsWith("tool-")) continue;
            if (p.input?.path) onAgentTouchPath?.(p.input.path);
            if (p.input?.from) onAgentTouchPath?.(p.input.from);
            if (p.input?.to) onAgentTouchPath?.(p.input.to);
          }
        }
      }
    } catch (e) {
      console.error(e);
      alert("Rollback failed.");
    }
  };


  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI Agent
        </span>
        <div className="ml-auto flex items-center gap-1">
          {activeFilePath && (
            <span className="hidden sm:inline truncate text-[10px] text-muted-foreground max-w-[160px]">
              ctx: {activeFilePath}
            </span>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button
                title="Chat history"
                className="flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <HistoryIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">History</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0" sideOffset={6}>
              <ThreadList projectId={projectId} activeThreadId={threadId} />
            </PopoverContent>
          </Popover>
          <button
            onClick={undoLast}
            disabled={isLoading || messages.length === 0}
            title="Undo last exchange"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 space-y-5 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">
              The agent can edit your files directly. Try:
            </p>
            <ul className="space-y-1">
              <li>• "Add a login() function to src/main.py"</li>
              <li>• "Create src/utils/auth.ts with JWT helpers"</li>
              <li>• "Rename src/main.py to src/app.py"</li>
              <li>• "Split this file into smaller modules"</li>
              <li>• "Find where 'handleError' is used in the project"</li>
            </ul>
          </div>
        )}
        {messages.map((m) => {
          const ts = timestamps.get(m.id);
          const time = ts ? formatTime(new Date(ts)) : "";
          const isUser = m.role === "user";
          const textOfMsg = m.parts
            .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
            .join("");
          const isEditing = editingId === m.id;
          const messageBody = isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                rows={3}
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="rounded border border-border px-2 py-1 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none break-words text-[14px] leading-relaxed">
              {(() => {
                const parts = m.parts as Array<{ type: string; text?: string; state?: string; toolName?: string; input?: unknown; output?: unknown }>;
                const toolParts = parts.filter((p) => p.type.startsWith("tool-"));
                const textParts = parts
                  .map((p, i) => ({ p, i }))
                  .filter(({ p }) => p.type === "text");
                const isStreaming = status === "streaming" && m.id === lastMsg?.id;
                return (
                  <>
                    {toolParts.length > 0 && (
                      <AgentActivity parts={toolParts as never} streaming={isStreaming} />
                    )}
                    {textParts.map(({ p, i }) => (
                      <ReactMarkdown
                        key={i}
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "");
                            const text = String(children).replace(/\n$/, "");
                            const isBlock = text.includes("\n") || !!match;
                            if (!isBlock) {
                              return (
                                <code className="rounded bg-muted px-1 py-0.5 text-[13px]" {...props}>
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <CodeBlock
                                code={text}
                                language={match?.[1] ?? "text"}
                                projectId={projectId}
                                onApplied={onApplied}
                              />
                            );
                          },
                        }}
                      >
                        {(p.text ?? "")}
                      </ReactMarkdown>
                    ))}
                  </>
                );
              })()}
            </div>
          );

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`group flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                  isUser ? "bg-primary text-primary-foreground" : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              </div>
              <div className={`min-w-0 ${isUser ? "max-w-[85%]" : "flex-1"}`}>
                <div
                  className={`mb-1 flex items-center gap-2 text-[11px] text-muted-foreground ${
                    isUser ? "flex-row-reverse" : ""
                  }`}
                >
                  <span className={`font-semibold ${isUser ? "text-primary" : "text-emerald-400"}`}>
                    {isUser ? "You" : "CodeMind"}
                  </span>
                  {time && <span>{time}</span>}
                  {isUser && !isEditing && textOfMsg && (
                    <button
                      onClick={() => {
                        setEditingId(m.id);
                        setEditingText(textOfMsg);
                      }}
                      className="opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                      title="Edit message"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {!isUser && timestamps.has(m.id) && (
                    <button
                      onClick={() => rollbackOne(m.id)}
                      className="ml-auto opacity-0 transition group-hover:opacity-100 hover:text-foreground flex items-center gap-1"
                      title="Roll back file changes from this reply"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>
                {isUser && !isEditing ? (
                  <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-primary-foreground text-[14px] leading-relaxed break-words whitespace-pre-wrap">
                    {textOfMsg}
                  </div>
                ) : !isUser ? (
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-card/60 px-3.5 py-2">
                    {messageBody}
                    {status === "streaming" && m.id === lastMsg?.id && (
                      <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary align-middle" />
                    )}
                  </div>
                ) : (
                  messageBody
                )}
              </div>
            </motion.div>
          );
        })}
        {showThinking && <ThinkingBox lastMessage={lastMsg} status={status} />}
      </div>
      {!stickToBottom && (
        <button
          onClick={() => {
            setStickToBottom(true);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] shadow-md hover:bg-accent backdrop-blur"
        >
          <ArrowDown className="h-3 w-3" />
          Jump to latest
        </button>
      )}
      </div>



      <ChatComposer
        input={input}
        setInput={setInput}
        submit={submit}
        isLoading={isLoading}
        allFilePaths={allFilePaths}
        inputRef={inputRef}
        attachments={attachments}
        setAttachments={setAttachments}
        threadId={threadId}
      />
    </div>
  );
}

const SLASH_COMMANDS: Array<{ cmd: string; desc: string; template: string }> = [
  { cmd: "/search", desc: "Search across all files", template: "/search " },
  { cmd: "/create", desc: "Create a new file", template: "/create " },
  { cmd: "/refactor", desc: "Refactor the active file", template: "/refactor " },
  { cmd: "/explain", desc: "Explain the active file", template: "/explain " },
  { cmd: "/diff", desc: "Show the last diff", template: "/diff" },
  { cmd: "/rollback", desc: "Undo the last agent change", template: "/rollback" },
];

type Attachment = { url: string; mediaType: string; name: string };

function ChatComposer({
  input,
  setInput,
  submit,
  isLoading,
  allFilePaths,
  inputRef,
  attachments,
  setAttachments,
  threadId,
}: {
  input: string;
  setInput: (v: string) => void;
  submit: () => void;
  isLoading: boolean;
  allFilePaths: string[];
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  threadId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(`"${file.name}" is too large (max 5 MB)`);
      return;
    }
    setUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${uid}/${threadId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("chat-attachments").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error("Sign URL failed");
      setAttachments((prev) => [...prev, { url: signed.data.signedUrl, mediaType: file.type, name: file.name }]);
    } catch (e) {
      console.error(e);
      alert(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const uploadMany = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    for (const f of images) await uploadImage(f);
  };


  // Auto-grow textarea between 2 and 6 rows
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const minH = lineHeight * 2 + 16;
    const maxH = lineHeight * 6 + 16;
    el.style.height = Math.min(maxH, Math.max(minH, el.scrollHeight)) + "px";
  }, [input, inputRef]);
  const caret = inputRef.current?.selectionStart ?? input.length;
  const before = input.slice(0, caret);
  const mentionMatch = /(?:^|\s)@([\w./\-]*)$/.exec(before);
  const slashMatch = /^\/(\w*)$/.exec(input);

  const mentionQuery = mentionMatch?.[1] ?? null;
  const slashQuery = slashMatch?.[1] ?? null;

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return allFilePaths.filter((p) => p.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, allFilePaths]);

  const slashMatches = useMemo(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.cmd.slice(1).startsWith(q));
  }, [slashQuery]);

  const insertMention = (path: string) => {
    if (!mentionMatch) return;
    const at = before.lastIndexOf("@");
    const next = input.slice(0, at) + `@${path} ` + input.slice(caret);
    setInput(next);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const insertSlash = (template: string) => {
    setInput(template);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const showSuggestions = mentionMatches.length > 0 || slashMatches.length > 0;

  return (
    <div className="border-t border-border p-2 sm:p-3">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div key={i} className="relative group">
              <img
                src={a.url}
                alt={a.name}
                className="h-16 w-16 rounded border border-border object-cover"
              />
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {uploading && (
            <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
      <div className="relative rounded-md border border-border bg-background focus-within:border-primary">
        {showSuggestions && (
          <div className="absolute bottom-full left-0 right-0 mb-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-10">
            {slashMatches.map((c) => (
              <button
                key={c.cmd}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertSlash(c.template);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="font-mono text-primary">{c.cmd}</span>
                <span className="text-muted-foreground">{c.desc}</span>
              </button>
            ))}
            {mentionMatches.map((p) => (
              <button
                key={p}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(p);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="font-mono">@{p}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 200) + "px";
          }}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData?.items ?? []);
            const img = items.find((it) => it.type.startsWith("image/"));
            if (img) {
              const f = img.getAsFile();
              if (f) {
                e.preventDefault();
                void uploadImage(f);
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !showSuggestions) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask the agent… try /search, /refactor or @filename (paste an image)"
          rows={1}
          className="w-full resize-none bg-transparent px-3 py-2 pr-20 text-[14px] outline-none placeholder:text-muted-foreground overflow-y-auto min-h-[44px] max-h-[200px] leading-relaxed"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadImage(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isLoading}
          className="absolute bottom-2 right-11 rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
          title="Attach image"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          onClick={submit}
          disabled={(!input.trim() && attachments.length === 0) || isLoading || uploading}
          className="absolute bottom-2 right-2 rounded-md bg-primary p-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          title="Send (Enter)"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


const STAGES = [
  { id: "understand", label: "Understand" },
  { id: "locate", label: "Locate" },
  { id: "plan", label: "Plan" },
  { id: "apply", label: "Apply" },
  { id: "verify", label: "Verify" },
] as const;

function ThinkingBox({
  lastMessage,
  status,
}: {
  lastMessage: UIMessage | undefined;
  status: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
    return () => clearInterval(id);
  }, []);

  // Infer the current stage from streamed parts.
  const currentStage = useMemo<(typeof STAGES)[number]["id"]>(() => {
    if (!lastMessage || lastMessage.role !== "assistant") return "understand";
    const parts = (lastMessage.parts as Array<{ type: string; state?: string; toolName?: string }>) ?? [];
    const tools = parts.filter((p) => p.type.startsWith("tool-"));
    if (!tools.length) return status === "streaming" ? "plan" : "locate";
    const hasWrite = tools.some((p) =>
      ["write_file", "edit_file", "patch_file", "apply_patch", "create_file", "delete_file", "delete_path", "rename_file", "move_path"]
        .includes(p.toolName ?? p.type.replace(/^tool-/, "")),
    );
    const hasVerify = tools.some((p) => {
      const n = p.toolName ?? p.type.replace(/^tool-/, "");
      return ["run_typecheck", "run_tests", "run_lint"].includes(n);
    });
    if (hasVerify) return "verify";
    if (hasWrite) return "apply";
    return "locate";
  }, [lastMessage, status]);

  const activeIdx = STAGES.findIndex((s) => s.id === currentStage);

  const activityParts = useMemo(() => {
    if (!lastMessage || lastMessage.role !== "assistant") return [];
    const parts = lastMessage.parts as Array<{
      type: string; state?: string; toolName?: string;
      input?: { path?: string; from?: string; to?: string; pattern?: string };
    }>;
    return parts.filter((p) => p.type.startsWith("tool-")).slice(-6);
  }, [lastMessage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5"
    >
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
      <div className="flex-1 min-w-0 rounded-lg border border-border bg-card/60 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12px] font-medium">
          <span>Agent working…</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{elapsed}s</span>
        </div>
        {/* Stage bar */}
        <div className="flex items-center gap-1 px-3 pt-2">
          {STAGES.map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <div key={s.id} className="flex flex-1 items-center gap-1">
                <div
                  className={`flex h-1.5 flex-1 items-center rounded-full ${
                    done ? "bg-emerald-500" : active ? "bg-primary" : "bg-muted"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium ${
                    done ? "text-emerald-500" : active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <ul className="px-3 py-2 space-y-1">
          <AnimatePresence initial={false}>
            {activityParts.map((p, idx) => {
              const name = p.toolName ?? p.type.replace(/^tool-/, "");
              const target = p.input?.path ?? (p.input?.from ? `${p.input.from} → ${p.input.to}` : p.input?.pattern ?? "");
              const done = p.state === "output-available";
              return (
                <motion.li
                  key={`${idx}-${name}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 text-[11px] font-mono"
                >
                  {done ? (
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-primary" />
                  )}
                  <span className="text-muted-foreground">{name}</span>
                  <span className="truncate">{target}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {status === "streaming" && (
            <li className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="text-base leading-none">💬</span>
              <span>Writing response…</span>
            </li>
          )}
        </ul>
      </div>
    </motion.div>
  );
}


type ToolPartLike = {
  type: string;
  state?: string;
  toolName?: string;
  input?: { path?: string; from?: string; to?: string; pattern?: string };
  output?: { ok?: boolean; error?: string; action?: string; path?: string; from?: string; to?: string };
};

function AgentActivity({ parts, streaming }: { parts: ToolPartLike[]; streaming: boolean }) {
  const [open, setOpen] = useState(streaming);
  useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming]);

  const total = parts.length;
  const done = parts.filter((p) => p.state === "output-available").length;
  const failed = parts.filter((p) => p.state === "output-available" && p.output?.ok === false).length;
  const allDone = done === total && total > 0;

  const headerLabel = streaming
    ? `Working… ${done}/${total} steps`
    : failed
      ? `Completed with ${failed} error${failed === 1 ? "" : "s"} · ${total} step${total === 1 ? "" : "s"}`
      : `Completed ${total} step${total === 1 ? "" : "s"}`;

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className={`not-prose my-2 overflow-hidden rounded-lg border ${
        failed ? "border-destructive/40 bg-destructive/5" : "border-border bg-card/40"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px]"
      >
        {streaming ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : failed ? (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        ) : allDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Wrench className="h-3.5 w-3.5 text-primary" />
        )}
        <span className="font-medium">{headerLabel}</span>
        <span className="ml-auto">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {total > 0 && (
        <div className="h-0.5 w-full bg-border/60">
          <motion.div
            className={`h-full ${failed ? "bg-destructive" : allDone ? "bg-emerald-500" : "bg-primary"}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
      )}
      <AnimatePresence initial={false}>

        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-2 py-2 space-y-1">
              {parts.map((p, i) => (
                <ToolPart key={i} part={p as never} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
