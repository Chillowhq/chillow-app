import { AlertCircle } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type FormNoticeProps = {
  children: ReactNode
  tone?: "error" | "warning"
  className?: string
}

export function FormNotice({
  children,
  tone = "error",
  className,
}: FormNoticeProps) {
  const toneClassName = tone === "warning"
    ? "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
    : "border-destructive/30 bg-destructive/5 text-foreground"

  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium", toneClassName, className)}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <p className="min-w-0 leading-relaxed">{children}</p>
    </div>
  )
}
