import type { AgentMessage, TraceStep } from "./agent-types"

// Format a single trace step into human-readable Markdown
function formatStepMarkdown(step: TraceStep): string {
  const time = step.durationMs ? ` (${(step.durationMs / 1000).toFixed(1)}s)` : ""
  switch (step.kind) {
    case "plan":
      return `### 📋 Plan\n**Goal**: ${step.goal}\n\n${step.steps.map((s, i) => `${i + 1}. [${s.done ? "x" : " "}] ${s.text}`).join("\n")}\n`
    case "thinking":
      return `### 🧠 Thinking (Iteration ${step.iteration})${time}\n**${step.title}**\n\n${step.reasoning}\n`
    case "tool_call":
      return `### 🔧 Tool Call: \`${step.toolName}\`${time}\n*${step.description}*\n\`\`\`json\n${JSON.stringify(step.args, null, 2)}\n\`\`\`\n`
    case "observation":
      return `### 👁️ Observation (${step.source})${time}\n**${step.summary}**\n\`\`\`json\n${JSON.stringify(step.data, null, 2)}\n\`\`\`\n`
    case "answer":
      return `### 💬 Final Answer\n\n${step.content}\n`
  }
}

// Convert a full agent message trace into structured Markdown
export function exportTraceToMarkdown(message: AgentMessage): string {
  const query = message.query || "User Query"
  const model = message.modelId || "react-agent"
  const duration = message.finishedAt && message.startedAt ? `${((message.finishedAt - message.startedAt) / 1000).toFixed(1)}s` : "n/a"
  const trace = message.trace || []

  return `# ReAct Agent Execution Trace

- **Query**: ${query}
- **Model**: \`${model}\`
- **Temperature**: ${message.temperature ?? "default"}
- **Iterations**: ${message.iterations ?? trace.length}
- **Total Tokens**: ${message.totalTokens ?? 0}
- **Duration**: ${duration}
- **Date**: ${new Date(message.startedAt || Date.now()).toISOString()}

---

## Execution Timeline

${trace.map(formatStepMarkdown).join("\n---\n\n")}
`
}

// Convert message trace to formatted JSON string
export function exportTraceToJson(message: AgentMessage): string {
  return JSON.stringify(
    {
      id: message.id,
      query: message.query,
      modelId: message.modelId,
      systemPrompt: message.systemPrompt,
      temperature: message.temperature,
      iterations: message.iterations,
      totalTokens: message.totalTokens,
      startedAt: message.startedAt,
      finishedAt: message.finishedAt,
      durationSeconds: message.finishedAt && message.startedAt ? (message.finishedAt - message.startedAt) / 1000 : undefined,
      trace: message.trace,
    },
    null,
    2
  )
}

// Trigger client-side file download
export function downloadFile(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Copy text to clipboard with navigator fallback
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback if clipboard API is blocked
  }
  return false
}
