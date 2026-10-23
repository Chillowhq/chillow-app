"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { PreparingMenuScreen } from "@/components/preparing-menu-screen"
import apiClient from "@/lib/axios-config"
import {
  ensureSessionId,
  saveBusinessId,
  saveServicePointLabel,
  saveTableToken,
} from "@/lib/guest-session"
import { getTableMenuUrl } from "@/lib/customer-routes"
import { readServicePointQrCapability } from "@/lib/qr-capability"

/**
 * QR bootstrap route. It captures the signed capability from the URL fragment,
 * removes it from the address bar, asks the backend to verify it, stores the
 * resulting GuestSession, then leaves this one-time bootstrap surface.
 */
export default function QRBootstrapPage() {
  const params = useParams()
  const router = useRouter()
  const businessId = params.businessId as string
  const servicePointId = params.servicePointId as string

  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const [attempt, setAttempt] = useState(0)
  const capabilityRef = useRef<string | null>(null)
  const bootstrapInFlightRef = useRef(false)

  useEffect(() => {
    if (!businessId || !servicePointId) return

    if (capabilityRef.current === null) {
      capabilityRef.current = readServicePointQrCapability(window.location.hash) || ""
      // Remove reusable authority before any request, navigation, analytics,
      // console output, or referrer can observe the current browser URL.
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      )
    }

    const qrCapability = capabilityRef.current
    if (!qrCapability) {
      setStatus("error")
      setErrorMessage(
        "This QR code is invalid or no longer active. Please ask for a new code.",
      )
      return
    }
    if (bootstrapInFlightRef.current) return
    bootstrapInFlightRef.current = true

    const startSession = async () => {
      try {
        const sessionId = ensureSessionId()
        if (!sessionId) throw new Error("Device identity is unavailable")

        const response = await apiClient.post("/table-session/start", {
          businessId,
          servicePointId,
          sessionId,
          qrCapability,
        })

        if (!response.data?.token) {
          throw new Error("Invalid session created")
        }

        saveTableToken(
          servicePointId,
          response.data.token,
          response.data.expiresAt,
          response.data.journeyId,
        )
        saveBusinessId(businessId)
        if (response.data.label) saveServicePointLabel(response.data.label)

        capabilityRef.current = ""
        router.replace(getTableMenuUrl(servicePointId, businessId))
      } catch (error: any) {
        // Axios errors can contain the request body. Log only the safe status so
        // raw capability material never reaches application/browser logs.
        console.error("QR session bootstrap failed", {
          status: error?.response?.status || null,
        })
        setStatus("error")
        setErrorMessage(
          error?.response?.data?.error ||
            "Failed to initialize this visit. Please rescan the QR code.",
        )
      } finally {
        bootstrapInFlightRef.current = false
      }
    }

    void startSession()
  }, [attempt, businessId, servicePointId, router])

  if (status === "loading") return <PreparingMenuScreen />

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-destructive/5 rounded-3xl p-8 border border-destructive/20 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-black text-foreground tracking-tight mb-2">
            Could not connect
          </h1>
          <p className="text-sm font-medium text-muted-foreground mb-8">
            {errorMessage}
          </p>
          <button
            onClick={() => {
              setStatus("loading")
              setErrorMessage("")
              setAttempt((value) => value + 1)
            }}
            className="px-6 py-3 bg-foreground text-background font-bold rounded-xl w-full hover:bg-foreground/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}
