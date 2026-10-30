import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("mobile owner navigation has an accessible Sheet title and description", async () => {
  const layout = await read("./app/owner/layout.tsx")

  assert.match(layout, /SheetHeader/)
  assert.match(layout, /<SheetTitle>Owner navigation<\/SheetTitle>/)
  assert.match(layout, /<SheetDescription>Navigate the Chillow owner workspace\.<\/SheetDescription>/)
})

test("billing tabs expose selected state, panel relationships, and keyboard navigation", async () => {
  const page = await read("./app/owner/billing/page.tsx")

  assert.match(page, /role="tablist"/)
  assert.match(page, /role="tab"/)
  assert.match(page, /aria-selected=\{activeTab === tab\.id\}/)
  assert.match(page, /aria-controls=\{billingPanelId\(tab\.id\)\}/)
  assert.match(page, /role="tabpanel"/)
  assert.match(page, /aria-labelledby=\{billingTabId\(/)
  assert.match(page, /handleBillingTabKeyDown/)
  assert.match(page, /case "ArrowRight"/)
  assert.match(page, /case "ArrowLeft"/)
  assert.match(page, /focus-visible:ring-2/)
})

test("subscription invoices and offline commission invoices have distinct descriptions", async () => {
  const page = await read("./app/owner/billing/page.tsx")
  const commissions = await read("./components/owner/billing/OfflineCommissionsSection.tsx")

  assert.match(page, /Subscription and platform billing records issued to your business\./)
  assert.doesNotMatch(page, /Past platform commission invoices/)
  assert.match(commissions, /Standalone offline commission invoices and collection states\./)
  assert.match(commissions, /min-w-0/)
  assert.match(commissions, /break-words/)
})
