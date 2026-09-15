// McpClientManager — spawns/connects to MCP servers, lists their tools, and
// dispatches tool calls.
//
// Lifecycle:
//   const mgr = new McpClientManager()
//   const tools = await mgr.connectAll(enabledServers)
//   // ... use mgr.callTool(fullName, args) inside the ReAct loop ...
//   await mgr.closeAll()
//
// Transports supported:
//   - stdio : spawn a local child process (npx / uvx / node / python)
//   - http  : connect to a remote MCP server over HTTP (streamable-http)
//   - sse   : connect to a remote MCP server over Server-Sent Events (legacy)
//
// All operations are best-effort: a single server failing to start does not
// affect the others. Failures are captured per-server in `lastError` and
// surfaced back to the caller via the return value of connectAll().

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import type { McpServerConfig, McpToolDescriptor } from "./types"
import { mcpServerSlug, buildMcpToolName } from "./types"

const CLIENT_INFO = { name: "agentic-chat", version: "0.2.1" }
const CLIENT_CAPABILITIES = {}

interface ServerEntry {
  config: McpServerConfig
  client: Client
  tools: McpToolDescriptor[]
  slug: string
}

export interface ConnectResult {
  tools: McpToolDescriptor[]
  errors: { serverId: string; serverName: string; error: string }[]
}

export class McpClientManager {
  private servers = new Map<string, ServerEntry>()

  // Connect to all enabled servers in parallel. Returns the flat list of
  // discovered tools and a per-server error list. Servers that fail are
  // skipped — they won't appear in `tools` and their error is in `errors`.
  async connectAll(servers: McpServerConfig[]): Promise<ConnectResult> {
    const enabled = servers.filter((s) => s.enabled)
    const results = await Promise.all(
      enabled.map((cfg) => this.connectOne(cfg).catch((err) => ({
        config: cfg,
        tools: [] as McpToolDescriptor[],
        error: err instanceof Error ? err.message : String(err),
      })))
    )

    const allTools: McpToolDescriptor[] = []
    const errors: ConnectResult["errors"] = []

    for (const r of results) {
      if (r.error) {
        errors.push({
          serverId: r.config.id,
          serverName: r.config.name,
          error: r.error,
        })
        continue
      }
      allTools.push(...r.tools)
    }

    return { tools: allTools, errors }
  }

  // Connect to a single MCP server. Throws on failure.
  private async connectOne(cfg: McpServerConfig): Promise<{ config: McpServerConfig; tools: McpToolDescriptor[]; error?: string }> {
    const slug = mcpServerSlug(cfg.name)
    const transport = this.buildTransport(cfg)
    const client = new Client(CLIENT_INFO, { capabilities: CLIENT_CAPABILITIES })

    // 30s startup timeout — npx can be slow on first run while it downloads
    // the package; subsequent runs are fast.
    await this.withTimeout(client.connect(transport), 30_000, `connect(${cfg.name})`)

    const toolsList = (await this.withTimeout(client.listTools(), 10_000, `listTools(${cfg.name})`)) as {
      tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>
    }
    const slugCount = this.countSlugCollision(slug)
    const finalSlug = slugCount === 0 ? slug : `${slug}_${slugCount}`

    const tools: McpToolDescriptor[] = (toolsList.tools || []).map((t) => ({
      serverId: cfg.id,
      serverName: cfg.name,
      serverSlug: finalSlug,
      toolName: t.name,
      fullName: buildMcpToolName(finalSlug, t.name),
      description: t.description || "(no description)",
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    }))

    this.servers.set(cfg.id, { config: cfg, client, tools, slug: finalSlug })
    return { config: cfg, tools }
  }

  private buildTransport(cfg: McpServerConfig) {
    if (cfg.transport === "stdio") {
      if (!cfg.command) throw new Error(`MCP server "${cfg.name}": stdio transport requires a command`)
      // StdioClientTransport expects a Record<string, string> (no undefined
      // values), but process.env has type Record<string, string | undefined>.
      // Filter out undefined entries to satisfy the type.
      const baseEnv: Record<string, string> = {}
      for (const [k, v] of Object.entries(process.env)) {
        if (v !== undefined) baseEnv[k] = v
      }
      return new StdioClientTransport({
        command: cfg.command,
        args: cfg.args || [],
        env: cfg.env ? { ...baseEnv, ...cfg.env } : baseEnv,
      })
    }
    if (cfg.transport === "http") {
      if (!cfg.url) throw new Error(`MCP server "${cfg.name}": http transport requires a url`)
      return new StreamableHTTPClientTransport(new URL(cfg.url), {
        requestInit: cfg.headers ? { headers: cfg.headers as Record<string, string> } : undefined,
      })
    }
    if (cfg.transport === "sse") {
      if (!cfg.url) throw new Error(`MCP server "${cfg.name}": sse transport requires a url`)
      return new SSEClientTransport(new URL(cfg.url), {
        requestInit: cfg.headers ? { headers: cfg.headers as Record<string, string> } : undefined,
      })
    }
    throw new Error(`MCP server "${cfg.name}": unknown transport "${cfg.transport}"`)
  }

  // Counts how many already-connected servers use the same slug, so we can
  // disambiguate (e.g. two "memory" servers → memory, memory_1).
  private countSlugCollision(slug: string): number {
    let count = 0
    for (const entry of this.servers.values()) {
      if (entry.slug === slug || entry.slug.startsWith(`${slug}_`)) count++
    }
    return count
  }

  // Calls a tool by its agent-facing full name (`mcp__<slug>__<tool>`).
  // Returns the MCP call result (already unwrapped from the content array).
  async callTool(
    fullName: string,
    args: Record<string, unknown>
  ): Promise<{ summary: string; data: unknown }> {
    const entry = this.findServerByToolName(fullName)
    if (!entry) throw new Error(`No MCP server exposes tool "${fullName}"`)

    const tool = entry.tools.find((t) => t.fullName === fullName)
    if (!tool) throw new Error(`MCP tool "${fullName}" not found`)

    const result = await entry.client.callTool({
      name: tool.toolName,
      arguments: args,
    })

    // MCP returns content as an array of typed blocks (text, image, etc.).
    // For agent consumption we extract text blocks and join them; non-text
    // blocks are summarized as counts.
    const content = Array.isArray(result.content) ? result.content : []
    const textBlocks = content.filter((c: { type?: string }) => c?.type === "text") as { text?: string }[]
    const otherBlocks = content.filter((c: { type?: string }) => c?.type !== "text")

    const text = textBlocks.map((b) => b.text || "").join("\n").trim()
    const data = text || (otherBlocks.length > 0
      ? { content: result.content, isError: result.isError }
      : { result, isError: result.isError })

    return {
      summary: `${entry.config.name} → ${tool.toolName}${result.isError ? " (errored)" : ""}`,
      data,
    }
  }

  private findServerByToolName(fullName: string): ServerEntry | undefined {
    for (const entry of this.servers.values()) {
      if (entry.tools.some((t) => t.fullName === fullName)) return entry
    }
    return undefined
  }

  // Closes all connected clients in parallel. Safe to call multiple times.
  async closeAll(): Promise<void> {
    const entries = Array.from(this.servers.values())
    this.servers.clear()
    await Promise.allSettled(entries.map((e) => e.client.close()))
  }

  // Health check: pings every connected server with the MCP `ping`
  // method. Returns true only if ALL servers respond within the timeout.
  // Used by the connection pool to decide whether a cached connection is
  // still usable or needs to be recreated.
  async ping(timeoutMs = 5000): Promise<boolean> {
    const entries = Array.from(this.servers.values())
    if (entries.length === 0) return false
    try {
      const results = await Promise.allSettled(
        entries.map((e) => this.withTimeout(e.client.ping(), timeoutMs, `ping(${e.config.name})`))
      )
      // Healthy if at least one server responds. We don't require ALL to
      // respond because a single broken server shouldn't invalidate the
      // entire pool entry — the agent can still use the working servers.
      return results.some((r) => r.status === "fulfilled")
    } catch {
      return false
    }
  }

  // Returns a flat list of all currently-known MCP tools across all servers.
  listAllTools(): McpToolDescriptor[] {
    const all: McpToolDescriptor[] = []
    for (const entry of this.servers.values()) all.push(...entry.tools)
    return all
  }

  // Wraps a promise with a timeout. Rejects with a clear error message.
  private withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`MCP ${label} timed out after ${ms}ms`))
      }, ms)
      p.then(
        (v) => { clearTimeout(timer); resolve(v) },
        (err) => { clearTimeout(timer); reject(err) }
      )
    })
  }
}
