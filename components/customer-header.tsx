"use client"

import { MapPin } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"

interface BrandingConfig {
  enabled?: boolean
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  displayName?: string
  removeQuickServeBranding?: boolean
}

interface CustomerHeaderProps {
  useBranding: boolean
  branding: BrandingConfig
  businessName: string
  businessLogoUrl?: string | null
  displayServicePoint?: string
  isOpen?: boolean
}

export default function CustomerHeader({
  useBranding,
  branding,
  businessName,
  businessLogoUrl,
  displayServicePoint = "Service point",
  isOpen,
}: CustomerHeaderProps) {
  const displayName = (useBranding && branding.displayName) || businessName || "QuickServe"
  const logoUrl = (useBranding && branding.logoUrl) || businessLogoUrl
  const logoInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    setLogoFailed(false)
  }, [logoUrl])

  return (
    <header
      className="relative z-20 mx-auto w-full max-w-5xl pb-8 pt-4 sm:pb-10 sm:pt-6"
      style={{
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
        <div className="flex items-center gap-4 sm:gap-6">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full p-1.5 shadow-[0_14px_35px_-18px_rgba(15,23,42,.65)] min-[380px]:h-[6.5rem] min-[380px]:w-[6.5rem] sm:h-28 sm:w-28"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))",
            }}
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background p-1.5">
              {logoUrl && !logoFailed ? (
                <Image
                  src={logoUrl}
                  alt={`${displayName} logo`}
                  width={112}
                  height={112}
                  className="h-full w-full rounded-full bg-white object-contain"
                  priority
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-full w-full items-center justify-center rounded-full text-2xl font-black text-[var(--brand-text-on-brand,white)] sm:text-3xl"
                  style={{ backgroundColor: "var(--brand-primary, #EA601A)" }}
                >
                  {logoInitials || "QS"}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <h1 className="min-w-0 text-[clamp(1.5rem,6vw,2.125rem)] font-black leading-[1.05] tracking-[-0.035em] text-foreground">
                {displayName}
              </h1>
              {typeof isOpen === "boolean" && (
                <span
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-bold ${
                    isOpen
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                  {isOpen ? "Open" : "Closed"}
                </span>
              )}
            </div>

            <p className="mt-3 flex items-center gap-2 text-base font-semibold text-muted-foreground sm:text-lg">
              <MapPin className="h-5 w-5 shrink-0 text-[var(--brand-primary,#EA601A)]" strokeWidth={2.25} aria-hidden="true" />
              <span className="truncate">{displayServicePoint}</span>
            </p>
          </div>
        </div>
    </header>
  )
}
