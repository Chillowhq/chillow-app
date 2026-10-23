import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("recipe builder adds ingredient tracking without Simple Stock replacement semantics", async () => {
  const source = await read("./components/owner/inventory/RecipeBuilderDialog.tsx")
  assert.match(source, /Add Ingredient Tracking/)
  assert.match(source, /Simple Stock remains active\./)
  assert.match(source, /does not change the sellable portion count/i)
  assert.doesNotMatch(source, /Replace Simple Stock/)
  assert.doesNotMatch(source, /replaceSimpleStock:/)
})

test("coexistence recipe can be removed independently while explaining stock preservation", async () => {
  const source = await read("./components/owner/inventory/RecipeBuilderDialog.tsx")
  assert.match(source, /apiClient\.delete/)
  assert.match(source, /\/owner\/inventory\/recipes\//)
  assert.match(source, /<AlertDialog/)
  assert.match(source, /<AlertDialogTitle>Remove ingredient tracking\?<\/AlertDialogTitle>/)
  assert.match(source, /Simple Stock and the current portion balance will remain unchanged/)
  assert.match(source, /Remove tracking/)
  assert.match(source, /event\.preventDefault\(\)/)
  assert.match(source, /disabled=\{removing\}/)
  assert.doesNotMatch(source, /window\.confirm/)
})

test("inventory and menu workspaces present sellable stock and ingredient tracking as separate layers", async () => {
  const [recipes, menu, drawer] = await Promise.all([
    read("./app/owner/inventory/recipes/page.tsx"),
    read("./app/owner/menu/page.tsx"),
    read("./components/owner/inventory/InventoryItemDrawer.tsx"),
  ])
  assert.match(recipes, /Sellable Stock:/)
  assert.match(recipes, /Ingredients are recorded when this item is prepared/)
  assert.match(menu, /Sellable stock and ingredients/)
  assert.match(menu, /If Simple Stock is off, the Available switch decides whether customers can order it/)
  assert.match(drawer, /Simple Stock remains the sellable authority/)
})

test("frontend recipe types expose coexistence behavior without merging balances", async () => {
  const source = await read("./types/inventory.ts")
  assert.match(source, /simpleStock:/)
  assert.match(source, /ingredientBehavior: "sidecar"/)
  assert.match(source, /ingredientTracking\?:/)
})
