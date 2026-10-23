import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("./app/owner/menu/page.tsx", import.meta.url), "utf8")

test("menu workspace uses the approved responsive operational grid and real controls", () => {
  assert.match(source, /Manage your menu items and categories/)
  assert.match(source, /grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4/)
  assert.match(source, /Search menu items\.\.\./)
  assert.match(source, /Filter by availability/)
  assert.match(source, /Filter by stock state/)
  assert.match(source, /Filter by fulfilment/)
  assert.match(source, /Sort menu items/)
  assert.doesNotMatch(source, /List view|setViewMode|MoreHorizontal/)
})

test("availability filtering uses effective availability while the switch preserves manual intent", () => {
  assert.match(source, /availabilityFilter === "available" \? item\.isAvailable : !item\.isAvailable/)
  assert.match(source, /getManualAvailability\(item\)/)
  assert.match(source, /handleToggleAvailability\(item\._id, manualAvailable\)/)
  assert.match(source, /\/menu-items\/\$\{id\}\/availability/)
})

test("stock presentation keeps authoritative stock modes separate", () => {
  assert.match(source, /trackingState === "canonical_simple" \|\| trackingState === "legacy"/)
  assert.match(source, /quantity <= threshold/)
  assert.match(source, /trackingState === "canonical_recipe"/)
  assert.match(source, /Ingredient tracked/)
  assert.match(source, /In stock · Unlimited/)
  assert.match(source, /Simple Stock off/)
})

test("editor uses a full-height accessible sheet with persistent actions", () => {
  assert.match(source, /<Sheet/)
  assert.match(source, /h-dvh w-full max-w-none/)
  assert.match(source, /min-h-0 flex-1 space-y-7 overflow-y-auto/)
  assert.match(source, /<SheetFooter/)
  assert.match(source, />Item Details</)
  assert.match(source, />Service &amp; Availability</)
  assert.match(source, />Stock &amp; Ingredients</)
  assert.match(source, /Save Item/)
  assert.match(source, /Cancel/)
})

test("menu states and item actions have explicit accessible treatment", () => {
  assert.match(source, /Menu items couldn't be loaded/)
  assert.match(source, /No menu items yet\./)
  assert.match(source, /No items in this category\./)
  assert.match(source, /No menu items match these filters\./)
  assert.match(source, /aria-label=\{`Edit \$\{item\.name\}`\}/)
  assert.match(source, /aria-label=\{`Delete \$\{item\.name\}`\}/)
  assert.match(source, /aria-label=\{`\$\{manualAvailable \? "Make" : "Set"\}/)
})

test("menu image uploads enforce the real contract and recover without browser alerts", () => {
  assert.match(source, /MENU_IMAGE_MAX_BYTES = 5 \* 1024 \* 1024/)
  assert.match(source, /MENU_IMAGE_MIME_TYPES = new Set\(\["image\/jpeg", "image\/png", "image\/webp"\]\)/)
  assert.match(source, /validateMenuImage\(file\)/)
  assert.match(source, /Image must be 5MB or smaller\./)
  assert.match(source, /imageUploadError && <p role="alert"/)
  assert.match(source, /isSaving \|\| isMenuItemSubmitting \|\| isUploadingImage/)
  assert.match(source, /toast\.error\(message\)/)
  assert.doesNotMatch(source, /\balert\(/)
})
