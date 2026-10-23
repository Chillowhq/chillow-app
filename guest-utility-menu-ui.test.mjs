import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
  new URL("./components/menu-button.tsx", import.meta.url),
  "utf8",
)

test("guest utility menu uses the approved vertical action hierarchy", () => {
  const waitstaff = source.indexOf('data-testid="guest-utility-waitstaff"')
  const orders = source.indexOf('data-testid="guest-utility-orders"')
  const notifications = source.indexOf(
    'data-testid="guest-utility-notifications"',
  )

  assert.ok(waitstaff >= 0)
  assert.ok(orders > waitstaff)
  assert.ok(notifications > orders)
  assert.match(
    source,
    /Request Waitstaff[\s\S]*Get assistance at your service point\./,
  )
  assert.match(source, /My Orders[\s\S]*Order history/)
  assert.match(source, /aria-label="Guest utility menu"/)
})

test("utility actions retain canonical routes and expired-session behavior", () => {
  assert.match(
    source,
    /href=\{`\/s\/\$\{servicePointId\}\/waitstaff-request`\}/,
  )
  assert.match(source, /href=\{`\/s\/\$\{servicePointId\}\/orders`\}/)
  assert.match(source, /callWaiterEnabled &&[\s\S]*isSessionValid \?/)
  assert.match(source, /Session expired\. Rescan the QR code\./)
  assert.doesNotMatch(source, /href=\{`\/table\//)
})

test("notifications expand in place without changing read semantics", () => {
  assert.match(source, /aria-expanded=\{notificationsExpanded\}/)
  assert.match(source, /aria-controls="guest-utility-notification-list"/)
  assert.match(source, /setNotificationsExpanded\(\(current\) => !current\)/)
  assert.match(
    source,
    /const closeMenu = useCallback\(\(\) => \{[\s\S]*setNotificationsExpanded\(false\)[\s\S]*setOpen\(false\)/,
  )
  assert.match(source, /grid-rows-\[1fr\]/)
  assert.match(source, /inert=\{!notificationsExpanded\}/)
  assert.match(source, /markAsRead\(notif\.id\)/)
  assert.match(source, /onClick=\{markAllAsRead\}/)
  assert.doesNotMatch(source, /markAllAsSeen/)
})

test("the reference arrangement preserves smooth motion and mobile constraints", () => {
  assert.match(source, /transition-\[transform,opacity\] duration-\[260ms\]/)
  assert.match(source, /duration-300 ease-out motion-reduce:transition-none/)
  assert.match(source, /w-\[min\(calc\(100vw-2rem\),22rem\)\]/)
  assert.match(source, /max-h-\[calc\(100dvh-6rem\)\]/)
  assert.match(source, /collisionPadding=\{16\}/)
  assert.match(source, /aria-label="Close guest utility menu"/)
  assert.match(source, /bg-black\/35[\s\S]*fade-in-0 duration-200/)
})

test("the portalled utility menu receives the canonical customer branding variables", () => {
  assert.match(source, /useCustomerTheme\(\)/)
  assert.match(
    source,
    /<PopoverContent[\s\S]*aria-label="Guest utility menu"[\s\S]*style=\{themeVars\}/,
  )
  assert.match(source, /var\(--brand-primary/)
})

test("unsupported reference rows are not rendered as dead controls", () => {
  assert.doesNotMatch(source, />\s*Language\s*</)
  assert.doesNotMatch(source, />\s*Help & Support\s*</)
})
