import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("frontend permission catalog exposes dedicated recipe management", async () => {
  const source = await readFile(new URL("./lib/manager-permissions.ts", import.meta.url), "utf8")
  assert.match(source, /INVENTORY_RECIPE_MANAGE: "inventory\.recipe\.manage"/)
  assert.match(source, /Manage Ingredient Recipes/)
  assert.match(
    source,
    /\[MANAGER_PERMISSIONS\.INVENTORY_RECIPE_MANAGE\]: MANAGER_PERMISSIONS\.INVENTORY_VIEW/,
  )
})

test("owner menu treats ingredient recipes separately from Simple Stock controls", async () => {
  const source = await readFile(new URL("./app/owner/menu/page.tsx", import.meta.url), "utf8")
  assert.match(source, /canonical_recipe/)
  assert.match(source, /editingItem\.inventory\?\.mode === "simple"/)
  assert.match(source, /editingItem\?\.inventory\?\.mode === "recipe"/)
  assert.match(source, /Ingredients tracked/)
  assert.match(source, /Sellable stock and ingredients/)
  assert.match(source, /Low or missing ingredient stock will not stop customers from ordering it/)
  assert.match(source, /Available switch to pause sales/)
})
