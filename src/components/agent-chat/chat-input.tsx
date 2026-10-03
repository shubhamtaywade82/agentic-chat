"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { Send, Square, Sparkles } from "lucide-react"
import { useAgentStore } from "@/store/agent-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const EXAMPLES = [
  { label: "Explain a pattern", prompt: "Explain the Singleton, Factory, and Observer design patterns with clean code examples." },
  { label: "Calculate", prompt: "Calculate compound interest on $10,000 at 7% annual return over 10 years using the calculator." },
  { label: "Weather", prompt: "What is the current weather in Tokyo?" },
  { label: "Look something up", prompt: "Give me a short background on the history of the Unix operating system." },
]

export function ChatInput() {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendUserMessage, stopRun, isRunning } = useAgentStore()

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 160) + "px"
  }, [text])

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || isRunning) return
    sendUserMessage(trimmed)
    setText("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-5xl px-4 py-3">
        {/* example chips */}
        {!isRunning && text.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setText(ex.prompt)}
                className="group flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
              >
                <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
                {ex.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition focus-within:ring-2 focus-within:ring-ring/40">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={isRunning ? "Agent is working…" : "Ask the agent…"}
            disabled={isRunning}
            className="scroll-thin flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />

          <Button
            size="sm"
            onClick={isRunning ? stopRun : submit}
            disabled={!isRunning && !text.trim()}
            className="h-8 gap-1.5"
          >
            {isRunning ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send
              </>
            )}
          </Button>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 font-mono">Enter</kbd> to send ·
          <kbd className="ml-1 rounded border border-border bg-muted px-1 font-mono">Shift+Enter</kbd> for newline
        </p>
      </div>
    </div>
  )
}
