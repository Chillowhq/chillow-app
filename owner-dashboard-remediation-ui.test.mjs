import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("feedback and branding surfaces do not invent owner-facing business data", async () => {
  const [feedback, branding] = await Promise.all([
    source("./app/owner/feedback/page.tsx"),
    source("./app/owner/branding/page.tsx"),
  ])

  assert.match(feedback, /Automated theme analysis is not enabled\./)
  assert.doesNotMatch(feedback, /amazing pasta|friendly staff|long waits/i)
  assert.match(branding, /preview\.menuItem/)
  assert.match(branding, /preview\.businessName/)
  assert.doesNotMatch(branding, /Signature Burger|\$14\.99/)
})

test("owner data tables provide mobile card layouts", async () => {
  for (const path of [
    "./app/owner/orders/page.tsx",
    "./app/owner/transactions/page.tsx",
    "./app/owner/service-points/page.tsx",
  ]) {
    const page = await source(path)
    assert.match(page, /hidden[^"\n]*lg:block/)
    assert.match(page, /lg:hidden/)
  }
})

test("order details use authoritative monetary fields", async () => {
  const details = await source("./components/orders/OwnerOrderDetailsSheet.tsx")

  assert.match(details, /order\.subtotal/)
  assert.match(details, /order\.taxAmount/)
  assert.match(details, /order\.platformFeeTotal/)
  assert.match(details, /order\.tipAmount/)
  assert.match(details, /order\.total/)
})

test("inventory dialogs retain reachable close actions", async () => {
  const [sheet, recipe] = await Promise.all([
    source("./components/ui/sheet.tsx"),
    source("./components/owner/inventory/RecipeBuilderDialog.tsx"),
  ])

  assert.match(sheet, /SheetPrimitive\.Close[^>]*className="[^"]*z-20/)
  assert.match(recipe, /<DialogClose asChild>[\s\S]*?Cancel[\s\S]*?<\/DialogClose>/)
})

test("reservation lists use explicit date ordering without a client-authored business date", async () => {
  const dashboard = await source("./components/reservations/dashboard/useReservationDashboard.ts")

  assert.match(dashboard, /useState<"createdAt" \| "checkInDate">\("checkInDate"\)/)
  assert.match(dashboard, /useState<"desc" \| "asc">\("desc"\)/)
  assert.doesNotMatch(dashboard, /params\.set\("clientToday"/)
  assert.match(dashboard, /new Intl\.DateTimeFormat\("en-US", \{[\s\S]*?timeZone: timezone/)
})

test("CRM explains its distinct journey and confirmed-visit populations", async () => {
  const crm = await source("./components/owner/crm/CrmOverview.tsx")

  assert.match(crm, /Ordering journeys are grouped by the business day when the menu visit began/)
  assert.match(crm, /Confirmed visits and customer revenue are grouped by the paid order&apos;s business day/)
})

test("Transactions renders currency-neutral monetary skeletons during loading", async () => {
  const transactions = await source("./app/owner/transactions/page.tsx")

  assert.match(transactions, /const summaryCurrency = businessSettings\?\.currency \|\| businessCurrency/)
  assert.match(transactions, /isLoading \? \([\s\S]*?<Skeleton className="mt-2 h-8 w-28" \/>/)
})
