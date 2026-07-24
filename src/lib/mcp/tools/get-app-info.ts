import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_app_info",
  title: "Get app info",
  description:
    "Return public metadata about this CodeMind app (name, description, capabilities). No user data is exposed.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            name: "CodeMind",
            description:
              "AI-powered coding workspace: edit files, chat with an AI agent, and preview projects in real time.",
            capabilities: ["chat", "file-editing", "project-index", "github-sync"],
          },
          null,
          2,
        ),
      },
    ],
  }),
});
