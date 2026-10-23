import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("recipes workspace is navigation and permission aware", async () => {
  const [layout, page] = await Promise.all([
    read("./app/owner/inventory/layout.tsx"),
    read("./app/owner/inventory/recipes/page.tsx"),
  ])

  assert.match(layout, /\/owner\/inventory\/recipes/)
  assert.match(layout, /MANAGER_PERMISSIONS\.MENU_VIEW/)
  assert.match(page, /MANAGER_PERMISSIONS\.MENU_VIEW/)
  assert.match(page, /MANAGER_PERMISSIONS\.MENU_MANAGE/)
  assert.match(page, /MANAGER_PERMISSIONS\.INVENTORY_RECIPE_MANAGE/)
})

test("recipes list uses canonical server filtering and cursor pagination", async () => {
  const source = await read("./app/owner/inventory/recipes/page.tsx")

  assert.match(source, /apiClient\.get<InventoryRecipesResponse>\("\/owner\/inventory\/recipes"/)
  assert.match(source, /status,/)
  assert.match(source, /cursor: cursor \|\| undefined/)
  assert.match(source, /limit: PAGE_SIZE/)
  assert.match(source, /recipe\.costing\.status === "complete"/)
  assert.match(source, /Missing cost/)
  assert.match(source, /Mixed currencies/)
})

test("recipe builder reuses canonical menu, inventory and recipe APIs", async () => {
  const source = await read("./components/owner/inventory/RecipeBuilderDialog.tsx")

  assert.match(source, /apiClient\.get<InventoryRecipeMenuCandidate\[]>\("\/menu-items"/)
  assert.match(source, /apiClient\.get<InventoryItemsResponse>\("\/owner\/inventory\/items"/)
  assert.match(source, /apiClient\.get<InventoryRecipeResponse>/)
  assert.match(source, /apiClient\.put<InventoryRecipeResponse>/)
  assert.match(source, /isAddingToSimpleStock/)
  assert.doesNotMatch(source, /replaceSimpleStock:/)
  assert.match(source, /replaceLegacyStock: isReplacingLegacyStock && replaceConfirmed/)
  assert.doesNotMatch(source, /stock count|variance/i)
})

test("recipe quantities and cost estimates respect canonical units", async () => {
  const [builder, helper] = await Promise.all([
    read("./components/owner/inventory/RecipeBuilderDialog.tsx"),
    read("./lib/inventory.ts"),
  ])

  assert.match(builder, /getCompatibleInventoryUnits\(item\.trackingUnit\)/)
  assert.match(builder, /inventoryQuantityToCanonical/)
  assert.match(builder, /item\.unitCostMinor === null \|\| !item\.costCurrency/)
  assert.match(builder, /Estimated ingredient cost/)
  assert.match(helper, /fraction\.slice\(factorDigits\)/)
  assert.match(helper, /Number\.isSafeInteger\(canonicalQuantity\)/)
  assert.match(helper, /return `count:\$\{unit\}`/)
})
