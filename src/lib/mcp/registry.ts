// Pre-configured reference MCP servers from the official MCP servers repo.
// https://modelcontextprotocol.io/examples
//
// All seven are added to DEFAULT_CONFIG.mcpServers so they show up in the
// Agent Configuration → MCP tab and the user can toggle them on/off without
// having to type command/args.
//
// Package availability (verified):
//   - @modelcontextprotocol/server-everything       (npm, TypeScript)
//   - @modelcontextprotocol/server-memory           (npm, TypeScript)
//   - @modelcontextprotocol/server-filesystem       (npm, TypeScript)
//   - @modelcontextprotocol/server-sequential-thinking (npm, TypeScript)
//   - mcp-server-time                                (PyPI, Python — run via uvx)
//   - mcp-server-fetch                               (PyPI, Python — run via uvx)
//   - mcp-server-git                                 (PyPI, Python — run via uvx)
//
// Defaults:
//   - memory, sequentialthinking, everything, time, fetch → enabled (work out of the box)
//   - filesystem → enabled with /tmp as the allowed path (works on any Unix)
//   - git → disabled (needs --repository <path> set to a real repo; enable
//     only when you have a local git repo to inspect)

import type { McpServerConfig } from "./types"
import { mcpServerSlug } from "./types"

type ReferenceServer = Omit<McpServerConfig, "id">

const REFERENCE_SERVERS: ReferenceServer[] = [
  {
    name: "memory",
    description: "Knowledge graph-based persistent memory system. Create entities, relations, and observations that survive across sessions.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    enabled: true,
  },
  {
    name: "time",
    description: "Time and timezone conversion. Get the current time in any IANA timezone, or convert between timezones.",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-time"],
    enabled: true,
  },
  {
    name: "sequentialthinking",
    description: "Dynamic and reflective problem-solving through structured thought sequences. Lets the agent break down complex multi-step reasoning.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    enabled: true,
  },
  {
    name: "fetch",
    description: "Web content fetching and conversion. Retrieves a URL, extracts readable text, and returns it as markdown for the LLM.",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
    enabled: true,
  },
  {
    name: "everything",
    description: "Reference / test server exposing prompts, resources, and tools (Echo, Add, LongRunningOperation, etc.). Useful for smoke-testing MCP.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    enabled: true,
  },
  {
    name: "filesystem",
    description: "Secure file operations with configurable access controls. Edit the args to point at the directories you want the agent to be able to read/write.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    enabled: true,
  },
  {
    name: "git",
    description: "Read, search, and manipulate Git repositories. Disabled by default — edit the args to set --repository to a real local git repo path before enabling.",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-git", "--repository", "."],
    enabled: false,
  },
]

// Materializes the reference servers into full McpServerConfig objects with
// stable IDs and slugs. Used once at DEFAULT_CONFIG build time.
export function buildDefaultMcpServers(): McpServerConfig[] {
  return REFERENCE_SERVERS.map((s, i) => ({
    ...s,
    id: `mcp_ref_${i + 1}_${mcpServerSlug(s.name)}`,
    env: s.env ? { ...s.env } : undefined,
  }))
}
