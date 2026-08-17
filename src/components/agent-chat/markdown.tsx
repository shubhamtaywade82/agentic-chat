"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Check, Copy } from "lucide-react"
import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"

// Auto-detect and format raw unformatted JSON strings and unwrap redundant outer markdown code fences
function prepareMarkdownContent(raw: string): string {
  if (!raw) return ""
  let text = raw.trim()

  // Strip leading artifact asterisks
  text = text.replace(/^\*+\s*\n/, "").trim()

  // Unwrap outer ```markdown ... ``` wrapper if LLM wrapped the entire response
  const outerMdMatch = text.match(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```$/i)
  if (outerMdMatch) {
    text = outerMdMatch[1].trim()
  }

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
        remarkPlugins={[remarkGfm]}
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
            return (
              <CodeBlock language={lang}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            )
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
