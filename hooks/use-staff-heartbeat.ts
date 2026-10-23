import { useEffect } from "react"
import { apiClient } from "@/lib/axios-config"

const STAFF_ROLES = ["waiter", "staff", "kitchen", "bartender", "housekeeping", "manager", "co_owner"]

export function useStaffHeartbeat(user: any) {
  useEffect(() => {
    // Only operational staff should send heartbeats
    if (!user || !STAFF_ROLES.includes(user.role)) {
      return
    }

    const sendHeartbeat = async () => {
      try {
        await apiClient.post("/auth/heartbeat")
      } catch (err) {
        console.error("[StaffHeartbeat] Failed to send heartbeat:", err)
      }
    }

    // Send immediately on mount
    sendHeartbeat()

    // Send periodically every 60 seconds
    const intervalId = setInterval(sendHeartbeat, 60000)

    // Send when window regains focus
    const handleFocus = () => {
      sendHeartbeat()
    }
    window.addEventListener("focus", handleFocus)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
    }
  }, [user])
}
