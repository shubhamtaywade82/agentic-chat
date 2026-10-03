export interface OpenUIPreset {
  id: string
  name: string
  description: string
  code: string
}

export const OPENUI_PRESETS: OpenUIPreset[] = [
  {
    id: "status-overview",
    name: "Status overview",
    description: "Grid + Metric + Badge + ActionButton",
    code: `root = Stack("md", [
  Text("Release 2.4 status", "heading"),
  Grid(3, [
    Metric("Open issues", "12", "3 new today", "warning"),
    Metric("Tests passing", "1,284", "of 1,291", "positive"),
    Metric("Build time", "4m 12s", "-18s vs last week")
  ]),
  Badge("Ready for review", "info"),
  ActionButton("Ask for a summary", "outline")
])`,
  },
  {
    id: "table-and-chart",
    name: "Table and chart",
    description: "Table + Chart in a Card",
    code: `root = Stack("md", [
  Card("Requests per service", [
    Table(["Service", "Requests", "Errors"], [["api", 18420, 12], ["web", 9310, 4], ["worker", 2210, 31]]),
    Chart("bar", ["api", "web", "worker"], [{name: "Requests", values: [18420, 9310, 2210]}, {name: "Errors", values: [12, 4, 31]}])
  ])
])`,
  },
  {
    id: "trend",
    name: "Trend line",
    description: "Chart (line) + List",
    code: `root = Stack("md", [
  Text("Weekly active users", "heading"),
  Chart("line", ["Mon", "Tue", "Wed", "Thu", "Fri"], [{name: "Users", values: [820, 910, 880, 1040, 1120]}]),
  List(["Peak on Friday", "Up 36% since Monday", "Dip on Wednesday matches the outage"])
])`,
  },
  {
    id: "alerts-and-progress",
    name: "Alerts and progress",
    description: "Alert + Progress + Markdown",
    code: `root = Stack("md", [
  Alert("Two migrations are pending and will run on the next deploy.", "warning", "Heads up"),
  Progress(72, "Disk quota used"),
  Progress(35, "Import complete"),
  Markdown("**Next step:** review the migration plan, then deploy.")
])`,
  },
]
