"use client"

import { useState, useEffect, useCallback } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react"
import { apiClient } from "@/lib/axios-config"
import { toast } from "sonner"

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

// ─── Inner form (must be rendered inside <Elements>) ──────────────────────────
function PaymentForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsSubmitting(true)
    setError(null)

    try {
      const { setupIntent, error: stripeError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      })

      if (stripeError) {
        setError(stripeError.message || "An error occurred while saving your card.")
        setIsSubmitting(false)
        return
      }

      if (setupIntent && setupIntent.status === "succeeded") {
        // Verify on backend & save safe metadata
        await apiClient.post("/owner/billing/verify-payment-method", {
          setupIntentId: setupIntent.id,
        })
        toast.success("Payment method saved.")
        onSuccess()
      } else {
        setError("Setup was not completed. Please try again.")
        setIsSubmitting(false)
      }
    } catch (err: any) {
      console.error("[PaymentForm] Error:", err)
      setError(err.response?.data?.message || "Failed to verify payment method.")
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/50 border border-border">
        <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
        <p className="text-[11px] font-medium text-muted-foreground leading-tight">
          Card details are securely processed by Stripe. QuickServe never stores your card number.
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-xl font-bold"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || !elements || isSubmitting}
          className="flex-1 rounded-xl font-bold gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Save payment method
        </Button>
      </div>
    </form>
  )
}

// ─── Main modal component ─────────────────────────────────────────────────────
interface AddPaymentMethodModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function AddPaymentMethodModal({
  open,
  onOpenChange,
  onSuccess,
}: AddPaymentMethodModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoadingIntent, setIsLoadingIntent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSetupIntent = useCallback(async () => {
    setIsLoadingIntent(true)
    setError(null)
    setClientSecret(null)
    try {
      const res = await apiClient.post("/owner/billing/setup-intent")
      setClientSecret(res.data.clientSecret)
    } catch (err: any) {
      console.error("[AddPaymentMethodModal] Error:", err)
      setError(err.response?.data?.message || "Failed to initialize payment setup.")
    } finally {
      setIsLoadingIntent(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchSetupIntent()
    } else {
      // Reset state when modal closes
      setClientSecret(null)
      setError(null)
    }
  }, [open, fetchSetupIntent])

  const handleSuccess = () => {
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl" showCloseButton={!isLoadingIntent}>
        <DialogHeader>
          <DialogTitle className="text-lg font-black">Add payment method</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Used for QuickServe subscription and offline commission invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {!stripePublishableKey && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm text-amber-800 dark:text-amber-400">
                <p className="font-bold">Online payments are temporarily unavailable</p>
                <p>Please contact support before trying to add a payment method.</p>
              </div>
            </div>
          )}

          {isLoadingIntent && stripePublishableKey && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">Preparing secure form…</p>
            </div>
          )}

          {error && !isLoadingIntent && (
            <div className="text-center py-8 space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-red-800 dark:text-red-400">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSetupIntent}
                className="rounded-xl font-bold"
              >
                Try again
              </Button>
            </div>
          )}

          {clientSecret && stripePublishableKey && !isLoadingIntent && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: {
                    borderRadius: "10px",
                    fontFamily: "inherit",
                  },
                },
              }}
            >
              <PaymentForm
                onSuccess={handleSuccess}
                onCancel={() => onOpenChange(false)}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
