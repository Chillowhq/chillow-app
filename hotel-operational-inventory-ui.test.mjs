import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("inventory exposes the approved domains with legacy Food Service fallback", async () => {
  const [types, helper] = await Promise.all([
    read("./types/inventory.ts"),
    read("./lib/inventory.ts"),
  ])

  for (const domain of ["food_service", "housekeeping", "guest_supplies", "cleaning", "linen", "general"]) {
    assert.match(types, new RegExp(`"${domain}"`))
  }
  assert.match(helper, /domain \|\| "food_service"/)
  assert.match(helper, /hasLodging/)
  assert.match(helper, /hasFoodService/)
})

test("the canonical item form creates and edits one domain field", async () => {
  const source = await read("./components/owner/inventory/InventoryItemFormDialog.tsx")

  assert.match(source, /getInventoryDomainsForBusiness\(user\)/)
  assert.match(source, /aria-label="Inventory domain"/)
  assert.match(source, /domain,/)
  assert.doesNotMatch(source, /HotelInventory|HotelInventoryItem/)
})

test("inventory filtering is server-driven and Room Usage is hotel-gated", async () => {
  const source = await read("./app/owner/inventory/items/page.tsx")

  assert.match(source, /domain: domain === "all"[\s\S]*domainOptions\.map\(\(option\) => option\.value\)\.join\(","\)[\s\S]*: domain/)
  assert.match(source, /Filter by inventory domain/)
  assert.match(source, /hasLodging && canManage/)
  assert.match(source, /Record Room Usage/)
  assert.match(source, /<RoomUsageDialog/)
})

test("Room Usage loads canonical rooms and eligible hotel supplies through the purpose-built context", async () => {
  const source = await read("./components/owner/inventory/RoomUsageDialog.tsx")

  assert.match(source, /"\/owner\/inventory\/room-usage\/context"/)
  assert.match(source, /servicePointId,[\s\S]*housekeepingOperationId/)
  assert.match(source, /setCandidates\(response\.data\.items \|\| \[\]\)/)
  assert.match(source, /normalizedSearch/)
  assert.doesNotMatch(source, /"\/owner\/inventory\/items"/)
  assert.match(source, /template\?\.suggestions/)
  assert.match(source, /prefilled as suggestions/)
  assert.match(source, /Change or remove anything that was not actually used/)
  assert.match(source, /confirmedLines = lines\.filter/)
  assert.match(source, /set it to zero/)
})

test("Room Type cards expose permission-gated standard supply management", async () => {
  const [page, view, dialog, types] = await Promise.all([
    read("./app/owner/service-points/page.tsx"),
    read("./components/service-points/HotelServicePointViews.tsx"),
    read("./components/service-points/RoomSupplyTemplateDialog.tsx"),
    read("./types/hotel-room-type.ts"),
  ])

  assert.match(page, /MANAGER_PERMISSIONS\.INVENTORY_MANAGE/)
  assert.match(page, /canManageSupplyTemplates/)
  assert.match(page, /<RoomSupplyTemplateDialog/)
  assert.match(view, /Room supplies/)
  assert.match(view, /standardSupplyTemplate\?\.length/)
  assert.match(dialog, /"\/business\/room-types\/supply-template"/)
  assert.match(dialog, /Stock changes only when your team confirms what they actually used while servicing a room/)
  assert.match(types, /standardSupplyTemplate\?: HotelRoomTypeSupplyTemplateItem\[\]/)
})

test("standard supply templates accept editable quantities and only hotel operational inventory", async () => {
  const source = await read("./components/service-points/RoomSupplyTemplateDialog.tsx")

  assert.match(source, /HOTEL_OPERATIONAL_INVENTORY_DOMAINS\.join\(","\)/)
  assert.match(source, /inventoryQuantityToCanonical/)
  assert.match(source, /items: lines\.map/)
  assert.match(source, /Remove unavailable supplies before saving/)
  assert.match(source, /max-h-\[min\(92dvh,820px\)\]/)
  assert.match(source, /overflow-y-auto/)
})

test("Room Supplies is a data-backed workspace that reuses the canonical template and stock APIs", async () => {
  const source = await read("./app/owner/inventory/room-supplies/page.tsx")

  assert.match(source, /"\/business\/settings"/)
  assert.match(source, /"\/business\/room-types\/supply-template"/)
  assert.match(source, /formatInventoryQuantity\(item\.onHandQuantity/)
  assert.match(source, /formatInventoryQuantity\(item\.reservedQuantity/)
  assert.match(source, /formatInventoryQuantity\(item\.availableQuantity/)
  assert.match(source, /canManageRoomSupplies/)
  assert.match(source, /<RoomSupplyTemplateDialog/)
  assert.match(source, /Setting these supplies does not change your stock/)
  assert.doesNotMatch(source, /"\/owner\/inventory\/room-usage"/)
})

test("Room Usage submits multiple item quantities once through the canonical API", async () => {
  const source = await read("./components/owner/inventory/RoomUsageDialog.tsx")

  assert.match(source, /items: confirmedLines\.map/)
  assert.match(source, /inventoryQuantityToCanonical/)
  assert.match(source, /"\/owner\/inventory\/room-usage"/)
  assert.match(source, /"Idempotency-Key"/)
  assert.match(source, /crypto\.randomUUID\(\)/)
  assert.match(source, /disabled=\{saving/)
  assert.match(source, /role="alert"/)
})

test("Room Usage and movement context are responsive and accessible", async () => {
  const [dialog, drawer] = await Promise.all([
    read("./components/owner/inventory/RoomUsageDialog.tsx"),
    read("./components/owner/inventory/InventoryItemDrawer.tsx"),
  ])

  assert.match(dialog, /92dvh/)
  assert.match(dialog, /overflow-y-auto/)
  assert.match(dialog, /className="h-11"/)
  assert.match(dialog, /aria-label="Room"/)
  assert.match(dialog, /aria-label=\{`Remove \$\{line\.item\.name\}`\}/)
  assert.match(drawer, /movement\.servicePoint\?\.label \|\| movement\.servicePointId/)
  assert.match(drawer, /Room Usage/)
})

test("Phase 3 services a canonical Room through the existing Room Usage command", async () => {
  const [page, roomsView, dialog] = await Promise.all([
    read("./app/owner/service-points/page.tsx"),
    read("./components/service-points/HotelServicePointViews.tsx"),
    read("./components/owner/inventory/RoomUsageDialog.tsx"),
  ])

  assert.match(page, /canServiceRooms/)
  assert.match(page, /MANAGER_PERMISSIONS\.INVENTORY_MANAGE/)
  assert.match(page, /onServiceRoom=\{setServicingRoom\}/)
  assert.match(page, /workflow="service_room"/)
  assert.match(page, /initialServicePointId=\{servicingRoom\?\.servicePointId\}/)
  assert.match(roomsView, /Service Room/)
  assert.match(roomsView, /disabled=\{!room\.isActive\}/)
  assert.match(dialog, /setServicePointId\(initialServicePointId\?\.trim\(\) \|\| ""\)/)
  assert.match(dialog, /Confirm Supplies/)
  assert.match(dialog, /"\/owner\/inventory\/room-usage"/)
  assert.doesNotMatch(page, /housekeeping-status|room-operational-state/)
})

test("hotel-only inventory does not expose food recipe management", async () => {
  const [layout, recipes, items, builder] = await Promise.all([
    read("./app/owner/inventory/layout.tsx"),
    read("./app/owner/inventory/recipes/page.tsx"),
    read("./app/owner/inventory/items/page.tsx"),
    read("./components/owner/inventory/RecipeBuilderDialog.tsx"),
  ])

  assert.match(layout, /hasFoodService && hasManagementPermission/)
  assert.match(recipes, /if \(!canViewRecipes\)/)
  assert.match(items, /canViewRecipes=\{canViewRecipes\}/)
  assert.match(builder, /domain: "food_service"/)
})
