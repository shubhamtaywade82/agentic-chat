"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

const emptySubscribe = () => () => {}

export function ThemeToggle() {
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const { setTheme, resolvedTheme } = useTheme()

  if (!isMounted) {
    return <div className="h-8 w-8" />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/70 text-muted-foreground transition hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 dark:text-slate-200" />
      )}
    </button>
  )
}
