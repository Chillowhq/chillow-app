import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("inventory is a server-driven, permission-guarded owner workspace", async () => {
  const [layout, permissions] = await Promise.all([
    read("./app/owner/layout.tsx"),
    read("./lib/manager-permissions.ts"),
  ])

  assert.match(layout, /inventory: \{ href: "\/owner\/inventory"[\s\S]*?INVENTORY_VIEW[\s\S]*?MANAGEMENT_ACCESS_AREAS\.INVENTORY/)
  assert.match(permissions, /\["\/owner\/inventory", MANAGER_PERMISSIONS\.INVENTORY_VIEW\]/)
  assert.match(permissions, /\[MANAGEMENT_ACCESS_AREAS\.INVENTORY, "\/owner\/inventory"\]/)
})

test("inventory overview uses the canonical owner summary and stock-attention links", async () => {
  const source = await read("./app/owner/inventory/page.tsx")

  assert.match(source, /apiClient\.get<InventoryOverviewApiResponse>\("\/owner\/inventory\/overview"/)
  assert.match(source, /stockStatus: "low_stock"/)
  assert.match(source, /stockStatus: "out_of_stock"/)
  assert.match(source, /buildInventoryHref/)
  assert.match(source, /Availability already accounts for reserved stock/)
})

test("items catalog keeps filtering and cursor pagination on the backend", async () => {
  const source = await read("./app/owner/inventory/items/page.tsx")

  assert.match(source, /apiClient\.get<InventoryItemsResponse>\("\/owner\/inventory\/items"/)
  assert.match(source, /stockStatus,/)
  assert.match(source, /active,/)
  assert.match(source, /cursor: cursor \|\| undefined/)
  assert.match(source, /limit: PAGE_SIZE/)
  assert.match(source, /setCursorHistory\(\(history\) => \[\.\.\.history, cursor\]\)/)
  assert.match(source, /window\.setTimeout[\s\S]+300/)
})

test("catalog displays available stock without mutating inventory", async () => {
  const [page, helper] = await Promise.all([
    read("./app/owner/inventory/items/page.tsx"),
    read("./lib/inventory.ts"),
  ])

  assert.match(page, /item\.onHandQuantity/)
  assert.match(page, /item\.reservedQuantity/)
  assert.match(page, /item\.availableQuantity/)
  assert.doesNotMatch(page, /apiClient\.(post|patch|put|delete)/)
  assert.match(helper, /item\.availableQuantity <= 0/)
  assert.match(helper, /item\.availableQuantity <= item\.lowStockThreshold/)
})
