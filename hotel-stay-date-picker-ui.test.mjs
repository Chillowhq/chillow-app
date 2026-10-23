import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pickerUrl = new URL(
  "./components/reservations/hotel/HotelStayDatePicker.tsx",
  import.meta.url,
)
const publicFlowUrl = new URL(
  "./components/reservations/hotel/HotelReservationFlow.tsx",
  import.meta.url,
)
const staffDialogUrl = new URL(
  "./components/reservations/dashboard/StaffHotelReservationDialog.tsx",
  import.meta.url,
)
const reservationDateUrl = new URL("./lib/reservation-date.ts", import.meta.url)
const dashboardUrl = new URL(
  "./components/reservations/HotelReservationsDashboard.tsx",
  import.meta.url,
)

test("public and staff hotel flows share one stay date picker", async () => {
  const [publicFlow, staffDialog] = await Promise.all([
    readFile(publicFlowUrl, "utf8"),
    readFile(staffDialogUrl, "utf8"),
  ])

  assert.match(publicFlow, /import \{[\s\S]*HotelStayDatePicker/)
  assert.match(publicFlow, /<HotelStayDatePicker/)
  assert.match(staffDialog, /import \{[\s\S]*HotelStayDatePicker/)
  assert.match(staffDialog, /<HotelStayDatePicker/)
  assert.doesNotMatch(publicFlow, /function MiniCalendar/)
})

test("shared picker owns range validation, past dates, and month navigation", async () => {
  const picker = await readFile(pickerUrl, "utf8")

  assert.match(picker, /selectionPhase/)
  assert.match(picker, /date <= checkInDate/)
  assert.match(picker, /Check-out must be after check-in\./)
  assert.match(picker, /const isPast = date < minDate/)
  assert.match(picker, /disabled=\{isPast\}/)
  assert.match(picker, /shiftMonth\(current, -1\)/)
  assert.match(picker, /shiftMonth\(current, 1\)/)
  assert.match(picker, /date > checkInDate && date < checkOutDate/)
  assert.match(picker, /getReservationNights\(checkInDate, checkOutDate\)/)
})

test("both flows derive minimum dates from the business timezone", async () => {
  const [publicFlow, staffDialog, reservationDate, dashboard] = await Promise.all([
    readFile(publicFlowUrl, "utf8"),
    readFile(staffDialogUrl, "utf8"),
    readFile(reservationDateUrl, "utf8"),
    readFile(dashboardUrl, "utf8"),
  ])

  assert.match(reservationDate, /getBusinessLocalReservationDate/)
  assert.match(reservationDate, /timeZone: timezone/)
  assert.match(publicFlow, /getBusinessLocalReservationDate\(business\?\.timezone \|\| "UTC"\)/)
  assert.match(staffDialog, /const \{ timezone, currency \} = useBusinessSettings\(\)/)
  assert.match(staffDialog, /getBusinessLocalReservationDate\(timezone\)/)
  assert.doesNotMatch(dashboard, /businessToday=/)
})

test("staff defaults to one business-local night and invalidates stale rooms", async () => {
  const staffDialog = await readFile(staffDialogUrl, "utf8")

  assert.match(staffDialog, /addReservationDateDays\(today, 1\)/)
  assert.match(staffDialog, /useState\(today\)/)
  assert.match(staffDialog, /useState\(defaultCheckOutDate\)/)
  assert.match(staffDialog, /handleStayDateChange/)
  assert.match(staffDialog, /setSelectedRoom\(null\)/)
  assert.match(staffDialog, /setRooms\(\[\]\)/)
  assert.match(staffDialog, /params: \{ checkInDate, checkOutDate, guestCount \}/)
})

test("staff date picker and guest controls remain responsive", async () => {
  const [picker, staffDialog] = await Promise.all([
    readFile(pickerUrl, "utf8"),
    readFile(staffDialogUrl, "utf8"),
  ])

  assert.match(picker, /grid grid-cols-7/)
  assert.match(picker, /h-9 w-full[\s\S]*sm:h-10/)
  assert.match(picker, /summaryAccessory \? "grid-cols-2 lg:grid-cols-4"/)
  assert.match(staffDialog, /instruction=\{null\}/)
  assert.match(staffDialog, /summaryAccessory=\{/)
  assert.match(staffDialog, /aria-label="Remove one guest"/)
  assert.match(staffDialog, /aria-label="Add one guest"/)
  assert.match(staffDialog, /disabled=\{guestCount <= 1\}/)
  assert.match(staffDialog, /disabled=\{guestCount >= 50\}/)
  assert.doesNotMatch(staffDialog, /Room capacity will be checked in the next step\./)
  assert.equal((staffDialog.match(/aria-label="Number of guests"/g) || []).length, 1)
  assert.match(staffDialog, /step === "stay" \|\| step === "room"/)
})

test("public date-picker composition remains unchanged", async () => {
  const publicFlow = await readFile(publicFlowUrl, "utf8")

  assert.doesNotMatch(publicFlow, /summaryAccessory=/)
  assert.doesNotMatch(publicFlow, /instruction=\{null\}/)
  assert.match(publicFlow, /className="mt-5"/)
})
