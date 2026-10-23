import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const ownerHook = await readFile(
  new URL("./hooks/use-owner-analytics.ts", import.meta.url),
  "utf8",
)
const crmHook = await readFile(
  new URL("./hooks/use-crm-analytics.ts", import.meta.url),
  "utf8",
)
const returnRefreshHook = await readFile(
  new URL("./hooks/use-analytics-return-refresh.ts", import.meta.url),
  "utf8",
)
const refreshControl = await readFile(
  new URL(
    "./components/analytics/shared/AnalyticsRefreshControl.tsx",
    import.meta.url,
  ),
  "utf8",
)
const analyticsHeader = await readFile(
  new URL("./components/analytics/shared/AnalyticsHeader.tsx", import.meta.url),
  "utf8",
)
const crmOverview = await readFile(
  new URL("./components/owner/crm/CrmOverview.tsx", import.meta.url),
  "utf8",
)

test("Owner and CRM analytics have no repeating polling or Analytics SSE", () => {
  for (const source of [ownerHook, crmHook, returnRefreshHook]) {
    assert.doesNotMatch(source, /setInterval/)
    assert.doesNotMatch(source, /clearInterval/)
    assert.doesNotMatch(source, /pollingIntervalMs/)
    assert.doesNotMatch(source, /useEventSource|analytics_changed/)
  }
})

test("initial and filter loads retain the authoritative Analytics endpoints and ranges", () => {
  assert.match(ownerHook, /`\/owner\/analytics\?\$\{queryParams\.toString\(\)\}`/)
  assert.match(crmHook, /`\/owner\/guests\/analytics\?\$\{queryParams\.toString\(\)\}`/)
  for (const source of [ownerHook, crmHook]) {
    assert.match(source, /new URLSearchParams\(\{\s*range[\s,}]/)
    assert.match(source, /queryParams\.set\("from", customRange\.from\)/)
    assert.match(source, /queryParams\.set\("to", customRange\.to\)/)
    assert.match(source, /loadedKeyRef\.current === requestKey/)
    assert.match(source, /window\.setTimeout\(\(\) => \{\s*void fetchAnalytics\(\)\s*\}, 0\)/)
  }
})

test("visibility and focus recovery coalesce into one stale return refresh", () => {
  assert.match(returnRefreshHook, /ANALYTICS_RETURN_STALE_MS = 30 \* 1000/)
  assert.match(returnRefreshHook, /ANALYTICS_RETURN_DEBOUNCE_MS = 300/)
  assert.match(returnRefreshHook, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/)
  assert.match(returnRefreshHook, /window\.addEventListener\("blur", markInactive\)/)
  assert.match(returnRefreshHook, /window\.addEventListener\("focus", refreshIfStale\)/)
  assert.match(returnRefreshHook, /inactiveAtRef\.current = null/)
  assert.match(returnRefreshHook, /void refreshRef\.current\(\)/)
  assert.doesNotMatch(returnRefreshHook, /setInterval/)
})

test("manual refresh is visible and duplicate concurrent requests are rejected", () => {
  for (const source of [ownerHook, crmHook]) {
    assert.match(source, /if \(inFlightKeyRef\.current === requestKey\) return/)
    assert.match(source, /inFlightKeyRef\.current = requestKey/)
    assert.match(source, /setRefreshing\(true\)/)
    assert.match(source, /setRefreshing\(false\)/)
  }
  assert.match(analyticsHeader, /<AnalyticsRefreshControl/)
  assert.match(crmOverview, /<AnalyticsRefreshControl/)
  assert.match(refreshControl, /disabled=\{refreshing\}/)
  assert.match(refreshControl, /refreshing \? "Refreshing" : "Refresh"/)
})

test("freshness records successful retrieval time and failed refreshes retain prior data", () => {
  for (const source of [ownerHook, crmHook]) {
    assert.match(source, /setData\(response\.data\)\s*setLastUpdated\(new Date\(\)\)/)
    assert.doesNotMatch(source, /setLastUpdated\(new Date\(response\.data\.generatedAt\)\)/)
    assert.doesNotMatch(source, /setData\(null\)/)
  }
  assert.match(refreshControl, />Updated</)
  assert.match(refreshControl, /formatTime\(lastUpdated, timezone\)/)
  assert.match(crmOverview, /compact=\{Boolean\(data\)\}/)
  assert.match(crmOverview, /\{data \? \(/)
})
