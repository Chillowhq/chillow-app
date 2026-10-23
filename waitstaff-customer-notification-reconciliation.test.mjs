import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

async function importTypeScriptModule(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
}

const reconciliationSource = await readFile(
  new URL("./lib/waitstaff-request-reconciliation.ts", import.meta.url),
  "utf8",
)
const reconciliationModuleUrl = await importTypeScriptModule(reconciliationSource)
const notificationSource = await readFile(
  new URL("./lib/waitstaff-customer-notification-reconciliation.ts", import.meta.url),
  "utf8",
)
const notificationModuleUrl = await importTypeScriptModule(
  notificationSource.replace(
    /from "@\/lib\/waitstaff-request-reconciliation"/,
    `from "${reconciliationModuleUrl}"`,
  ),
)
const { deriveWaitstaffAcknowledgementNotificationEvents } = await import(
  notificationModuleUrl,
)

const context = {
  businessId: "business-1",
  servicePointId: "sp-1",
}
const acknowledgedCall = {
  _id: "call-1",
  businessId: context.businessId,
  servicePointId: context.servicePointId,
  status: "acknowledged",
  acknowledgedAt: "2026-10-09T10:01:00.000Z",
  acknowledgedByName: "Sarah",
  createdAt: "2026-10-09T10:00:00.000Z",
}

test("an acknowledged current-visit call produces a stable canonical notification event", () => {
  const events = deriveWaitstaffAcknowledgementNotificationEvents(
    acknowledgedCall,
    context,
  )

  assert.equal(events.length, 1)
  assert.equal(
    events[0].eventId,
    "call-1:WAITER_ACKNOWLEDGED:2026-10-09T10:01:00.000Z",
  )
  assert.equal(events[0].eventType, "WAITER_ACKNOWLEDGED")
  assert.equal(events[0].call.acknowledgedByName, "Sarah")
})

test("terminal, malformed, and out-of-context calls never create acknowledgement events", () => {
  assert.deepEqual(
    deriveWaitstaffAcknowledgementNotificationEvents(
      { ...acknowledgedCall, status: "resolved" },
      context,
    ),
    [],
  )
  assert.deepEqual(
    deriveWaitstaffAcknowledgementNotificationEvents(
      { ...acknowledgedCall, acknowledgedAt: null },
      context,
    ),
    [],
  )
  assert.deepEqual(
    deriveWaitstaffAcknowledgementNotificationEvents(
      { ...acknowledgedCall, businessId: "business-2" },
      context,
    ),
    [],
  )
})

test("recovery batches remain deterministic for persisted-event deduplication", () => {
  const laterCall = {
    ...acknowledgedCall,
    _id: "call-2",
    acknowledgedAt: "2026-10-09T10:02:00.000Z",
  }

  const events = deriveWaitstaffAcknowledgementNotificationEvents(
    [laterCall, acknowledgedCall, { ...acknowledgedCall, status: "missed" }],
    context,
  )

  assert.deepEqual(events.map((event) => event.eventId), [
    "call-1:WAITER_ACKNOWLEDGED:2026-10-09T10:01:00.000Z",
    "call-2:WAITER_ACKNOWLEDGED:2026-10-09T10:02:00.000Z",
  ])
})
