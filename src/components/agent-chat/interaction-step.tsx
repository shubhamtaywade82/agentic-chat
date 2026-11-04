"use client"

import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { InteractionStep } from "@/lib/agent-types"
import { useAgentStore } from "@/store/agent-store"

/**
 * What a paused Nexum run is asking the user, and the controls to answer it.
 * Answering resolves the interaction on the server; the same run then keeps
 * streaming, and the stream's "resolved" event is what settles this card.
 */
export function InteractionBody({ step }: { step: InteractionStep }) {
  const resolveInteraction = useAgentStore((s) => s.resolveInteraction)
  const submitting = step.status === "running"
  const waiting = step.status === "pending" || submitting

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 text-sm">
      {step.interaction === "approval" ? (
        <>
          <p className="font-medium">{step.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{step.summary}</p>
        </>
      ) : (
        <p className="font-medium">{step.question}</p>
      )}

      {waiting && (
        <div className="mt-3 flex flex-wrap gap-2">
          {step.interaction === "approval" ? (
            <>
              <Button size="sm" disabled={submitting} onClick={() => resolveInteraction(step.id, { approved: true })}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={submitting} onClick={() => resolveInteraction(step.id, { approved: false })}>
                <X className="h-3.5 w-3.5" /> Deny
              </Button>
            </>
          ) : (
            step.options?.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant="outline"
                disabled={submitting}
                title={option.description}
                onClick={() => resolveInteraction(step.id, { selectedId: option.id })}
              >
                {option.label}
              </Button>
            ))
          )}
        </div>
      )}

      {step.error && <p className="mt-2 text-xs text-destructive">{step.error}</p>}
      {!waiting && <p className="mt-2 text-xs text-muted-foreground">{outcomeOf(step)}</p>}
    </div>
  )
}

function outcomeOf({ resolution, options }: InteractionStep): string {
  if (!resolution) return "No longer waiting: the run ended or the request timed out."
  if (resolution.approved !== undefined) return resolution.approved ? "Approved." : "Denied."
  const chosen = options?.find((o) => o.id === resolution.selectedId)
  return chosen ? `You chose: ${chosen.label}.` : "Skipped."
}
