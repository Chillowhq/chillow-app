import type {
  InventoryDuplicateSignal,
  InventoryDomain,
  InventoryItem,
  InventoryTrackingUnit,
  InventoryUnit,
} from "@/types/inventory"
import type { InventoryOperationalContext } from "@/types/business-capabilities"

export const INVENTORY_DOMAIN_OPTIONS: Array<{ value: InventoryDomain; label: string }> = [
  { value: "food_service", label: "Food Service" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "guest_supplies", label: "Guest Supplies" },
  { value: "cleaning", label: "Cleaning" },
  { value: "linen", label: "Linen" },
  { value: "general", label: "General" },
]

export const HOTEL_OPERATIONAL_INVENTORY_DOMAINS: InventoryDomain[] = [
  "housekeeping",
  "guest_supplies",
  "cleaning",
  "linen",
  "general",
]

export const INVENTORY_OPERATIONAL_CONTEXTS: Array<{
  value: InventoryOperationalContext
  label: string
}> = [
  { value: "hotelOperations", label: "Hotel Operations" },
  { value: "foodService", label: "Food Service" },
]

type InventoryBusinessContext = {
  businessType?: string
  modules?: string[]
  capabilities?: {
    visibleModules?: string[]
    identity?: { shell?: string }
    inventory?: { contexts?: InventoryOperationalContext[] }
  }
} | null | undefined

export function getInventoryOperationalContexts(context: InventoryBusinessContext) {
  const serverContexts = context?.capabilities?.inventory?.contexts
  if (Array.isArray(serverContexts)) {
    return INVENTORY_OPERATIONAL_CONTEXTS
      .map((option) => option.value)
      .filter((value) => serverContexts.includes(value))
  }

  const modules = context?.capabilities?.visibleModules || context?.modules || []
  const hasLodging = modules.includes("lodging") || context?.capabilities?.identity?.shell === "hotel" || context?.businessType === "hotel"
  const hasFoodService = modules.includes("foodService") || !hasLodging
  return [
    ...(hasLodging ? ["hotelOperations" as const] : []),
    ...(hasFoodService ? ["foodService" as const] : []),
  ]
}

export function isInventoryOperationalContext(value: string | null | undefined): value is InventoryOperationalContext {
  return value === "hotelOperations" || value === "foodService"
}

export function resolveInventoryOperationalContext(
  context: InventoryBusinessContext,
  requested?: string | null,
  preferred?: InventoryOperationalContext,
) {
  const available = getInventoryOperationalContexts(context)
  if (isInventoryOperationalContext(requested) && available.includes(requested)) return requested
  if (preferred && available.includes(preferred)) return preferred
  return available[0] || "foodService"
}

export function getInventoryDomainsForBusiness(
  context: InventoryBusinessContext,
  operationalContext?: InventoryOperationalContext,
) {
  const availableContexts = getInventoryOperationalContexts(context)
  const contexts = operationalContext ? [operationalContext] : availableContexts
  return INVENTORY_DOMAIN_OPTIONS.filter((option) => (
    option.value === "food_service"
      ? contexts.includes("foodService") && availableContexts.includes("foodService")
      : contexts.includes("hotelOperations") && availableContexts.includes("hotelOperations")
  ))
}

export function buildInventoryHref(
  pathname: string,
  operationalContext: InventoryOperationalContext,
  includeContext: boolean,
  params: Record<string, string | null | undefined> = {},
) {
  const query = new URLSearchParams()
  if (includeContext) query.set("context", operationalContext)
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  const serialized = query.toString()
  return serialized ? `${pathname}?${serialized}` : pathname
}

export function getInventoryDomainLabel(domain?: InventoryDomain | null) {
  return INVENTORY_DOMAIN_OPTIONS.find((option) => option.value === (domain || "food_service"))?.label || "Food Service"
}

export type InventoryStockState = "in_stock" | "low_stock" | "out_of_stock"

const UNIT_LABELS: Record<InventoryUnit, { singular: string; plural: string }> = {
  g: { singular: "g", plural: "g" },
  kg: { singular: "kg", plural: "kg" },
  ml: { singular: "ml", plural: "ml" },
  L: { singular: "L", plural: "L" },
  piece: { singular: "piece", plural: "pieces" },
  bottle: { singular: "bottle", plural: "bottles" },
  can: { singular: "can", plural: "cans" },
  pack: { singular: "pack", plural: "packs" },
  portion: { singular: "portion", plural: "portions" },
}

export const INVENTORY_TRACKING_UNIT_OPTIONS: Array<{
  value: InventoryTrackingUnit
  label: string
}> = [
  { value: "g", label: "Grams (g)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "piece", label: "Pieces" },
  { value: "bottle", label: "Bottles" },
  { value: "can", label: "Cans" },
  { value: "pack", label: "Packs" },
  { value: "portion", label: "Portions" },
]

const quantityFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})

export function getInventoryStockState(item: Pick<
  InventoryItem,
  "availableQuantity" | "lowStockThreshold"
>): InventoryStockState {
  if (item.availableQuantity <= 0) return "out_of_stock"
  if (item.availableQuantity <= item.lowStockThreshold) return "low_stock"
  return "in_stock"
}

export function formatInventoryQuantity(quantity: number, unit: InventoryUnit) {
  const unitLabel = quantity === 1 ? UNIT_LABELS[unit].singular : UNIT_LABELS[unit].plural
  return `${quantityFormatter.format(quantity)} ${unitLabel}`
}

export function getCompatibleInventoryUnits(trackingUnit: InventoryTrackingUnit): InventoryUnit[] {
  if (trackingUnit === "g") return ["g", "kg"]
  if (trackingUnit === "ml") return ["ml", "L"]
  return [trackingUnit]
}

export function getInventoryUnitLabel(unit: InventoryUnit) {
  return UNIT_LABELS[unit].plural
}

const UNIT_FACTORS_TO_BASE: Record<InventoryUnit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  L: 1000,
  piece: 1,
  bottle: 1,
  can: 1,
  pack: 1,
  portion: 1,
}

const WEIGHT_UNITS = new Set<InventoryUnit>(["g", "kg"])
const VOLUME_UNITS = new Set<InventoryUnit>(["ml", "L"])

function inventoryUnitDimension(unit: InventoryUnit) {
  if (WEIGHT_UNITS.has(unit)) return "weight"
  if (VOLUME_UNITS.has(unit)) return "volume"
  return `count:${unit}`
}

export function inventoryQuantityToCanonical(
  value: string | number,
  unit: InventoryUnit,
  trackingUnit: InventoryTrackingUnit,
) {
  const raw = String(value).trim()
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/)
  if (!match || (match[2]?.length ?? 0) > 9) {
    throw new Error("Quantity must be a positive decimal with no more than 9 decimal places")
  }
  if (inventoryUnitDimension(unit) !== inventoryUnitDimension(trackingUnit)) {
    throw new Error(`${unit} cannot be converted to ${trackingUnit}`)
  }

  const fraction = match[2] || ""
  const factor = UNIT_FACTORS_TO_BASE[unit] / UNIT_FACTORS_TO_BASE[trackingUnit]
  const factorDigits = factor === 1000 ? 3 : 0
  if (!Number.isSafeInteger(factor) || factor < 1) {
    throw new Error(`${unit} cannot be converted to ${trackingUnit}`)
  }
  if (fraction.slice(factorDigits).split("").some((digit) => digit !== "0")) {
    throw new Error(`Quantity must resolve to a whole ${trackingUnit}`)
  }

  const canonicalText = `${match[1]}${fraction.slice(0, factorDigits).padEnd(factorDigits, "0")}`
    .replace(/^0+(?=\d)/, "")
  const canonicalQuantity = Number(canonicalText)
  if (!Number.isSafeInteger(canonicalQuantity)) {
    throw new Error("Quantity is too large")
  }
  if (canonicalQuantity <= 0) throw new Error("Quantity must be greater than zero")
  return canonicalQuantity
}

function getCurrencyFractionDigits(currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function formatInventoryMoneyMinor(amountMinor: number, currency: string) {
  const exponent = getCurrencyFractionDigits(currency)
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amountMinor / (10 ** exponent))
  } catch {
    return `${(amountMinor / (10 ** exponent)).toFixed(exponent)} ${currency}`
  }
}

export function inventoryCostToInput(amountMinor: number | null, currency: string) {
  if (amountMinor === null) return ""
  const exponent = getCurrencyFractionDigits(currency)
  return (amountMinor / (10 ** exponent)).toFixed(exponent)
}

export function inventoryCostToMinor(value: string, currency: string) {
  const normalized = value.trim()
  if (!normalized) return null
  const normalizedCurrency = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error("Enter a valid three-letter currency code")
  }
  const exponent = getCurrencyFractionDigits(normalizedCurrency)
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/)
  if (!match || (match[2]?.length ?? 0) > exponent) {
    throw new Error(`Enter a valid cost with no more than ${exponent} decimal places`)
  }
  const scale = 10 ** exponent
  const fraction = (match[2] || "").padEnd(exponent, "0")
  const amount = Number(match[1]) * scale + Number(fraction || "0")
  if (!Number.isSafeInteger(amount) || amount > Number.MAX_SAFE_INTEGER) {
    throw new Error("Cost is too large")
  }
  return amount
}

export function getInventoryApiError(error: unknown, fallback: string) {
  const responseError = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof responseError === "string" && responseError.trim() ? responseError : fallback
}

export function getInventoryDuplicateSignal(error: unknown): InventoryDuplicateSignal | null {
  const response = (error as {
    response?: {
      data?: {
        conflictType?: unknown
        candidate?: Partial<InventoryDuplicateSignal["candidate"]>
        canContinue?: unknown
      }
    }
  })?.response?.data
  const candidate = response?.candidate
  if (
    (response?.conflictType !== "strong" && response?.conflictType !== "category_variant") ||
    typeof response.canContinue !== "boolean" ||
    typeof candidate?.inventoryItemId !== "string" ||
    typeof candidate.name !== "string" ||
    !(typeof candidate.category === "string" || candidate.category === null) ||
    typeof candidate.trackingUnit !== "string" ||
    typeof candidate.isActive !== "boolean" ||
    typeof candidate.availableQuantity !== "number"
  ) return null
  return response as InventoryDuplicateSignal
}
