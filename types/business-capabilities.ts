export type BusinessModule = "lodging" | "foodService"
export type InventoryOperationalContext = "hotelOperations" | "foodService"
export type BusinessShell = "restaurant" | "hotel"
export type ReservationMode = "timeslot" | "stay"
export type ServicePointType = "table" | "room" | "booth" | "other"

export type ServicePointTerminology = {
  singular: string
  plural: string
  lower: string
  lowerPlural: string
}

export type CapabilityNavigationGroup = {
  id: string
  label: string
  items: string[]
}

export type BusinessCapabilities = {
  version: number
  identity: {
    businessType: string
    venueType: string | null
    venueLabel: string | null
    shell: BusinessShell
  }
  visibleModules: BusinessModule[]
  navigation: {
    shell: BusinessShell
    groups: CapabilityNavigationGroup[]
  }
  dashboard: {
    shell: BusinessShell
    sections: string[]
  }
  reservations: {
    modes: ReservationMode[]
    primaryMode: ReservationMode
  }
  servicePoints: {
    allowedTypes: ServicePointType[]
    defaultType: ServicePointType
  }
  terminology: {
    servicePoint: ServicePointTerminology
  }
  settings: {
    sections: string[]
  }
  analytics: {
    sections: string[]
  }
  inventory: {
    contexts: InventoryOperationalContext[]
  }
}

export type BusinessCapabilityContract = {
  businessType?: string
  venueType?: string | null
  modules?: BusinessModule[]
  capabilities?: BusinessCapabilities
}
