const LOCAL_FRONTEND_ORIGIN = "http://localhost:3000"

export function getCanonicalFrontendOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL
  if (configuredOrigin) return configuredOrigin.trim()

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_FRONTEND_BASE_URL is required in production")
  }

  if (typeof window !== "undefined") return window.location.origin

  return LOCAL_FRONTEND_ORIGIN
}
