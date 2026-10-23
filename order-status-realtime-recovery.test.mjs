import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const statusPageUrl = new URL("./app/s/[servicePointId]/status/page.tsx", import.meta.url)

test("order status uses one canonical fetch callback for initial load and recovery", async () => {
  const page = await readFile(statusPageUrl, "utf8")

  assert.match(page, /import \{ useCallback, useEffect, useState \} from "react"/)
  assert.match(page, /const fetchOrder = useCallback\(async \(\) =>/)
  assert.match(page, /void fetchOrder\(\)/)
  assert.match(page, /apiClient\.get\(`\/orders\/\$\{encodeURIComponent\(orderId\)\}`/)
})

test("order status refetches after SSE reconnect and visibility recovery", async () => {
  const page = await readFile(statusPageUrl, "utf8")

  assert.match(
    page,
    /useEventSource\([\s\S]*?sseUrl,[\s\S]*?\{ onReconnect: fetchOrder \},[\s\S]*?\)/,
  )
})

test("recovery fetch preserves current-visit authorization and history separation", async () => {
  const page = await readFile(statusPageUrl, "utf8")

  assert.match(page, /scope: isHistoricalView \? "history" : "current"/)
  assert.match(page, /"x-table-session-token": tableSessionToken/)
  assert.match(page, /const sseUrl = !isHistoricalView/)
})
