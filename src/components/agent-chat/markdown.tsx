"use client"

import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("md-body break-words", className)}>
      <ReactMarkdown
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
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                  {children}
                </code>
              )
            }
            const lang = match?.[1] || "text"
            return (
              <CodeBlock language={lang}>{String(children).replace(/\n$/, "")}</CodeBlock>
            )
          },
          a(props) {
            return (
              <a
                {...props}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:opacity-80"
              />
            )
          },
          table(props) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-border">
                <table {...props} className="w-full text-sm" />
              </div>
            )
          },
          th(props) {
            return <th {...props} className="border-b border-border bg-muted/50 px-3 py-1.5 text-left font-medium" />
          },
          td(props) {
            return <td {...props} className="border-b border-border px-3 py-1.5" />
          },
        }}
      >
        {content}
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
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "0.75rem 1rem",
          fontSize: "0.8rem",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), monospace" } }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}
