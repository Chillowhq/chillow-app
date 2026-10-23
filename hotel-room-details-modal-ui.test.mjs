import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const publicFlowUrl = new URL(
  "./components/reservations/hotel/HotelReservationFlow.tsx",
  import.meta.url,
)

test("desktop room details use a wide, viewport-bounded two-column dialog", async () => {
  const source = await readFile(publicFlowUrl, "utf8")

  assert.match(source, /useMediaQuery\("\(min-width: 768px\)"\)/)
  assert.match(source, /h-\[min\(46rem,calc\(100dvh-3rem\)\)\]/)
  assert.match(source, /grid-cols-12/)
  assert.match(source, /col-span-7/)
  assert.match(source, /col-span-5/)
  assert.match(source, /sm:max-w-6xl/)
  assert.doesNotMatch(source, /className="max-w-4xl p-0 overflow-hidden/)
})

test("desktop details remain scrollable without pushing the action footer out of view", async () => {
  const source = await readFile(publicFlowUrl, "utf8")

  assert.match(source, /min-h-0 flex-1 space-y-6 overflow-y-auto p-6/)
  assert.match(source, /flex shrink-0 items-center justify-between gap-4 border-t/)
})
