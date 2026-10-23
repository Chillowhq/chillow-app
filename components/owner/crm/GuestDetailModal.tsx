"use client"

import { useState, useEffect } from "react"
import { X, Award, Mail, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import apiClient from "@/lib/axios-config"
import { useBusinessSettings } from "@/contexts/BusinessContext"
import { formatPrice, formatDateTime } from "@/lib/localization"
import type { GuestProfile } from "./CrmCustomersView"

type GuestDetailModalProps = {
  guest?: GuestProfile | null
  guestId?: string | null
  onClose: () => void
}

export function GuestDetailModal({
  guest: initialGuest,
  guestId,
  onClose,
}: GuestDetailModalProps) {
  const [guest, setGuest] = useState<GuestProfile | null>(initialGuest || null)
  const [loading, setLoading] = useState<boolean>(!initialGuest && !!guestId)
  const [error, setError] = useState<string | null>(null)
  const { currency, timezone } = useBusinessSettings()

  useEffect(() => {
    if (initialGuest) {
      setGuest(initialGuest)
      setLoading(false)
      return
    }

    if (!guestId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    apiClient
      .get<GuestProfile>(`/owner/guests/${encodeURIComponent(guestId)}`)
      .then((res) => {
        if (!cancelled) {
          setGuest(res.data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch guest detail:", err)
          setError("Failed to load customer details.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [initialGuest, guestId])

  const formatCents = (cents: number) => {
    return formatPrice(cents / 100, currency)
  }

  const getGuestTipCents = (g: GuestProfile) => {
    return Number(g.totalTipsCents ?? g.totalTipsCollectedCents ?? 0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-card">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                {guest?.guestStatus === "lead" ? "Guest Lead" : "Guest Profile"}
              </p>
              {guest?.marketingConsent ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
                  Marketable
                </span>
              ) : null}
              {guest?.guestStatus === "lead" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">
                  Lead
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-foreground truncate max-w-sm">
              {guest?.email || (loading ? "Loading..." : "Customer Details")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-secondary/50 rounded-full hover:bg-secondary transition-colors border border-border/50 shadow-sm"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6 bg-secondary/10">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">
              <p className="font-medium">{error}</p>
            </div>
          ) : guest ? (
            <>
              {/* Quick Meta Row */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-card p-3 rounded-xl border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Visits
                  </p>
                  <p className="font-bold text-foreground mt-0.5">
                    {guest.visitCount}
                  </p>
                </div>
                <div className="bg-card p-3 rounded-xl border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Orders
                  </p>
                  <p className="font-bold text-foreground mt-0.5">
                    {guest.paidOrderCount || 0}
                  </p>
                </div>
                <div className="bg-card p-3 rounded-xl border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Total Spend
                  </p>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatCents(guest.totalSpendCents)}
                  </p>
                </div>
                {getGuestTipCents(guest) > 0 && (
                  <div className="bg-card p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                      Total Tips
                    </p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatCents(getGuestTipCents(guest))}
                    </p>
                    {guest.ordersWithTips ? (
                      <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                        {guest.ordersWithTips} tipped orders
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="bg-card p-3 rounded-xl border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Avg Spend / Visit
                  </p>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatCents(guest.averageSpendCents)}
                  </p>
                </div>
                <div className="bg-card p-3 rounded-xl border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Avg Spend / Order
                  </p>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatCents(guest.averageOrderSpendCents || 0)}
                  </p>
                </div>
                <div className="bg-card p-3 rounded-xl border border-border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Last Visit
                  </p>
                  <p
                    className="font-bold text-foreground mt-0.5 text-sm"
                    suppressHydrationWarning
                  >
                    {guest.lastVisitAt
                      ? formatDateTime(guest.lastVisitAt, timezone)
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Loyalty & Marketing
                    </h3>
                    <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Award className="w-4 h-4 text-primary" />
                          Points
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {guest.loyaltyPoints}
                        </span>
                      </div>
                      <div className="h-px bg-border w-full" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Mail className="w-4 h-4 text-primary" />
                          Marketing Opt-In
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {guest.marketingConsent ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Favourite Items */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Top Ordered Items
                    </h3>
                    {guest.favouriteItems && guest.favouriteItems.length > 0 ? (
                      <ul className="space-y-2">
                        {guest.favouriteItems.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex flex-col p-3 rounded-xl bg-card border border-border shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">
                                {item.itemName}
                              </span>
                              <div className="px-2 py-0.5 rounded bg-secondary text-xs font-bold text-muted-foreground">
                                {item.quantity}x
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-6 rounded-xl bg-card border border-border shadow-sm text-center text-muted-foreground">
                        <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">
                          No favourite items yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-border bg-card">
          <Button
            className="w-full font-bold py-6 rounded-xl text-md"
            onClick={onClose}
          >
            Close Profile
          </Button>
        </div>
      </div>
    </div>
  )
}
