"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowDownWideNarrow,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ListOrdered,
  MapPin,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  OwnerOrderPaymentBadge,
  OwnerOrderStatusBadge,
  formatOrderType,
} from "@/components/orders/OwnerOrderBadges"
import { OwnerOrderDetailsSheet } from "@/components/orders/OwnerOrderDetailsSheet"
import { ErrorState } from "@/components/shared/ErrorState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useBusinessSettings } from "@/contexts/BusinessContext"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEventSource } from "@/hooks/use-event-source"
import apiClient from "@/lib/axios-config"
import { formatPrice, formatTime, pluralize } from "@/lib/localization"
import { MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { formatOrderReference, normalizeOrderSearch } from "@/lib/order-reference"
import { cn } from "@/lib/utils"
import type {
  OwnerOrder,
  OwnerOrderCounts,
  OwnerOrderPaymentStatus,
  OwnerOrdersFilterOptions,
  OwnerOrdersPagination,
  OwnerOrdersResponse,
  OwnerOrderStatus,
  OwnerOrderType,
} from "@/types/owner-orders"

type TimeRange = "today" | "yesterday" | "7days" | "thisMonth" | "custom"
type PageDirection = "next" | "previous"
type FetchResult = "success" | "failed" | "invalid-cursor" | "cancelled" | "skipped"

interface PageRequest {
  cursor: string | null
  direction: PageDirection
}

const FIRST_PAGE_REQUEST: PageRequest = { cursor: null, direction: "next" }
const EMPTY_COUNTS: OwnerOrderCounts = {
  placed: 0,
  in_progress: 0,
  ready: 0,
  completed: 0,
}
const EMPTY_PAGINATION: OwnerOrdersPagination = {
  limit: 25,
  nextCursor: null,
  previousCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
}
const EMPTY_FILTER_OPTIONS: OwnerOrdersFilterOptions = {
  orderTypes: [],
  paymentStatuses: [],
  servicePoints: [],
}
const RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 days" },
  { value: "thisMonth", label: "This month" },
  { value: "custom", label: "Custom" },
]
const STATUS_OPTIONS: Array<{ value: OwnerOrderStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "placed", label: "Placed" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
]

function getItemCount(order: OwnerOrder): number {
  return order.items.reduce((total, item) => total + item.quantity, 0)
}

function formatOrderListDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date(value))
}

function MetricCard({
  icon: Icon,
  iconClassName,
  value,
  label,
  detail,
}: {
  icon: typeof ListOrdered
  iconClassName: string
  value: string
  label: string
  detail: string
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconClassName)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none tracking-tight text-foreground">{value}</p>
        <h2 className="mt-1 text-sm font-bold text-foreground">{label}</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detail}</p>
      </div>
    </article>
  )
}

function OrdersLoadingState() {
  return (
    <div role="status" aria-label="Loading orders" className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="rounded-2xl border border-border bg-card p-4">
        <Skeleton className="mb-4 h-9 w-full rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const { user } = useAuthGuard()
  const { currency, timezone } = useBusinessSettings()

  const [orders, setOrders] = useState<OwnerOrder[]>([])
  const [counts, setCounts] = useState<OwnerOrderCounts>(EMPTY_COUNTS)
  const [totalOrderValue, setTotalOrderValue] = useState<number | null>(null)
  const [filterOptions, setFilterOptions] = useState<OwnerOrdersFilterOptions>(EMPTY_FILTER_OPTIONS)
  const [pagination, setPagination] = useState<OwnerOrdersPagination>(EMPTY_PAGINATION)
  const [isLoading, setIsLoading] = useState(true)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [range, setRange] = useState<TimeRange>("today")
  const [customRange, setCustomRange] = useState({ from: "", to: "" })
  const [tempCustomRange, setTempCustomRange] = useState({ from: "", to: "" })
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [statusFilter, setStatusFilter] = useState<OwnerOrderStatus | "all">("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState<OwnerOrderType | "all">("all")
  const [paymentFilter, setPaymentFilter] = useState<OwnerOrderPaymentStatus | "all">("all")
  const [servicePointFilter, setServicePointFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<OwnerOrder | null>(null)
  const [currentPageRequest, setCurrentPageRequest] = useState<PageRequest>(FIRST_PAGE_REQUEST)
  const [currentPageNumber, setCurrentPageNumber] = useState(1)
  const [newOrdersAvailable, setNewOrdersAvailable] = useState(false)

  const activeRequestRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const currentPageRequestRef = useRef<PageRequest>(FIRST_PAGE_REQUEST)
  const realtimeRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastOrderTriggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(normalizeOrderSearch(searchQuery))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const fetchOrders = useCallback(async (
    pageRequest: PageRequest = FIRST_PAGE_REQUEST,
    options: { silent?: boolean; preserveRows?: boolean } = {},
  ): Promise<FetchResult> => {
    const { silent = false, preserveRows = false } = options
    if (silent && activeRequestRef.current) return "skipped"

    activeRequestRef.current?.abort()
    const requestController = new AbortController()
    activeRequestRef.current = requestController
    const requestSequence = ++requestSequenceRef.current

    if (preserveRows) {
      setIsPageLoading(true)
    } else if (!silent) {
      setIsLoading(true)
      setError(null)
    }

    try {
      const params = new URLSearchParams({
        range,
        status: statusFilter,
        limit: "25",
      })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (orderTypeFilter !== "all") params.set("orderType", orderTypeFilter)
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter)
      if (servicePointFilter !== "all") params.set("servicePointId", servicePointFilter)
      if (range === "custom") {
        params.set("from", customRange.from)
        params.set("to", customRange.to)
      }
      if (pageRequest.cursor) {
        params.set("cursor", pageRequest.cursor)
        params.set("direction", pageRequest.direction)
      }

      const response = await apiClient.get<OwnerOrdersResponse>(
        `/owner/orders?${params.toString()}`,
        { signal: requestController.signal },
      )
      if (requestSequence !== requestSequenceRef.current) return "cancelled"

      const responseOrders = response.data.orders || []
      setOrders(responseOrders)
      setCounts(response.data.counts || EMPTY_COUNTS)
      setTotalOrderValue(
        typeof response.data.summary?.totalOrderValue === "number"
          ? response.data.summary.totalOrderValue
          : null,
      )
      setFilterOptions(response.data.filterOptions || {
        orderTypes: Array.from(new Set(responseOrders.map((order) => order.orderType))).sort(),
        paymentStatuses: Array.from(new Set(responseOrders.map((order) => order.paymentStatus))).sort(),
        servicePoints: Array.from(
          new Map(
            responseOrders.map((order) => [
              order.servicePointId || order.servicePointLabel,
              order.servicePointLabel,
            ]),
          ),
          ([id, label]) => ({ id, label }),
        ).sort((left, right) => left.label.localeCompare(right.label)),
      })
      setPagination(response.data.pagination || EMPTY_PAGINATION)
      currentPageRequestRef.current = pageRequest
      setCurrentPageRequest(pageRequest)
      if (!pageRequest.cursor) {
        setCurrentPageNumber(1)
        setNewOrdersAvailable(false)
      }
      setError(null)
      return "success"
    } catch (fetchError) {
      if (requestController.signal.aborted) return "cancelled"
      console.error("Failed to fetch orders:", fetchError)
      const statusCode = (fetchError as { response?: { status?: number } })?.response?.status
      if (statusCode === 400 && pageRequest.cursor) return "invalid-cursor"
      if (preserveRows || silent) {
        if (!silent) toast.error("Failed to load that orders page. Please try again.")
      } else {
        setError("Orders could not be loaded.")
      }
      return "failed"
    } finally {
      if (activeRequestRef.current === requestController) {
        activeRequestRef.current = null
        setIsLoading(false)
        setIsPageLoading(false)
      }
    }
  }, [customRange, debouncedSearch, orderTypeFilter, paymentFilter, range, servicePointFilter, statusFilter])

  useEffect(() => {
    if (!user) return
    if (range === "custom" && (!customRange.from || !customRange.to)) return
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current)
      realtimeRefreshTimerRef.current = null
    }
    void fetchOrders(FIRST_PAGE_REQUEST)
  }, [customRange, fetchOrders, range, user])

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current)
      activeRequestRef.current?.abort()
    }
  }, [])

  const triggerDebouncedRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current)
    realtimeRefreshTimerRef.current = setTimeout(() => {
      void fetchOrders(currentPageRequestRef.current, { silent: true, preserveRows: true })
    }, 1500)
  }, [fetchOrders])

  const sseUrl = user?.businessId
    ? `/events?role=owner&businessId=${user.businessId}&permission=${MANAGER_PERMISSIONS.ORDERS_VIEW}`
    : ""
  const sseHandlers = useMemo(() => ({
    order_created: () => {
      if (currentPageRequestRef.current.cursor) setNewOrdersAvailable(true)
      triggerDebouncedRefresh()
    },
    order_updated: triggerDebouncedRefresh,
  }), [triggerDebouncedRefresh])
  const { isConnected } = useEventSource(sseUrl, sseHandlers, {
    onReconnect: triggerDebouncedRefresh,
  })
  const [hasHadTimeToConnect, setHasHadTimeToConnect] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setHasHadTimeToConnect(true), 3000)
    return () => window.clearTimeout(timer)
  }, [])

  const totalOrders = Object.values(counts).reduce((total, count) => total + count, 0)
  const activeOrders = counts.placed + counts.in_progress + counts.ready
  const secondaryFilterCount = [
    orderTypeFilter !== "all",
    paymentFilter !== "all",
    servicePointFilter !== "all",
  ].filter(Boolean).length
  const hasScopedSearchOrFilters = Boolean(
    debouncedSearch || orderTypeFilter !== "all" || paymentFilter !== "all" || servicePointFilter !== "all",
  )
  const knownViewTotal = statusFilter === "all" ? totalOrders : counts[statusFilter]
  const pageStart = knownViewTotal > 0 ? (currentPageNumber - 1) * pagination.limit + 1 : 0
  const pageEnd = Math.min(pageStart + orders.length - 1, knownViewTotal)
  const hasAnyFilters = Boolean(searchQuery || statusFilter !== "all" || secondaryFilterCount)

  const handleApplyCustomRange = () => {
    if (!tempCustomRange.from || !tempCustomRange.to || tempCustomRange.from > tempCustomRange.to) return
    setCustomRange(tempCustomRange)
    setRange("custom")
    setShowCustomPicker(false)
  }

  const handlePageNavigation = async (direction: PageDirection) => {
    const cursor = direction === "next" ? pagination.nextCursor : pagination.previousCursor
    if (!cursor || isPageLoading) return
    const result = await fetchOrders({ cursor, direction }, { preserveRows: true })
    if (result === "success") {
      setCurrentPageNumber((page) => direction === "next" ? page + 1 : Math.max(1, page - 1))
    } else if (result === "invalid-cursor") {
      toast.error("This orders page expired. Returning to the latest orders.")
      await fetchOrders(FIRST_PAGE_REQUEST, { preserveRows: true })
    }
  }

  const handleRefresh = async () => {
    const result = await fetchOrders(currentPageRequest, { preserveRows: true })
    if (result === "invalid-cursor") {
      toast.error("This orders page expired. Returning to the latest orders.")
      await fetchOrders(FIRST_PAGE_REQUEST, { preserveRows: true })
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setDebouncedSearch("")
    setStatusFilter("all")
    setOrderTypeFilter("all")
    setPaymentFilter("all")
    setServicePointFilter("all")
  }

  const openOrder = (order: OwnerOrder, trigger: HTMLElement) => {
    lastOrderTriggerRef.current = trigger
    setSelectedOrder(order)
  }

  const handleDetailsOpenChange = (open: boolean) => {
    if (open) return
    setSelectedOrder(null)
    window.setTimeout(() => lastOrderTriggerRef.current?.focus(), 0)
  }

  return (
    <div className="min-h-full pb-16">
      <header className="border-b border-border bg-background/95 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">Orders</h1>
              {!isConnected && hasHadTimeToConnect && user?.businessId ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  Updates paused
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Track and review orders across your business.
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 xl:flex-none">
              {RANGE_OPTIONS.map((option) => {
                if (option.value === "custom") {
                  const customRangeIsValid = Boolean(
                    tempCustomRange.from &&
                    tempCustomRange.to &&
                    tempCustomRange.from <= tempCustomRange.to,
                  )
                  return (
                    <Popover key={option.value} open={showCustomPicker} onOpenChange={setShowCustomPicker}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 shrink-0 gap-1.5 px-3 text-xs font-semibold",
                            range === option.value && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                          )}
                          aria-label="Choose a custom order date range"
                        >
                          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                          Custom
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 space-y-4 p-4">
                        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                          <h2 className="text-sm font-bold">Select custom range</h2>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setShowCustomPicker(false)}
                            aria-label="Close custom date range"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label htmlFor="orders-date-from" className="text-xs font-semibold text-muted-foreground">From</label>
                            <input
                              id="orders-date-from"
                              type="date"
                              value={tempCustomRange.from}
                              onChange={(event) => setTempCustomRange((current) => ({ ...current, from: event.target.value }))}
                              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label htmlFor="orders-date-to" className="text-xs font-semibold text-muted-foreground">To</label>
                            <input
                              id="orders-date-to"
                              type="date"
                              value={tempCustomRange.to}
                              onChange={(event) => setTempCustomRange((current) => ({ ...current, to: event.target.value }))}
                              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                        </div>
                        {tempCustomRange.from && tempCustomRange.to && tempCustomRange.from > tempCustomRange.to ? (
                          <p className="text-xs font-medium text-destructive" role="alert">The end date must be on or after the start date.</p>
                        ) : null}
                        <Button type="button" className="w-full" disabled={!customRangeIsValid} onClick={handleApplyCustomRange}>
                          Apply range
                        </Button>
                      </PopoverContent>
                    </Popover>
                  )
                }

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 shrink-0 px-3 text-xs font-semibold",
                      range === option.value && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                    onClick={() => setRange(option.value)}
                    aria-pressed={range === option.value}
                  >
                    {option.label}
                  </Button>
                )
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => void handleRefresh()}
              disabled={isLoading || isPageLoading}
              aria-label="Refresh orders"
            >
              <RefreshCw className={cn("h-4 w-4", (isLoading || isPageLoading) && "animate-spin")} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main className="space-y-5 p-4 sm:p-6">
        {error && !isLoading ? (
          <ErrorState
            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-8"
            title={error}
            description="Check your connection and try again."
            action={
              <Button type="button" variant="outline" className="mt-4" onClick={() => void fetchOrders(FIRST_PAGE_REQUEST)}>
                Retry
              </Button>
            }
          />
        ) : isLoading ? (
          <OrdersLoadingState />
        ) : (
          <>
            <section aria-label="Order summary" className={cn("grid grid-cols-2 gap-3", totalOrderValue !== null ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
              <MetricCard icon={ListOrdered} iconClassName="bg-blue-50 text-blue-600" value={String(totalOrders)} label="Total Orders" detail="All orders in this period" />
              <MetricCard icon={Clock3} iconClassName="bg-amber-50 text-amber-600" value={String(activeOrders)} label="Active Orders" detail="Placed, In Progress, Ready" />
              <MetricCard icon={CheckCircle2} iconClassName="bg-emerald-50 text-emerald-600" value={String(counts.completed)} label="Completed Orders" detail="Finished in this period" />
              {totalOrderValue !== null ? (
                <MetricCard icon={CircleDollarSign} iconClassName="bg-rose-50 text-rose-600" value={formatPrice(totalOrderValue, currency)} label="Total Order Value" detail="Authoritative order totals in this period" />
              ) : null}
            </section>

            <section aria-labelledby="orders-list-title" className="space-y-3">
              <h2 id="orders-list-title" className="sr-only">Orders list</h2>
              <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary/50 p-1" aria-label="Filter orders by lifecycle status">
                {STATUS_OPTIONS.map((option) => {
                  const count = option.value === "all" ? totalOrders : counts[option.value]
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        statusFilter === option.value
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:bg-card hover:text-foreground",
                      )}
                      aria-pressed={statusFilter === option.value}
                    >
                      {option.label}
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", statusFilter === option.value ? "bg-background/20" : "bg-background")}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {newOrdersAvailable && currentPageRequest.cursor ? (
                <button
                  type="button"
                  onClick={() => void fetchOrders(FIRST_PAGE_REQUEST, { preserveRows: true })}
                  disabled={isPageLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15 disabled:opacity-60"
                >
                  New orders available · Jump to latest
                </button>
              ) : null}

              <div className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by order ID or service point…"
                        aria-label="Search by order ID or service point"
                        className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm shadow-none focus-visible:ring-2 dark:bg-background"
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label="Clear order search"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-between gap-2 sm:hidden"
                      onClick={() => setMobileFiltersOpen((open) => !open)}
                      aria-expanded={mobileFiltersOpen}
                      aria-controls="orders-secondary-filters"
                    >
                      <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters</span>
                      {secondaryFilterCount > 0 ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{secondaryFilterCount}</span> : null}
                    </Button>
                  </div>

                  <div
                    id="orders-secondary-filters"
                    className={cn(
                      "mt-2 grid-cols-1 gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]",
                      mobileFiltersOpen ? "grid" : "hidden",
                    )}
                  >
                    {filterOptions.orderTypes.length > 0 ? (
                      <Select value={orderTypeFilter} onValueChange={(value) => setOrderTypeFilter(value as OwnerOrderType | "all")}>
                        <SelectTrigger aria-label="Filter by order type"><SelectValue placeholder="All types" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          {filterOptions.orderTypes.map((value) => <SelectItem key={value} value={value}>{formatOrderType(value)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {filterOptions.paymentStatuses.length > 0 ? (
                      <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as OwnerOrderPaymentStatus | "all")}>
                        <SelectTrigger aria-label="Filter by payment status"><SelectValue placeholder="All payments" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All payments</SelectItem>
                          {filterOptions.paymentStatuses.map((value) => <SelectItem key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {filterOptions.servicePoints.length > 0 ? (
                      <Select value={servicePointFilter} onValueChange={setServicePointFilter}>
                        <SelectTrigger aria-label="Filter by service point"><SelectValue placeholder="All service points" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All service points</SelectItem>
                          {filterOptions.servicePoints.map((servicePoint) => <SelectItem key={servicePoint.id} value={servicePoint.id}>{servicePoint.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : null}
                    <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground" aria-label="Orders sorted by most recent">
                      <span className="inline-flex items-center gap-1.5"><ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden="true" /> Most recent</span>
                      {hasAnyFilters ? (
                        <button type="button" onClick={clearFilters} className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear</button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={cn("relative", isPageLoading && "pointer-events-none opacity-60")} aria-busy={isPageLoading}>
                  {orders.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <ShoppingBag className="mx-auto h-9 w-9 text-muted-foreground/50" aria-hidden="true" />
                      <h2 className="mt-3 font-bold text-foreground">
                        {totalOrders === 0 && !hasAnyFilters ? "No orders in this period." : "No orders match these filters."}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {totalOrders === 0 && !hasAnyFilters ? "Orders placed during this date range will appear here." : "Try adjusting your search or filters."}
                      </p>
                      {totalOrders > 0 || hasAnyFilters ? <Button type="button" variant="outline" className="mt-4" onClick={clearFilters}>Clear filters</Button> : null}
                    </div>
                  ) : (
                    <>
                      <div className="hidden lg:block">
                        <table className="w-full table-fixed text-left text-sm">
                          <caption className="sr-only">Orders in the selected period</caption>
                          <thead className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th scope="col" className="w-[19%] px-4 py-3">Order</th>
                              <th scope="col" className="w-[16%] px-3 py-3">Service Point</th>
                              <th scope="col" className="w-[13%] px-3 py-3">Type</th>
                              <th scope="col" className="w-[10%] px-3 py-3">Items</th>
                              <th scope="col" className="w-[13%] px-3 py-3">Total</th>
                              <th scope="col" className="w-[13%] px-3 py-3">Payment</th>
                              <th scope="col" className="w-[16%] px-3 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/70">
                            {orders.map((order) => {
                              const itemCount = getItemCount(order)
                              return (
                                <tr
                                  key={order.orderId}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => openOrder(order, event.currentTarget)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault()
                                      openOrder(order, event.currentTarget)
                                    }
                                  }}
                                  className="cursor-pointer outline-none transition-colors hover:bg-secondary/30 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                                  aria-label={`View details for order ${formatOrderReference(order.orderId)}`}
                                >
                                  <td className="px-4 py-3">
                                    <p className="font-black text-foreground">{formatOrderReference(order.orderId)}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground" suppressHydrationWarning>
                                      {formatOrderListDate(order.createdAt, timezone)} · {formatTime(order.createdAt, timezone)}
                                    </p>
                                  </td>
                                  <td className="px-3 py-3"><span className="block truncate font-medium" title={order.servicePointLabel}>{order.servicePointLabel}</span></td>
                                  <td className="px-3 py-3 text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                      {order.orderType === "dine-in" ? (
                                        <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                      ) : (
                                        <ShoppingBag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                      )}
                                      {formatOrderType(order.orderType)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-muted-foreground">{itemCount} {pluralize(itemCount, "item")}</td>
                                  <td className="px-3 py-3 font-bold text-foreground">{formatPrice(order.total, order.currency || currency)}</td>
                                  <td className="px-3 py-3"><OwnerOrderPaymentBadge status={order.paymentStatus} /></td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center justify-between gap-2"><OwnerOrderStatusBadge status={order.status} /><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="divide-y divide-border/70 lg:hidden">
                        {orders.map((order) => {
                          const itemCount = getItemCount(order)
                          return (
                            <button
                              key={order.orderId}
                              type="button"
                              onClick={(event) => openOrder(order, event.currentTarget)}
                              className="block w-full p-4 text-left outline-none transition-colors hover:bg-secondary/30 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                              aria-label={`View details for order ${formatOrderReference(order.orderId)}`}
                            >
                              <span className="flex items-start justify-between gap-3">
                                <span>
                                  <span className="block font-black text-foreground">{formatOrderReference(order.orderId)}</span>
                                  <span className="mt-0.5 block text-xs text-muted-foreground" suppressHydrationWarning>{formatOrderListDate(order.createdAt, timezone)} · {formatTime(order.createdAt, timezone)}</span>
                                </span>
                                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              </span>
                              <span className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="truncate">{order.servicePointLabel}</span>
                                <span aria-hidden="true">·</span>
                                <span>{formatOrderType(order.orderType)}</span>
                              </span>
                              <span className="mt-2 flex items-end justify-between gap-3">
                                <span>
                                  <span className="block text-xs text-muted-foreground">{itemCount} {pluralize(itemCount, "item")}</span>
                                  <span className="mt-0.5 block font-black text-foreground">{formatPrice(order.total, order.currency || currency)}</span>
                                </span>
                                <span className="flex flex-wrap justify-end gap-1.5"><OwnerOrderPaymentBadge status={order.paymentStatus} /><OwnerOrderStatusBadge status={order.status} /></span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-border bg-secondary/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
                    {isPageLoading
                      ? "Loading orders page…"
                      : hasScopedSearchOrFilters
                        ? `Showing ${orders.length} matching ${pluralize(orders.length, "order")} on page ${currentPageNumber}`
                        : `Showing ${pageStart}–${pageEnd} of ${knownViewTotal} ${pluralize(knownViewTotal, "order")}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void handlePageNavigation("previous")} disabled={!pagination.hasPreviousPage || !pagination.previousCursor || isPageLoading}>
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void handlePageNavigation("next")} disabled={!pagination.hasNextPage || !pagination.nextCursor || isPageLoading}>
                      Next <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <OwnerOrderDetailsSheet
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={handleDetailsOpenChange}
        currency={currency}
        timezone={timezone}
      />
    </div>
  )
}
