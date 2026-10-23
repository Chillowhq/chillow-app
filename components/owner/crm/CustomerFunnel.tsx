"use client"

import { Users, ShoppingBag, UserCheck, Lightbulb, Info } from "lucide-react"
import { formatPrice, formatDateTime } from "@/lib/localization"
import { buildConversionInsights } from "@/lib/crm-conversion-insights.mjs"
import type { CrmCustomerJourneyData } from "@/types/crm-analytics"

type CustomerFunnelProps = {
  journeyData: CrmCustomerJourneyData
  currency: string
  timezone?: string
}

export function CustomerFunnel({
  journeyData,
  currency,
  timezone,
}: CustomerFunnelProps) {
  const formatCents = (cents: number) => {
    return formatPrice((cents || 0) / 100, currency)
  }

  const {
    totalOrderingVisitors = 0,
    visitorsWhoOrdered = 0,
    visitorsWithoutOrder = 0,
    identifiedVisitors = 0,
    identifiedOrderingVisitors = 0,
    anonymousOrderingVisitors = 0,
    visitToOrderConversionRate = 0,
    orderToIdentifiedConversionRate = 0,
    visitToIdentifiedConversionRate = 0,
    customerJourneyRevenueCents = 0,
    tracking,
  } = journeyData || {}

  const trackingAvailable = tracking?.hasTrackingData === true
  const conversionInsights = buildConversionInsights(
    {
      totalOrderingVisitors,
      visitorsWhoOrdered,
      visitorsWithoutOrder,
      identifiedOrderingVisitors,
      anonymousOrderingVisitors,
      visitToOrderConversionRate,
      orderToIdentifiedConversionRate,
      customerJourneyRevenueCents,
    },
    formatCents,
  )

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <h3 className="font-black text-foreground text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Customer Journey & Acquisition Funnel
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            See how visitors move from opening the ordering experience to placing orders and becoming known customers.
          </p>
        </div>

        
      </div>

      {!trackingAvailable ? (
        <div className="p-8 text-center bg-secondary/20 border border-dashed border-border rounded-2xl space-y-2">
          <p className="font-bold text-foreground text-sm">
            Customer Journey Tracking Active
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Customer journey metrics start automatically as new ordering visitors open the menu, scan table QR codes, or place orders.
          </p>
        </div>
      ) : totalOrderingVisitors === 0 ? (
        <div className="p-8 text-center bg-secondary/20 border border-dashed border-border rounded-2xl space-y-2">
          <p className="font-bold text-foreground text-sm">
            No ordering visitors during this period.
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Visitors will appear after they open the ordering experience.
          </p>
        </div>
      ) : (
        <>
          {/* 3-Stage Visual Funnel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stage 1: Ordering Visitors */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  <Users className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full bg-blue-100/80 dark:bg-blue-900/80">
                  Stage 1
                </span>
              </div>
              <div>
                <p className="text-3xl font-black text-foreground">
                  {totalOrderingVisitors.toLocaleString()}
                </p>
                <p className="text-xs font-bold text-muted-foreground mt-1">
                  Ordering Visitors
                </p>
              </div>
            </div>

            {/* Stage 2: Ordered */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  <ShoppingBag className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-900/80 flex items-center gap-1">
                  <span>Stage 2</span>
                  <span className="text-emerald-800 dark:text-emerald-200 font-extrabold">• {visitToOrderConversionRate}%</span>
                </span>
              </div>
              <div>
                <p className="text-3xl font-black text-foreground">
                  {visitorsWhoOrdered.toLocaleString()}
                </p>
                <p className="text-xs font-bold text-muted-foreground mt-1">
                  Ordered
                </p>
              </div>
            </div>

            {/* Stage 3: Identified Customers */}
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  <UserCheck className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full bg-purple-100/80 dark:bg-purple-900/80 flex items-center gap-1">
                  <span>Stage 3</span>
                  <span className="text-purple-800 dark:text-purple-200 font-extrabold">• {orderToIdentifiedConversionRate}%</span>
                </span>
              </div>
              <div>
                <p className="text-3xl font-black text-foreground">
                  {identifiedVisitors.toLocaleString()}
                </p>
                <p className="text-xs font-bold text-muted-foreground mt-1">
                  Identified Customers
                </p>
              </div>
            </div>
          </div>

          {/* Supporting Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Didn't Order
              </p>
              <p className="text-xl font-black text-foreground">
                {visitorsWithoutOrder.toLocaleString()}
              </p>
            </div>

            <div className="bg-secondary/30 p-4 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Ordered Anonymously
              </p>
              <p className="text-xl font-black text-foreground">
                {anonymousOrderingVisitors.toLocaleString()}
              </p>
            </div>

            <div className="bg-secondary/30 p-4 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Visit → Identified Rate
              </p>
              <p className="text-xl font-black text-foreground">
                {visitToIdentifiedConversionRate}%
              </p>
            </div>

            <div className="bg-secondary/30 p-4 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Tracked Journey Revenue
              </p>
              <p className="text-xl font-black text-foreground">
                {formatCents(customerJourneyRevenueCents)}
              </p>
            </div>
          </div>

          {/* Insights List */}
          {conversionInsights.length > 0 && (
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Conversion Insights</span>
              </div>
              <ul className="space-y-1.5 pl-6 list-disc text-xs text-foreground font-medium">
                {conversionInsights.map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
