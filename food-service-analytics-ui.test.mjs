import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const analyticsPage = await readFile(
  new URL("./app/owner/analytics/page.tsx", import.meta.url),
  "utf8",
)
const foodServiceAnalytics = await readFile(
  new URL(
    "./components/analytics/food-service/FoodServiceAnalytics.tsx",
    import.meta.url,
  ),
  "utf8",
)

test("food-service analytics keeps the approved hierarchy on the aggregated owner contract", () => {
  assert.match(analyticsPage, /useOwnerAnalytics/)
  assert.match(analyticsPage, /label: "Overview"/)
  assert.match(analyticsPage, /label: "Food Service"/)
  assert.match(foodServiceAnalytics, /Operational key metrics/)
  assert.match(foodServiceAnalytics, /Total Tips Collected/)
  assert.match(foodServiceAnalytics, /Revenue Trend/)
  assert.match(foodServiceAnalytics, /Hourly Orders/)
  assert.match(foodServiceAnalytics, /Top Selling Items/)
  assert.match(foodServiceAnalytics, /Category Breakdown/)
  assert.match(foodServiceAnalytics, /Order Type Split/)
  assert.match(foodServiceAnalytics, /Channel Breakdown/)
  assert.match(foodServiceAnalytics, /Service Call Analytics/)
  assert.match(foodServiceAnalytics, /Service Point Performance/)
  assert.match(foodServiceAnalytics, /Waitstaff Activity/)
})

test("food-service analytics presents only supported dimensions and real series", () => {
  assert.match(foodServiceAnalytics, /data\.revenueByDay/)
  assert.match(foodServiceAnalytics, /dataKey="grossCents"/)
  assert.match(foodServiceAnalytics, /dataKey="orderCount"/)
  assert.match(foodServiceAnalytics, /data\.hourlyOrders/)
  assert.match(foodServiceAnalytics, /row\.type === "dine-in"/)
  assert.match(foodServiceAnalytics, /row\.channel === "self"/)
  assert.match(foodServiceAnalytics, /Ranked by quantity sold from paid orders/)
  assert.match(foodServiceAnalytics, /Share of paid item revenue/)
  assert.doesNotMatch(foodServiceAnalytics, /vs previous/i)
  assert.doesNotMatch(foodServiceAnalytics, /sparkline/i)
  assert.doesNotMatch(foodServiceAnalytics, /Export Report/)
})

test("food-service analytics handles zero denominators, empty sections, and responsive tables", () => {
  assert.match(foodServiceAnalytics, /totalPaidOrders > 0/)
  assert.match(foodServiceAnalytics, /resolutionRate === null \? "—"/)
  assert.match(foodServiceAnalytics, /No paid revenue in this period\./)
  assert.match(foodServiceAnalytics, /No service calls in this period\./)
  assert.match(foodServiceAnalytics, /hidden max-h-\[28rem\] overflow-auto md:block/)
  assert.match(foodServiceAnalytics, /divide-y divide-border md:hidden/)
  assert.match(foodServiceAnalytics, /hidden max-h-\[28rem\] overflow-auto lg:block/)
  assert.match(foodServiceAnalytics, /divide-y divide-border lg:hidden/)
})

test("charts and dense data retain accessible text alternatives", () => {
  assert.match(foodServiceAnalytics, /role="img"/)
  assert.match(foodServiceAnalytics, /aria-label="Daily paid revenue/)
  assert.match(foodServiceAnalytics, /aria-label="Order counts grouped by local business hour"/)
  assert.match(foodServiceAnalytics, /aria-label="Category revenue legend"/)
  assert.match(foodServiceAnalytics, /<caption className="sr-only">/)
  assert.match(foodServiceAnalytics, /<th scope="row"/)
})
