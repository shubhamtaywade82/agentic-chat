/**
 * Bridges OpenUI's `toolProvider` prop to Nexum.
 *
 * We pass the MCP-client shape (`callTool({ name, arguments })`) rather than
 * a function map, so any tool name the generated UI uses reaches Nexum —
 * no hand-kept list of names to drift from Nexum's catalog. Each call POSTs
 * to `/api/tool`, which proxies to the chat's Nexum session; Nexum executes
 * read-only tools under its own credentials and policy and refuses the rest.
 *
 * See docs/openui-integration.md §5.4 (Pattern D).
 */

import type { McpClientLike } from "@openuidev/react-lang"

type McpCallResult = Awaited<ReturnType<McpClientLike["callTool"]>>

async function callNexumTool(
  tool: string,
  args: Record<string, unknown>,
  nexumSessionId: string | undefined,
): Promise<McpCallResult> {
  const res = await fetch("/api/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, args, nexumSessionId }),
  })
  const json = (await res.json()) as { ok: boolean; data?: unknown; error?: string }
  if (!json.ok) {
    // isError makes the renderer surface the message as a tool failure.
    return { content: [{ type: "text", text: json.error || `Tool ${tool} failed` }], isError: true }
  }
  return { content: [], structuredContent: json.data }
}

/** Builds the OpenUI tool provider bound to one chat's Nexum session. */
export function buildToolProvider(nexumSessionId: string | undefined): McpClientLike {
  return {
    callTool: ({ name, arguments: args }) => callNexumTool(name, args ?? {}, nexumSessionId),
  }
}

export default buildToolProvider
