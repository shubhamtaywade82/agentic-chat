import type { CustomTool } from "./agent-types"

// Browser-safe execution of user-defined custom tools
export async function executeCustomTool(tool: CustomTool, args: Record<string, unknown>) {
  if (tool.mode === "static") {
    try {
      return JSON.parse(tool.code)
    } catch {
      return { result: tool.code }
    }
  }
  if (tool.mode === "fetch") {
    const url = tool.code.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(args[k] ?? "")))
    const res = await fetch(url)
    return await res.json()
  }
  const fn = new Function("args", `"use strict"; ${tool.code}`)
  return await fn(args)
}
