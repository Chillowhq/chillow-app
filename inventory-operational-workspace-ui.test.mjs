import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")
const [layout, overview, items, recipes, helper, form, roomSupplies, servicePoints, roomsView, roomUsage] = await Promise.all([
  read("./app/owner/inventory/layout.tsx"),
  read("./app/owner/inventory/page.tsx"),
  read("./app/owner/inventory/items/page.tsx"),
  read("./app/owner/inventory/recipes/page.tsx"),
  read("./lib/inventory.ts"),
  read("./components/owner/inventory/InventoryItemFormDialog.tsx"),
  read("./app/owner/inventory/room-supplies/page.tsx"),
  read("./app/owner/service-points/page.tsx"),
  read("./components/service-points/HotelServicePointViews.tsx"),
  read("./components/owner/inventory/RoomUsageDialog.tsx"),
])

test("matrix 1: hotel-only resolves Hotel Operations Inventory", () => {
  assert.match(helper, /hasLodging \? \["hotelOperations" as const\]/)
  assert.match(layout, /activeContext === "hotelOperations"/)
})

test("matrix 2: hotel-only has no unnecessary Food Service switch", () => {
  assert.match(layout, /mixedBusiness \? \(/)
  assert.match(helper, /hasFoodService \? \["foodService" as const\]/)
})

test("matrix 3: hotel-only hides Recipes", () => {
  assert.match(layout, /activeContext === "foodService" && canViewRecipes/)
})

test("matrix 4: food-only resolves Food Service Inventory", () => {
  assert.match(helper, /return available\[0\] \|\| "foodService"/)
  assert.match(layout, /Manage stock for your Food Service operation/)
})

test("matrix 5: food-only hides Hotel Operations", () => {
  assert.match(layout, /mixedBusiness \? \(/)
  assert.match(layout, /hasHotelOperations = availableContexts\.includes\("hotelOperations"\)/)
})

test("matrix 6: food-only hides Room Supplies", () => {
  assert.match(layout, /activeContext === "hotelOperations" && hasHotelOperations[\s\S]*room-supplies/)
})

test("matrix 7: food-only hides Record Room Usage", () => {
  assert.match(items, /hasLodging && canManage[\s\S]*Record Room Usage/)
})

test("matrix 8: mixed businesses receive both context options", () => {
  assert.match(helper, /hotelOperations[\s\S]*foodService/)
  assert.match(layout, /INVENTORY_OPERATIONAL_CONTEXTS\.filter/)
})

test("matrix 9: mixed Food Service ON exposes the Food Service context", () => {
  assert.match(layout, /availableContexts\.includes\(option\.value\)/)
  assert.match(layout, /Food Service/)
})

test("matrix 10: Food Service OFF removes its context", () => {
  assert.match(helper, /serverContexts\.includes\(value\)/)
  assert.match(layout, /availableContexts\.includes\(option\.value\)/)
})

test("matrix 11: Recipes disappear when Food Service is disabled", () => {
  assert.match(recipes, /hasFoodService = availableContexts\.includes\("foodService"\)/)
  assert.match(layout, /pathname\.startsWith\("\/owner\/inventory\/recipes"\) && !hasFoodService/)
})

test("matrix 12: disabled Food Service item views cannot issue unscoped reads", () => {
  assert.match(items, /domainOptions\.map\(\(option\) => option\.value\)\.join\(","\)/)
  assert.doesNotMatch(items, /filter\(\(item\).*domain/s)
})

test("matrix 16: direct unavailable routes fall back safely", () => {
  assert.match(layout, /invalidCapabilityRoute \|\| routeContextMismatch/)
  assert.match(layout, /router\.replace\(buildInventoryHref\("\/owner\/inventory"/)
})

test("matrix 19: Record Room Usage is only rendered in Hotel Operations", () => {
  assert.match(items, /operationalContext === "hotelOperations"/)
  assert.match(items, /hasLodging && canManage/)
})

test("matrix 20: Room Supplies is only rendered in Hotel Operations", () => {
  assert.match(layout, /activeContext === "hotelOperations" && hasHotelOperations/)
  assert.match(roomSupplies, /Choose the supplies your team normally uses to prepare each type of room/)
})

test("matrix 23: Recipes retain the existing builder and permissions", () => {
  assert.match(recipes, /RecipeBuilderDialog/)
  assert.match(recipes, /MANAGER_PERMISSIONS\.INVENTORY_RECIPE_MANAGE/)
})

test("matrix 29: Hotel item creation receives only context domains", () => {
  assert.match(items, /getInventoryDomainsForBusiness\(user, operationalContext\)/)
  assert.match(items, /domainOptions=\{domainOptions\}/)
  assert.match(form, /allowedDomainOptions \?\? businessDomainOptions/)
})

test("matrix 30: Food Service creation retains food_service semantics", () => {
  assert.match(helper, /option\.value === "food_service"[\s\S]*contexts\.includes\("foodService"\)/)
  assert.match(form, /domain,/)
})

test("matrix 36: Service Room stays on Room cards and uses Room Usage", () => {
  assert.match(roomsView, /Service Room/)
  assert.match(servicePoints, /workflow="service_room"/)
  assert.match(roomUsage, /"\/owner\/inventory\/room-usage"/)
})

test("matrix 40: no reservation or check-in event consumes room supplies", () => {
  const newWorkspaceSources = `${layout}\n${overview}\n${items}\n${roomSupplies}`
  assert.doesNotMatch(newWorkspaceSources, /check.?in.*consume|reservation.*consume/i)
  assert.match(roomSupplies, /Setting these supplies does not change your stock/)
})
