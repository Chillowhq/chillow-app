"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Users, BarChart3 } from "lucide-react"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { MANAGER_PERMISSIONS, hasManagementPermission } from "@/lib/manager-permissions"
import { LockedFeatureState } from "@/components/owner/LockedFeatureState"
import { CrmOverview } from "@/components/owner/crm/CrmOverview"
import { CrmCustomersView } from "@/components/owner/crm/CrmCustomersView"
import { PageHeader } from "@/components/shared/PageHeader"

export default function OwnerGuestsPage() {
  const { user, loading } = useAuthGuard()
  const searchParams = useSearchParams()

  const initialView = searchParams.get("view") === "customers" ? "customers" : "overview"
  const [activeTab, setActiveTab] = useState<"overview" | "customers">(initialView)
  const [mountedTabs, setMountedTabs] = useState<Set<"overview" | "customers">>(
    () => new Set([initialView]),
  )

  const [requestedGuestId, setRequestedGuestId] = useState<string | null>(
    searchParams.get("guestId"),
  )

  const isLocked = user && !user.entitlements?.crm
  const hasCrmPermission = hasManagementPermission(user, MANAGER_PERMISSIONS.CRM_VIEW)

  const selectTab = (tab: "overview" | "customers") => {
    setActiveTab(tab)
    setMountedTabs((current) => {
      if (current.has(tab)) return current
      return new Set([...current, tab])
    })
  }

  if (loading) {
    return <div className="min-h-screen animate-pulse bg-background" />
  }

  if (!hasCrmPermission) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-muted-foreground text-sm">
          You do not have permission to view CRM / Customer Analytics.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <div className="border-b border-border bg-card px-6 py-6">
        <PageHeader
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          title={
            <>
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </span>
              Guests / CRM
            </>
          }
          titleClassName="flex items-center gap-2 mb-1"
          description="Understand your customers, visits, spending and loyalty."
          descriptionClassName="mt-0"
          action={
            !isLocked ? (
              <div className="flex items-center bg-secondary/60 p-1 rounded-2xl border border-border">
                <button
                  onClick={() => selectTab("overview")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "overview"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Overview
                </button>
                <button
                  onClick={() => selectTab("customers")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "customers"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Customers
                </button>
              </div>
            ) : null
          }
        />
      </div>

      {/* Main Content Area */}
      {isLocked ? (
        <div className="p-6">
          <LockedFeatureState
            feature="crm"
            canManagePlan={user?.role === "owner"}
          />
        </div>
      ) : (
        <>
          {mountedTabs.has("overview") ? (
            <div hidden={activeTab !== "overview"}>
              <CrmOverview
                active={activeTab === "overview"}
                businessId={user?.businessId}
                requestedGuestId={activeTab === "overview" ? requestedGuestId : null}
                onRequestedGuestHandled={() => setRequestedGuestId(null)}
              />
            </div>
          ) : null}
          {mountedTabs.has("customers") ? (
            <div hidden={activeTab !== "customers"}>
              <CrmCustomersView
                requestedGuestId={activeTab === "customers" ? requestedGuestId : null}
                onRequestedGuestHandled={() => setRequestedGuestId(null)}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
