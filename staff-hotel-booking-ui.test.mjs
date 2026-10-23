import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const dialogUrl = new URL(
  "./components/reservations/dashboard/StaffHotelReservationDialog.tsx",
  import.meta.url,
)
const roomPriceDisplayUrl = new URL(
  "./components/reservations/hotel/HotelRoomPriceDisplay.tsx",
  import.meta.url,
)

test("staff room selection reuses canonical date and capacity availability", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /\/owner\/reservations\/availability/)
  assert.match(dialog, /params: \{ checkInDate, checkOutDate, guestCount \}/)
  assert.match(dialog, /if \(!room\.available\) return false/)
  assert.match(dialog, /room\.capacityExceeded/)
  assert.match(dialog, /selectedRoom\.capacityExceeded/)
  assert.match(dialog, /await fetchRooms\(\)/)
})

test("availability overview derives totals and categories from returned rooms", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /rooms\.forEach\(\(room\) =>/)
  assert.match(dialog, /summary\.totalRooms \+= 1/)
  assert.match(dialog, /if \(room\.available\) summary\.availableRooms \+= 1/)
  assert.match(dialog, /totalRooms: rooms\.length/)
  assert.match(dialog, /rooms\.filter\(\(room\) => room\.available\)\.length/)
  assert.doesNotMatch(dialog, /["'](?:Deluxe|Standard|Superior|Single|Suite)["']/)
})

test("category filters, sorting, and responsive room grid are present", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /setActiveRoomCategory\(item\.key\)/)
  assert.match(dialog, /getRoomCategory\(room\.roomType\)\.key === activeRoomCategory/)
  assert.match(dialog, /value="price-asc"/)
  assert.match(dialog, /value="price-desc"/)
  assert.match(dialog, /value="capacity"/)
  assert.match(dialog, /grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-\[1180px\]:grid-cols-4/)
})

test("wide modal keeps room content and actions usable", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /sm:max-w-\[1280px\]/)
  assert.match(dialog, /h-\[\d+dvh\] max-h-\[\d+dvh\]/)
  assert.match(dialog, /min-h-0 flex-1 space-y-5 overflow-y-auto/)
  assert.match(dialog, /flex shrink-0 flex-col gap-3 border-t/)
  assert.match(dialog, /Continue to Guest Details/)
  assert.match(dialog, /disabled=\{\s*!selectedRoom \|\|\s*!selectedRoom\.available \|\|\s*selectedRoom\.capacityExceeded/)
})

test("room step keeps informative loading, empty, and failure states", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /Checking room availability\.\.\./)
  assert.match(dialog, /No .* are available for the selected stay\./)
  assert.match(dialog, /Change dates/)
  assert.match(dialog, /Room availability could not be loaded\./)
  assert.match(dialog, /toast\.error\(message\)/)
})

test("guest step uses the wide responsive layout and stable footer", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /max-w-6xl gap-5 lg:grid-cols-\[minmax\(0,2fr\)_minmax\(280px,1fr\)\]/)
  assert.match(dialog, /aria-labelledby="guest-details-heading"/)
  assert.match(dialog, /aria-labelledby="booking-summary-heading"/)
  assert.match(dialog, /sticky bottom-0 z-10 flex shrink-0/)
  assert.match(dialog, /Continue to Payment/)
  assert.match(dialog, /grid gap-5 sm:grid-cols-2/)
})

test("guest booking summary uses selected state and the shared currency formatter", async () => {
  const [dialog, roomPriceDisplay] = await Promise.all([
    readFile(dialogUrl, "utf8"),
    readFile(roomPriceDisplayUrl, "utf8"),
  ])

  assert.match(dialog, /selectedRoom\.label/)
  assert.match(dialog, /selectedRoom\.roomType \|\| "Room"/)
  assert.match(dialog, /format\(new Date\(checkInDate \+ "T00:00"\), "MMM d"\)/)
  assert.match(dialog, /\{nights\} \{nights === 1 \? "night" : "nights"\}/)
  assert.match(dialog, /\{guestCount\} \{guestCount === 1 \? "guest" : "guests"\}/)
  assert.match(dialog, /const bookingCurrency = selectedRoom\?\.currency \|\| currency/)
  assert.match(dialog, /<HotelRoomPriceDisplay[\s\S]*?pricePerNight=\{selectedRoom\.pricePerNight \?\? 0\}[\s\S]*?currency=\{bookingCurrency\}/)
  assert.match(roomPriceDisplay, /import \{ formatBookingCurrency \} from "\.\/HotelPricingBreakdown"/)
  assert.match(roomPriceDisplay, /formatBookingCurrency\(pricePerNight, currency\)/)
  assert.doesNotMatch(dialog, /currency(?: =|:) "EUR"|room\.currency \|\| "EUR"/)
  assert.match(dialog, /onClick=\{\(\) => setStep\("room"\)\}[\s\S]*Change Room/)
})

test("guest fields preserve optional copy, limits, and required validation", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /Email \(optional\)/)
  assert.match(dialog, /placeholder="\+00 000 000 000"/)
  assert.match(dialog, /Late arrival, accessibility needs, room preferences, special requests\.\.\./)
  assert.match(dialog, /maxLength=\{500\}/)
  assert.match(dialog, /Guest name is required\./)
  assert.match(dialog, /Phone number is required\./)
  assert.match(dialog, /aria-invalid=\{Boolean\(guestErrors\.customerName\)\}/)
  assert.match(dialog, /aria-invalid=\{Boolean\(guestErrors\.phone\)\}/)
  assert.match(dialog, /disabled=\{!customerName\.trim\(\) \|\| !phone\.trim\(\)\}/)
})

test("guest navigation preserves component-level form state", async () => {
  const dialog = await readFile(dialogUrl, "utf8")

  assert.match(dialog, /const \[customerName, setCustomerName\] = useState\(""\)/)
  assert.match(dialog, /const \[email, setEmail\] = useState\(""\)/)
  assert.match(dialog, /const \[phone, setPhone\] = useState\(""\)/)
  assert.match(dialog, /const \[specialRequest, setSpecialRequest\] = useState\(""\)/)
  assert.equal([...dialog.matchAll(/setCustomerName\(""\)/g)].length, 1)
  assert.equal([...dialog.matchAll(/setEmail\(""\)/g)].length, 1)
  assert.equal([...dialog.matchAll(/setPhone\(""\)/g)].length, 1)
  assert.equal([...dialog.matchAll(/setSpecialRequest\(""\)/g)].length, 1)
})
