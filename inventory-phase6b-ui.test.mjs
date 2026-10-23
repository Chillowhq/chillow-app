import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("item catalog gates Phase 6B actions through canonical permissions", async () => {
  const source = await read("./app/owner/inventory/items/page.tsx")

  assert.match(source, /MANAGER_PERMISSIONS\.INVENTORY_MANAGE/)
  assert.match(source, /MANAGER_PERMISSIONS\.INVENTORY_RECEIVE/)
  assert.match(source, /MANAGER_PERMISSIONS\.INVENTORY_WASTE/)
  assert.match(source, /MANAGER_PERMISSIONS\.INVENTORY_ADJUST/)
  assert.match(source, /MANAGER_PERMISSIONS\.MENU_VIEW/)
  assert.match(source, /<InventoryItemDrawer/)
  assert.match(source, /<InventoryItemFormDialog/)
})

test("item form creates and edits metadata without writing balances", async () => {
  const source = await read("./components/owner/inventory/InventoryItemFormDialog.tsx")

  assert.match(source, /apiClient\.post<\{ item: InventoryItem \}>\("\/owner\/inventory\/items"/)
  assert.match(source, /apiClient\.patch<\{ item: InventoryItem \}>/)
  assert.match(source, /lowStockThreshold/)
  assert.match(source, /unitCostMinor/)
  assert.doesNotMatch(source, /onHandQuantity\s*:/)
  assert.doesNotMatch(source, /reservedQuantity\s*:/)
})

test("stock operations use their canonical endpoints and stable idempotency keys", async () => {
  const source = await read("./components/owner/inventory/InventoryMovementDialog.tsx")

  assert.match(source, /InventoryMovementAction = "receive" \| "waste" \| "adjust"/)
  assert.match(source, /crypto\.randomUUID\(\)/)
  assert.match(source, /"Idempotency-Key": idempotencyRef\.current\.key/)
  assert.match(source, /\/owner\/inventory\/items\/\$\{encodeURIComponent\(item\.inventoryItemId\)\}\/\$\{action\}/)
  assert.match(source, /direction/)
  assert.match(source, /reason/)
})

test("drawer loads item-scoped movements and linked recipes without editing recipes", async () => {
  const source = await read("./components/owner/inventory/InventoryItemDrawer.tsx")

  assert.match(source, /"\/owner\/inventory\/movements"/)
  assert.match(source, /inventoryItemId: itemId, limit: 8/)
  assert.match(source, /"\/owner\/inventory\/recipes"/)
  assert.match(source, /inventoryItemId: itemId, limit: 6/)
  assert.doesNotMatch(
    source,
    /apiClient\.(?:put|patch|post|delete)[\s\S]{0,120}["'`]\/owner\/inventory\/recipes/,
  )
  assert.doesNotMatch(source, /variance/i)
})
