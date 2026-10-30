import { AlertCircle, CheckCircle2, Clock3, Info, Receipt } from "lucide-react"
import { format } from "date-fns"
import { formatMinorCurrency } from "@/lib/localization"

export type OfflineCommissionActivity = {
  id: string
  sourceType: string
  sourceId: string
  confirmedAt: string
  eligibleAmountCents: number
  commissionRateApplied: number
  commissionAmountCents: number
  currency: string
  billingPeriod: string | null
  status: string
  invoiceBatchId: string | null
  stripeInvoiceId: string | null
}

export type OfflineCommissionBatch = {
  id: string
  billingPeriod: string | null
  currency: string
  status: string
  amountCents: number
  stripeInvoiceId: string | null
  failed: boolean
}

export type OfflineCommissionBilling = {
  currency: string
  currentPeriod: string | null
  currentPeriodAccruedAmountCents: number | null
  accruedAmountCents: number
  invoicedAmountCents: number
  paidAmountCents: number
  failedAmountCents: number
  adjustmentAmountCents: number
  collectionState: string
  pagination: { page: number; limit: number; total: number }
  activities: OfflineCommissionActivity[]
  batches: OfflineCommissionBatch[]
  adjustments: Array<{
    id: string
    amountCents: number
    status: string
    stripeCreditNoteId: string | null
    createdAt: string
  }>
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy")
}

function formatPeriod(value: string | null | undefined) {
  if (!value) return "—"
  const [start, end] = value.split("/")
  const startLabel = formatDate(start)
  const endLabel = formatDate(end)
  return startLabel === "—" || endLabel === "—" ? value : `${startLabel} – ${endLabel}`
}

function sourceLabel(sourceType: string) {
  if (sourceType === "order") return "Restaurant order"
  if (sourceType === "reservation") return "Hotel reservation"
  return "Commission activity"
}

function statusPresentation(status: string) {
  const normalized = String(status || "unknown").toLowerCase()
  const labels: Record<string, string> = {
    pending: "Accrued",
    invoiced: "Invoiced",
    paid: "Paid",
    failed: "Confirmed payment failure",
    held: "Held for reconciliation",
    disabled: "Collection disabled",
  }
  const classes: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    invoiced: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    held: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    disabled: "bg-secondary text-muted-foreground",
  }
  return {
    label: labels[normalized] || normalized.replace(/_/g, " "),
    className: classes[normalized] || "bg-secondary text-muted-foreground",
  }
}

function StatusBadge({ status }: { status: string }) {
  const presentation = statusPresentation(status)
  return (
    <span className={`inline-flex max-w-[10rem] shrink-0 whitespace-normal rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide ${presentation.className}`}>
      {presentation.label}
    </span>
  )
}

export function OfflineCommissionsSkeleton() {
  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-6 shadow-sm" role="status" aria-label="Loading offline commissions">
      <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-secondary/20" />)}
      </div>
    </section>
  )
}

export default function OfflineCommissionsSection({
  data,
  isActivityLoading,
  activityError,
  onRetryActivity,
  onActivityPageChange,
}: {
  data: OfflineCommissionBilling
  isActivityLoading: boolean
  activityError: boolean
  onRetryActivity: () => void
  onActivityPageChange: (page: number) => void
}) {
  const currency = String(data.currency || "EUR").toUpperCase()
  const amount = (value: number | null | undefined, rowCurrency = currency) => (
    value === null || value === undefined ? "—" : formatMinorCurrency(value, String(rowCurrency || currency).toUpperCase(), "en-IE")
  )
  const heldBatches = data.batches.filter((batch) => batch.status === "held")
  const failedBatches = data.batches.filter((batch) => batch.status === "failed")
  const activityPage = Math.max(1, Number(data.pagination?.page) || 1)
  const activityLimit = Math.max(1, Number(data.pagination?.limit) || data.activities.length || 1)
  const activityTotal = Math.max(0, Number(data.pagination?.total) || 0)
  const activityPageCount = Math.max(1, Math.ceil(activityTotal / activityLimit))
  const activityStart = activityTotal === 0 ? 0 : ((activityPage - 1) * activityLimit) + 1
  const activityEnd = Math.min(activityPage * activityLimit, activityTotal)

  return (
    <div className="space-y-8">
      <section className="rounded-[1.5rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
              <Receipt className="h-5 w-5 text-primary" />
              Offline Commissions
            </h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Backend-recorded commissions for offline restaurant orders and hotel reservations.</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billing currency: {currency}</p>
        </div>

        {data.collectionState === "disabled" && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4 text-muted-foreground">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Commission collection is disabled</p>
              <p className="mt-1 text-xs font-medium">Accruals and historical batches are shown for visibility. This page does not activate collection or billing automation.</p>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Accrued this period" value={amount(data.currentPeriodAccruedAmountCents)} detail={data.currentPeriod ? formatPeriod(data.currentPeriod) : "Current period unavailable"} />
          <SummaryCard label="Accrued balance" value={amount(data.accruedAmountCents)} detail="All periods not yet invoiced" />
          <SummaryCard label="Invoiced" value={amount(data.invoicedAmountCents)} detail="Historical issued invoices" />
          <SummaryCard label="Paid" value={amount(data.paidAmountCents)} detail="Successfully collected" emphasis="positive" />
        </div>

        {(heldBatches.length > 0 || failedBatches.length > 0) && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {heldBatches.length > 0 && <StateNotice status="held" count={heldBatches.length} />}
            {failedBatches.length > 0 && <StateNotice status="failed" count={failedBatches.length} />}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-secondary/30 p-5">
          <h2 className="text-lg font-black text-foreground">Commission Activity</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Eligible payment and commission amounts are supplied by Chillow and are not recalculated here.</p>
          {activityError && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert">
              <p className="font-medium text-muted-foreground">Could not load the selected activity page. Previously displayed activity remains visible.</p>
              <button type="button" onClick={onRetryActivity} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary">Try again</button>
            </div>
          )}
        </div>

        {data.activities.length === 0 ? (
          <EmptyState label="No commission activity yet" description="Recorded offline commission activity will appear here." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Reference</th>
                    <th className="px-6 py-4 text-right">Eligible payment</th>
                    <th className="px-6 py-4 text-right">Stored rate</th>
                    <th className="px-6 py-4 text-right">Commission</th>
                    <th className="px-6 py-4 text-right">Billing status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.activities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(activity.confirmedAt)}</td>
                      <td className="px-6 py-4"><p className="font-bold text-foreground">{sourceLabel(activity.sourceType)}</p><p className="text-xs text-muted-foreground">{activity.sourceId}</p></td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{amount(activity.eligibleAmountCents, activity.currency)}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{activity.commissionRateApplied}%</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{amount(activity.commissionAmountCents, activity.currency)}</td>
                      <td className="px-6 py-4 text-right"><StatusBadge status={activity.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 md:hidden">
              {data.activities.map((activity) => (
                <article key={activity.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-bold text-foreground">{sourceLabel(activity.sourceType)}</p><p className="break-words text-xs text-muted-foreground">{activity.sourceId}</p></div><StatusBadge status={activity.status} /></div>
                  <p className="mt-3 text-xs text-muted-foreground">{formatDate(activity.confirmedAt)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Metric label="Eligible payment" value={amount(activity.eligibleAmountCents, activity.currency)} /><Metric label="Stored rate" value={`${activity.commissionRateApplied}%`} /><Metric label="Commission" value={amount(activity.commissionAmountCents, activity.currency)} /></div>
                </article>
              ))}
            </div>
          </>
        )}
        {activityTotal > 0 && (
          <div className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
              Showing transactions {activityStart}–{activityEnd} of {activityTotal}
              {isActivityLoading ? " · Loading activity…" : ""}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => onActivityPageChange(activityPage - 1)} disabled={isActivityLoading || activityPage <= 1} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50" aria-label="Previous commission activity page">Previous</button>
              <button type="button" onClick={() => onActivityPageChange(activityPage + 1)} disabled={isActivityLoading || activityPage >= activityPageCount} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50" aria-label="Next commission activity page">Next</button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-secondary/30 p-5">
          <h2 className="text-lg font-black text-foreground">Commission Invoice History</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Standalone offline commission invoices and collection states.</p>
        </div>
        {data.batches.length === 0 ? <EmptyState label="No commission invoices yet" description="Issued commission invoice batches will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><tr><th className="px-6 py-4">Invoice reference</th><th className="px-6 py-4">Billing period</th><th className="px-6 py-4 text-right">Amount</th><th className="px-6 py-4">Currency</th><th className="px-6 py-4 text-right">Status</th></tr></thead>
              <tbody className="divide-y divide-border/50">
                {data.batches.map((batch) => <tr key={batch.id} className="hover:bg-muted/20"><td className="px-6 py-4 font-bold text-foreground">{batch.stripeInvoiceId || batch.id}</td><td className="px-6 py-4 text-muted-foreground">{formatPeriod(batch.billingPeriod)}</td><td className="px-6 py-4 text-right font-bold text-foreground">{amount(batch.amountCents, batch.currency)}</td><td className="px-6 py-4 font-bold text-muted-foreground">{String(batch.currency || currency).toUpperCase()}</td><td className="px-6 py-4 text-right"><StatusBadge status={batch.status} /></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({ label, value, detail, emphasis }: { label: string; value: string; detail: string; emphasis?: "positive" }) {
  return <div className="rounded-xl border border-border bg-background p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-black ${emphasis === "positive" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>{value}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p></div>
}

function StateNotice({ status, count }: { status: "held" | "failed"; count: number }) {
  const held = status === "held"
  const Icon = held ? Clock3 : AlertCircle
  return <div className={`flex items-start gap-3 rounded-xl border p-4 ${held ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"}`}><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${held ? "text-amber-600" : "text-red-600"}`} /><div><p className={`text-sm font-bold ${held ? "text-amber-900 dark:text-amber-300" : "text-red-900 dark:text-red-300"}`}>{held ? "Held for reconciliation" : "Confirmed payment failure"}</p><p className={`mt-1 text-xs font-medium ${held ? "text-amber-800 dark:text-amber-400" : "text-red-800 dark:text-red-400"}`}>{count} invoice batch{count === 1 ? " is" : "es are"} {held ? "awaiting reconciliation; this is not a confirmed failure." : "has a confirmed collection failure."}</p></div></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-words font-black text-foreground">{value}</p></div>
}

function EmptyState({ label, description }: { label: string; description: string }) {
  return <div className="p-10 text-center text-muted-foreground"><CheckCircle2 className="mx-auto h-9 w-9 opacity-30" /><p className="mt-3 text-sm font-bold text-foreground">{label}</p><p className="mx-auto mt-1 max-w-sm text-xs font-medium">{description}</p></div>
}
