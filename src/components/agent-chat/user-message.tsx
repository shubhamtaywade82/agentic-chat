"use client"

import { motion } from "framer-motion"
import { User } from "lucide-react"
import { Markdown } from "./markdown"

export function UserMessageView({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 justify-end"
    >
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tr-sm border border-border bg-muted/60 px-4 py-2.5">
        <Markdown content={content} />
      </div>
      <div className="flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <User className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  )
}
