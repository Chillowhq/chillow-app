"use client"

import React, { ReactNode, useEffect, useState, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { apiClient } from "@/lib/axios-config"
import { getBusinessId } from "@/lib/business-info"
import { saveBusinessId } from "@/lib/guest-session"
import { CustomerRouteSkeleton } from "@/components/customer-loading-skeletons"

export const CustomerThemeContext = React.createContext<{
  branding: any
  useBranding: boolean
  themeVars: React.CSSProperties
}>({ branding: null, useBranding: false, themeVars: {} })

export function useCustomerTheme() {
  return React.useContext(CustomerThemeContext)
}

interface CustomerThemeProviderProps {
  children: ReactNode
  businessId?: string
}

export function CustomerThemeProvider({ children, businessId: propBusinessId }: CustomerThemeProviderProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  const [branding, setBranding] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [useBranding, setUseBranding] = useState(false)

  useEffect(() => {
    const initTheme = async () => {
      try {
        // 1. Resolve Business ID: prop > URL > SessionStorage > Env
        const urlBusinessId = searchParams.get("businessId")
        const resolvedBusinessId = propBusinessId || urlBusinessId || getBusinessId()
        
        if (!resolvedBusinessId) {
          console.warn("[CustomerThemeProvider] No businessId found for theme.")
          setIsLoading(false)
          return
        }

        // Persist it if it came from URL so direct refreshes on /order work
        if (urlBusinessId) {
          saveBusinessId(urlBusinessId)
        }
        // Also persist prop-provided businessId for child pages
        if (propBusinessId) {
          saveBusinessId(propBusinessId)
        }

        // 2. Fetch Branding Config
        const res = await apiClient.get(`/public/business-config?businessId=${resolvedBusinessId}`)
        const restaurantData = res.data
        
        const brandingAccess = restaurantData?.brandingAccess
        const brandingConfig = restaurantData?.branding
        
        if (brandingAccess?.canUseBranding && brandingConfig?.enabled) {
          setBranding(brandingConfig)
          setUseBranding(true)
        }
      } catch (err) {
        console.error("[CustomerThemeProvider] Failed to load branding:", err)
      } finally {
        setIsLoading(false)
      }
    }

    initTheme()
  }, [searchParams, propBusinessId])

  // Compute CSS Variables
  const themeVars = useMemo(() => {
    if (!useBranding || !branding) return {}
    
    return {
      '--primary': branding.primaryColor || '#EA601A',
      '--brand-primary': branding.primaryColor || '#EA601A',
      '--brand-secondary': branding.secondaryColor || '#2B304C',
      '--brand-accent': branding.accentColor || '#FB923C',
      '--brand-background': branding.backgroundColor || '#F8F9FA',
      '--brand-gradient-from': branding.primaryColor || '#EA601A',
      '--brand-gradient-to': branding.accentColor || '#ff8c42',
      '--brand-text': '#FFFFFF', // Text on brand colors
      '--brand-muted': `${branding.primaryColor || '#EA601A'}15`,
      '--brand-border': `${branding.primaryColor || '#EA601A'}33`,
      '--brand-ring': `${branding.primaryColor || '#EA601A'}33`,
      '--brand-shadow': `${branding.primaryColor || '#EA601A'}33`,
    } as React.CSSProperties
  }, [useBranding, branding])

  // Show a neutral loading state to prevent flashing QuickServe orange
  if (isLoading) {
    return <CustomerRouteSkeleton pathname={pathname} />
  }

  // Wrap the children in the theme provider
  return (
    <CustomerThemeContext.Provider value={{ branding, useBranding, themeVars }}>
      <div className={useBranding ? "customer-menu-theme" : ""} style={themeVars}>
        {children}
      </div>
    </CustomerThemeContext.Provider>
  )
}
