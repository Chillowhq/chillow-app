"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * useFocusMode — shared hook for Kitchen & Waitstaff Focus Mode.
 *
 * Manages:
 * - `isFocusMode` boolean state (UI layout only)
 * - Fullscreen API enter/exit with graceful error handling
 * - `fullscreenchange` listener to auto-exit focus layout when browser fullscreen ends
 * - Cleanup on unmount (exits fullscreen if still active)
 *
 * Does NOT persist to localStorage — resets on refresh.
 * Does NOT affect auth, presence, SSE, or permissions.
 */
export function useFocusMode() {
  const [isFocusMode, setIsFocusMode] = useState(false)
  const isMountedRef = useRef(true)

  // Safely request fullscreen on document.documentElement
  // so portal-based modals/popovers remain inside the fullscreen tree.
  const requestFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if ((el as any).webkitRequestFullscreen) {
        // Safari fallback
        await (el as any).webkitRequestFullscreen()
      }
    } catch {
      // Fullscreen denied or unsupported — focus layout still activates
      console.warn("[FocusMode] Fullscreen request denied or unsupported")
    }
  }, [])

  // Safely exit fullscreen only if currently in fullscreen
  const safeExitFullscreen = useCallback(async () => {
    try {
      if (
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      ) {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        }
      }
    } catch {
      // Exit fullscreen failed — silently ignore
      console.warn("[FocusMode] exitFullscreen failed or was rejected")
    }
  }, [])

  const enterFocusMode = useCallback(async () => {
    setIsFocusMode(true)
    await requestFullscreen()
  }, [requestFullscreen])

  const exitFocusMode = useCallback(async () => {
    setIsFocusMode(false)
    await safeExitFullscreen()
  }, [safeExitFullscreen])

  const toggleFocusMode = useCallback(async () => {
    if (isFocusMode) {
      await exitFocusMode()
    } else {
      await enterFocusMode()
    }
  }, [isFocusMode, enterFocusMode, exitFocusMode])

  // Listen for browser fullscreen exit (Esc key, gesture, etc.)
  // to sync focus layout state back to normal.
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!isMountedRef.current) return

      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      )

      // If browser exited fullscreen but we're still in focus mode, exit focus layout
      if (!isFullscreen && isFocusMode) {
        setIsFocusMode(false)
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
    }
  }, [isFocusMode])

  // Cleanup on unmount — exit fullscreen if we unmount while active
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // Fire-and-forget defensive exit
      try {
        if (
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement
        ) {
          document.exitFullscreen?.().catch(() => {})
        }
      } catch {
        // Silently ignore
      }
    }
  }, [])

  return {
    isFocusMode,
    enterFocusMode,
    exitFocusMode,
    toggleFocusMode,
  }
}
