import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const reconciliationSource = await readFile(
  new URL("./lib/waitstaff-request-reconciliation.ts", import.meta.url),
  "utf8",
)
const transpiledReconciliation = ts.transpileModule(reconciliationSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const reconciliationModuleUrl = `data:text/javascript;base64,${Buffer.from(
  transpiledReconciliation,
).toString("base64")}`
const {
  getWaiterRequestTimerDeadline,
  getWaiterRequestTimerStart,
  isServiceRequestForContext,
  reconcileIncomingCall,
} = await import(reconciliationModuleUrl)

const context = {
  businessId: "business-1",
  servicePointId: "sp-1",
}

const pendingCall = {
  _id: "call-1",
  businessId: context.businessId,
  servicePointId: context.servicePointId,
  servicePointLabel: "Table 1",
  status: "pending",
  createdAt: "2026-08-04T10:00:00.000Z",
  updatedAt: "2026-08-04T10:00:00.000Z",
  pendingExpiresAt: "2026-08-04T10:03:00.000Z",
}

test("POST success establishes the authoritative active request", () => {
  const active = reconcileIncomingCall(null, pendingCall, context)
  assert.equal(active?._id, pendingCall._id)
  assert.equal(active?.status, "pending")
})

test("empty and stale fetches preserve a confirmed active request", () => {
  assert.strictEqual(
    reconcileIncomingCall(pendingCall, [], context),
    pendingCall,
  )
  assert.strictEqual(
    reconcileIncomingCall(pendingCall, null, context),
    pendingCall,
  )

  const stalePending = {
    ...pendingCall,
    updatedAt: "2026-08-04T09:59:00.000Z",
  }
  assert.strictEqual(
    reconcileIncomingCall(pendingCall, [stalePending], context),
    pendingCall,
  )
})

test("duplicate SSE events are idempotent and retain the timer deadline", () => {
  const duplicate = reconcileIncomingCall(
    pendingCall,
    { ...pendingCall },
    context,
  )
  assert.strictEqual(duplicate, pendingCall)
  assert.equal(
    getWaiterRequestTimerDeadline(duplicate),
    pendingCall.pendingExpiresAt,
  )
  assert.equal(getWaiterRequestTimerStart(duplicate), pendingCall.createdAt)
})

test("acknowledgement and resolution merge without a late pending regression", () => {
  const acknowledged = reconcileIncomingCall(
    pendingCall,
    {
      ...pendingCall,
      status: "acknowledged",
      updatedAt: "2026-08-04T10:01:00.000Z",
      acknowledgedExpiresAt: "2026-08-04T10:11:00.000Z",
    },
    context,
  )
  assert.equal(acknowledged?.status, "acknowledged")
  assert.equal(acknowledged?.pendingExpiresAt, null)

  const lateCreate = reconcileIncomingCall(
    acknowledged,
    pendingCall,
    context,
  )
  assert.strictEqual(lateCreate, acknowledged)

  const resolved = reconcileIncomingCall(
    lateCreate,
    {
      ...pendingCall,
      status: "resolved",
      updatedAt: "2026-08-04T10:02:00.000Z",
      resolvedAt: "2026-08-04T10:02:00.000Z",
    },
    context,
  )
  assert.equal(resolved?.status, "resolved")
})

test("acknowledged requests remain active within their fresh expiry window", () => {
  const acknowledged = {
    ...pendingCall,
    status: "acknowledged",
    updatedAt: "2026-08-04T10:01:00.000Z",
    pendingExpiresAt: null,
    acknowledgedExpiresAt: "2026-08-04T10:11:00.000Z",
  }
  assert.equal(
    reconcileIncomingCall(
      null,
      [acknowledged],
      context,
      Date.parse("2026-08-04T10:05:00.000Z"),
    )?.status,
    "acknowledged",
  )
  assert.equal(
    getWaiterRequestTimerDeadline(acknowledged),
    acknowledged.acknowledgedExpiresAt,
  )
  assert.equal(
    getWaiterRequestTimerStart(acknowledged),
    acknowledged.acknowledgedAt || acknowledged.updatedAt,
  )
})

test("an acknowledged request is cleared after its expiry when refresh has no active call", () => {
  const acknowledged = {
    ...pendingCall,
    status: "acknowledged",
    updatedAt: "2026-08-04T10:01:00.000Z",
    pendingExpiresAt: null,
    acknowledgedExpiresAt: "2026-08-04T10:11:00.000Z",
  }
  assert.equal(
    reconcileIncomingCall(
      acknowledged,
      [],
      context,
      Date.parse("2026-08-04T10:12:00.000Z"),
    ),
    null,
  )
})

test("waitstaff dashboard mirrors acknowledged expiry through the existing missed state", async () => {
  const waiterPage = await readFile(
    new URL("./app/waitstaff/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(waiterPage, /c\.status === "acknowledged"/)
  assert.match(waiterPage, /c\.acknowledgedExpiresAt/)
  assert.match(waiterPage, /status: "missed"/)
})

test("a fetched terminal status is authoritative for the same request", () => {
  const missed = {
    ...pendingCall,
    status: "missed",
    updatedAt: "2026-08-04T10:03:00.000Z",
    missedAt: "2026-08-04T10:03:00.000Z",
  }
  assert.equal(
    reconcileIncomingCall(pendingCall, [missed], context)?.status,
    "missed",
  )
})

test("request identity requires _id, businessId, and servicePointId", () => {
  assert.equal(isServiceRequestForContext(pendingCall, context), true)
  assert.strictEqual(
    reconcileIncomingCall(
      pendingCall,
      { ...pendingCall, businessId: "business-2" },
      context,
    ),
    pendingCall,
  )
  assert.strictEqual(
    reconcileIncomingCall(
      pendingCall,
      { ...pendingCall, servicePointId: "sp-2" },
      context,
    ),
    pendingCall,
  )
})

test("a newer request replaces a terminal request for the same canonical scope", () => {
  const resolved = {
    ...pendingCall,
    status: "resolved",
    resolvedAt: "2026-08-04T10:02:00.000Z",
  }
  const newer = {
    ...pendingCall,
    _id: "call-2",
    createdAt: "2026-08-04T10:04:00.000Z",
    updatedAt: "2026-08-04T10:04:00.000Z",
    pendingExpiresAt: "2026-08-04T10:07:00.000Z",
  }
  assert.equal(reconcileIncomingCall(resolved, newer, context)?._id, "call-2")
})

test("the shared provider owns reconciliation and the timer never invents request state", async () => {
  const [page, hook, provider] = await Promise.all([
    readFile(
      new URL("./app/s/[servicePointId]/waitstaff-request/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./hooks/use-waitstaff-request.ts", import.meta.url), "utf8"),
    readFile(
      new URL("./components/providers/customer-guest-realtime-provider.tsx", import.meta.url),
      "utf8",
    ),
  ])

  assert.match(page, /useCustomerGuestRealtime\(\)\.waitstaff/)
  assert.doesNotMatch(page, /apiClient|useEventSource|reconcileIncomingCall/)
  assert.match(page, /data-testid="waitstaff-request-dialog"/)
  assert.match(hook, /reconcileIncomingCall\(/)
  assert.match(hook, /applyIncomingRequest\(response\.calls\)/)
  assert.match(hook, /applyIncomingRequest\(data\.call\)/)
  assert.match(hook, /requestInFlightRef\.current/)
  assert.match(hook, /getWaiterRequestTimerDeadline\(currentRequest\)/)
  assert.match(hook, /expiryRefreshDeadlineRef\.current/)
  assert.doesNotMatch(hook, /setCurrentRequest\(null\)[\s\S]{0,700}remaining <= 0/)
  assert.match(provider, /useWaitstaffRequest\(\{/)
  assert.match(provider, /useCustomerNotifications\(\)/)
  assert.match(provider, /refreshGuestVisit/)
  assert.doesNotMatch(page, /acknowledgementTransitionKey|acknowledgedToastKeysRef|sonner/)
  assert.match(page, /has seen your request\./)
  assert.doesNotMatch(page, /useCustomerNotifications/)
})

test("staff recovery uses one guarded authoritative reconciliation request", async () => {
  const staffPage = await readFile(
    new URL("./app/waitstaff/page.tsx", import.meta.url),
    "utf8",
  )

  assert.match(staffPage, /onReconnect:\s*reconcileCalls/)
  assert.match(staffPage, /callsReconciliationInFlightRef/)
  assert.match(staffPage, /callsRevisionAtStart/)
  assert.match(staffPage, /callsRevisionRef\.current !== callsRevisionAtStart/)
  assert.match(staffPage, /const reconciliation = fetchCalls\(\)/)
  assert.match(staffPage, /callsScopeRef\.current !== callsScopeAtStart/)
})
