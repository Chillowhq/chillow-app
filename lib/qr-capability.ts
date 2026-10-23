const QR_CAPABILITY_FRAGMENT_KEY = "c"

function servicePointQrPath(businessId: string, servicePointId: string) {
  return `/q/${encodeURIComponent(businessId)}/${encodeURIComponent(servicePointId)}`
}

export function buildServicePointQrUrl(
  origin: string,
  businessId: string,
  servicePointId: string,
  capability: string,
) {
  const base = origin.replace(/\/$/, "")
  const fragment = new URLSearchParams({
    [QR_CAPABILITY_FRAGMENT_KEY]: capability,
  }).toString()
  return `${base}${servicePointQrPath(businessId, servicePointId)}#${fragment}`
}

export function buildServicePointQrDisplayUrl(
  origin: string,
  businessId: string,
  servicePointId: string,
) {
  return `${origin.replace(/\/$/, "")}${servicePointQrPath(businessId, servicePointId)}`
}

export function readServicePointQrCapability(hash: string) {
  const capability = new URLSearchParams(hash.replace(/^#/, ""))
    .get(QR_CAPABILITY_FRAGMENT_KEY)
    ?.trim()
  return capability || null
}

