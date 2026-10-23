"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  HeartHandshake,
  Info,
  MapPin,
  MessageSquare,
  MessageSquareHeart,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingBag,
  Star,
  TrendingUp,
  Utensils,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorState } from "@/components/shared/ErrorState"
import { PageHeader } from "@/components/shared/PageHeader"
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
import { apiClient } from "@/lib/axios-config"
import { formatPrice, pluralize } from "@/lib/localization"
import { cn } from "@/lib/utils"

type FeedbackRange =
  | "today"
  | "yesterday"
  | "7days"
  | "thisMonth"
  | "custom"

type FeedbackClassification = "all" | "needs_attention"
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1"
type FeedbackSort =
  | "most_recent"
  | "oldest"
  | "highest_rating"
  | "lowest_rating"

type FeedbackReview = {
  _id: string
  orderId: string
  overallRating: number
  tags?: string[]
  comment?: string
  orderType?: string
  servicePointId?: string | null
  servicePointLabel?: string | null
  orderValue?: number
  createdAt: string
}

type FeedbackAnalytics = {
  overview: {
    totalFeedbacks: number
    averageRating: number
    responseRate: number
    csatScore: number
    totalCompletedOrders: number
  }
  ratingDistribution: Record<number, number>
  recentReviews: FeedbackReview[]
}

type MetricCardProps = {
  label: string
  detail: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  tone: "blue" | "green" | "amber" | "violet"
}

const QUICK_RANGES: { value: Exclude<FeedbackRange, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 days" },
  { value: "thisMonth", label: "This month" },
]

const METRIC_TONES = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const

const DISTRIBUTION_TONES: Record<number, string> = {
  5: "bg-emerald-500",
  4: "bg-emerald-500",
  3: "bg-amber-400",
  2: "bg-red-500",
  1: "bg-red-500",
}

const EMPTY_REVIEWS: FeedbackReview[] = []

function MetricCard({ label, detail, value, icon: Icon, tone }: MetricCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            METRIC_TONES[tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black leading-none text-foreground">
            {value}
          </p>
          <h2 className="mt-1.5 text-xs font-bold text-foreground">{label}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
    </section>
  )
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={rating + " out of 5 stars"}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "size-4",
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted",
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function formatServiceType(value?: string) {
  if (!value) return "Service type not recorded"
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatFeedbackDate(value: string, timezone: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date unavailable"

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(date)
}

function FeedbackCard({
  review,
  currency,
  timezone,
  highlighted = false,
}: {
  review: FeedbackReview
  currency: string
  timezone: string
  highlighted?: boolean
}) {
  const servicePoint =
    review.servicePointLabel || review.servicePointId || null
  const needsAttention = review.overallRating < 3

  return (
    <article
      id={`feedback-${encodeURIComponent(review._id)}`}
      data-feedback-id={review._id}
      tabIndex={-1}
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/20 focus:outline-none",
        highlighted && "border-primary ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <RatingStars rating={review.overallRating} />
          {needsAttention ? (
            <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-300">
              Needs Attention
            </span>
          ) : null}
        </div>
        <time
          className="shrink-0 text-xs font-medium text-muted-foreground"
          dateTime={review.createdAt}
        >
          {formatFeedbackDate(review.createdAt, timezone)}
        </time>
      </div>

      {review.comment?.trim() ? (
        <p className="mt-3 text-sm font-medium leading-6 text-foreground">
          “{review.comment.trim()}”
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No written feedback
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        {review.orderType ? (
          <span className="inline-flex items-center gap-1.5">
            {review.orderType === "takeout" ? (
              <ShoppingBag className="size-3.5" aria-hidden="true" />
            ) : (
              <Utensils className="size-3.5" aria-hidden="true" />
            )}
            {formatServiceType(review.orderType)}
          </span>
        ) : null}
        {servicePoint ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-48 truncate">{servicePoint}</span>
          </span>
        ) : null}
        {review.orderId ? (
          <span
            className="inline-flex min-w-0 items-center gap-1.5"
            title={"Order " + review.orderId}
          >
            <ReceiptText className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-52 truncate">Order {review.orderId}</span>
          </span>
        ) : null}
        {typeof review.orderValue === "number" && review.orderValue > 0 ? (
          <span className="font-semibold text-foreground">
            {formatPrice(review.orderValue, currency)}
          </span>
        ) : null}
      </div>
    </article>
  )
}

function FeedbackLoadingState() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading customer feedback">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-10 w-full" />
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading customer feedback</span>
    </div>
  )
}

export default function CustomerFeedbackDashboard() {
  const { currency, timezone } = useBusinessSettings()
  const workspaceRef = useRef<HTMLElement>(null)

  const [data, setData] = useState<FeedbackAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<FeedbackRange>("thisMonth")

  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [tempFrom, setTempFrom] = useState("")
  const [tempTo, setTempTo] = useState("")
  const [customError, setCustomError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [classification, setClassification] =
    useState<FeedbackClassification>("all")
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all")
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all")
  const [servicePointFilter, setServicePointFilter] = useState("all")
  const [sort, setSort] = useState<FeedbackSort>("most_recent")
  const [linkedFeedbackId, setLinkedFeedbackId] = useState<string | null>(null)

  useEffect(() => {
    setLinkedFeedbackId(new URLSearchParams(window.location.search).get("feedbackId"))
  }, [])

  const fetchData = useCallback(
    async (selectedRange: FeedbackRange, from?: string, to?: string) => {
      setLoading(true)
      setError(null)
      setData(null)

      try {
        const params = new URLSearchParams({ range: selectedRange })
        if (selectedRange === "custom" && from && to) {
          params.set("from", from)
          params.set("to", to)
        }
        const response = await apiClient.get<FeedbackAnalytics>(
          "/owner/feedback?" + params.toString(),
        )
        setData(response.data)
      } catch (requestError) {
        console.error("Failed to load feedback analytics", requestError)
        setError(
          "Customer feedback could not be loaded. Check your connection and try again.",
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (range !== "custom") void fetchData(range)
  }, [fetchData, range])

  const handleApplyCustom = () => {
    if (!tempFrom || !tempTo) return
    if (tempFrom > tempTo) {
      setCustomError("The start date must be on or before the end date.")
      return
    }

    setCustomError(null)
    setCustomFrom(tempFrom)
    setCustomTo(tempTo)
    setRange("custom")
    setShowCustomPicker(false)
    void fetchData("custom", tempFrom, tempTo)
  }

  const handleRefresh = () => {
    void fetchData(
      range,
      range === "custom" ? customFrom : undefined,
      range === "custom" ? customTo : undefined,
    )
  }

  const recentReviews = data?.recentReviews || EMPTY_REVIEWS
  const totalReviews = data?.overview.totalFeedbacks || 0
  const completedOrders = data?.overview.totalCompletedOrders || 0
  const needsAttentionCount =
    (data?.ratingDistribution?.[1] || 0) +
    (data?.ratingDistribution?.[2] || 0)
  const needsAttentionPercent =
    totalReviews > 0
      ? Math.round((needsAttentionCount / totalReviews) * 100)
      : 0

  const serviceTypes = useMemo(
    () =>
      Array.from(
        new Set(
          recentReviews
            .map((review) => review.orderType)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [recentReviews],
  )

  const servicePoints = useMemo(
    () =>
      Array.from(
        new Set(
          recentReviews
            .map(
              (review) =>
                review.servicePointLabel || review.servicePointId || null,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [recentReviews],
  )

  const filteredReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const reviews = recentReviews.filter((review) => {
      const servicePoint =
        review.servicePointLabel || review.servicePointId || ""
      const matchesSearch =
        !query ||
        review.comment?.toLowerCase().includes(query) ||
        review.orderId?.toLowerCase().includes(query) ||
        servicePoint.toLowerCase().includes(query)
      const matchesClassification =
        classification === "all" || review.overallRating < 3
      const matchesRating =
        ratingFilter === "all" ||
        review.overallRating === Number(ratingFilter)
      const matchesServiceType =
        serviceTypeFilter === "all" ||
        review.orderType === serviceTypeFilter
      const matchesServicePoint =
        servicePointFilter === "all" ||
        servicePoint === servicePointFilter

      return (
        matchesSearch &&
        matchesClassification &&
        matchesRating &&
        matchesServiceType &&
        matchesServicePoint
      )
    })

    return [...reviews].sort((left, right) => {
      if (sort === "oldest") {
        return (
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
        )
      }
      if (sort === "highest_rating") {
        return (
          right.overallRating - left.overallRating ||
          new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
        )
      }
      if (sort === "lowest_rating") {
        return (
          left.overallRating - right.overallRating ||
          new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
        )
      }
      return (
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime()
      )
    })
  }, [
    classification,
    ratingFilter,
    recentReviews,
    searchQuery,
    servicePointFilter,
    serviceTypeFilter,
    sort,
  ])

  useEffect(() => {
    if (!linkedFeedbackId || loading) return
    const target = document.getElementById(`feedback-${encodeURIComponent(linkedFeedbackId)}`)
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    target.focus({ preventScroll: true })
  }, [filteredReviews, linkedFeedbackId, loading])

  const filtersAreDefault =
    !searchQuery.trim() &&
    classification === "all" &&
    ratingFilter === "all" &&
    serviceTypeFilter === "all" &&
    servicePointFilter === "all" &&
    sort === "most_recent"

  const clearFilters = () => {
    setSearchQuery("")
    setClassification("all")
    setRatingFilter("all")
    setServiceTypeFilter("all")
    setServicePointFilter("all")
    setSort("most_recent")
  }

  const showNeedsAttention = () => {
    setClassification("needs_attention")
    setRatingFilter("all")
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    workspaceRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    })
  }

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <PageHeader
          className="mx-auto flex max-w-[1600px] flex-col items-start justify-between gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center"
          title="Customer Feedback"
          description="Understand guest satisfaction and what guests are telling you."
          action={
            <div className="flex w-full min-w-0 items-center gap-2 lg:w-auto">
            <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border bg-card p-1 lg:flex-none">
              <div className="flex min-w-max items-center">
                {QUICK_RANGES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={loading}
                    aria-pressed={range === option.value}
                    className={cn(
                      "min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                      range === option.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => {
                      setRange(option.value)
                      setShowCustomPicker(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}

                <Popover
                  open={showCustomPicker}
                  onOpenChange={(open) => {
                    setShowCustomPicker(open)
                    if (!open) setCustomError(null)
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={loading}
                      aria-pressed={range === "custom"}
                      className={cn(
                        "flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                        range === "custom"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Calendar className="size-3.5" aria-hidden="true" />
                      {range === "custom" && customFrom
                        ? customFrom + " – " + customTo
                        : "Custom"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(18rem,calc(100vw-2rem))] space-y-4 rounded-xl p-4"
                    align="end"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <h2 className="text-sm font-bold">Select custom range</h2>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowCustomPicker(false)}
                        aria-label="Close custom date range"
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="feedback-custom-from"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        From
                      </label>
                      <Input
                        id="feedback-custom-from"
                        type="date"
                        value={tempFrom}
                        max={tempTo || undefined}
                        onChange={(event) => {
                          setTempFrom(event.target.value)
                          setCustomError(null)
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="feedback-custom-to"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        To
                      </label>
                      <Input
                        id="feedback-custom-to"
                        type="date"
                        value={tempTo}
                        min={tempFrom || undefined}
                        onChange={(event) => {
                          setTempTo(event.target.value)
                          setCustomError(null)
                        }}
                      />
                    </div>
                    {customError ? (
                      <p className="text-xs text-destructive" role="alert">
                        {customError}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!tempFrom || !tempTo}
                      onClick={handleApplyCustom}
                    >
                      Apply range
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={loading}
              onClick={handleRefresh}
              aria-label="Refresh feedback"
            >
              <RefreshCcw
                className={loading ? "animate-spin" : ""}
                aria-hidden="true"
              />
            </Button>
            </div>
          }
        />
      </header>

      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
        {loading ? (
          <FeedbackLoadingState />
        ) : error ? (
          <ErrorState
            className="min-h-80 rounded-xl border border-border bg-card px-6 py-12 shadow-sm"
            icon={
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
              </div>
            }
            title="Customer feedback could not be loaded"
            description={error}
            action={
              <Button className="mt-5" onClick={handleRefresh}>
                <RefreshCcw aria-hidden="true" />
                Retry
              </Button>
            }
          />
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard
                label="Total Reviews"
                detail="Feedback received"
                value={totalReviews}
                icon={MessageSquare}
                tone="blue"
              />
              <MetricCard
                label="CSAT Score"
                detail={
                  totalReviews > 0 ? "4 & 5 star ratings" : "No feedback yet"
                }
                value={totalReviews > 0 ? data.overview.csatScore + "%" : "—"}
                icon={HeartHandshake}
                tone="green"
              />
              <MetricCard
                label="Average Rating"
                detail={totalReviews > 0 ? "out of 5" : "No feedback yet"}
                value={
                  totalReviews > 0
                    ? data.overview.averageRating.toFixed(1)
                    : "—"
                }
                icon={Star}
                tone="amber"
              />
              <MetricCard
                label="Response Rate"
                detail={
                  completedOrders > 0
                    ? totalReviews +
                      " of " +
                      completedOrders +
                      " completed orders"
                    : "No completed orders"
                }
                value={
                  completedOrders > 0
                    ? data.overview.responseRate + "%"
                    : "—"
                }
                icon={TrendingUp}
                tone="violet"
              />
            </div>

            {needsAttentionCount > 0 ? (
              <section className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-950">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-300">
                    <Star className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-red-700 dark:text-red-300">
                      Needs Attention
                    </h2>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-xl font-black text-foreground">
                        {needsAttentionCount}{" "}
                        {pluralize(needsAttentionCount, "review")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        1–2 star feedback in this period ({needsAttentionPercent}%
                        of all reviews)
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="self-start text-red-700 hover:bg-red-500/10 hover:text-red-800 sm:self-auto dark:text-red-300"
                  onClick={showNeedsAttention}
                >
                  View low-rated feedback
                  <ArrowRight aria-hidden="true" />
                </Button>
              </section>
            ) : null}

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <section
                ref={workspaceRef}
                className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm scroll-mt-24"
                aria-labelledby="all-feedback-title"
              >
                <div className="border-b border-border p-4 sm:p-5">
                  <h2
                    id="all-feedback-title"
                    className="text-xl font-black text-foreground"
                  >
                    All Feedback{" "}
                    <span className="text-muted-foreground">
                      ({totalReviews})
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Latest feedback from your guests, across all service points.
                  </p>
                </div>

                <div className="space-y-3 border-b border-border p-4">
                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-[minmax(15rem,1fr)_10rem_9rem_10rem_11rem]">
                    <div className="relative sm:col-span-2 2xl:col-span-1">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search comments, orders, or service points..."
                        aria-label="Search feedback comments, order references, or service points"
                        className="pl-9"
                      />
                    </div>

                    <Select
                      value={classification}
                      onValueChange={(value: FeedbackClassification) =>
                        setClassification(value)
                      }
                    >
                      <SelectTrigger aria-label="Filter by feedback classification">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All feedback</SelectItem>
                        <SelectItem value="needs_attention">
                          Needs Attention
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={ratingFilter}
                      onValueChange={(value: RatingFilter) =>
                        setRatingFilter(value)
                      }
                    >
                      <SelectTrigger aria-label="Filter by rating">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All ratings</SelectItem>
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <SelectItem key={rating} value={String(rating)}>
                            {rating} {pluralize(rating, "star")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {serviceTypes.length > 0 ? (
                      <Select
                        value={serviceTypeFilter}
                        onValueChange={setServiceTypeFilter}
                      >
                        <SelectTrigger aria-label="Filter by service type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All service types</SelectItem>
                          {serviceTypes.map((serviceType) => (
                            <SelectItem key={serviceType} value={serviceType}>
                              {formatServiceType(serviceType)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}

                    {servicePoints.length > 0 ? (
                      <Select
                        value={servicePointFilter}
                        onValueChange={setServicePointFilter}
                      >
                        <SelectTrigger aria-label="Filter by service point">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All service points</SelectItem>
                          {servicePoints.map((servicePoint) => (
                            <SelectItem key={servicePoint} value={servicePoint}>
                              {servicePoint}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {filtersAreDefault
                        ? "Showing the latest " +
                          recentReviews.length +
                          " of " +
                          totalReviews +
                          " feedback submissions"
                        : filteredReviews.length +
                          " matches in the latest " +
                          recentReviews.length +
                          " feedback submissions"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={filtersAreDefault}
                        onClick={clearFilters}
                      >
                        <X aria-hidden="true" />
                        Clear filters
                      </Button>
                      <Select
                        value={sort}
                        onValueChange={(value: FeedbackSort) => setSort(value)}
                      >
                        <SelectTrigger
                          className="w-40"
                          aria-label="Sort feedback"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="most_recent">
                            Most recent
                          </SelectItem>
                          <SelectItem value="oldest">Oldest</SelectItem>
                          <SelectItem value="highest_rating">
                            Highest rating
                          </SelectItem>
                          <SelectItem value="lowest_rating">
                            Lowest rating
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4" aria-live="polite">
                  {filteredReviews.length > 0 ? (
                    filteredReviews.map((review) => (
                      <FeedbackCard
                        key={review._id}
                        review={review}
                        currency={currency}
                        timezone={timezone}
                        highlighted={review._id === linkedFeedbackId}
                      />
                    ))
                  ) : (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                      <MessageSquare
                        className="size-8 text-muted-foreground/60"
                        aria-hidden="true"
                      />
                      <h3 className="mt-3 font-bold text-foreground">
                        {filtersAreDefault
                          ? "No feedback received in this period."
                          : "No feedback matches these filters."}
                      </h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {filtersAreDefault
                          ? "Guest feedback will appear here when it is submitted."
                          : "Try changing or clearing the current filters."}
                      </p>
                      {!filtersAreDefault ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-4"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>

              <aside className="space-y-4" aria-label="Feedback supporting information">
                <section
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  aria-labelledby="rating-distribution-title"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="rating-distribution-title" className="font-bold">
                      Rating Distribution
                    </h2>
                    <Info
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  {totalReviews > 0 ? (
                    <div className="mt-4 space-y-2">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = data.ratingDistribution?.[rating] || 0
                        const percent = Math.round(
                          (count / totalReviews) * 100,
                        )
                        const active = ratingFilter === String(rating)

                        return (
                          <button
                            key={rating}
                            type="button"
                            aria-label={
                              "Filter to " +
                              rating +
                              " " +
                              pluralize(rating, "star") +
                              ": " +
                              count +
                              " " +
                              pluralize(count, "review")
                            }
                            aria-pressed={active}
                            className={cn(
                              "flex min-h-9 w-full items-center gap-2 rounded-lg px-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active ? "bg-muted" : "hover:bg-muted/60",
                            )}
                            onClick={() => {
                              setClassification("all")
                              setRatingFilter(
                                active
                                  ? "all"
                                  : (String(rating) as RatingFilter),
                              )
                            }}
                          >
                            <span className="flex w-8 shrink-0 items-center gap-1 text-xs font-bold">
                              {rating}
                              <Star
                                className="size-3 fill-amber-400 text-amber-400"
                                aria-hidden="true"
                              />
                            </span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <span
                                className={cn(
                                  "block h-full rounded-full",
                                  DISTRIBUTION_TONES[rating],
                                )}
                                style={{ width: percent + "%" }}
                                aria-hidden="true"
                              />
                            </span>
                            <span className="w-7 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                      No ratings in this period.
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-indigo-200 bg-indigo-500/5 p-4 shadow-sm dark:border-indigo-950">
                  <div className="flex items-center gap-2">
                    <MessageSquareHeart
                      className="size-4 text-indigo-600 dark:text-indigo-300"
                      aria-hidden="true"
                    />
                    <h2 className="text-sm font-bold">Feedback Insights</h2>
                    <span className="ml-auto rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                      Premium
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Understand common themes and trends in your guest feedback.
                    Automated theme analysis is not enabled.
                  </p>
                </section>

                <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <Info
                      className="mt-0.5 size-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                    <div>
                      <h2 className="text-sm font-bold">About this data</h2>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Response rate is calculated as feedback received divided
                        by completed orders in the selected period.
                      </p>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
