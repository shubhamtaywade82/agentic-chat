"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Check, Copy, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Code2, Eye } from "lucide-react"
import { useState, useMemo, useEffect, useId } from "react"
import { cn } from "@/lib/utils"
import "katex/dist/katex.min.css"

// Auto-detect and format raw unformatted JSON strings and unwrap redundant outer markdown code fences
function prepareMarkdownContent(raw: string): string {
  if (!raw) return ""
  let text = raw.trim()

  // Strip leading artifact asterisks
  text = text.replace(/^\*+\s*\n/, "").trim()

  // Unwrap any ```markdown ... ``` or ```md ... ``` fences so they render as rich markdown rather than code block boxes
  text = text.replace(/```(?:markdown|md)\s*\n([\s\S]*?)\n```/gi, "$1")

  // Unwrap outer untagged ``` ... ``` if the entire message is wrapped
  text = text.replace(/^```\s*\n([\s\S]*?)\n```$/gi, "$1")

  // If text is pure JSON object or array not already fenced
  if (
    !text.startsWith("```") &&
    ((text.startsWith("{") && text.endsWith("}")) ||
      (text.startsWith("[") && text.endsWith("]")))
  ) {
    try {
      const parsed = JSON.parse(text)
      return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```"
    } catch {
      // Not valid JSON, return as is
    }
  }

  return text
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const formattedContent = useMemo(() => prepareMarkdownContent(content), [content])

  return (
    <div className={cn("md-body break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code(props) {
            const { children, className } = props as {
              children?: React.ReactNode
              className?: string
            }
            const match = /language-(\w+)/.exec(className || "")
            const isInline = !className && !String(children ?? "").includes("\n")

            if (isInline) {
              return (
                <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground font-semibold">
                  {children}
                </code>
              )
            }

            const lang = match?.[1] || "text"
            const code = String(children).replace(/\n$/, "")

            if (lang === "mermaid") {
              return <MermaidBlock chart={code} />
            }

            return <CodeBlock language={lang}>{code}</CodeBlock>
          },
          a(props) {
            return (
              <a
                {...props}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:opacity-80"
              />
            )
          },
          table(props) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-border bg-card/40">
                <table {...props} className="w-full text-sm border-collapse" />
              </div>
            )
          },
          thead(props) {
            return <thead {...props} className="bg-muted/60 border-b border-border" />
          },
          th(props) {
            return <th {...props} className="px-3.5 py-2 text-left font-semibold text-xs text-foreground" />
          },
          td(props) {
            return <td {...props} className="border-b border-border/60 px-3.5 py-2 text-xs text-foreground/90" />
          },
          tr(props) {
            return <tr {...props} className="hover:bg-muted/30 transition-colors" />
          },
          blockquote(props) {
            return (
              <blockquote
                {...props}
                className="border-l-4 border-emerald-500/40 bg-emerald-500/5 my-3 py-1.5 px-3 rounded-r-md text-muted-foreground text-sm italic"
              />
            )
          },
          ul(props) {
            return <ul {...props} className="my-2 space-y-1 list-disc pl-5 text-sm" />
          },
          ol(props) {
            return <ol {...props} className="my-2 space-y-1 list-decimal pl-5 text-sm" />
          },
          li(props) {
            return <li {...props} className="text-sm leading-relaxed" />
          },
          h1(props) {
            return <h1 {...props} className="text-lg font-bold tracking-tight mt-4 mb-2 pb-1 border-b border-border" />
          },
          h2(props) {
            return <h2 {...props} className="text-base font-bold tracking-tight mt-3 mb-1.5" />
          },
          h3(props) {
            return <h3 {...props} className="text-sm font-semibold mt-2.5 mb-1" />
          },
          hr(props) {
            return <hr {...props} className="my-4 border-border" />
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  )
}

function CodeBlock({
  language,
  children,
}: {
  language: string
  children: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-[#282c34] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {language}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span className="text-[10px]">{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "0.85rem 1rem",
          fontSize: "0.8rem",
          lineHeight: "1.5",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), monospace" } }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

// Small local models reliably declare `graph`/`flowchart` but then write a
// full sequence-diagram body (participant + ->> arrows), plus a handful of
// other invalid-but-predictable quirks. Repairing those before handing the
// chart to mermaid fixes far more real responses than prompt-tuning alone.
function normalizeMermaid(raw: string): string {
  let text = raw.trim()

  // Stray hallucinated metadata line, e.g. "title=Trading Bot Flow"
  text = text.replace(/^\s*title\s*=.*$/gim, "")

  // Header says graph/flowchart but the body is actually a sequence diagram
  const looksLikeSequence = /^\s*participant\s+/m.test(text) || /-{1,2}>>/.test(text)
  if (looksLikeSequence) {
    text = text.replace(/^\s*(graph|flowchart)\s+\w+\s*$/im, "sequenceDiagram")
    // `style` is a flowchart-only directive — invalid once retargeted to sequenceDiagram
    text = text.replace(/^\s*style\s+.*$/gim, "")
  }

  // Only "left of" / "right of" / "over" are valid note positions
  text = text.replace(/\bnote\s+(?:top|bottom)\s+(left|right)\s+of\b/gi, "note $1 of")

  // Common unit typo: "2dp" instead of "2px"
  text = text.replace(/(\d+)dp\b/g, "$1px")

  return text.trim()
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

// Renders ```mermaid fences as diagrams, with a toolbar to zoom the preview,
// flip to raw source, and copy. Mermaid needs a real DOM-safe id and runs
// client-side only, so this stays isolated from the SSR-rendered markdown tree.
function MermaidBlock({ chart }: { chart: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "")
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [copied, setCopied] = useState(false)
  const normalized = useMemo(() => normalizeMermaid(chart), [chart])

  // Renders into state (not a ref's innerHTML) so the SVG survives the
  // Preview/Code toggle unmounting the preview container — a ref write only
  // happens once, at render time, and is lost when that DOM node goes away.
  useEffect(() => {
    let cancelled = false
    setError(null)

    import("mermaid").then(async ({ default: mermaid }) => {
      if (cancelled) return
      try {
        const isDark = document.documentElement.classList.contains("dark")
        mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", securityLevel: "strict" })
        const { svg: rendered } = await mermaid.render(`mermaid-${rawId}`, normalized)
        if (!cancelled) setSvg(rendered)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render diagram")
      }
    })

    return () => {
      cancelled = true
    }
  }, [normalized, rawId])

  const copy = () => {
    navigator.clipboard.writeText(chart)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (error) {
    return (
      <div className="my-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Couldn&apos;t render diagram — showing source
        </div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{chart}</pre>
      </div>
    )
  }

  const iconBtn = "flex items-center justify-center rounded p-1 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-[#282c34] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-400">mermaid</span>
        <div className="flex items-center gap-0.5">
          {!showCode && (
            <>
              <button onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))} className={iconBtn} aria-label="Zoom out">
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setZoom(1)} className="w-10 text-center font-mono text-[10px] text-zinc-400 hover:text-zinc-100" aria-label="Reset zoom">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))} className={iconBtn} aria-label="Zoom in">
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setZoom(1)} className={iconBtn} aria-label="Reset zoom to 100%">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-3.5 w-px bg-white/10" />
            </>
          )}
          <button onClick={() => setShowCode((v) => !v)} className={cn(iconBtn, "gap-1 px-1.5")} aria-label={showCode ? "Show preview" : "Show source"}>
            {showCode ? <Eye className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
            <span className="text-[10px]">{showCode ? "Preview" : "Code"}</span>
          </button>
          <button onClick={copy} className={cn(iconBtn, "gap-1 px-1.5")} aria-label="Copy source">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {showCode ? (
        <SyntaxHighlighter
          language="text"
          style={oneDark}
          customStyle={{ margin: 0, background: "transparent", padding: "0.85rem 1rem", fontSize: "0.8rem", lineHeight: "1.5" }}
          codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), monospace" } }}
        >
          {chart}
        </SyntaxHighlighter>
      ) : (
        <div className="max-h-[600px] min-h-[200px] overflow-auto bg-card/40 p-4">
          <div
            className="mx-auto w-full origin-top transition-transform duration-150 [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-none"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
          />
        </div>
      )}
    </div>
  )
}
