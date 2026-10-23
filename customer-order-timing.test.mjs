import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const helperSource = await readFile(
  new URL("./lib/customer-order-progress.ts", import.meta.url),
  "utf8",
)
const transpiledHelper = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const helperModuleUrl = `data:text/javascript;base64,${Buffer.from(
  transpiledHelper,
).toString("base64")}`
const {
  getCustomerOrderPresentation,
  getStationEtaLabels,
} = await import(helperModuleUrl)

function station(overrides = {}) {
  return {
    required: false,
    state: "not_required",
    estimatedReadyAt: null,
    estimateStartedAt: null,
    etaState: "none",
    ...overrides,
  }
}

function progress(overrides = {}) {
  return {
    globalStatus: "in_progress",
    headline: "Your order is in progress.",
    secondaryMessage: null,
    etaMode: "none",
    estimatedReadyAt: null,
    estimateStartedAt: null,
    etaState: "none",
    assistanceAvailable: false,
    assistanceAvailableAt: null,
    assistanceReason: null,
    assistanceStations: [],
    stationContext: {
      food: station(),
      drinks: station(),
    },
    ...overrides,
  }
}

test("an absolute assistance threshold crosses locally without polling or a mutation", () => {
  const projected = progress({
    globalStatus: "placed",
    assistanceAvailableAt: "2026-09-04T12:10:00.000Z",
    assistanceReason: "prepared_fulfillment_not_started",
  })

  assert.equal(
    getCustomerOrderPresentation(projected, Date.parse("2026-09-04T12:09:59.999Z"))
      .assistanceAvailable,
    false,
  )
  assert.equal(
    getCustomerOrderPresentation(projected, Date.parse("2026-09-04T12:10:00.000Z"))
      .assistanceAvailable,
    true,
  )
})

test("overall ETA is visible before expiry and removed at zero", () => {
  const projected = progress({
    etaMode: "overall",
    estimatedReadyAt: "2026-09-04T12:10:00.000Z",
    stationContext: {
      food: station({
        required: true,
        state: "preparing",
        estimatedReadyAt: "2026-09-04T12:10:00.000Z",
      }),
      drinks: station(),
    },
  })

  const before = getCustomerOrderPresentation(
    projected,
    Date.parse("2026-09-04T12:09:59.999Z"),
  )
  assert.equal(before.overallEstimatedReadyAt, "2026-09-04T12:10:00.000Z")
  assert.equal(before.isExtendedPreparation, false)

  const atZero = getCustomerOrderPresentation(
    projected,
    Date.parse("2026-09-04T12:10:00.000Z"),
  )
  assert.equal(atZero.overallEstimatedReadyAt, null)
  assert.equal(atZero.headline, "Still being prepared")
  assert.equal(atZero.secondaryMessage, "Your food is still being prepared.")
})

test("expired station estimates do not clamp to about one minute", () => {
  const projected = progress({
    etaMode: "station",
    stationContext: {
      food: station(),
      drinks: station({
        required: true,
        state: "preparing",
        estimatedReadyAt: "2026-09-04T12:10:00.000Z",
      }),
    },
  })

  assert.deepEqual(
    getStationEtaLabels(projected, Date.parse("2026-09-04T12:09:00.001Z")),
    [{ key: "drinks", label: "Drinks: about 1 min" }],
  )
  assert.deepEqual(
    getStationEtaLabels(projected, Date.parse("2026-09-04T12:10:00.000Z")),
    [],
  )
  const expired = getCustomerOrderPresentation(
    projected,
    Date.parse("2026-09-04T12:10:00.000Z"),
  )
  assert.equal(expired.secondaryMessage, "Your drinks are still being prepared.")
  assert.equal(expired.assistanceAvailable, false)
})

test("mixed elapsed preparation uses mixed copy and a ready transition wins", () => {
  const preparedStation = station({
    required: true,
    state: "preparing",
    estimatedReadyAt: "2026-09-04T12:10:00.000Z",
  })
  const mixed = progress({
    etaMode: "overall",
    estimatedReadyAt: "2026-09-04T12:10:00.000Z",
    stationContext: { food: preparedStation, drinks: preparedStation },
  })
  const now = Date.parse("2026-09-04T12:11:00.000Z")
  assert.equal(
    getCustomerOrderPresentation(mixed, now).secondaryMessage,
    "Your food and drinks are still being prepared.",
  )

  const ready = progress({
    ...mixed,
    globalStatus: "ready",
    headline: "Your order is ready to be served.",
  })
  const readyPresentation = getCustomerOrderPresentation(ready, now)
  assert.equal(readyPresentation.headline, "Your order is ready to be served.")
  assert.equal(readyPresentation.isExtendedPreparation, false)
})

test("customer surfaces consume the shared presentation and delayed-order waiter flow", async () => {
  const [widget, status] = await Promise.all([
    readFile(new URL("./components/order-eta-widget.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/s/[servicePointId]/status/page.tsx", import.meta.url), "utf8"),
  ])

  assert.match(widget, /getCustomerOrderPresentation/)
  assert.match(status, /getCustomerOrderPresentation/)
  assert.match(widget, /encodeURIComponent\("Delayed order"\)/)
  assert.match(widget, />\s*CALL WAITER\s*</)
  assert.ok(widget.indexOf("CALL WAITER") < widget.indexOf("View Order Details"))
})
