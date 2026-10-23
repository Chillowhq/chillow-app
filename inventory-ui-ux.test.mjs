import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("inventory overview uses canonical summary, attention filters, activity, and permission-gated quick actions", async () => {
  const source = await read("./app/owner/inventory/page.tsx")

  assert.match(source, /apiClient\.get<InventoryOverviewApiResponse>\("\/owner\/inventory\/overview"/)
  assert.match(source, /stockStatus: "out_of_stock"/)
  assert.match(source, /stockStatus: "low_stock"/)
  assert.match(source, /<InventoryAttentionList/)
  assert.match(source, /<InventoryActivityList/)
  assert.match(source, /canReceive \? \(/)
  assert.match(source, /canWaste \? \(/)
  assert.match(source, /canAdjust \? \(/)
  assert.match(source, /Choose an item before recording a stock movement/)
})

test("inventory catalog explains canonical quantities and reuses the receive workflow", async () => {
  const source = await read("./app/owner/inventory/items/page.tsx")

  assert.match(source, /Physical stock currently recorded/)
  assert.match(source, /Committed to orders, not yet consumed/)
  assert.match(source, /On hand minus reserved/)
  assert.match(source, />Category<\/TableHead>/)
  assert.match(source, />Low stock alert<\/TableHead>/)
  assert.match(source, /setMovementTarget\(\{ item, action: "receive" \}\)/)
  assert.match(source, /<InventoryMovementDialog/)
})

test("stock dialogs preview backend-authoritative impacts without changing their idempotent endpoints", async () => {
  const [movement, summary] = await Promise.all([
    read("./components/owner/inventory/InventoryMovementDialog.tsx"),
    read("./components/owner/inventory/InventoryQuantitySummary.tsx"),
  ])

  assert.match(movement, /Correct stock count/)
  assert.match(movement, /Stock impact/)
  assert.match(movement, /Reserved stock remains/)
  assert.match(movement, /inventoryQuantityToCanonical/)
  assert.match(movement, /"Idempotency-Key": idempotencyRef\.current\.key/)
  assert.match(movement, /\/owner\/inventory\/items\/\$\{encodeURIComponent\(item\.inventoryItemId\)\}\/\$\{action\}/)
  assert.match(summary, /On hand − Reserved = Available/)
})

test("new stock items offer the existing receive flow without accepting an initial balance", async () => {
  const source = await read("./components/owner/inventory/InventoryItemFormDialog.tsx")

  assert.match(source, /New item starts with zero stock|starts with zero stock/)
  assert.match(source, /Receive first delivery/)
  assert.match(source, /onReceiveFirstDelivery/)
  assert.match(source, /Packs, pieces, and bottles stay distinct/)
  assert.doesNotMatch(source, /onHandQuantity\s*:/)
  assert.doesNotMatch(source, /reservedQuantity\s*:/)
})

test("inventory overview caps attention and recent activity at five canonical records", async () => {
  const [overview, panels] = await Promise.all([
    read("./app/owner/inventory/page.tsx"),
    read("./components/owner/inventory/InventoryOverviewPanels.tsx"),
  ])

  assert.match(overview, /stockStatus: "out_of_stock", limit: 5/)
  assert.match(overview, /remainingSlots = Math\.max\(0, 5 - outOfStockItems\.length\)/)
  assert.match(overview, /setAttentionItems\(\[\.\.\.outOfStockItems, \.\.\.lowStockItems\]\.slice\(0, 5\)\)/)
  assert.match(overview, /View all activity/)
  assert.match(panels, /items\.slice\(0, 5\)/)
  assert.match(panels, /formatDateTime\(date, timezone\)/)
  assert.match(panels, /committed to orders/)
  assert.match(panels, /released from orders/)
})

test("Stock Activity uses server-side canonical movement pagination and scoped filters", async () => {
  const [activity, layout] = await Promise.all([
    read("./app/owner/inventory/activity/page.tsx"),
    read("./app/owner/inventory/layout.tsx"),
  ])

  assert.match(activity, /Stock activity/)
  assert.match(activity, /See what changed, when it changed, and who recorded it\./)
  assert.match(activity, /apiClient\.get<InventoryMovementsResponse>\("\/owner\/inventory\/movements"/)
  assert.match(activity, /domain,/)
  assert.match(activity, /inventoryItemId: selectedItem\?\.inventoryItemId/)
  assert.match(activity, /cursor: cursor \|\| undefined/)
  assert.match(activity, /limit: PAGE_SIZE/)
  assert.match(activity, /const PAGE_SIZE = 20/)
  assert.match(activity, /Search by inventory item/)
  assert.match(activity, /type="date"/)
  assert.match(activity, /nextCursor/)
  assert.match(layout, /\{ href: "\/owner\/inventory\/activity", label: "Stock activity" \}/)
  assert.match(layout, /pathname\.startsWith\("\/owner\/inventory\/activity"\)/)
})