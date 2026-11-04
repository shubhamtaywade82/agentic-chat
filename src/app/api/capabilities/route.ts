import { NextResponse } from "next/server"
import { NexumClient, NexumHttpError, describeNexumError } from "@/lib/nexum"
import { nexumHostUrl } from "@/lib/nexum-client"

/**
 * What the Nexum server can do (tools, skills, models, MCP servers, output
 * formats), proxied so the Nexum token stays server-side.
 *
 * Response: `{ ok: true, capabilities } | { ok: false, error: string }`
 */
export async function GET() {
  const nexum = new NexumClient({ baseUrl: nexumHostUrl() })
  try {
    return NextResponse.json({ ok: true, capabilities: await nexum.capabilities.get() })
  } catch (err: unknown) {
    if (err instanceof NexumHttpError) {
      return NextResponse.json({ ok: false, error: describeNexumError(err) }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: `Cannot reach Nexum at ${nexumHostUrl()}: ${message}` }, { status: 502 })
  }
}
