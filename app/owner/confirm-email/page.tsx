"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"

type PageState = "loading" | "success" | "invalid" | "taken" | "server" | "unknown"

export default function ConfirmEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<PageState>("loading")
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")
    const token = searchParams.get("token")

    if (success === "true") {
      setState("success")
    } else if (error === "invalid") {
      setState("invalid")
    } else if (error === "taken") {
      setState("taken")
    } else if (error === "server") {
      setState("server")
    } else if (token) {
      // Has a token but it went to frontend directly — should not happen after fix,
      // but show a helpful message instead of "unexpected state"
      setState("invalid")
    } else {
      setState("unknown")
    }
  }, [searchParams])

  // Auto-redirect to settings after success
  useEffect(() => {
    if (state !== "success") return
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          router.push("/owner/settings?tab=security")
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router, state])

  const content = {
    loading: {
      icon: <Loader2 className="w-16 h-16 text-primary animate-spin" />,
      title: "Confirming your email...",
      description: "Please wait while we verify your request.",
      color: "text-primary"
    },
    success: {
      icon: <CheckCircle2 className="w-16 h-16 text-green-500" />,
      title: "Email updated successfully!",
      description: `Your login email has been changed. Redirecting to settings in ${countdown}s...`,
      color: "text-green-600"
    },
    invalid: {
      icon: <XCircle className="w-16 h-16 text-red-500" />,
      title: "Link expired or invalid",
      description: "This confirmation link has expired or has already been used. Please request a new email change from your settings.",
      color: "text-red-600"
    },
    taken: {
      icon: <AlertTriangle className="w-16 h-16 text-amber-500" />,
      title: "Email already in use",
      description: "The email address you requested is already associated with another account. Please try a different email.",
      color: "text-amber-600"
    },
    server: {
      icon: <XCircle className="w-16 h-16 text-red-500" />,
      title: "Something went wrong",
      description: "We couldn't confirm your email right now. Please try again or contact support.",
      color: "text-red-600"
    },
    unknown: {
      icon: <AlertTriangle className="w-16 h-16 text-muted-foreground" />,
      title: "Unexpected state",
      description: "We're not sure what happened. Please return to settings and try again.",
      color: "text-muted-foreground"
    }
  }

  const current = content[state]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card rounded-[2rem] border border-border shadow-xl max-w-md w-full p-10 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in-95 duration-500">
        {/* Logo */}
        <div className="text-xl font-black tracking-tight text-foreground">
          Quick<span className="text-primary">Serve</span>
        </div>

        {/* Status icon */}
        <div className="flex items-center justify-center">
          {current.icon}
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className={`text-2xl font-black ${current.color}`}>{current.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* CTA */}
        {state !== "loading" && (
          <Link
            href="/owner/settings?tab=security"
            className="mt-2 inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Back to Settings
          </Link>
        )}
      </div>
    </div>
  )
}
