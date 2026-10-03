/**
 * The generic OpenUI component vocabulary: names, descriptions and prop
 * schemas, with no React.
 *
 * Two consumers share this one definition:
 *   - `prompt.ts` (server side) turns it into the component spec sent to Nexum,
 *     so the model only emits components the client can render;
 *   - `library.tsx` (client side) attaches the React implementations.
 *
 * Arguments in OpenUI Lang are positional, so the key order of each `props`
 * object below IS the call signature: `Metric("Open issues", "12")`.
 */

import { createLibrary, defineComponent } from "@openuidev/lang-core"
import { z } from "zod"

export interface ComponentSpec {
  name: string
  description: string
  props: z.ZodObject<z.ZodRawShape>
}

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const componentSpecs = {
  Stack: {
    name: "Stack",
    description:
      "Vertical layout container. Use as the root of every response: children render top-to-bottom.",
    props: z.object({
      gap: z.enum(["xs", "sm", "md", "lg"]).optional().describe("Vertical gap between children. Default: md."),
      children: z.array(z.unknown()).optional().describe("Child components to stack."),
    }),
  },
  Grid: {
    name: "Grid",
    description: "Lays children out in equal-width columns, wrapping onto new rows. Good for a row of Metric tiles.",
    props: z.object({
      columns: z.number().int().min(1).max(4).optional().describe("Number of columns, 1-4. Default: 2."),
      children: z.array(z.unknown()).optional().describe("Child components to place in the grid."),
    }),
  },
  Card: {
    name: "Card",
    description: "Bordered container with an optional title. Use to group related content.",
    props: z.object({
      title: z.string().optional().describe("Heading shown at the top of the card."),
      children: z.array(z.unknown()).optional().describe("Content inside the card."),
    }),
  },
  Text: {
    name: "Text",
    description: "Plain text block. Use for headings, labels and short callouts.",
    props: z.object({
      content: z.string().describe("The text to display."),
      variant: z.enum(["default", "muted", "heading", "small"]).optional().describe("Visual style. Default: default."),
    }),
  },
  Markdown: {
    name: "Markdown",
    description: "Rendered Markdown (lists, code blocks, emphasis). Use for prose and explanations.",
    props: z.object({
      content: z.string().describe("Markdown source."),
    }),
  },
  Metric: {
    name: "Metric",
    description: "A single number with a label, e.g. a count, rate, size or duration.",
    props: z.object({
      label: z.string(),
      value: z.string().describe("The value, already formatted for display."),
      sub: z.string().optional().describe("Small supporting text under the value."),
      tone: z.enum(["default", "positive", "negative", "warning"]).optional().describe("Color of the value."),
    }),
  },
  Table: {
    name: "Table",
    description: "Rows and columns of data. Prefer this over a Markdown table.",
    props: z.object({
      columns: z.array(z.string()).describe("Column headings."),
      rows: z.array(z.array(cell)).describe("One array of cell values per row, in column order."),
    }),
  },
  List: {
    name: "List",
    description: "A bulleted or numbered list of short items.",
    props: z.object({
      items: z.array(z.string()),
      ordered: z.boolean().optional().describe("Number the items instead of using bullets."),
    }),
  },
  Badge: {
    name: "Badge",
    description: "A small status label such as 'passing', 'beta' or 'overdue'.",
    props: z.object({
      label: z.string(),
      tone: z.enum(["neutral", "positive", "negative", "warning", "info"]).optional().describe("Default: neutral."),
    }),
  },
  Alert: {
    name: "Alert",
    description: "A highlighted notice: a warning, an error, a success message or a tip.",
    props: z.object({
      message: z.string(),
      tone: z.enum(["info", "success", "warning", "error"]).optional().describe("Default: info."),
      title: z.string().optional(),
    }),
  },
  Progress: {
    name: "Progress",
    description: "A progress bar for a percentage, e.g. completion of a task or a quota used.",
    props: z.object({
      value: z.number().min(0).max(100).describe("Percentage from 0 to 100."),
      label: z.string().optional(),
    }),
  },
  Chart: {
    name: "Chart",
    description: "A bar or line chart of one or more series over shared labels.",
    props: z.object({
      type: z.enum(["bar", "line"]),
      labels: z.array(z.string()).describe("X-axis labels, one per data point."),
      series: z
        .array(z.object({ name: z.string(), values: z.array(z.number()) }))
        .describe("One entry per line/bar group; `values` lines up with `labels`."),
    }),
  },
  ActionButton: {
    name: "ActionButton",
    description:
      "Clickable button. The onClick action can run a read-only tool via @Run, set state via @Set, " +
      "or continue the conversation via @ToAssistant.",
    props: z.object({
      label: z.string().describe("Button text."),
      variant: z.enum(["default", "outline", "ghost", "destructive"]).optional().describe("Default: default."),
    }),
  },
  HtmlArtifact: {
    name: "HtmlArtifact",
    description:
      "Renders self-contained HTML (inline <style>/<script> allowed) in a sandboxed iframe with no access " +
      "to the parent page. Use ONLY for a one-off visual none of the other components can express.",
    props: z.object({
      html: z.string().describe("Self-contained HTML document or fragment."),
      height: z.number().optional().describe("Iframe height in pixels. Default: 360."),
    }),
  },
} satisfies Record<string, ComponentSpec>

export type ComponentName = keyof typeof componentSpecs

/** Server-safe library, for prompt generation only; the React twin is in `library.tsx`. */
export const domainLibrarySpec = createLibrary({
  root: "Stack",
  components: (Object.values(componentSpecs) as ComponentSpec[]).map((spec) => defineComponent({ ...spec, component: null as never })),
})

export default domainLibrarySpec
