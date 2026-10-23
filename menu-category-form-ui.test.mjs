import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageSource = await readFile(new URL("./app/owner/menu/page.tsx", import.meta.url), "utf8")
const validationSource = await readFile(new URL("./app/owner/menu/page.validation.ts", import.meta.url), "utf8")

test("menu category creation uses page-local RHF and Zod validation", () => {
  assert.match(pageSource, /zodResolver\(menuCategorySchema\)/)
  assert.match(pageSource, /useForm<MenuCategoryFormValues>/)
  assert.match(pageSource, /handleCategorySubmit\(handleAddCategory\)/)
  assert.match(pageSource, /<Field\s+id="new-menu-category"/)
  assert.match(pageSource, /categoryErrors\.category\?\.message/)
  assert.match(pageSource, /<FormNotice/)
  assert.doesNotMatch(pageSource, /newCategoryName/)
})

test("menu category validation rejects blank names without normalizing request payloads", () => {
  assert.match(validationSource, /value\.trim\(\)\.length > 0/)
  assert.match(validationSource, /category: values\.category/)
  assert.doesNotMatch(validationSource, /category:\s*values\.category\.trim\(\)/)
  assert.match(validationSource, /first\.toUpperCase\(\)/)
})

test("menu category creation preserves tenant context, pending protection, and reset lifecycle", () => {
  assert.match(pageSource, /businessId: user\?\.businessId,/)
  assert.match(pageSource, /categorySubmissionInFlight\.current/)
  assert.match(pageSource, /disabled=\{isCategorySubmitting\}/)
  assert.match(pageSource, /resetCategoryCreation\(\)/)
  assert.match(pageSource, /setMenuItemValue\("category", values\.category\.trim\(\)\.toLowerCase\(\), \{ shouldDirty: true, shouldValidate: true \}\)/)
})
