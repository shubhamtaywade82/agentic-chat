// MCP (Model Context Protocol) integration types.
//
// MCP servers extend the agent's tool surface dynamically. Each enabled
// server exposes a list of tools; those tools get injected into the LLM's
// system prompt alongside the built-in live-tools, and the agent can call
// them using the `mcp__<serverSlug>__<toolName>` naming convention.

export type McpTransport = "stdio" | "http" | "sse"

export interface McpServerConfig {
  id: string
  /** Human-readable server name; slugified to form the tool-name prefix. */
  name: string
  description?: string
  transport: McpTransport
  enabled: boolean

  // ── stdio transport fields ───────────────────────────────────────────
  /** Shell command to spawn, e.g. "npx" or "uvx" or "node". */
  command?: string
  /** Args passed to the command. */
  args?: string[]
  /** Environment variables for the spawned process. */
  env?: Record<string, string>

  // ── http / sse transport fields ──────────────────────────────────────
  /** Remote server URL (http or sse transport). */
  url?: string
  /** Extra headers for HTTP/SSE transport (e.g. Authorization). */
  headers?: Record<string, string>

  // ── runtime metadata (populated after a successful test/connect) ────
  lastConnectedAt?: number
  lastToolCount?: number
  lastError?: string
}

export interface McpToolDescriptor {
  serverId: string
  serverName: string
  serverSlug: string
  /** Local tool name as exposed by the MCP server. */
  toolName: string
  /** Agent-facing name: `mcp__<serverSlug>__<toolName>`. */
  fullName: string
  description: string
  /** JSON Schema describing the tool's input parameters. */
  inputSchema: unknown
}

// Convert a server name to a slug usable inside `mcp__<slug>__<tool>`.
// Strips non-alphanumerics, lowercases, collapses to underscores.
export function mcpServerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "server"
}

// Build the agent-facing tool name for an MCP tool.
export function buildMcpToolName(serverSlug: string, toolName: string): string {
  return `mcp__${serverSlug}__${toolName}`
}

// Parse an `mcp__`-prefixed tool name back into its parts.
export function parseMcpToolName(
  fullName: string
): { serverSlug: string; toolName: string } | null {
  const m = fullName.match(/^mcp__([a-z0-9_]+)__(.+)$/)
  if (!m) return null
  return { serverSlug: m[1], toolName: m[2] }
}

// Returns true if a tool name uses the MCP namespace prefix.
export function isMcpToolName(name: string): boolean {
  return name.startsWith("mcp__")
}
