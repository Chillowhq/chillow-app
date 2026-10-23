"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"

import ManagePlanModal from "./billing/ManagePlanModal"

type LockedFeature = "analytics" | "crm" | "aiBusinessAnalyst"

type LockedFeatureStateProps = {
  feature: LockedFeature
  canManagePlan?: boolean
}

type FeatureCopy = {
  eyebrow: string
  headline: string
  description: string
  benefits: Array<{
    title: string
    detail: string
  }>
}

const FEATURE_COPY: Record<LockedFeature, FeatureCopy> = {
  analytics: {
    eyebrow: "Growth analytics",
    headline: "See exactly what’s driving your business",
    description:
      "Turn the activity Chillow already records into clear performance trends and operational insight.",
    benefits: [
      {
        title: "Business performance",
        detail:
          "— track revenue, orders, reservations, and key performance trends over time.",
      },
      {
        title: "Customer & operational insights",
        detail:
          "— uncover peak periods, service patterns, customer behaviour, and the areas driving business performance.",
      },
      {
        title: "Staff Performance",
        detail:
          "— measure acknowledged/resolved requests, response times, orders served, and offline payments handled by each waiter.",
      },
      {
        title: "Peak-Time & Demand Insights",
        detail:
          "— identify your busiest hours, order volume patterns, average preparation time, and operational peaks.",
      },
      {
        title: "Service Response Analytics",
        detail:
          "— track waiter calls, missed requests, first-response time, resolution time, and the reasons customers request assistance.",
      },
    ],
  },
  crm: {
    eyebrow: "Growth · Guest Insights",
    headline: "Turn every visit into customer intelligence",
    description:
      "Chillow automatically turns guest activity into profiles, segments, spending insights, and marketing-ready customer data.",
    benefits: [
      {
        title: "Know your highest-value guests",
        detail:
          "— identify top spenders, frequent visitors, and your most active customers",
      },
      {
        title: "Understand every guest relationship",
        detail:
          "— visits, orders, spend, last visit, and activity history in one place",
      },
      {
        title: "Automatically segment your audience",
        detail:
          "— customers, leads, recent guests, inactive guests, and marketing opt-ins",
      },
      {
        title: "Turn first-time guests into repeat customers",
        detail:
          "— understand who's returning and who you're at risk of losing",
      },
      {
        title: "Build a marketing-ready customer base",
        detail:
          "— capture consent and know who you can engage with",
      },
    ],
  },
  aiBusinessAnalyst: {
    eyebrow: "Growth · AI Business Analyst",
    headline: "Understand what changed in your business and what deserves your attention next",
    description:
      "Every week, Chillow analyzes your sales, operations, customers, service performance and other available business activity, then turns the most important changes into a concise business briefing.",
    benefits: [
      {
        title: "Weekly business performance briefing",
        detail:
          "— a clear summary of what mattered most in your business this week",
      },
      {
        title: "Important improvements and risks identified automatically",
        detail:
          "— Chillow flags what went well and what needs your attention",
      },
      {
        title: "Clear priorities for the coming week",
        detail:
          "— actionable recommendations grounded in your actual business activity",
      },
      {
        title: "Recommendations grounded in Chillow activity",
        detail:
          "— every insight is backed by your real sales, operations, and customer data",
      },
    ],
  },
}

export function LockedFeatureState({
  feature,
  canManagePlan = true,
}: LockedFeatureStateProps) {
  const [showManagePlan, setShowManagePlan] = useState(false)
  const copy = FEATURE_COPY[feature]

  return (
    <>
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-primary/20 bg-primary/10 p-6 shadow-sm">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
          {copy.headline}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {copy.description}
        </p>

        <ul className="mt-4 space-y-2">
          {copy.benefits.map((benefit) => (
            <li
              key={benefit.title}
              className="flex items-start gap-2 text-sm text-foreground sm:text-base"
            >
              <Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" />
              <span className="leading-relaxed">
                <strong className="font-bold">{benefit.title}</strong>{" "}
                <span className="text-muted-foreground">{benefit.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        {canManagePlan ? (
          <Button
            size="lg"
            className="mt-5 h-11 w-full rounded-xl bg-primary text-base font-bold text-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => setShowManagePlan(true)}
          >
            Upgrade to Growth
          </Button>
        ) : (
          <p className="mt-5 text-sm font-semibold text-muted-foreground">
            This feature is not included in the business&apos;s current plan.
            Contact the business owner to review plan options.
          </p>
        )}
      </div>

      {canManagePlan ? (
        <ManagePlanModal
          open={showManagePlan}
          onOpenChange={setShowManagePlan}
          onSuccess={() => window.location.reload()}
        />
      ) : null}
    </>
  )
}
