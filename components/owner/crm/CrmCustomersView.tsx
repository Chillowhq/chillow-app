"use client"

import { useState, useEffect } from "react"
import {
  Users,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import apiClient from "@/lib/axios-config"
import { useAuthContext } from "@/contexts/AuthContext"
import { useBusinessSettings } from "@/contexts/BusinessContext"
import { formatPrice, formatDateTime } from "@/lib/localization"
import { GuestDetailModal } from "./GuestDetailModal"

export type GuestProfile = {
  _id: string
  guestStatus: "lead" | "customer"
  email: string
  name?: string
  phone?: string
  visitCount: number
  orderCount: number
  paidOrderCount: number
  totalSpendCents: number
  totalTipsCents?: number
  totalTipsCollectedCents?: number
  averageTipCents?: number
  highestTipCents?: number
  ordersWithTips?: number
  tipRate?: number
  averageSpendCents: number
  averageOrderSpendCents: number
  firstVisitAt: string
  lastVisitAt: string
  favouriteItems: { itemName: string, quantity: number }[]
  loyaltyPoints: number
  loyaltyStatus: string
  marketingConsent: boolean
}

type CrmCustomersViewProps = {
  requestedGuestId?: string | null
  onRequestedGuestHandled?: () => void
}

export function CrmCustomersView({
  requestedGuestId,
  onRequestedGuestHandled,
}: CrmCustomersViewProps) {
  const { user } = useAuthContext()
  const [guests, setGuests] = useState<GuestProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterBy, setFilterBy] = useState<string>("customers")
  const [dateRange, setDateRange] = useState<string>("all")
  const [customStartDate, setCustomStartDate] = useState<string>("")
  const [customEndDate, setCustomEndDate] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [cursor, setCursor] = useState<string | null>(null)
  const [direction, setDirection] = useState<"next" | "previous">("next")
  const [pagination, setPagination] = useState({ 
    nextCursor: null as string | null,
    previousCursor: null as string | null,
    hasNextPage: false,
    hasPreviousPage: false,
    total: 0 
  })

  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null)
  const { currency, timezone } = useBusinessSettings()


  const fetchGuests = async () => {
    if (!user?.businessId) return
    try {
      setIsLoading(true)
      const queryParams = new URLSearchParams()
      if (cursor) queryParams.append("cursor", cursor)
      queryParams.append("direction", direction)
      queryParams.append("limit", "25")
      queryParams.append("filterBy", filterBy)
      queryParams.append("dateRange", dateRange)
      if (dateRange === "custom") {
        if (customStartDate) queryParams.append("startDate", customStartDate)
        if (customEndDate) queryParams.append("endDate", customEndDate)
      }
      if (debouncedSearch) queryParams.append("search", debouncedSearch)

      const response = await apiClient.get(`/owner/guests?${queryParams.toString()}`)
      setGuests(response.data.guests || [])
      setPagination(response.data.pagination || { 
        nextCursor: null, 
        previousCursor: null, 
        hasNextPage: false, 
        hasPreviousPage: false, 
        total: 0 
      })
    } catch (err) {
      console.error("Failed to fetch guests:", err)
      setError("Failed to load guests. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }


  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCursor(null)
      setDirection("next")
    }, 500)
    return () => clearTimeout(handler)
  }, [searchQuery])

  useEffect(() => {
    if (!user) return
    if (!user.entitlements?.crm) return // Don't fetch if CRM is locked
    fetchGuests()
  }, [user, cursor, direction, filterBy, dateRange, debouncedSearch, customStartDate, customEndDate])

  const handleFilterChange = (f: string) => {
    setFilterBy(f)
    setCursor(null)
    setDirection("next")
  }

  const handleDateRangeChange = (dr: string) => {
    setDateRange(dr)
    setCursor(null)
    setDirection("next")
  }

  const formatCents = (cents: number) => {
    return formatPrice(cents / 100, currency)
  }

  const getGuestTipCents = (guest: GuestProfile) => {
    return Number(guest.totalTipsCents ?? guest.totalTipsCollectedCents ?? 0)
  }

  return (
    <div className="pb-20">
      <div className="border-b border-border bg-background">
        {/* Filters */}
        <div className="px-6 py-3 bg-secondary/30 border-t border-border flex gap-2 overflow-x-auto">
          {(["customers", "leads", "consent_only", "no_consent", "top_spenders", "most_orders", "highest_visits", "recent", "inactive"] as const).map((f) => {
            const labels: Record<string, string> = {
              "customers": "Customers",
              "leads": "Leads",
              "consent_only": "Marketing Opt-In",
              "no_consent": "No Marketing",
              "top_spenders": "Top Spenders",
              "most_orders": "Most Orders",
              "highest_visits": "Highest Visits",
              "recent": "Recent (30d)",
              "inactive": "Inactive (90d+)"
            }
            return (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${filterBy === f
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-background border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                {labels[f]}
              </button>
            )
          })}
        </div>

        {/* Date Range Filters */}
        <div className="px-6 py-3 bg-secondary/10 border-t border-border flex items-center gap-2 overflow-x-auto min-h-[52px]">
          {(["all", "today", "yesterday", "last7", "thisMonth", "custom"] as const).map((dr) => {
            const labels: Record<string, string> = {
              "all": "All Time",
              "today": "Today",
              "yesterday": "Yesterday",
              "last7": "Last 7 Days",
              "thisMonth": "This Month",
              "custom": "Custom"
            }
            return (
              <button
                key={dr}
                onClick={() => handleDateRangeChange(dr)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${dateRange === dr
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-background border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                {labels[dr]}
              </button>
            )
          })}
          
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 ml-4">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Email / Name</th>
                  <th className="px-6 py-4 whitespace-nowrap">Visits</th>
                  <th className="px-6 py-4 whitespace-nowrap">Orders</th>
                  <th className="px-6 py-4 whitespace-nowrap">Total Spend</th>
                  <th className="px-6 py-4 whitespace-nowrap">Last Visit</th>
                  <th className="px-6 py-4 whitespace-nowrap">Consent</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, rowIndex) => (
                    <tr key={rowIndex} aria-label="Loading guest profile">
                      <td className="px-6 py-4"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="ml-auto h-8 w-20 rounded-lg" /></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-500 whitespace-nowrap">
                      <p className="font-medium">{error}</p>
                    </td>
                  </tr>
                ) : guests.length > 0 ? (
                  guests.map(guest => (
                    <tr key={guest._id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{guest.email}</p>
                          {guest.guestStatus === "lead" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">Lead</span>
                          )}
                        </div>
                        {guest.name && <p className="text-xs font-medium text-muted-foreground mt-0.5">{guest.name}</p>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-foreground bg-secondary px-2 py-1 rounded">{guest.visitCount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-foreground bg-secondary px-2 py-1 rounded">{guest.paidOrderCount || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-black text-foreground">
                        <div>
                          {formatCents(guest.totalSpendCents)}
                          {getGuestTipCents(guest) > 0 && (
                            <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCents(getGuestTipCents(guest))} tips
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-medium" suppressHydrationWarning>
                        {guest.lastVisitAt ? formatDateTime(guest.lastVisitAt, timezone) : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {guest.marketingConsent ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Opt-In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary text-muted-foreground text-xs font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> None
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Button
                          onClick={() => setSelectedGuest(guest)}
                          variant="ghost"
                          size="sm"
                          className="font-bold hover:bg-primary/10 hover:text-primary transition-colors gap-2"
                        >
                          <Eye className="w-4 h-4" /> View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No guest profiles found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {(!isLoading && (pagination.hasNextPage || pagination.hasPreviousPage)) && (
            <div className="p-4 border-t border-border flex items-center justify-between bg-card">
              <span className="text-sm font-medium text-muted-foreground">
                Total: {pagination.total} guests
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCursor(pagination.previousCursor)
                    setDirection("previous")
                  }}
                  disabled={!pagination.hasPreviousPage || !pagination.previousCursor}
                  className="font-bold"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCursor(pagination.nextCursor)
                    setDirection("next")
                  }}
                  disabled={!pagination.hasNextPage || !pagination.nextCursor}
                  className="font-bold"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guest Detail Modal */}
      {(selectedGuest || requestedGuestId) && (
        <GuestDetailModal
          guest={selectedGuest}
          guestId={selectedGuest ? null : requestedGuestId}
          onClose={() => {
            setSelectedGuest(null)
            if (requestedGuestId) onRequestedGuestHandled?.()
          }}
        />
      )}
    </div>
  )
}
