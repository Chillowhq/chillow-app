"use client"

import {
  Bell,
  Check,
  MessageCircle,
  Receipt,
  type LucideIcon,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  MENU_WAITSTAFF_REQUEST_REASONS,
  type WaitstaffRequestReasonId,
} from "@/lib/waitstaff-request-reasons"
import { useCustomerTheme } from "@/components/providers/customer-theme-provider"

type GuestWaitstaffRequestSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  servicePointLabel: string
  selectedReason: WaitstaffRequestReasonId
  onSelectReason: (reason: WaitstaffRequestReasonId) => void
  onSubmit: () => void
  isSubmitting: boolean
}

const REASON_ICONS: Partial<Record<WaitstaffRequestReasonId, LucideIcon>> = {
  "Customer neeed Assistance": Bell,
  "Bill request": Receipt,
  "Other reasons": MessageCircle,
} as const

export default function GuestWaitstaffRequestSheet({
  open,
  onOpenChange,
  servicePointLabel,
  selectedReason,
  onSelectReason,
  onSubmit,
  isSubmitting,
}: GuestWaitstaffRequestSheetProps) {
  const { themeVars } = useCustomerTheme()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        style={themeVars}
        className="mx-auto max-h-[88dvh] w-full overflow-y-auto rounded-t-[2rem] border-border bg-background p-0 shadow-2xl sm:max-w-xl motion-reduce:transition-none"
      >
        <div
          className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-7"
          data-testid="guest-waitstaff-request-sheet"
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-border"
          />

          <SheetHeader className="space-y-2 p-0 text-left">
            <SheetTitle className="text-2xl font-black tracking-tight text-foreground">
              Request Waitstaff
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[var(--brand-primary,#EA601A)]"
              />
              {servicePointLabel}
            </SheetDescription>
          </SheetHeader>

          <fieldset className="mt-7 space-y-3">
            <legend className="mb-3 text-base font-black text-foreground">
              How can we help you?
            </legend>
            {MENU_WAITSTAFF_REQUEST_REASONS.map((reason) => {
              const selected = selectedReason === reason.id
              const Icon = REASON_ICONS[reason.id] || Bell

              return (
                <button
                  key={reason.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectReason(reason.id)}
                  className={`flex min-h-20 w-full items-center gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] focus-visible:ring-offset-2 motion-reduce:transition-none ${
                    selected
                      ? "border-[var(--brand-primary,#EA601A)] bg-[var(--brand-muted,hsl(var(--secondary)))] shadow-sm"
                      : "border-border bg-card hover:border-[var(--brand-primary,#EA601A)]/50 hover:bg-secondary/40"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      selected
                        ? "bg-[var(--brand-primary,#EA601A)]/12 text-[var(--brand-primary,#EA601A)]"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-foreground sm:text-base">
                      {reason.menuLabel}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {reason.menuDescription}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected
                        ? "border-[var(--brand-primary,#EA601A)] bg-[var(--brand-primary,#EA601A)] text-white"
                        : "border-border"
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              )
            })}
          </fieldset>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--brand-primary,#EA601A)] px-5 text-sm font-black text-[var(--brand-text-on-brand,white)] shadow-lg shadow-[var(--brand-primary,#EA601A)]/20 transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
                />
                Sending request...
              </span>
            ) : (
              "Send request"
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
