import { NextRequest, NextResponse } from "next/server"
import { AVAILABLE_MODELS, DEFAULT_PROVIDER_URLS, LlmProvider, ModelOption } from "@/lib/agent-types"

// Filter out non-generative / embedding models
function isEmbeddingModel(modelId: string): boolean {
  const lower = modelId.toLowerCase()
  return (
    lower.includes("embed") ||
    lower.includes("embedding") ||
    lower.includes("bge-") ||
    lower.includes("minilm") ||
    lower.includes("rerank") ||
    lower.includes("colbert") ||
    lower.includes("mxbai-") ||
    lower.includes("nomic-")
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const provider = (searchParams.get("provider") as LlmProvider) || "ollama_local"
  const baseUrl = searchParams.get("apiBaseUrl") || DEFAULT_PROVIDER_URLS[provider] || ""
  const apiKey = searchParams.get("apiKey") || ""

  try {
    // Ollama Local or Remote tags endpoint
    if (provider === "ollama_local" || provider === "ollama_cloud") {
      const url = `${baseUrl || "http://localhost:11434"}/api/tags`
      const res = await fetch(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} })
      if (res.ok) {
        const data = await res.json()
        const rawModels: ModelOption[] = (data.models || []).map((m: { name: string; size?: number; details?: { parameter_size?: string } }) => ({
          id: m.name,
          label: `${m.name}${m.details?.parameter_size ? ` (${m.details.parameter_size})` : ""}`,
          contextWindow: 128_000,
          costPer1k: 0,
          provider,
        }))

        // Exclude embedding models
        const chatModels = rawModels.filter((m) => !isEmbeddingModel(m.id))
        if (chatModels.length > 0) {
          return NextResponse.json({ provider, models: chatModels, isLive: true, fetchedAt: Date.now() })
        }
      }
    }

    // OpenAI or Groq or OpenAI-compatible endpoint
    if ((provider === "openai" || provider === "groq" || provider === "custom") && apiKey) {
      const url = `${baseUrl || "https://api.openai.com/v1"}/models`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
      if (res.ok) {
        const data = await res.json()
        const rawModels: ModelOption[] = (data.data || []).map((m: { id: string }) => ({
          id: m.id,
          label: m.id,
          contextWindow: 128_000,
          costPer1k: provider === "openai" ? 2.5 : 0.5,
          provider,
        }))
        const chatModels = rawModels.filter((m) => !isEmbeddingModel(m.id)).slice(0, 25)
        if (chatModels.length > 0) {
          return NextResponse.json({ provider, models: chatModels, isLive: true, fetchedAt: Date.now() })
        }
      }
    }
  } catch {
    // Fall through to fallback catalog if network/endpoint is unavailable
  }

  // Provider Fallback Catalog (filtered)
  const fallback = AVAILABLE_MODELS.filter((m) => m.provider === provider && !isEmbeddingModel(m.id))
  const models = fallback.length > 0 ? fallback : AVAILABLE_MODELS
  return NextResponse.json({ provider, models, isLive: false, fetchedAt: Date.now() })
}
