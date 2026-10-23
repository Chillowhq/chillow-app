"use client"

import { useState, useEffect } from "react"
import { Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { toast } from "sonner"

type ManagePlanModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  // Optional: pass in pre-fetched data if available, otherwise it will fetch its own
  prefetchedPlans?: any[]
  prefetchedCurrentPlan?: string
  prefetchedScheduledDowngradePlan?: string
}

export default function ManagePlanModal({
  open,
  onOpenChange,
  onSuccess,
  prefetchedPlans,
  prefetchedCurrentPlan,
  prefetchedScheduledDowngradePlan
}: ManagePlanModalProps) {
  const [plans, setPlans] = useState<any[]>(prefetchedPlans || [])
  const [currentPlan, setCurrentPlan] = useState<string | null>(prefetchedCurrentPlan || null)
  const [scheduledDowngradePlan, setScheduledDowngradePlan] = useState<string | null>(prefetchedScheduledDowngradePlan || null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [isChangingPlan, setIsChangingPlan] = useState<string | null>(null)
  const [pendingPlanChange, setPendingPlanChange] = useState<{ id: string, name: string, isUpgrade: boolean } | null>(null)

  useEffect(() => {
    // If open and we didn't receive prefetched data, fetch it.
    if (open && !prefetchedPlans) {
      const fetchData = async () => {
        setIsLoading(true)
        try {
          const [plansRes, infoRes] = await Promise.all([
            apiClient.get("/public/plans").catch(() => null),
            apiClient.get("/owner/billing").catch(() => null),
          ])
          if (plansRes?.data) setPlans(plansRes.data)
          if (infoRes?.data) {
            setCurrentPlan(infoRes.data.currentPlan)
            setScheduledDowngradePlan(infoRes.data.scheduledDowngradePlan)
          }
        } catch (error) {
          console.error("Failed to load plans", error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchData()
    } else if (open) {
      setPlans(prefetchedPlans || [])
      setCurrentPlan(prefetchedCurrentPlan || null)
      setScheduledDowngradePlan(prefetchedScheduledDowngradePlan || null)
    }
  }, [open, prefetchedPlans, prefetchedCurrentPlan, prefetchedScheduledDowngradePlan])

  const changePlan = async (planSlug: string) => {
    try {
      setIsChangingPlan(planSlug)
      const res = await apiClient.post("/owner/billing/plan", { planSlug })
      toast.success(res.data?.message || `Plan changed to ${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)}!`)
      
      // Update local state so it looks fast
      setCurrentPlan(planSlug)
      setPendingPlanChange(null)
      
      if (onSuccess) onSuccess()
      
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to change plan")
    } finally {
      setIsChangingPlan(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Manage Plan</DialogTitle>
            <DialogDescription>Choose a plan for your subscription and offline commission rate.</DialogDescription>
          </DialogHeader>
          <section className="border-0 shadow-none p-0">
            <div className="mb-6">
              <h2 className="text-lg font-black text-foreground">Manage Plan</h2>
              <p className="text-xs text-muted-foreground font-medium">Choose a plan for your subscription and offline commission rate</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan, _idx, allPlans) => (
                  <div
                    key={plan.slug}
                    className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                      currentPlan === plan.slug
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50 cursor-pointer"
                    }`}
                    onClick={() => {
                      if (currentPlan === plan.slug) {
                        toast.info("You are already subscribed to this plan.")
                        return
                      }

                      const currentPlanDef = allPlans.find(p => p.slug === (currentPlan || 'basic'))
                      const currentLevel = currentPlanDef?.level || 1
                      const targetLevel = plan.level || 1

                      setPendingPlanChange({
                        id: plan.slug,
                        name: plan.name,
                        isUpgrade: targetLevel > currentLevel
                      })
                      onOpenChange(false) // Close main dialog to show confirmation
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground text-sm">{plan.name}</p>
                        {currentPlan === plan.slug && (
                          <span className="bg-primary text-primary-foreground text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm tracking-wider">
                            Current
                          </span>
                        )}
                        {scheduledDowngradePlan === plan.slug && (
                          <span className="bg-amber-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm tracking-wider">
                            Downgrading Soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.offlineCommissionRate}% offline commission</p>
                    </div>
                    {currentPlan !== plan.slug && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full pointer-events-none" disabled={isChangingPlan === plan.slug}>
                        {isChangingPlan === plan.slug ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>

      {/* Change Plan Confirmation Modal */}
      <AlertDialog open={!!pendingPlanChange} onOpenChange={(open) => {
        if (!open) {
          setPendingPlanChange(null)
          // Re-open the main dialog if they cancel
          onOpenChange(true)
        }
      }}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">
              {pendingPlanChange?.isUpgrade ? 'Upgrade' : 'Downgrade'} to {pendingPlanChange?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
              {pendingPlanChange?.isUpgrade ? (
                <>
                  <span className="block">Your subscription will be upgraded immediately.</span>
                  <span className="block mt-2">Your new features and limits will become available instantly.</span>
                  <span className="block mt-2">Any new commission rates will apply only to future orders.</span>
                </>
              ) : (
                <>
                  <span className="block">Your current plan will remain active until the end of your current billing period.</span>
                  <span className="block mt-2">Your downgrade will automatically take effect on your next renewal date.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
            <AlertDialogCancel
              className="flex-1 rounded-xl font-bold"
              disabled={!!isChangingPlan}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={`flex-1 rounded-xl font-bold text-white ${pendingPlanChange?.isUpgrade ? 'bg-primary hover:bg-primary/90' : 'bg-amber-600 hover:bg-amber-700'}`}
              disabled={!!isChangingPlan}
              onClick={async (e) => {
                e.preventDefault()
                if (pendingPlanChange) {
                  await changePlan(pendingPlanChange.id)
                }
              }}
            >
              {isChangingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {pendingPlanChange?.isUpgrade ? 'Upgrade Now' : 'Schedule Downgrade'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
