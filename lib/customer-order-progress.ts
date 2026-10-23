export type CustomerStationProgress = {
  required: boolean
  state: "not_required" | "waiting" | "preparing" | "ready"
  hasReady?: boolean
  startedAt?: string | null
  readyAt?: string | null
  estimatedReadyAt: string | null
  estimateStartedAt: string | null
  etaState?: "none" | "active" | "extended"
}

export type CustomerOrderProgress = {
  globalStatus: string
  headline: string
  secondaryMessage: string | null
  etaMode: "none" | "station" | "overall"
  estimatedReadyAt: string | null
  estimateStartedAt: string | null
  etaState?: "none" | "active" | "extended"
  assistanceAvailable?: boolean
  assistanceAvailableAt?: string | null
  assistanceReason?: string | null
  assistanceStations?: Array<"kitchen" | "bar">
  stationContext: {
    food: CustomerStationProgress
    drinks: CustomerStationProgress
  }
}

type CustomerProgressOrder = {
  status?: string
  customerProgress?: CustomerOrderProgress | null
  customerStatusMessage?: string | null
}

const EMPTY_STATION: CustomerStationProgress = {
  required: false,
  state: "not_required",
  estimatedReadyAt: null,
  estimateStartedAt: null,
  etaState: "none",
}

const TERMINAL_STATUSES = new Set(["ready", "completed", "cancelled", "served"])

function fallbackHeadline(status?: string) {
  switch (status) {
    case "cancelled": return "This order was cancelled."
    case "completed": return "Your order has been served."
    case "ready": return "Your order is ready to be served."
    case "in_progress": return "Your order is in progress."
    default: return "Your order is confirmed."
  }
}

/**
 * Reads the backend-authoritative customer projection. The fallback is only
 * for stale locally-cached DTOs and deliberately does not invent an ETA.
 */
export function getCustomerOrderProgress(order: CustomerProgressOrder): CustomerOrderProgress {
  const status = order.status || "placed"
  if (order.customerProgress?.headline) {
    const projected = {
      ...order.customerProgress,
      etaState: order.customerProgress.etaState || "none",
      assistanceAvailable: order.customerProgress.assistanceAvailable === true,
      assistanceAvailableAt: order.customerProgress.assistanceAvailableAt || null,
      assistanceReason: order.customerProgress.assistanceReason || null,
      assistanceStations: order.customerProgress.assistanceStations || [],
    }
    if (status !== "placed") return projected
    return {
      ...projected,
      globalStatus: "placed",
      headline: "Your order is confirmed.",
      secondaryMessage: projected.secondaryMessage || "Waiting for preparation to begin.",
    }
  }

  return {
    globalStatus: status,
    headline: status === "placed"
      ? "Your order is confirmed."
      : order.customerStatusMessage || fallbackHeadline(status),
    secondaryMessage: status === "placed" ? "Waiting for preparation to begin." : null,
    etaMode: "none",
    estimatedReadyAt: null,
    estimateStartedAt: null,
    etaState: "none",
    assistanceAvailable: false,
    assistanceAvailableAt: null,
    assistanceReason: null,
    assistanceStations: [],
    stationContext: {
      food: EMPTY_STATION,
      drinks: EMPTY_STATION,
    },
  }
}

export function getStationEtaLabels(progress: CustomerOrderProgress, nowMs = Date.now()) {
  if (progress.etaMode !== "station") return []

  return ([
    ["food", "Food", progress.stationContext.food],
    ["drinks", "Drinks", progress.stationContext.drinks],
  ] as const).flatMap(([key, label, station]) => {
    const readyAtMs = Date.parse(station.estimatedReadyAt || "")
    if (!Number.isFinite(readyAtMs) || readyAtMs <= nowMs) return []
    const minutes = Math.ceil((readyAtMs - nowMs) / 60_000)
    return [{ key, label: `${label}: about ${minutes} min` }]
  })
}

function extendedPreparationCopy(progress: CustomerOrderProgress, nowMs: number) {
  const hasElapsedEstimate = (station: CustomerStationProgress) => {
    const readyAtMs = Date.parse(station.estimatedReadyAt || "")
    return station.state === "preparing" &&
      Number.isFinite(readyAtMs) &&
      readyAtMs <= nowMs
  }
  const foodExtended = hasElapsedEstimate(progress.stationContext.food)
  const drinksExtended = hasElapsedEstimate(progress.stationContext.drinks)

  if (foodExtended && drinksExtended) {
    return "Your food and drinks are still being prepared."
  }
  if (foodExtended) return "Your food is still being prepared."
  if (drinksExtended) return "Your drinks are still being prepared."
  return null
}

export function getCustomerOrderPresentation(
  progress: CustomerOrderProgress,
  nowMs = Date.now(),
) {
  const extendedMessage = ["in_progress", "preparing"].includes(progress.globalStatus)
    ? extendedPreparationCopy(progress, nowMs)
    : null
  const overallReadyAtMs = Date.parse(progress.estimatedReadyAt || "")
  const overallEstimatedReadyAt =
    progress.etaMode === "overall" &&
    !extendedMessage &&
    Number.isFinite(overallReadyAtMs) &&
    overallReadyAtMs > nowMs
      ? progress.estimatedReadyAt
      : null
  const assistanceAvailableAtMs = Date.parse(
    progress.assistanceAvailableAt || "",
  )
  const assistanceAvailable =
    !TERMINAL_STATUSES.has(progress.globalStatus) &&
    progress.assistanceReason === "prepared_fulfillment_not_started" &&
    (
      progress.assistanceAvailable === true ||
      (
        Number.isFinite(assistanceAvailableAtMs) &&
        assistanceAvailableAtMs <= nowMs
      )
    )

  return {
    headline: extendedMessage ? "Still being prepared" : progress.headline,
    secondaryMessage: extendedMessage || progress.secondaryMessage,
    isExtendedPreparation: !!extendedMessage,
    overallEstimatedReadyAt,
    stationEtas: getStationEtaLabels(progress, nowMs),
    assistanceAvailable,
  }
}
