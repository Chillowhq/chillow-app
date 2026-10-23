import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("owner menu uses explicit Simple Stock APIs and permission gates", async () => {
  const source = await readFile(new URL("./app/owner/menu/page.tsx", import.meta.url), "utf8")
  assert.match(source, /MANAGER_PERMISSIONS\.INVENTORY_MANAGE/)
  assert.match(source, /MANAGER_PERMISSIONS\.INVENTORY_ADJUST/)
  assert.match(source, /\/owner\/inventory\/simple-stock\/menu-items/)
  assert.match(source, /\/adjust`/)
  assert.match(source, /Idempotency-Key/)
  assert.match(source, /openingQuantity/)
  assert.match(source, /stockUnit/)
  assert.match(source, /Track with Simple Stock/)
})

test("manual availability and a zero low-stock threshold remain distinct", async () => {
  const [ownerMenu, menuCard, detail] = await Promise.all([
    readFile(new URL("./app/owner/menu/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/menu-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/item-detail-sheet.tsx", import.meta.url), "utf8"),
  ])
  assert.match(ownerMenu, /manualIsAvailable/)
  for (const source of [ownerMenu, menuCard, detail]) {
    assert.doesNotMatch(source, /lowStockThreshold\s*\|\|\s*5/)
    assert.match(source, /lowStockThreshold\s*\?\?\s*5/)
  }
})
