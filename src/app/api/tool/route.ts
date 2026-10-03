import { NextRequest, NextResponse } from "next/server"
import { NexumClient, NexumHttpError, describeNexumError } from "@/lib/nexum"
import { nexumHostUrl } from "@/lib/nexum-client"

/**
 * Tool calls from OpenUI-rendered components (`Query(...)`, `@Run`), proxied
 * to the chat's Nexum session. Nexum owns execution, credentials and policy,
 * and only runs read-only tools here; anything that changes state must go
 * through an agent run (e.g. `@ToAssistant`). This route stays server-side
 * only so the Nexum token never reaches the browser.
 *
 * Body: `{ tool: string, args?: Record<string, unknown>, nexumSessionId: string }`
 * Response: `{ ok: true, data: unknown } | { ok: false, error: string }`
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { tool?: unknown; args?: Record<string, unknown>; nexumSessionId?: unknown }
  if (typeof body.tool !== "string" || !body.tool) {
    return NextResponse.json({ ok: false, error: "Missing `tool` field" }, { status: 400 })
  }
  if (typeof body.nexumSessionId !== "string" || !body.nexumSessionId) {
    return NextResponse.json(
      { ok: false, error: "This chat has no Nexum session yet; send a message first" },
      { status: 400 },
    )
  }

  const nexum = new NexumClient({ baseUrl: nexumHostUrl() })
  try {
    const result = await nexum.tools.invoke(body.nexumSessionId, body.tool, body.args ?? {})
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error?.message ?? `Tool ${body.tool} failed` })
    return NextResponse.json({ ok: true, data: result.data })
  } catch (err: unknown) {
    if (err instanceof NexumHttpError) {
      return NextResponse.json({ ok: false, error: describeNexumError(err) }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
