import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("inventory catalog defaults to active operations and gives inactive state visual precedence", async () => {
  const source = await read("./app/owner/inventory/items/page.tsx")

  assert.match(source, /isActiveFilter\(initialActive\) \? initialActive : "true"/)
  assert.match(source, /<SelectItem value="false">Inactive<\/SelectItem>/)
  assert.match(source, /item\.isActive \? \(\s*<InventoryStockBadge item=\{item\} \/>\s*\) : \(/)
  assert.match(source, />\s*Inactive\s*<\/span>/)
})

test("inventory item drawer separates item state from stock state and exposes managed lifecycle actions", async () => {
  const source = await read("./components/owner/inventory/InventoryItemDrawer.tsx")

  assert.match(source, />Item state<\/p>/i)
  assert.match(source, />Stock state<\/p>/i)
  assert.match(source, /item\.isDeleted \? "Removed" : item\.isActive \? "Active" : "Inactive"/)
  assert.match(source, />\s*Archive item\s*<\/Button>/)
  assert.match(source, />\s*Reactivate item\s*<\/Button>/)
  assert.match(source, />\s*Remove item\s*<\/Button>/)
  assert.match(source, /apiClient\.patch<\{ item: InventoryItem \}>/)
  assert.match(source, /apiClient\.delete\(`\/owner\/inventory\/items\/\$\{encodeURIComponent\(item\.inventoryItemId\)\}`\)/)
  assert.match(source, /\{canManage && !item\.isDeleted \? \(/)
  assert.doesNotMatch(source, /soft delete|tombstone/i)
})

test("inventory create and edit surfaces structured strong and category-variant resolution", async () => {
  const source = await read("./components/owner/inventory/InventoryItemFormDialog.tsx")
  const parser = await read("./lib/inventory.ts")

  assert.match(parser, /conflictType !== "strong" && response\?\.conflictType !== "category_variant"/)
  assert.match(source, /getInventoryDuplicateSignal\(requestError\)/)
  assert.match(source, /View existing item/)
  assert.match(source, /Reactivate existing item/)
  assert.match(source, /Continue with this category/)
  assert.match(source, /allowCategoryVariant/)
  assert.match(source, /onViewExisting\?\.\(duplicateSignal\.candidate\.inventoryItemId\)/)
})

test("menu Simple Stock offers reuse without treating opening quantity as an overwrite", async () => {
  const source = await read("./app/owner/menu/page.tsx")

  assert.match(source, /getInventoryDuplicateSignal\(err\)/)
  assert.match(source, /Existing inventory item|inventory item already matches/i)
  assert.match(source, /Use existing inventory item/)
  assert.match(source, /Reactivate and use existing item/)
  assert.match(source, /inventoryItemId: simpleStockSignal\.candidate\.inventoryItemId/)
  assert.match(source, /reactivateInventoryItem: !simpleStockSignal\.candidate\.isActive/)
  assert.match(source, /opening quantity above will not replace it/)
  assert.match(source, /Create separate inventory item/)
  assert.match(source, /allowCategoryVariant: true/)
})

test("menu confirmation distinguishes menu-only and safe menu-plus-inventory removal", async () => {
  const source = await read("./app/owner/menu/page.tsx")

  assert.match(source, /\/owner\/inventory\/simple-stock\/menu-items\/\$\{encodeURIComponent\(itemToDelete\._id\)\}\/removal-preview/)
  assert.match(source, /apiClient\.delete\(`\/owner\/inventory\/simple-stock\/menu-items\/\$\{item\._id\}`\)/)
  assert.match(source, /Remove from Menu only/)
  assert.match(source, /Remove from Menu and Inventory/)
  assert.match(source, /deletionPreview\?\.canRemoveInventory && canRemoveSimpleStockInventory/)
  assert.match(source, /still used by \{deletionPreview\.sharedActiveRelationshipCount\} other active menu/)
  assert.match(source, /Historical stock and order records|preserves its identity and stock history/i)
  assert.doesNotMatch(source, /soft delete|tombstone/i)
})
