import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

async function importTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  )
}

const reasons = await importTypeScriptModule("./lib/waitstaff-request-reasons.ts")
const presentation = await importTypeScriptModule(
  "./lib/waitstaff-request-presentation.ts",
)
const [menuView, card, sheet, hook, eventSourceHook, dedicatedPage, utilityMenu, staffPage, themeProvider, realtimeProvider] =
  await Promise.all([
    readFile(new URL("./components/table-menu-view.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("./components/guest-waitstaff-request-card.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./components/guest-waitstaff-request-sheet.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./hooks/use-waitstaff-request.ts", import.meta.url), "utf8"),
    readFile(new URL("./hooks/use-event-source.ts", import.meta.url), "utf8"),
    readFile(
      new URL("./app/s/[servicePointId]/waitstaff-request/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./components/menu-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/waitstaff/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "./components/providers/customer-theme-provider.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "./components/providers/customer-guest-realtime-provider.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ])

test("the menu sheet exposes only the three approved canonical request reasons", () => {
  assert.deepEqual(
    reasons.MENU_WAITSTAFF_REQUEST_REASONS.map(({ id, menuLabel }) => ({
      id,
      menuLabel,
    })),
    [
      { id: "Customer neeed Assistance", menuLabel: "General assistance" },
      { id: "Bill request", menuLabel: "Bill / payment" },
      { id: "Other reasons", menuLabel: "Something else" },
    ],
  )
  assert.equal(reasons.DEFAULT_WAITSTAFF_REQUEST_REASON, "Customer neeed Assistance")
  assert.equal(reasons.isWaitstaffRequestReasonId("Other reasons"), true)
  assert.equal(reasons.isWaitstaffRequestReasonId("Typed custom reason"), false)
})

test("menu presentation covers recovery, live workflow, failure, and expiry states", () => {
  const base = {
    status: null,
    isRecovering: false,
    hasError: false,
    expiredSession: false,
    resolvedPresentationComplete: false,
  }

  assert.equal(presentation.resolveMenuWaitstaffDisplayState(base), "idle")
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({
      ...base,
      isRecovering: true,
    }),
    "recovering",
  )
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({ ...base, status: "pending" }),
    "pending",
  )
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({
      ...base,
      status: "acknowledged",
    }),
    "acknowledged",
  )
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({ ...base, hasError: true }),
    "error",
  )
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({ ...base, status: "missed" }),
    "missed",
  )
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({
      ...base,
      expiredSession: true,
    }),
    "expired",
  )
  assert.equal(
    presentation.getMenuWaitstaffCopy("acknowledged", "Alex").message,
    "Alex has seen your request.",
  )
  assert.equal(
    presentation.getMenuWaitstaffCopy("acknowledged", "").message,
    "A team member has seen your request.",
  )
  assert.equal(
    presentation.getMenuWaitstaffCopy("idle", "", "Table 60").message,
    "Get assistance at Table 60.",
  )
  assert.equal(presentation.getMenuWaitstaffCopy("idle").title, "Request Waitstaff")
  assert.equal(presentation.getMenuWaitstaffCopy("pending").title, "Waitstaff requested")
  assert.equal(presentation.getMenuWaitstaffCopy("resolved").title, "Request completed")
  assert.equal(presentation.getMenuWaitstaffCopy("missed").action, "Try again")
  assert.equal(presentation.getMenuWaitstaffCopy("error").action, "Try again")
})

test("resolved feedback lasts five seconds and then returns to idle presentation only", () => {
  const resolved = {
    status: "resolved",
    isRecovering: false,
    hasError: false,
    expiredSession: false,
  }

  assert.equal(presentation.MENU_RESOLVED_PRESENTATION_MS, 5_000)
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({
      ...resolved,
      resolvedPresentationComplete: false,
    }),
    "resolved",
  )
  assert.equal(
    presentation.resolveMenuWaitstaffDisplayState({
      ...resolved,
      resolvedPresentationComplete: true,
    }),
    "idle",
  )
  assert.match(card, /window\.setTimeout\([\s\S]*MENU_RESOLVED_PRESENTATION_MS/)
  assert.match(card, /window\.clearTimeout\(timer\)/)
  assert.doesNotMatch(card, /localStorage|sessionStorage/)
})

test("the menu card is capability-gated and occupies the approved menu position", () => {
  const headerPosition = menuView.indexOf("<CustomerHeader")
  const cardPosition = menuView.indexOf("<GuestWaitstaffRequestCard")
  const searchPosition = menuView.indexOf('id="guest-menu-search"')

  assert.ok(headerPosition >= 0 && cardPosition > headerPosition)
  assert.ok(searchPosition > cardPosition)
  assert.match(menuView, /!isWaiterMode && callWaiterEnabled && isOpen/)
  assert.match(card, /data-testid="guest-waitstaff-request-card"/)
  assert.match(card, /aria-live="polite"/)
  assert.match(card, /motion-reduce:/)
})

test("pending menu requests expose the compact countdown while active states retain detail navigation", () => {
  assert.match(card, /countdownProgress/)
  assert.match(card, /h-10 w-10 shrink-0/)
  assert.match(card, /strokeDasharray=\{COUNTDOWN_RING_CIRCUMFERENCE\}/)
  assert.match(card, /strokeDashoffset=\{dashOffset\}/)
  assert.match(card, /Request again available in/)
  assert.match(card, /aria-hidden="true"[\s\S]*\{countdown\}/)
  assert.match(card, /\["pending", "acknowledged"\]\.includes\(displayState\)/)
  assert.match(card, /const showCountdown =\s*displayState === "pending"/)
  assert.match(card, /router\.push\(`\/s\/\$\{servicePointId\}\/waitstaff-request`\)/)
  assert.doesNotMatch(card, />\s*(Cooldown|Wait time|Waiter arriving|Request again timer)\s*</)
  assert.doesNotMatch(hook, /setCountdown\("00:00"\)/)
})

test("the refined service row remains mobile-safe and avoids unsupported arrival claims", () => {
  assert.match(card, /w-full items-center/)
  assert.match(card, /min-w-0 flex-1/)
  assert.match(card, /shrink-0/)
  assert.match(card, /sm:max-w-4xl/)
  assert.match(card, /motion-reduce:transition-none/)
  assert.doesNotMatch(card, /will arrive|waiter arriving/i)
  assert.match(card, /getMenuWaitstaffCopy\(/)
  assert.doesNotMatch(dedicatedPage, /is coming to your table/i)
  assert.match(dedicatedPage, /has seen your request\./)
})

test("the sheet is accessible, mobile-safe, and intentionally has no cancellation or free text", () => {
  assert.match(sheet, /side="bottom"/)
  assert.match(sheet, /env\(safe-area-inset-bottom\)/)
  assert.match(sheet, /aria-pressed=\{selected\}/)
  assert.match(sheet, /onOpenChange=\{onOpenChange\}/)
  assert.match(sheet, /min-h-20/)
  assert.match(sheet, /min-h-14/)
  assert.match(sheet, /disabled=\{isSubmitting\}/)
  assert.match(card, /if \(canOpenRequestSheet\) setSheetOpen\(true\)/)
  assert.match(card, /if \(request\) setSheetOpen\(false\)/)
  assert.doesNotMatch(sheet, /textarea|Cancel request|Cancel Request/)
  assert.doesNotMatch(card, /cancel/i)
})

test("the portalled request sheet receives the canonical customer branding variables", () => {
  assert.match(themeProvider, /themeVars: React\.CSSProperties/)
  assert.match(themeProvider, /value=\{\{ branding, useBranding, themeVars \}\}/)
  assert.match(sheet, /useCustomerTheme\(\)/)
  assert.match(sheet, /style=\{themeVars\}/)
  assert.match(sheet, /var\(--brand-primary/)
  assert.match(sheet, /var\(--brand-muted/)
})

test("one shared provider owns guest waitstaff lifecycle and canonical acknowledgement delivery", () => {
  assert.match(hook, /apiClient\.get\("\/waitstaff\/calls"/)
  assert.match(hook, /apiClient\.post\("\/waitstaff\/calls"/)
  assert.match(hook, /reconcileIncomingCall\(/)
  assert.match(hook, /waiter_call_created/)
  assert.match(hook, /waiter_call_updated/)
  assert.match(hook, /\{ onReconnect: refresh \}/)
  assert.match(eventSourceHook, /document\.addEventListener\("visibilitychange"/)
  assert.match(eventSourceHook, /recoverOnVisibility !== false/)
  assert.match(hook, /requestInFlightRef\.current/)
  assert.match(hook, /getWaiterRequestTimerDeadline\(currentRequest\)/)
  assert.match(hook, /getWaiterRequestTimerStart\(currentRequest\)/)
  assert.match(hook, /Math\.ceil\(remaining \/ 1000\)/)
  assert.match(hook, /isTableSessionValid\(servicePointId\)/)
  assert.match(hook, /mountedRef\.current = false/)
  assert.match(hook, /currentVisitCalls/)
  assert.match(hook, /reportCurrentVisitCalls\(response\.currentVisitCalls, "recovery"\)/)
  assert.match(hook, /reportCurrentVisitCalls\(data\.call, "sse"\)/)
  assert.match(realtimeProvider, /useCustomerNotifications\(\)/)
  assert.match(realtimeProvider, /useWaitstaffRequest\(\{/)
  assert.match(realtimeProvider, /onWaitstaffRoute \|\| keepWaitstaffActive/)
  assert.match(realtimeProvider, /key=\{runtimeKey\}/)
  assert.match(card, /useCustomerGuestRealtime\(\)\.waitstaff/)
  assert.doesNotMatch(card, /acknowledgementTransitionKey|acknowledgedToastKeysRef|sonner/)
  assert.match(dedicatedPage, /useCustomerGuestRealtime\(\)\.waitstaff/)
  assert.doesNotMatch(dedicatedPage, /acknowledgementTransitionKey|acknowledgedToastKeysRef|sonner/)
  assert.doesNotMatch(dedicatedPage, /apiClient|useEventSource|reconcileIncomingCall/)
})

test("the existing utility-menu link remains available and staff uses canonical label fallback", () => {
  assert.match(
    utilityMenu,
    /href=\{`\/s\/\$\{servicePointId\}\/waitstaff-request`\}[\s\S]*Request Waitstaff/,
  )
  assert.match(
    staffPage,
    /c\.displayLabel \|\|[\s\S]*servicePointMap\.get\(c\.servicePointId\)[\s\S]*c\.servicePointQrCode/,
  )
})
