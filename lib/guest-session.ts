import { v4 as uuid } from "uuid"

const SESSION_KEY = "qs_session_id"
const tokenKey = (servicePointId: string) => `qs_gs_${servicePointId}`

type StoredTableToken = {
  token: string
  expiresAt?: string | null
  savedAt?: number
  sessionInstanceId: string
  journeyId?: string | null
}

// device session (order history identity)
export function ensureSessionId() {
  if (typeof window === "undefined") return null

  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// table session token (QR presence proof) stored with backend-provided expiry.
// Each successful table-session start is a NEW session instance and gets its
// own sessionInstanceId. This id is the source of truth for session-scoped
// persistence (e.g. customer notifications) so state from an old QR scan can
// never leak into a later scan of the same service point.
export function saveTableToken(
  servicePointId: string,
  st: string,
  expiresAt?: string | null,
  journeyId?: string | null,
) {
  if (typeof window === "undefined") return
  const entry = JSON.stringify({
    token: st,
    expiresAt: expiresAt ?? null,
    savedAt: Date.now(),
    sessionInstanceId: uuid(),
    journeyId: journeyId ?? null,
  })
  sessionStorage.setItem(tokenKey(servicePointId), entry)
}

export function saveJourneyForTable(servicePointId: string, journeyId: string) {
  if (typeof window === "undefined") return
  const raw = sessionStorage.getItem(tokenKey(servicePointId))
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as StoredTableToken
    if (!parsed || typeof parsed !== "object" || typeof parsed.token !== "string") return
    sessionStorage.setItem(
      tokenKey(servicePointId),
      JSON.stringify({ ...parsed, journeyId }),
    )
  } catch {
    // Legacy plain-token entries cannot safely carry journey metadata.
  }
}

export function clearJourneyForTable(servicePointId: string) {
  if (typeof window === "undefined") return
  const raw = sessionStorage.getItem(tokenKey(servicePointId))
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as StoredTableToken
    if (!parsed || typeof parsed !== "object" || typeof parsed.token !== "string") return
    sessionStorage.setItem(
      tokenKey(servicePointId),
      JSON.stringify({ ...parsed, journeyId: null }),
    )
  } catch {
    // Legacy plain-token entries have no journey metadata to clear.
  }
}

export function getJourneyId(servicePointId: string): string | null {
  if (typeof window === "undefined") return null
  if (!getTableToken(servicePointId)) return null

  const raw = sessionStorage.getItem(tokenKey(servicePointId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredTableToken
    return typeof parsed?.journeyId === "string" ? parsed.journeyId : null
  } catch {
    return null
  }
}

/**
 * Returns the raw token string if the session is still valid, or null if it
 * is absent or has exceeded the backend-provided expiresAt.
 * Legacy values without expiresAt are handed back to the backend for validation.
 */
export function getTableToken(servicePointId: string): string | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(tokenKey(servicePointId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredTableToken
    if (parsed && typeof parsed === "object" && typeof parsed.token === "string") {
      if (parsed.expiresAt) {
        const expiresAtMs = Date.parse(parsed.expiresAt)
        if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
          sessionStorage.removeItem(tokenKey(servicePointId))
          return null
        }
      }

      if (!parsed.token.trim()) {
        sessionStorage.removeItem(tokenKey(servicePointId))
        return null
      }

      return parsed.token
    }
  } catch {
    // Legacy format: plain token string. Let the backend remain authoritative.
    return raw
  }

  return null
}

/**
 * Returns the sessionInstanceId for the current table session, or null if
 * the session is absent or expired. This id is regenerated on every successful
 * QR scan (saveTableToken) and is the canonical scope for session-bound
 * persisted state such as customer notifications.
 */
export function getSessionInstanceId(servicePointId: string): string | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(tokenKey(servicePointId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredTableToken
    if (parsed && typeof parsed === "object" && parsed.sessionInstanceId) {
      // Also validate expiry so we don't return an id for an expired session
      if (parsed.expiresAt) {
        const expiresAtMs = Date.parse(parsed.expiresAt)
        if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
          return null
        }
      }
      return parsed.sessionInstanceId
    }
  } catch {
    // Legacy format — no sessionInstanceId
  }
  return null
}

/**
 * Returns true if the device has a non-expired table token for the given servicePointId.
 * Use this everywhere a session validity check is needed.
 */
export function isTableSessionValid(servicePointId: string): boolean {
  return !!getTableToken(servicePointId)
}

export function clearTableToken(servicePointId: string) {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(tokenKey(servicePointId))
}

export function clearDeviceSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_KEY)
}

// business identity for the current QR session
const BUSINESS_KEY = "qs_business_id"

export function saveBusinessId(businessId: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(BUSINESS_KEY, businessId)
}

export function getStoredBusinessId(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(BUSINESS_KEY)
}

export function clearAllTableTokens() {
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith("qs_gs_")) {
      sessionStorage.removeItem(key)
    }
  })
}

// Service point label persisted so child pages (/order, /confirmation etc.) can show it
const SP_LABEL_KEY = "qs_sp_label"

export function saveServicePointLabel(label: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SP_LABEL_KEY, label)
}

export function getServicePointLabel(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(SP_LABEL_KEY)
}
