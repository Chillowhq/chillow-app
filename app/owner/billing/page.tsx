"use client"

import { useState, useEffect } from "react"
import {
  CreditCard,
  Wallet,
  Receipt,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Info,
  Trash2,
  Link as LinkIcon,
  Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiClient } from "@/lib/axios-config"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { MANAGEMENT_ACCESS_AREAS } from "@/lib/manager-permissions"
import { toast } from "sonner"
import { format } from "date-fns"
import AddPaymentMethodModal from "@/components/owner/billing/AddPaymentMethodModal"
import ManagePlanModal from "@/components/owner/billing/ManagePlanModal"
import { useSetupProgress } from "@/contexts/SetupProgressContext"
import { formatMinorCurrency } from "@/lib/localization"

type BillingTab = "billing" | "payouts" | "performance"
type BillingResource = "billing" | "commission" | "invoices" | "plans" | "payout" | "feeSettings"

const billingTabs: Array<{ id: BillingTab; label: string; question: string }> = [
  { id: "billing", label: "Billing", question: "How much do I owe Chillow?" },
  { id: "payouts", label: "Payouts", question: "When and how do I receive online payments?" },
  { id: "performance", label: "Performance", question: "How much revenue has Chillow helped me process?" },
]

const isBillingTab = (value: string | null): value is BillingTab => (
  Boolean(value && billingTabs.some((tab) => tab.id === value))
)

function BillingCardSkeleton({
  label,
  metricCount = 4,
}: {
  label: string
  metricCount?: number
}) {
  return (
    <section
      className="rounded-[1.5rem] border border-border bg-card p-6 shadow-sm"
      role="status"
      aria-label={label}
    >
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: metricCount }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-secondary/20 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    </section>
  )
}

function InvoiceHistorySkeleton() {
  return (
    <section
      className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm"
      role="status"
      aria-label="Loading invoice history"
    >
      <div className="border-b border-border p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-3 w-52" />
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid grid-cols-2 gap-4 px-6 py-4 md:grid-cols-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  )
}

function BillingSectionError({
  label,
  onRetry,
}: {
  label: string
  onRetry: () => void
}) {
  return (
    <section className="rounded-[1.5rem] border border-destructive/30 bg-card p-6 shadow-sm" role="alert">
      <p className="font-bold text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">Previously saved billing information has not been changed.</p>
      <Button type="button" variant="outline" className="mt-4 rounded-xl font-bold" onClick={onRetry}>
        Try Again
      </Button>
    </section>
  )
}

export default function BillingPage() {
  const { user } = useAuthGuard({ requiredArea: MANAGEMENT_ACCESS_AREAS.PAYMENTS_AND_BILLING })
  const businessId = user?.businessId
  const isPrimaryOwner = user?.role === "owner"
  const { refreshSetupProgress } = useSetupProgress()

  const [isLoading, setIsLoading] = useState(true)
  const [resourceLoading, setResourceLoading] = useState<Record<BillingResource, boolean>>({
    billing: true,
    commission: true,
    invoices: true,
    plans: true,
    payout: true,
    feeSettings: true,
  })
  const [resourceErrors, setResourceErrors] = useState<Partial<Record<BillingResource, boolean>>>({})
  const [activeTab, setActiveTab] = useState<BillingTab>("billing")
  const [showPlanDialog, setShowPlanDialog] = useState(false)

  // Section 1: Customer Payments (Stripe Connect)
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean
    stripeOnboardingComplete: boolean
    stripeChargesEnabled: boolean
    stripePayoutsEnabled: boolean
    stripeAccountId: string | null
  }>({
    connected: false,
    stripeOnboardingComplete: false,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeAccountId: null
  })
  const [isCheckingStripeStatus, setIsCheckingStripeStatus] = useState(false)
  const [hasCheckedStripeStatus, setHasCheckedStripeStatus] = useState(false)
  const [stripeStatusError, setStripeStatusError] = useState(false)
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)
  const [isOpeningStripeDashboard, setIsOpeningStripeDashboard] = useState(false)

  // Sections 2-5: Chillow Billing (MVP)
  const [billingInfo, setBillingInfo] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isDeletingCard, setIsDeletingCard] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  // Sections 6-7: Analytics & Invoices
  const [commission, setCommission] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null)
  const [payoutSummary, setPayoutSummary] = useState<any>(null)

  // Section: Platform Fee Settings
  const [platformFeeMode, setPlatformFeeMode] = useState<"business_absorbs" | "customer_pays" | "split">("business_absorbs")
  const [customerPlatformFeePercent, setCustomerPlatformFeePercent] = useState<number>(0)
  const [feeLabel, setFeeLabel] = useState("Platform Fee")
  const [feeRate, setFeeRate] = useState<number>(2.5)
  const [isSavingFeeSettings, setIsSavingFeeSettings] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab")
    const action = params.get("action")
    const invoiceId = params.get("invoiceId")

    if (isBillingTab(tab)) {
      setActiveTab(tab)
    }
    if (invoiceId) setLinkedInvoiceId(invoiceId)

    if (action === "add-card" && isPrimaryOwner) {
      setShowPaymentModal(true)
      params.delete("action")
      const query = params.toString()
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    }
  }, [isPrimaryOwner])

  useEffect(() => {
    if (!linkedInvoiceId || resourceLoading.invoices) return
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-invoice-ids]"))
      .find((element) => (element.dataset.invoiceIds || "").split("|").includes(linkedInvoiceId))
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    target.focus({ preventScroll: true })
  }, [invoices, linkedInvoiceId, resourceLoading.invoices])

  useEffect(() => {
    if (businessId) {
      fetchStripeStatus()
      fetchBillingData()
      fetchPlatformFeeSettings()
    }
  }, [businessId])


  const fetchStripeStatus = async () => {
    try {
      setIsCheckingStripeStatus(true)
      setStripeStatusError(false)
      const res = await apiClient.get("/owner/stripe/status")
      setStripeStatus(res.data)
    } catch (error) {
      console.error("Failed to fetch Stripe status", error)
      setStripeStatusError(true)
    } finally {
      setIsCheckingStripeStatus(false)
      setHasCheckedStripeStatus(true)
    }
  }

  const fetchBillingData = async () => {
    let requestFailed = false
    const markLoaded = (resource: BillingResource) => {
      setResourceLoading((current) => ({ ...current, [resource]: false }))
    }
    const loadResource = async (
      resource: BillingResource,
      request: Promise<{ data: any }>,
      applyData: (data: any) => void,
    ) => {
      try {
        setResourceErrors((current) => ({ ...current, [resource]: false }))
        const response = await request
        applyData(response.data)
      } catch (error) {
        requestFailed = true
        setResourceErrors((current) => ({ ...current, [resource]: true }))
        console.error(`Failed to fetch billing resource: ${resource}`, error)
      } finally {
        markLoaded(resource)
      }
    }

    try {
      setIsLoading(true)
      await Promise.all([
        loadResource("billing", apiClient.get("/owner/billing"), setBillingInfo),
        loadResource("commission", apiClient.get("/owner/billing/commission"), setCommission),
        loadResource("invoices", apiClient.get("/owner/billing/invoices"), setInvoices),
        loadResource("plans", apiClient.get("/public/plans"), setPlans),
        loadResource("payout", apiClient.get("/owner/stripe/payout-summary"), setPayoutSummary),
      ])

      if (requestFailed) toast.error("Some billing information could not be loaded")
    } catch (error) {
      console.error("Failed to fetch billing data", error)
      toast.error("Failed to load billing information")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPlatformFeeSettings = async () => {
    try {
      setResourceErrors((current) => ({ ...current, feeSettings: false }))
      const res = await apiClient.get("/owner/billing")
      if (res?.data) {
        setPlatformFeeMode(res.data.platformFeeMode || (res.data.passPlatformFeeToCustomer ? "customer_pays" : "business_absorbs"))
        setCustomerPlatformFeePercent(res.data.customerPlatformFeePercent ?? 0)
        setFeeLabel(res.data.platformFeeLabel || "Platform Fee")
        setFeeRate(res.data.platformFeeRate ?? 2.5)
      }
    } catch (err) {
      console.error("Failed to fetch platform fee settings", err)
      setResourceErrors((current) => ({ ...current, feeSettings: true }))
    } finally {
      setResourceLoading((current) => ({ ...current, feeSettings: false }))
    }
  }

  const retryBillingData = () => {
    setResourceLoading((current) => ({
      ...current,
      billing: true,
      commission: true,
      invoices: true,
      plans: true,
      payout: true,
    }))
    fetchBillingData()
  }

  const retryPlatformFeeSettings = () => {
    setResourceLoading((current) => ({ ...current, feeSettings: true }))
    fetchPlatformFeeSettings()
  }

  const retryStripeStatus = () => {
    setHasCheckedStripeStatus(false)
    fetchStripeStatus()
  }

  const savePlatformFeeSettings = async (newMode: string, newPercent: number, newLabel?: string) => {
    try {
      setIsSavingFeeSettings(true)
      const payload: any = {
        platformFeeMode: newMode,
        customerPlatformFeePercent: newPercent,
        passPlatformFeeToCustomer: newMode === "customer_pays" || newMode === "split" // backend compat
      }
      if (newLabel !== undefined) payload.platformFeeLabel = newLabel
      const res = await apiClient.patch("/owner/billing/platform-fee-settings", payload)
      if (res?.data) {
        setPlatformFeeMode(res.data.platformFeeMode)
        setCustomerPlatformFeePercent(res.data.customerPlatformFeePercent)
        if (res.data.platformFeeLabel) setFeeLabel(res.data.platformFeeLabel)
        if (res.data.platformFeeRate != null) setFeeRate(res.data.platformFeeRate)
      }
      toast.success("Platform fee settings saved")
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update platform fee settings")
    } finally {
      setIsSavingFeeSettings(false)
    }
  }

  // --- Customer Payments Functions ---
  const connectStripeAccount = async () => {
    try {
      setIsConnectingStripe(true)
      const res = await apiClient.post("/owner/stripe/connect-account")
      const redirectUrl = res.data.onboardingUrl || res.data.url
      if (redirectUrl) {
        window.location.href = redirectUrl
      } else {
        toast.error("No onboarding URL returned from Stripe.")
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.response?.data?.error || "Failed to start Stripe connection.")
    } finally {
      setIsConnectingStripe(false)
    }
  }

  const openStripeDashboard = async () => {
    try {
      setIsOpeningStripeDashboard(true)
      const res = await apiClient.get("/owner/stripe/dashboard-link")
      if (res.data.url) {
        window.open(res.data.url, "_blank", "noopener,noreferrer")
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to open Stripe Dashboard.")
    } finally {
      setIsOpeningStripeDashboard(false)
    }
  }

  const handleTabChange = (tab: BillingTab) => {
    setActiveTab(tab)

    const params = new URLSearchParams(window.location.search)
    if (tab === "billing") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }

    const query = params.toString()
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
  }



  const formatCurrency = (
    val: number,
    cur = billingInfo?.currency || commission?.currency || "EUR",
  ) => {
    const amount = isNaN(val) || val === null || val === undefined ? 0 : val
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: cur }).format(amount)
  }

  const formatInvoiceAmount = (invoice: any) => {
    const currency = String(invoice.currency || billingInfo?.currency || "EUR").toUpperCase()
    const hasAmountPaid = Number.isSafeInteger(invoice.amountPaid)
    const hasAmountDue = Number.isSafeInteger(invoice.amountDue)
    if (hasAmountPaid || hasAmountDue) {
      const amountMinor = invoice.status === "paid" && hasAmountPaid
        ? invoice.amountPaid
        : invoice.amountDue
      return formatMinorCurrency(amountMinor, currency, "en-IE")
    }
    // Legacy local rows stored `amount` as a major-unit value.
    return formatCurrency(Number(invoice.amount || 0), currency)
  }

  const formatBalance = (entries: any[] = []) => {
    if (!Array.isArray(entries) || entries.length === 0) return formatCurrency(0)
    return entries
      .map((entry) => formatCurrency(Number(entry.amountMajor ?? 0), entry.currency || "EUR"))
      .join(" / ")
  }

  const formatPayoutStatus = (status?: string) => {
    if (!status) return "Unknown"
    return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const titleCasePlan = (slug?: string) => {
    if (!slug) return "Basic"
    return slug.charAt(0).toUpperCase() + slug.slice(1)
  }

  const currentPlanSlug = billingInfo?.currentPlan || commission?.currentPlan || "basic"
  const currentPlan = plans.find((plan) => plan.slug === currentPlanSlug)
  const currentPlanName = currentPlan?.name || titleCasePlan(currentPlanSlug)
  const currentBillingCycle = commission?.currentBillingCycle || {}
  const monthlyPrice = Number(currentPlan?.monthlyPrice ?? currentBillingCycle.subscriptionFee ?? 0)
  const offlineCommissionRate = Number(currentPlan?.offlineCommissionRate ?? commission?.offlineCommissionRate ?? 0)

  const billingPeriod = currentBillingCycle.billingPeriod || commission?.billingPeriod || billingInfo?.billingPeriod || {}
  const periodStart = billingPeriod.start || billingInfo?.currentPeriodStart
  const periodEnd = billingPeriod.end || billingInfo?.currentPeriodEnd
  const nextInvoiceDate = billingPeriod.invoiceAt || billingInfo?.nextInvoiceDate || billingInfo?.nextBillingDate
  const billingPeriodLabel = periodStart && periodEnd
    ? `${format(new Date(periodStart), "MMM d")} - ${format(new Date(periodEnd), "MMM d")}`
    : "Not available"
  const nextInvoiceLabel = nextInvoiceDate ? format(new Date(nextInvoiceDate), "MMM d, yyyy") : "Not available"
  const daysUntilInvoice = billingPeriod.daysUntilInvoice ?? commission?.daysUntilInvoice ?? billingInfo?.daysUntilInvoice
  const daysRemainingLabel = typeof daysUntilInvoice === "number"
    ? `${daysUntilInvoice} day${daysUntilInvoice === 1 ? "" : "s"} remaining`
    : "Not available"

  const customerPaidFees = Number(currentBillingCycle.customerPaidFees || 0)
  const businessPaidFees = Number(currentBillingCycle.businessPaidFees || currentBillingCycle.businessOwedCommission || 0)
  const totalQuickServeFees = Number(currentBillingCycle.totalQuickServeFees || currentBillingCycle.offlineCommissionAmount || 0)
  const pendingInvoiceAmount = Number(currentBillingCycle.pendingInvoiceAmount ?? (monthlyPrice + totalQuickServeFees))

  const scheduledPlanSlug = billingInfo?.scheduledDowngradePlan
  const scheduledPlan = plans.find((plan) => plan.slug === scheduledPlanSlug)
  const scheduledPlanName = scheduledPlan?.name || titleCasePlan(scheduledPlanSlug)
  const scheduledEffectiveDate = billingInfo?.scheduledPlanEffectiveDate || nextInvoiceDate
  const scheduledEffectiveLabel = scheduledEffectiveDate
    ? format(new Date(scheduledEffectiveDate), "MMM d, yyyy")
    : "the next billing cycle"

  const revenueSummary = commission?.revenueSummary || {}
  const onlineRevenueProcessed = Number(revenueSummary.onlineRevenueProcessed || 0)
  const offlineRevenueProcessed = Number(revenueSummary.offlineRevenueProcessed || 0)
  const totalRevenueProcessed = Number(revenueSummary.totalRevenueProcessed ?? (onlineRevenueProcessed + offlineRevenueProcessed))
  const totalOrdersProcessed = Number(revenueSummary.totalOrdersProcessed || 0)
  const averageOrderValue = Number(revenueSummary.averageOrderValue ?? (totalOrdersProcessed > 0 ? totalRevenueProcessed / totalOrdersProcessed : 0))
  const totalQuickServeFeesProcessed = Number(revenueSummary.totalQuickServeFeesProcessed || 0)
  const netRevenueProcessed = Number(revenueSummary.netRevenueProcessed ?? (totalRevenueProcessed - totalQuickServeFeesProcessed))
  const revenueSummaryTipsCollected = Number(
    revenueSummary.totalTipsProcessed ??
    revenueSummary.totalTipsCollected ??
    revenueSummary.totalTips ??
    revenueSummary.tipsCollected ??
    commission?.totalTipsCollected ??
    billingInfo?.totalTipsCollected ??
    0
  )
  const totalTipsCollected = revenueSummaryTipsCollected

  const payoutDataLoaded = payoutSummary !== null
  const payoutConnected = payoutSummary?.connected === true
  const recentPayouts = payoutSummary?.recentPayouts || []
  const nextPayout = payoutSummary?.nextPayout || null
  const availableBalanceLabel = !payoutDataLoaded
    ? "Unavailable"
    : payoutConnected
      ? formatBalance(payoutSummary.availableBalance)
      : "Not connected"
  const pendingBalanceLabel = !payoutDataLoaded
    ? "Unavailable"
    : payoutConnected
      ? formatBalance(payoutSummary.pendingBalance)
      : "Not connected"
  const nextPayoutLabel = nextPayout
    ? formatCurrency(Number(nextPayout.amountMajor || 0), nextPayout.currency || "EUR")
    : payoutConnected
      ? "No scheduled payout"
      : payoutDataLoaded
        ? "Not connected"
        : "Unavailable"
  const nextPayoutMeta = nextPayout?.arrivalDate
    ? `Arrives ${format(new Date(nextPayout.arrivalDate), "MMM d, yyyy")}`
    : nextPayout?.status
      ? formatPayoutStatus(nextPayout.status)
      : payoutConnected
        ? "Stripe has not scheduled one yet"
        : payoutDataLoaded
          ? "Connect Stripe to view payouts"
          : "Payout data could not be loaded"
  const recentPayoutLabel = recentPayouts.length > 0
    ? `${recentPayouts.length} payout${recentPayouts.length === 1 ? "" : "s"}`
    : payoutConnected
      ? "No payouts yet"
      : payoutDataLoaded
        ? "Not connected"
        : "Unavailable"
  const latestPayout = recentPayouts[0]
  const recentPayoutMeta = latestPayout
    ? `Latest ${formatCurrency(Number(latestPayout.amountMajor || 0), latestPayout.currency || "EUR")} - ${formatPayoutStatus(latestPayout.status)}`
    : payoutConnected
      ? "Recent payouts will appear here"
      : payoutDataLoaded
        ? "Connect Stripe to view payouts"
        : "Payout data could not be loaded"

  const isBillingOverviewLoading = resourceLoading.billing || resourceLoading.commission || resourceLoading.plans
  const isSubscriptionLoading = resourceLoading.billing || resourceLoading.commission || resourceLoading.plans
  const isPerformanceLoading = resourceLoading.commission
  const hasBillingOverviewError = Boolean(resourceErrors.billing || resourceErrors.commission || resourceErrors.plans)
  const hasPerformanceError = Boolean(resourceErrors.commission)

  return (
    <div className="flex-1 overflow-y-auto bg-muted/30">
      <header className="sticky top-0 lg:top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Payments & Billing
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage billing, payouts, and Chillow revenue in one place
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStripeStatus()
              fetchBillingData()
            }}
            disabled={isLoading || isCheckingStripeStatus}
            className="flex items-center gap-2 font-bold bg-secondary/50 hover:bg-secondary border-border rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isCheckingStripeStatus ? "animate-spin text-muted-foreground" : "text-primary"}`} />
            Refresh Data
          </Button>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        {!isPrimaryOwner && (
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-200">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-black">Billing workspace access</p>
              <p className="mt-1 text-xs font-medium">
                You can view billing, invoices, payment status, and payouts. Only the Primary Owner can change plans, payment methods, fee configuration, or Stripe account ownership.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap gap-2">
            {billingTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {billingTabs.find((tab) => tab.id === activeTab)?.question}
          </p>
        </div>

        {activeTab === "billing" && (
          <div className="space-y-8">
            {hasBillingOverviewError ? (
              <BillingSectionError label="Current billing cycle could not be loaded" onRetry={retryBillingData} />
            ) : isBillingOverviewLoading ? (
              <BillingCardSkeleton label="Loading current billing cycle" />
            ) : (
            <section className="bg-card rounded-[1.5rem] border border-border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Current Billing Cycle
                </h2>
                <p className="text-xs text-muted-foreground font-medium">Current billing cycle fees only.</p>
              </div>

              <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pending Invoice</p>
                <p className="text-3xl font-black text-foreground">{formatCurrency(pendingInvoiceAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">Subscription plus business-paid Chillow fees for this billing period.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Billing Period</p>
                  <p className="text-sm font-black text-foreground">
                    {billingPeriodLabel}
                  </p>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Next Invoice</p>
                  <p className="text-sm font-black text-foreground">
                    {nextInvoiceLabel}
                  </p>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Days Until Invoice</p>
                  <p className="text-sm font-black text-foreground">
                    {daysRemainingLabel}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Customer-paid Fees</p>
                  <p className="text-lg font-black text-foreground">{formatCurrency(customerPaidFees)}</p>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Business-paid Fees</p>
                  <p className="text-lg font-black text-foreground">{formatCurrency(businessPaidFees)}</p>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Chillow Fees</p>
                  <p className="text-lg font-black text-primary">{formatCurrency(totalQuickServeFees)}</p>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pending Invoice Amount</p>
                  <p className="text-lg font-black text-foreground">{formatCurrency(pendingInvoiceAmount)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-blue-800 dark:text-blue-400 leading-tight">
                  Current billing cycle fees only. Revenue totals are shown separately in Performance.
                </p>
              </div>
            </section>
            )}
            {hasBillingOverviewError ? (
              <BillingSectionError label="Current subscription could not be loaded" onRetry={retryBillingData} />
            ) : isSubscriptionLoading ? (
              <BillingCardSkeleton label="Loading current subscription" metricCount={3} />
            ) : (
            <section className="bg-card rounded-[1.5rem] border border-border shadow-sm p-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                <div>
                  <h2 className="text-lg font-black text-foreground">Current Subscription</h2>
                  <p className="text-xs text-muted-foreground font-medium">Your Chillow subscription</p>
                </div>

                {billingInfo?.billingStatus === 'active' ? (
                  <div className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active
                  </div>
                ) : billingInfo?.billingStatus === 'past_due' ? (
                  <div className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Past Due
                  </div>
                ) : (
                  <div className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Incomplete
                  </div>
                )}
              </div>

              <div className="relative z-10">
                <p className="text-3xl font-black capitalize text-foreground">
                  {currentPlanName}
                </p>
                <div className="mt-4 bg-secondary/50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Status</p>
                    <p className="text-lg font-black text-foreground capitalize">{billingInfo?.billingStatus || "Incomplete"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Monthly Subscription</p>
                    <p className="text-lg font-black text-foreground">{formatCurrency(monthlyPrice)} <span className="text-xs font-medium text-muted-foreground">/mo</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Offline Commission Rate</p>
                    <p className="text-lg font-black text-foreground">{offlineCommissionRate}%</p>
                  </div>
                </div>
              </div>

                {scheduledPlanSlug && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black">Downgrade scheduled</p>
                      <p className="text-xs font-medium mt-1">
                        {currentPlanName} stays active until {scheduledEffectiveLabel}. {scheduledPlanName} starts on the next billing cycle.
                      </p>
                    </div>
                  </div>
                )}
            </section>
            )}
            {isPrimaryOwner && <section className="bg-card rounded-[1.5rem] border border-border shadow-sm p-4">
              <button
                type="button"
                onClick={() => setShowPlanDialog(true)}
                className="w-full flex items-center justify-between gap-4 text-left rounded-xl hover:bg-secondary/50 transition-colors p-3"
              >
                <div>
                  <p className="text-sm font-black text-foreground">Manage Plan</p>
                  <p className="text-xs text-muted-foreground font-medium">Change subscription tier or review commission rates</p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary" />
              </button>
            </section>}
        {resourceErrors.feeSettings ? (
          <BillingSectionError label="Platform fee settings could not be loaded" onRetry={retryPlatformFeeSettings} />
        ) : resourceLoading.feeSettings ? (
          <BillingCardSkeleton label="Loading platform fee settings" metricCount={3} />
        ) : (
        <section className="bg-card rounded-[1.5rem] border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Platform Fee Settings
              </h2>
              <p className="text-xs text-muted-foreground font-medium">Control how Chillow commission fees are handled at checkout</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-secondary/30 border border-border rounded-xl space-y-4">
              <p className="text-sm font-bold text-foreground">Who pays the platform fee?</p>
              <div className="space-y-2">
                {[
                  { id: "business_absorbs", label: "We absorb full fee" },
                  { id: "customer_pays", label: "Customer pays full fee" },
                  { id: "split", label: "Split fee between customer and business" }
                ].map((option) => (
                  <label key={option.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted/50 rounded-lg">
                    <input
                      type="radio"
                      name="platformFeeMode"
                      value={option.id}
                      checked={platformFeeMode === option.id}
                      onChange={() => savePlatformFeeSettings(option.id, option.id === "customer_pays" ? 100 : (option.id === "split" ? 50 : 0), feeLabel)}
                      className="w-4 h-4 text-primary"
                      disabled={isSavingFeeSettings || !isPrimaryOwner}
                    />
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>

              {platformFeeMode === "split" && (
                <div className="pt-4 border-t border-border mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Customer Share</label>
                    <span className="text-sm font-black text-primary">{customerPlatformFeePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customerPlatformFeePercent}
                    onChange={(e) => setCustomerPlatformFeePercent(parseInt(e.target.value))}
                    onMouseUp={() => savePlatformFeeSettings(platformFeeMode, customerPlatformFeePercent, feeLabel)}
                    onTouchEnd={() => savePlatformFeeSettings(platformFeeMode, customerPlatformFeePercent, feeLabel)}
                    className="w-full accent-primary"
                    disabled={isSavingFeeSettings || !isPrimaryOwner}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-bold">
                    <span>Business pays {100 - customerPlatformFeePercent}%</span>
                    <span>Customer pays {customerPlatformFeePercent}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Current rate display */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 md:mt-0" />
              <div className="text-xs font-medium text-blue-800 dark:text-blue-400">
                <p>Fee rate is <span className="font-black">{feeRate}%</span> based on your <span className="capitalize font-bold">{billingInfo?.currentPlan || "basic"}</span> plan.</p>
                <div className="mt-2 bg-white/50 dark:bg-black/20 p-2 rounded border border-blue-200/50 dark:border-blue-800/50 font-mono text-[11px]">
                  <strong>Example on a {formatCurrency(50)} order:</strong><br />
                  Full Fee: {formatCurrency(50 * feeRate / 100)}<br />
                  {platformFeeMode === "business_absorbs" && "Business pays full fee. Customer sees no fee."}
                  {platformFeeMode === "customer_pays" && "Customer pays full fee at checkout."}
                  {platformFeeMode === "split" && `Customer pays ${formatCurrency(Math.round(50 * feeRate * customerPlatformFeePercent / 100) / 100)}. Business pays ${formatCurrency((50 * feeRate / 100) - (Math.round(50 * feeRate * customerPlatformFeePercent / 100) / 100))}.`}
                </div>
              </div>
            </div>

            {/* Custom label field */}
            {platformFeeMode !== "business_absorbs" && (
              <div className="p-4 bg-secondary/20 border border-border rounded-xl space-y-3">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Platform Fee Label</label>
                <p className="text-[10px] text-muted-foreground -mt-1">This is the label customers will see on their checkout summary.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={feeLabel}
                    onChange={(e) => setFeeLabel(e.target.value)}
                    disabled={!isPrimaryOwner}
                    maxLength={50}
                    className="flex-1 p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm"
                    placeholder="e.g. Service Fee, Platform Fee"
                  />
                  <Button
                    variant="outline"
                    onClick={() => savePlatformFeeSettings(platformFeeMode, customerPlatformFeePercent, feeLabel)}
                    disabled={isSavingFeeSettings || !isPrimaryOwner}
                    className="rounded-xl font-bold text-xs px-4"
                  >
                    {isSavingFeeSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Label"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
        )}
        {resourceErrors.invoices ? (
          <BillingSectionError label="Invoice history could not be loaded" onRetry={retryBillingData} />
        ) : resourceLoading.invoices ? (
          <InvoiceHistorySkeleton />
        ) : (
        <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/30">
            <div>
              <h2 className="text-lg font-black text-foreground">Invoice History</h2>
              <p className="text-xs text-muted-foreground font-medium">Past platform commission invoices</p>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground bg-background">
              <Receipt className="w-10 h-10 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-sm text-foreground mb-1">No invoices yet</p>
              <p className="text-xs max-w-sm mx-auto">
                Once your account accrues offline commission and completes a billing cycle, invoices will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-muted-foreground uppercase bg-muted/50 font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-xl">Invoice ID</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right rounded-tr-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoices.map((inv, idx) => (
                    <tr
                      key={idx}
                      id={`invoice-${encodeURIComponent(String(inv._id || inv.stripeInvoiceId || idx))}`}
                      data-invoice-ids={`${String(inv._id || "")}|${String(inv.stripeInvoiceId || "")}`}
                      tabIndex={-1}
                      className={`transition-colors hover:bg-muted/20 focus:outline-none ${
                        linkedInvoiceId && [inv._id, inv.stripeInvoiceId].map(String).includes(linkedInvoiceId)
                          ? "bg-primary/5 ring-2 ring-inset ring-primary/30"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-medium text-foreground">
                        {inv.stripeInvoiceId || inv._id || `INV-${idx}`}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {(inv.stripeCreatedAt || inv.createdAt)
                          ? format(new Date(inv.stripeCreatedAt || inv.createdAt), "MMM d, yyyy")
                          : "-"}
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        {formatInvoiceAmount(inv)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          (inv.status === 'open' || inv.status === 'draft') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {inv.status || 'open'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {(inv.hostedInvoiceUrl || inv.hosted_invoice_url) && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary hover:bg-primary/10" asChild>
                              <a href={inv.hostedInvoiceUrl || inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          )}
                          {(inv.invoicePdf || inv.invoice_pdf) && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary hover:bg-primary/10" asChild>
                              <a href={inv.invoicePdf || inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                PDF
                              </a>
                            </Button>
                          )}
                          {isPrimaryOwner && <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={async () => {
                              try {
                                await apiClient.delete(`/owner/billing/invoices/${inv._id}`)
                                toast.success("Invoice archived successfully")
                                fetchBillingData()
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || "Failed to archive invoice")
                              }
                            }}
                          >
                            Archive
                          </Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}
          </div>
        )}

        {activeTab === "payouts" && (
          <div className="space-y-8">
        {stripeStatusError ? (
          <BillingSectionError label="Online payment connection could not be loaded" onRetry={retryStripeStatus} />
        ) : !hasCheckedStripeStatus ? (
          <BillingCardSkeleton label="Loading online payment connection" metricCount={3} />
        ) : (
        <div>
          <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
            <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Online Payments - Bank Account</h2>
                <p className="text-xs text-muted-foreground font-medium">Connect your bank to receive online card payments directly</p>
              </div>
            </div>
            <div className="p-6">
              {/* Status badge */}
              {isCheckingStripeStatus ? (
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl border border-border bg-secondary/30">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                  <p className="text-sm font-bold text-muted-foreground">Checking connection status...</p>
                </div>
              ) : !stripeStatus?.connected ? (
                <div className="flex items-center gap-3 p-4 rounded-xl mb-6 border bg-secondary border-border">
                  <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                  <p className="font-bold text-sm text-foreground">Not connected</p>
                </div>
              ) : (
                <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 border ${stripeStatus.stripeOnboardingComplete
                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                    : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                  }`}>
                  {stripeStatus.stripeOnboardingComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold text-sm text-foreground">
                      {stripeStatus.stripeOnboardingComplete
                        ? "Connected - Ready to receive payments"
                        : "Connection incomplete"}
                    </p>
                    {stripeStatus.stripeOnboardingComplete && (
                      <p className="text-xs text-muted-foreground mt-0.5">Card payments are active. Platform fee applies per transaction.</p>
                    )}
                  </div>
                </div>
              )}

              {isPrimaryOwner ? <div className="flex flex-wrap gap-3 items-center">
                {/* Not connected: Connect Bank Account */}
                {!stripeStatus?.connected && (
                  <Button
                    onClick={connectStripeAccount}
                    disabled={isConnectingStripe}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl gap-2"
                  >
                    {isConnectingStripe
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ExternalLink className="w-4 h-4" />}
                    Connect Bank Account
                  </Button>
                )}
                {/* Fully connected: Update Bank Account + Open Stripe Dashboard */}
                {stripeStatus?.stripeOnboardingComplete && (
                  <>
                    <Button
                      onClick={connectStripeAccount}
                      disabled={isConnectingStripe}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl gap-2"
                    >
                      {isConnectingStripe
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <ExternalLink className="w-4 h-4" />}
                      Update Bank Account
                    </Button>
                    <Button
                      id="open-stripe-dashboard-btn"
                      onClick={openStripeDashboard}
                      disabled={isOpeningStripeDashboard}
                      variant="outline"
                      className="font-bold rounded-xl gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30"
                    >
                      {isOpeningStripeDashboard
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <ExternalLink className="w-4 h-4" />}
                      Open Stripe Dashboard
                    </Button>
                  </>
                )}
                {/* Connected but incomplete: Continue Setup + Check status link */}
                {stripeStatus?.connected && !stripeStatus.stripeOnboardingComplete && (
                  <>
                    <Button
                      onClick={connectStripeAccount}
                      disabled={isConnectingStripe}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl gap-2"
                    >
                      {isConnectingStripe
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <ExternalLink className="w-4 h-4" />}
                      Continue Setup
                    </Button>
                    <button
                      onClick={fetchStripeStatus}
                      disabled={isCheckingStripeStatus}
                      className="text-xs font-bold text-primary underline underline-offset-2 disabled:opacity-50"
                    >
                      Check connection status
                    </button>
                  </>
                )}
              </div> : (
                <p className="text-xs font-bold text-muted-foreground">
                  Stripe onboarding and account-management links are available only to the Primary Owner.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-4 font-medium">
                Payments are routed directly to your bank account via Stripe. Chillow deducts a small platform fee per transaction based on your plan.
              </p>
            </div>
          </section>
        </div>
        )}
          {resourceErrors.billing ? (
            <BillingSectionError label="Payment method could not be loaded" onRetry={retryBillingData} />
          ) : resourceLoading.billing ? (
            <BillingCardSkeleton label="Loading payment method" metricCount={2} />
          ) : (
            <section className="bg-card rounded-[1.5rem] border border-border shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Payment Method
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium">Used for monthly commission invoices</p>
                </div>
              </div>

              {billingInfo?.billingStatus === 'past_due' && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-900 dark:text-red-400">Offline Payments Disabled</p>
                    <p className="text-xs text-red-700 dark:text-red-500 mt-1">Offline payments are disabled because your billing payment failed. Please update your payment method.</p>
                  </div>
                </div>
              )}

              {billingInfo?.billingStatus === 'incomplete' && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Offline Payments Disabled</p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">Offline payments are disabled until you add a billing payment method.</p>
                  </div>
                </div>
              )}

              {billingInfo?.billingStatus === 'active' && billingInfo?.paymentMethodLast4 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-8 bg-background border border-border rounded-md flex items-center justify-center shadow-sm">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground capitalize">
                          {billingInfo.paymentMethodBrand} **** {billingInfo.paymentMethodLast4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires {billingInfo.paymentMethodExpMonth}/{billingInfo.paymentMethodExpYear}
                        </p>
                      </div>
                    </div>
                  </div>
                  {isPrimaryOwner && <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowPaymentModal(true)}
                      className="flex-1 rounded-xl font-bold text-xs"
                    >
                      Update Card
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRemoveConfirm(true)}
                      disabled={isDeletingCard}
                      className="flex-1 rounded-xl font-bold text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900"
                    >
                      {isDeletingCard && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                      Remove Card
                    </Button>
                  </div>}
                </div>
              ) : (
                <div className="text-center py-6 px-4 bg-amber-50/50 dark:bg-amber-950/10 border border-dashed border-amber-200 dark:border-amber-900 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3 opacity-80" />
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-400 mb-1">Action Required</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mb-5 max-w-[250px] mx-auto">
                    Please add a payment method to activate your account for offline commission billing.
                  </p>
                  {isPrimaryOwner ? <Button
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full rounded-xl font-bold shadow-sm"
                  >
                    Add Card
                  </Button> : (
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                      Ask the Primary Owner to add or update the billing payment method.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {resourceErrors.payout ? (
            <BillingSectionError label="Payout summary could not be loaded" onRetry={retryBillingData} />
          ) : resourceLoading.payout ? (
            <BillingCardSkeleton label="Loading payout summary" />
          ) : (
            <section className="bg-card rounded-[1.5rem] border border-border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-secondary text-muted-foreground flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">Payout History</h2>
                  <p className="text-xs text-muted-foreground font-medium">Available balance, pending balance, next payout, and recent payouts</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Available Balance</p>
                  <p className="text-sm font-black text-foreground">{availableBalanceLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">Ready for Stripe payout</p>
                </div>
                <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pending Balance</p>
                  <p className="text-sm font-black text-foreground">{pendingBalanceLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">Card payments still settling</p>
                </div>
                <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Next Payout</p>
                  <p className="text-sm font-black text-foreground">{nextPayoutLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">{nextPayoutMeta}</p>
                </div>
                <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Recent Payouts</p>
                  <p className="text-sm font-black text-foreground">{recentPayoutLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">{recentPayoutMeta}</p>
                </div>
              </div>
            </section>
          )}
          </div>
        )}

        {activeTab === "performance" && (
          <div className="space-y-8">
            {hasPerformanceError ? (
              <BillingSectionError label="Revenue performance could not be loaded" onRetry={retryBillingData} />
            ) : isPerformanceLoading ? (
              <BillingCardSkeleton label="Loading revenue performance" metricCount={7} />
            ) : (
            <section className="bg-card rounded-[1.5rem] border border-border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Revenue Overview
                </h2>
                <p className="text-xs text-muted-foreground font-medium">All-time paid revenue processed through Chillow.</p>
                <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-2">Since joining Chillow</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Revenue Processed</p>
                  <p className="text-2xl font-black text-foreground">{formatCurrency(totalRevenueProcessed)}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">Online and offline paid orders.</p>
                </div>
                <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Net Revenue Processed</p>
                  <p className="text-2xl font-black text-primary">{formatCurrency(netRevenueProcessed)}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">Total revenue minus Chillow fees.</p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Online Revenue Processed</p>
                  <p className="text-2xl font-black text-foreground">{formatCurrency(onlineRevenueProcessed)}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">Paid online card orders.</p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Offline Revenue Processed</p>
                  <p className="text-2xl font-black text-foreground">{formatCurrency(offlineRevenueProcessed)}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">Paid cash and POS orders.</p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Orders Processed</p>
                  <p className="text-2xl font-black text-foreground">{totalOrdersProcessed.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">Paid online and offline orders.</p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-secondary/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Average Order Value</p>
                  <p className="text-2xl font-black text-foreground">{formatCurrency(averageOrderValue)}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">Total revenue divided by paid orders.</p>
                </div>
                <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20">
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Total Tips Collected</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(totalTipsCollected)}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">Tracked separately from gross and net revenue.</p>
                </div>
              </div>
            </section>
            )}
          </div>
        )}
      </div>

      {isPrimaryOwner && <>
      <AddPaymentMethodModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onSuccess={() => { fetchBillingData(); refreshSetupProgress(); }}
      />

      <ManagePlanModal
        open={showPlanDialog}
        onOpenChange={setShowPlanDialog}
        onSuccess={fetchBillingData}
        prefetchedPlans={plans}
        prefetchedCurrentPlan={billingInfo?.currentPlan}
        prefetchedScheduledDowngradePlan={billingInfo?.scheduledDowngradePlan}
      />

      {/* Remove Card Confirmation Modal */}
      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-lg font-black">
              Remove payment method?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm text-muted-foreground">
              Your <span className="font-bold text-foreground capitalize">{billingInfo?.paymentMethodBrand}</span> card ending in <span className="font-bold text-foreground">{billingInfo?.paymentMethodLast4}</span> will be permanently removed. You&apos;ll need to add a new card to continue billing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <AlertDialogCancel
              className="flex-1 rounded-xl font-bold"
              disabled={isDeletingCard}
            >
              Keep Card
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeletingCard}
              onClick={async (e) => {
                e.preventDefault()
                setIsDeletingCard(true)
                try {
                  await apiClient.delete("/owner/billing/payment-method")
                  toast.success("Payment method removed successfully.")
                  setShowRemoveConfirm(false)
                  fetchBillingData()
                } catch (err: any) {
                  toast.error(err.response?.data?.message || "Failed to remove card.")
                } finally {
                  setIsDeletingCard(false)
                }
              }}
            >
              {isDeletingCard && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Yes, Remove Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>}


    </div>
  )
}
