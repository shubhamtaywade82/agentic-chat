import { NextRequest, NextResponse } from "next/server"
import { NexumClient, NexumHttpError, describeNexumError, type InteractionResolution } from "@/lib/nexum"
import { nexumHostUrl } from "@/lib/nexum-client"

/**
 * Answers an approval or clarification a Nexum run is waiting on. The same
 * run keeps streaming over the /api/agent connection that is already open,
 * so this never starts a second run.
 *
 * Body: `{ runId, interactionId, approved?: boolean, selectedId?: string }`
 * Response: `{ ok: true } | { ok: false, error: string }`
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    runId?: unknown
    interactionId?: unknown
    approved?: unknown
    selectedId?: unknown
  }
  if (typeof body.runId !== "string" || typeof body.interactionId !== "string") {
    return NextResponse.json({ ok: false, error: "`runId` and `interactionId` are required" }, { status: 400 })
  }

  const resolution: InteractionResolution = {}
  if (typeof body.approved === "boolean") resolution.approved = body.approved
  if (typeof body.selectedId === "string") resolution.selectedId = body.selectedId

  const nexum = new NexumClient({ baseUrl: nexumHostUrl() })
  try {
    await nexum.interactions.resolve(body.runId, body.interactionId, resolution)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof NexumHttpError) {
      return NextResponse.json({ ok: false, error: describeNexumError(err) }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
