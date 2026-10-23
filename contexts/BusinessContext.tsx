"use client"

import { createContext, useContext, ReactNode } from "react"
import type { BusinessCapabilities, BusinessModule, ServicePointTerminology } from "@/types/business-capabilities"

export type ServicePointTerm = ServicePointTerminology

interface BusinessContextType {
  businessType: string
  modules: BusinessModule[]
  capabilities?: BusinessCapabilities
  term: ServicePointTerm
  currency: string
  taxRate: number
  timezone: string
}

const genericTerm: ServicePointTerm = {
  singular: "Service Point",
  plural: "Service Points",
  lower: "service point",
  lowerPlural: "service points",
}

export function getServicePointTerm(capabilities?: BusinessCapabilities): ServicePointTerm {
  return capabilities?.terminology.servicePoint || genericTerm
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

export function BusinessProvider({ 
  children, 
  businessType,
  modules,
  capabilities,
  currency = "USD",
  taxRate = 0,
  timezone = "UTC"
}: { 
  children: ReactNode
  businessType?: string
  modules?: BusinessModule[]
  capabilities?: BusinessCapabilities
  currency?: string
  taxRate?: number
  timezone?: string
}) {
  const type = businessType || "restaurant"
  const term = getServicePointTerm(capabilities)

  return (
    <BusinessContext.Provider value={{ businessType: type, modules: modules || [], capabilities, term, currency, taxRate, timezone }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusinessSettings() {
  const context = useContext(BusinessContext)
  if (!context) {
    // Graceful fallback to prevent crashes if used outside provider
    return { businessType: "restaurant", modules: [], capabilities: undefined, term: genericTerm, currency: "USD", taxRate: 0, timezone: "UTC" }
  }
  return context
}

export function useServicePointTerm() {
  const { term } = useBusinessSettings()
  return term
}
