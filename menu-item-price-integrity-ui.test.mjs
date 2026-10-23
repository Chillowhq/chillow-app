import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("./app/owner/menu/page.tsx", import.meta.url), "utf8")
const validationSource = await readFile(new URL("./app/owner/menu/page.validation.ts", import.meta.url), "utf8")

test("new Menu Items start with an empty price and require a positive finite value", () => {
  assert.match(validationSource, /price: "",\s*\n\s*category/)
  assert.doesNotMatch(validationSource, /price: "0",\s*\n\s*category/)
  assert.match(validationSource, /validateMenuItemPriceInput/)
  assert.match(validationSource, /Number\.isFinite\(parsed\)/)
  assert.match(source, /zodResolver\(menuItemSchema\)/)
  assert.match(source, /const price = parseMenuItemPriceInput\(values\.price\)/)
  assert.match(source, /price === null \|\| price <= 0/)
  assert.match(source, /min="0\.01"/)
  assert.match(validationSource, /Enter a valid price greater than 0\./)
})

test("Menu Item editing and valid request construction retain the existing contract", () => {
  assert.match(source, /price: String\(item\.price\)/)
  assert.match(source, /const basePayload = \{[\s\S]*?price,[\s\S]*?businessId: user\?\.businessId,/)
  assert.ok(source.indexOf("price <= 0") < source.indexOf("const basePayload"))
})
