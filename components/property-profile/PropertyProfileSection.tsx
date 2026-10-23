"use client"

import type { ReactNode } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PropertyProfileSection({
  id,
  title,
  description,
  icon,
  children,
  saving,
  saved,
  saveDisabled = false,
  onSave,
}: {
  id: string
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
  saving: boolean
  saved: boolean
  saveDisabled?: boolean
  onSave: () => void
}) {
  return (
    <section id={id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm scroll-mt-24">
      <div className="flex flex-col gap-4 border-b border-border bg-secondary/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || saveDisabled}
          className="min-w-28 rounded-xl font-bold"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saving ? "Saving" : saved ? "Saved" : "Save section"}
        </Button>
      </div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function FieldLabel({
  children,
  hint,
  htmlFor,
}: {
  children: ReactNode
  hint?: string
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-foreground">
      {children}
      {hint ? <span className="ml-1 font-medium text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function ChoiceGroup<T extends string | number | boolean | null>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: Array<{ value: T; label: string; description?: string }>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-2xl border p-3 text-left transition-colors ${
              selected
                ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                : "border-border bg-background hover:border-primary/30"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className={`h-3.5 w-3.5 rounded-full border-4 ${selected ? "border-primary" : "border-muted-foreground/30"}`} />
              {option.label}
            </span>
            {option.description ? (
              <span className="mt-1 block pl-5.5 text-xs text-muted-foreground">{option.description}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
