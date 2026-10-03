/**
 * React implementations for the generic OpenUI component vocabulary.
 *
 * Names, descriptions and prop schemas live in `spec.ts` (shared with the
 * server-side prompt generator); this file only attaches the components the
 * OpenUI `<Renderer>` mounts. Props can arrive partially while a response
 * streams, so every component tolerates missing or malformed values.
 */

import type React from "react"
import {
  createLibrary,
  defineComponent,
  useRenderNode,
  useTriggerAction,
  type ComponentRenderProps,
} from "@openuidev/react-lang"
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CodeBlock, Markdown } from "@/components/agent-chat/markdown"
import { componentSpecs, type ComponentName, type ComponentSpec } from "./spec"

type Renderer = (props: ComponentRenderProps<unknown>) => React.ReactNode

const implement = (name: ComponentName, component: Renderer) =>
  defineComponent({ ...(componentSpecs[name] as ComponentSpec), component: component as never })

const propsOf = <T,>(props: unknown) => (props ?? {}) as Partial<T>

function Children({ items }: { items: unknown }) {
  const renderNode = useRenderNode()
  if (!Array.isArray(items)) return null
  return (
    <>
      {items.map((child, i) =>
        child && typeof child === "object" ? (
          <div key={i}>{renderNode(child as Parameters<typeof renderNode>[0])}</div>
        ) : (
          <div key={i}>{String(child)}</div>
        ),
      )}
    </>
  )
}

const STACK_GAP: Record<string, string> = { xs: "gap-1", sm: "gap-2", md: "gap-4", lg: "gap-6" }
const GRID_COLUMNS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }

const METRIC_TONE: Record<string, string> = {
  positive: "text-emerald-500",
  negative: "text-red-500",
  warning: "text-amber-500",
}

const BADGE_TONE: Record<string, string> = {
  positive: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  negative: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

const ALERT_TONE: Record<string, string> = {
  info: "border-sky-500/40 bg-sky-500/5",
  success: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  error: "border-red-500/40 bg-red-500/5",
}

const CHART_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#06b6d4"]

const Stack = implement("Stack", ({ props }) => {
  const p = propsOf<{ gap: string; children: unknown[] }>(props)
  return (
    <div className={cn("flex flex-col", STACK_GAP[p.gap ?? "md"] ?? STACK_GAP.md)}>
      <Children items={p.children} />
    </div>
  )
})

const Grid = implement("Grid", ({ props }) => {
  const p = propsOf<{ columns: number; children: unknown[] }>(props)
  return (
    <div className={cn("grid gap-4", GRID_COLUMNS[p.columns ?? 2] ?? GRID_COLUMNS[2])}>
      <Children items={p.children} />
    </div>
  )
})

const CardBox = implement("Card", ({ props }) => {
  const p = propsOf<{ title: string; children: unknown[] }>(props)
  return (
    <Card className="gap-3 rounded-xl border-border p-4 shadow-sm">
      {p.title && <div className="text-sm font-semibold text-foreground">{p.title}</div>}
      <div className="flex flex-col gap-3">
        <Children items={p.children} />
      </div>
    </Card>
  )
})

const Text = implement("Text", ({ props }) => {
  const p = propsOf<{ content: string; variant: string }>(props)
  const cls =
    p.variant === "heading"
      ? "text-base font-semibold text-foreground"
      : p.variant === "muted"
        ? "text-xs text-muted-foreground"
        : p.variant === "small"
          ? "text-[11px] text-muted-foreground"
          : "text-sm text-foreground"
  return <div className={cls}>{p.content ?? ""}</div>
})

const MarkdownBlock = implement("Markdown", ({ props }) => <Markdown content={propsOf<{ content: string }>(props).content ?? ""} />)

const Metric = implement("Metric", ({ props }) => {
  const p = propsOf<{ label: string; value: string; sub: string; tone: string }>(props)
  return (
    <Card className="gap-0 rounded-lg border-border p-3 shadow-none">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.label ?? "—"}</div>
      <div className={cn("mt-1 font-mono text-lg font-semibold text-foreground", METRIC_TONE[p.tone ?? ""])}>
        {p.value ?? "—"}
      </div>
      {p.sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{p.sub}</div>}
    </Card>
  )
})

const DataTable = implement("Table", ({ props }) => {
  const p = propsOf<{ columns: string[]; rows: unknown[][] }>(props)
  const columns = Array.isArray(p.columns) ? p.columns : []
  const rows = Array.isArray(p.rows) ? p.rows.filter(Array.isArray) : []
  return (
    <Card className="gap-0 overflow-hidden rounded-xl border-border p-0 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, i) => (
              <TableHead key={i}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, r) => (
            <TableRow key={r}>
              {row.map((value, c) => (
                <TableCell key={c}>{value === null || value === undefined ? "" : String(value)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
})

const ItemList = implement("List", ({ props }) => {
  const p = propsOf<{ items: string[]; ordered: boolean }>(props)
  const items = Array.isArray(p.items) ? p.items : []
  const Tag = p.ordered ? "ol" : "ul"
  return (
    <Tag className={cn("space-y-1 pl-5 text-sm text-foreground", p.ordered ? "list-decimal" : "list-disc")}>
      {items.map((item, i) => (
        <li key={i}>{String(item)}</li>
      ))}
    </Tag>
  )
})

const StatusBadge = implement("Badge", ({ props }) => {
  const p = propsOf<{ label: string; tone: string }>(props)
  return (
    <Badge variant="outline" className={cn("w-fit", BADGE_TONE[p.tone ?? ""])}>
      {p.label ?? ""}
    </Badge>
  )
})

const Notice = implement("Alert", ({ props }) => {
  const p = propsOf<{ message: string; tone: string; title: string }>(props)
  return (
    <Alert className={ALERT_TONE[p.tone ?? "info"] ?? ALERT_TONE.info}>
      {p.title && <AlertTitle>{p.title}</AlertTitle>}
      <AlertDescription>{p.message ?? ""}</AlertDescription>
    </Alert>
  )
})

const ProgressBar = implement("Progress", ({ props }) => {
  const p = propsOf<{ value: number; label: string }>(props)
  const value = Number.isFinite(p.value) ? Math.min(100, Math.max(0, p.value as number)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{p.label ?? ""}</span>
        <span className="font-mono">{Math.round(value)}%</span>
      </div>
      <Progress value={value} />
    </div>
  )
})

const ChartBlock = implement("Chart", ({ props }) => {
  const p = propsOf<{ type: string; labels: string[]; series: { name: string; values: number[] }[] }>(props)
  const labels = Array.isArray(p.labels) ? p.labels : []
  const series = (Array.isArray(p.series) ? p.series : []).filter((s) => s && typeof s.name === "string" && Array.isArray(s.values))
  const data = labels.map((label, i) => ({ label, ...Object.fromEntries(series.map((s) => [s.name, s.values[i] ?? null])) }))
  const Plot = p.type === "line" ? LineChart : BarChart
  return (
    <Card className="gap-0 rounded-xl border-border p-3 shadow-sm">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Plot data={data}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            {series.length > 1 && <Legend />}
            {series.map((s, i) =>
              p.type === "line" ? (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} />
              ) : (
                <Bar key={s.name} dataKey={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ),
            )}
          </Plot>
        </ResponsiveContainer>
      </div>
    </Card>
  )
})

const ActionButton = implement("ActionButton", ({ props }) => {
  const p = propsOf<{ label: string; variant: string }>(props)
  const triggerAction = useTriggerAction()
  const cls =
    p.variant === "outline"
      ? "border border-border bg-transparent text-foreground hover:bg-muted"
      : p.variant === "ghost"
        ? "bg-transparent text-foreground hover:bg-muted"
        : p.variant === "destructive"
          ? "bg-red-500 text-white hover:bg-red-600"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
  return (
    <button
      type="button"
      className={cn("w-fit rounded-md px-3 py-1 text-xs font-medium transition", cls)}
      onClick={() => triggerAction("click")}
    >
      {p.label ?? "Click"}
    </button>
  )
})

const Code = implement("CodeBlock", ({ props }) => {
  const p = propsOf<{ code: string; language: string }>(props)
  return <CodeBlock language={p.language || "text"}>{p.code ?? ""}</CodeBlock>
})

export const domainLibrary = createLibrary({
  root: "Stack",
  components: [
    Stack,
    Grid,
    CardBox,
    Text,
    MarkdownBlock,
    Metric,
    DataTable,
    ItemList,
    StatusBadge,
    Notice,
    ProgressBar,
    ChartBlock,
    Code,
    ActionButton,
  ],
})

export default domainLibrary
