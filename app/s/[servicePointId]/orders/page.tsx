"use client"

import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import OrderHistory from "@/components/order-history"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ensureSessionId } from "@/lib/guest-session"
import { getBusinessId } from "@/lib/business-info"
import { getTableMenuUrl } from "@/lib/customer-routes"
import { clearOrderHistory } from "@/lib/order-history-storage"
import { apiClient } from "@/lib/axios-config"

export default function OrderHistoryPage() {
  const router = useRouter()
  const params = useParams()
  const servicePointId = params.servicePointId as string

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [isHistoryEmpty, setIsHistoryEmpty] = useState(true)

  // ✅ get sessionId safely in browser
  useEffect(() => {
    const id = ensureSessionId()
    setSessionId(id)
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const rid = getBusinessId()
      const res = await apiClient.get(`/public/business-config?businessId=${rid}`)
      setRestaurant(res.data)
    } catch (err) {
      console.error("Failed to fetch settings for history page", err)
    }
  }

  const handleClearHistory = () => {
    if (!sessionId) return
    setIsClearing(true)
    const bid = getBusinessId()
    clearOrderHistory({ businessId: bid, sessionId })
    // The active GuestSession is bound to qs_session_id. Clear only the
    // local history presentation so the current visit remains authorized.
    router.replace(getTableMenuUrl(servicePointId, bid))
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Order History</h1>
        </div>
      </header>

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <OrderHistory
          servicePointId={servicePointId}
          currency={restaurant?.currency}
          timezone={restaurant?.timezone}
          onEmptyChange={setIsHistoryEmpty}
        />

        {sessionId && !isHistoryEmpty && (
          <div className="mt-12 mb-8 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowDialog(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
              disabled={isClearing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All History
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Order History?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Historical orders for this business will be hidden on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              disabled={isClearing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isClearing ? "Clearing..." : "Clear History"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
