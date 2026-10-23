import { AlertCircle } from "lucide-react"
import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FieldControlProps = {
  id: string
  "aria-describedby": string | undefined
  "aria-invalid": true | undefined
}

type FieldProps = {
  id: string
  label: ReactNode
  required?: boolean
  description?: ReactNode
  error?: ReactNode
  className?: string
  children: (controlProps: FieldControlProps) => ReactNode
}

export function Field({
  id,
  label,
  required = false,
  description,
  error,
  className,
  children,
}: FieldProps) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-destructive" aria-hidden="true">*</span> : null}
      </Label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-sm font-medium text-destructive" aria-live="polite">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
