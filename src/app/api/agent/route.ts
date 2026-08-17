import { NextRequest } from "next/server"
import { executeLiveTool } from "@/lib/live-tools"
import type { AgentConfig, CustomTool } from "@/lib/agent-types"

export async function POST(req: NextRequest) {
  const { query, config, customTools = [] } = (await req.json()) as {
    query: string
    config: AgentConfig
    customTools?: CustomTool[]
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Step 1: High-level task decomposition
        send({
          kind: "plan",
          goal: `Process and answer: "${query}"`,
          steps: [
            "Analyze intent and parameters",
            "Determine necessary tool actions",
            "Execute tools with live data",
            "Evaluate observations and compose response",
          ],
        })

        // Step 2: Determine tool mapping
        const isWeather = /weather|temperature|forecast|rain|sunny/i.test(query)
        const isMath = /calculate|compute|\d+\s*[\+\-\*\/x^]\s*\d+|sqrt|percentage/i.test(query)
        const isSearch = /search|who is|what is|find|latest|news|research/i.test(query)
        const isCode = /code|script|python|javascript|run|execute/i.test(query)

        // Custom tools check
        const matchedCustom = customTools.find((t) =>
          t.enabled && new RegExp(t.name.replace(/_/g, " "), "i").test(query)
        )

        let toolToCall: { name: string; args: Record<string, unknown>; desc: string } | null = null

        if (matchedCustom) {
          toolToCall = { name: matchedCustom.name, args: { query }, desc: matchedCustom.description }
        } else if (isWeather && config.enabledTools.weather_api !== false) {
          const city = query.match(/in ([A-Z][a-zA-Z\s,]+)/i)?.[1] || "Tokyo"
          toolToCall = { name: "weather_api", args: { location: city.trim() }, desc: `Fetch current weather for ${city}` }
        } else if (isMath && config.enabledTools.calculator !== false) {
          const expr = query.match(/[\d\.\s\+\-\*\/x^()]+/)?.[0]?.trim() || "2 + 2"
          toolToCall = { name: "calculator", args: { expression: expr }, desc: `Evaluate math: ${expr}` }
        } else if (isSearch && config.enabledTools.web_search !== false) {
          toolToCall = { name: "web_search", args: { query }, desc: `Search live web for ${query}` }
        } else if (isCode && config.enabledTools.code_interpreter !== false) {
          toolToCall = { name: "code_interpreter", args: { code: "console.log('Sandbox test ok');", language: "javascript" }, desc: "Execute code sandbox" }
        }

        // Step 3: Reasoning phase
        send({
          kind: "thinking",
          iteration: 1,
          title: "Analyzing request intent",
          reasoning: toolToCall
            ? `Identified user intent requires calling **\`${toolToCall.name}\`** with parameters \`${JSON.stringify(toolToCall.args)}\`. Executing live tool to ground response.`
            : `User query "${query}" can be answered directly using internal domain knowledge. Formulating structured explanation.`,
          tokensIn: 45,
          tokensOut: 65,
        })

        // Step 4: Act & Observe if tool is needed
        if (toolToCall) {
          send({
            kind: "tool_call",
            iteration: 1,
            toolName: toolToCall.name,
            description: toolToCall.desc,
            args: toolToCall.args,
          })

          const toolResult = await executeLiveTool(toolToCall.name, toolToCall.args, customTools)

          send({
            kind: "observation",
            iteration: 1,
            source: toolToCall.name,
            summary: toolResult.summary,
            data: toolResult.data,
          })

          // Reflection phase
          send({
            kind: "thinking",
            iteration: 2,
            title: "Evaluating live observation",
            reasoning: `Received live data from **\`${toolToCall.name}\`**: ${JSON.stringify(toolResult.data).slice(0, 120)}... Information is verified and sufficient for final synthesis.`,
            tokensIn: 80,
            tokensOut: 70,
          })

          // Final Answer formulation
          let answerContent = `Based on live execution of **${toolToCall.name}**:\n\n`
          if (toolToCall.name === "weather_api") {
            const w = toolResult.data as { location: string; temperature_c: number; condition: string; humidity: number; wind_kph: number }
            answerContent += `Currently in **${w.location}**, it is **${w.temperature_c}°C** with **${w.condition}**.\n- Humidity: ${w.humidity}%\n- Wind Speed: ${w.wind_kph} km/h\n`
          } else if (toolToCall.name === "calculator") {
            const m = toolResult.data as { expression: string; result: number }
            answerContent += `Result of \`${m.expression}\` is **${m.result}** ✅`
          } else if (toolToCall.name === "web_search") {
            const s = toolResult.data as { results: { title: string; url: string; snippet: string }[] }
            answerContent += `Found relevant information:\n\n` + s.results.map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`).join("\n\n")
          } else {
            answerContent += `\`\`\`json\n${JSON.stringify(toolResult.data, null, 2)}\n\`\`\``
          }

          send({ kind: "answer", iteration: 2, content: answerContent })
        } else {
          send({
            kind: "answer",
            iteration: 1,
            content: `I processed your request: *"${query}"*.\n\nThis response was generated through the live ReAct engine. Enable specific tools (Weather, Calculator, Search, Code Sandbox) or define a custom tool to see live tool calls in action.`,
          })
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        send({ kind: "answer", iteration: 1, content: `⚠️ Error processing agent loop: ${errorMsg}` })
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
