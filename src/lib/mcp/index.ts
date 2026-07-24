import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getAppInfoTool from "./tools/get-app-info";

export default defineMcp({
  name: "codemind-mcp",
  title: "CodeMind MCP",
  version: "0.1.0",
  instructions:
    "Public MCP server for CodeMind. Use `echo` to verify connectivity and `get_app_info` to fetch public metadata about the app. No user data is exposed.",
  tools: [echoTool, getAppInfoTool],
});
