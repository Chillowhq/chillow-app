import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [menuView, featuredSwiper, menuCard, cartBar, customerHeader, detailSheet, categoryTabs, rootLayout] =
  await Promise.all([
    readFile(new URL("./components/table-menu-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/featured-swiper.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/menu-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/cart-bar.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/customer-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/item-detail-sheet.tsx", import.meta.url), "utf8"),
    readFile(new URL("./components/category-tabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/layout.tsx", import.meta.url), "utf8"),
  ])

test("guest menu preserves the canonical API, QR, and cart integrations", () => {
  assert.match(menuView, /\/public\/business-config\?businessId=\$\{businessId\}/)
  assert.match(menuView, /\/menu-items\?businessId=\$\{businessId\}/)
  assert.match(menuView, /\/menu-items\/popular\?businessId=\$\{businessId\}/)
  assert.match(menuView, /saveTableToken\(servicePointId, sessionToken\)/)
  assert.match(menuView, /ensureCartContext\(\{[\s\S]*actor: isWaiterMode \? "waitstaff" : "customer"/)
  assert.match(menuView, /useCartStore/)
  assert.match(menuView, /<ItemDetailSheet/)
})

test("the approved hero-first information hierarchy uses actual data", () => {
  const heroPosition = menuView.indexOf("<FeaturedSwiper")
  const identityPosition = menuView.indexOf("<CustomerHeader")
  const waitstaffPosition = menuView.indexOf("<GuestWaitstaffRequestCard")
  const searchPosition = menuView.indexOf('id="guest-menu-search"')
  const categoryPosition = menuView.indexOf('aria-label="Menu categories"')

  assert.ok(heroPosition >= 0)
  assert.ok(identityPosition > heroPosition)
  assert.ok(waitstaffPosition > identityPosition)
  assert.ok(searchPosition > waitstaffPosition)
  assert.ok(categoryPosition > searchPosition)
  assert.match(customerHeader, /businessLogoUrl/)
  assert.match(customerHeader, /displayServicePoint/)
  assert.match(menuView, /isRestaurantOpen\(restaurant\.operatingHours, restaurant\.timezone\)/)
})

test("the approved mobile composition uses an immersive hero and integrated discovery surface", () => {
  assert.match(featuredSwiper, /h-\[23rem\]/)
  assert.match(featuredSwiper, /saturate\(1\.08\)_contrast\(1\.03\)/)
  assert.match(menuView, /-mt-8 rounded-t-\[2\.75rem\]/)
  assert.match(menuView, /placeholder="Search delicious dishes\.\.\."/)
  assert.match(menuView, /min-h-16 w-full rounded-full/)
  assert.match(categoryTabs, /min-h-13/)
  assert.doesNotMatch(customerHeader, /rounded-\[1\.75rem\].*border.*shadow/)
  assert.match(rootLayout, /viewportFit: "cover"/)
})

test("hero supports manual arrows, pagination, keyboard, pointer/touch swipe, and reduced motion", () => {
  assert.match(featuredSwiper, /aria-roledescription="carousel"/)
  assert.match(featuredSwiper, /event\.key === "ArrowLeft"/)
  assert.match(featuredSwiper, /event\.key === "ArrowRight"/)
  assert.match(featuredSwiper, /onPointerDown/)
  assert.match(featuredSwiper, /onPointerUp/)
  assert.match(featuredSwiper, /touch-pan-y/)
  assert.match(featuredSwiper, /if \(didSwipe\.current\)/)
  assert.match(featuredSwiper, /Previous featured item/)
  assert.match(featuredSwiper, /Next featured item/)
  assert.match(featuredSwiper, /aria-current=/)
  assert.match(featuredSwiper, /motion-reduce:transition-none/)
  assert.match(featuredSwiper, /onClick=\{\(\) => goToSlide\(index\)\}/)
})

test("hero autoplay advances multiple slides with one cleanup-safe timer", () => {
  assert.match(featuredSwiper, /FEATURED_AUTOPLAY_INTERVAL_MS = 3_600/)
  assert.match(featuredSwiper, /FEATURED_AUTOPLAY_RESUME_DELAY_MS = 6_000/)
  assert.match(featuredSwiper, /featuredItems\.length < 2/)
  assert.match(featuredSwiper, /\(safeCurrent \+ 1\) % featuredItems\.length/)
  assert.equal((featuredSwiper.match(/window\.setTimeout/g) || []).length, 1)
  assert.match(featuredSwiper, /return \(\) => window\.clearTimeout\(timer\)/)
  assert.doesNotMatch(featuredSwiper, /setInterval/)
  assert.match(featuredSwiper, /resetAutoplayAfterInteraction\(\)/)
  assert.match(featuredSwiper, /setAutoplayDelayMs\(FEATURED_AUTOPLAY_RESUME_DELAY_MS\)/)
})

test("hero autoplay is disabled for reduced motion and overlays preserve pointer interaction", () => {
  assert.match(featuredSwiper, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
  assert.match(featuredSwiper, /media\.addEventListener\("change", syncPreference\)/)
  assert.match(featuredSwiper, /media\.removeEventListener\("change", syncPreference\)/)
  assert.match(featuredSwiper, /prefersReducedMotion \|\|/)
  assert.match(featuredSwiper, /pointer-events-none absolute inset-0 bg-\[linear-gradient\(90deg/)
  assert.match(featuredSwiper, /pointer-events-none absolute inset-0 bg-\[linear-gradient\(to_top/)
  assert.match(featuredSwiper, /rgba\(4,8,18,\.66\)/)
})

test("search and categories remain client-side and expose clear empty states", () => {
  assert.match(menuView, /item\.name\.toLowerCase\(\)\.includes\(normalizedSearch\)/)
  assert.match(menuView, /item\.category\.toLowerCase\(\)\.includes\(normalizedSearch\)/)
  assert.match(menuView, /aria-label="Clear menu search"/)
  assert.match(menuView, /No menu items available/)
  assert.match(menuView, /No matching menu items/)
  assert.match(menuView, /Menu couldn&apos;t be loaded/)
  assert.match(menuView, /Try again/)
})

test("popular and category discovery rows use real items without fake favourites", () => {
  assert.match(menuView, /Most ordered this week/)
  assert.match(menuView, /popularItems\.slice\(0, 8\)/)
  assert.match(menuView, /w-\[54vw\] min-w-\[172px\] max-w-\[232px\]/)
  assert.match(menuView, /categoryItems\.length > 4/)
  assert.doesNotMatch(menuView + menuCard, /Heart|favorite|favourite/i)
})

test("cards expose canonical availability and accessible 44px quantity controls", () => {
  assert.match(menuCard, /item\.inventory\?\.availableQuantity/)
  assert.match(menuCard, /item\.inventory\?\.isLowStock === true/)
  assert.match(menuCard, /availabilityStatus === "sold_out" \|\| availableQuantity === 0/)
  assert.match(menuCard, /disabled=\{!canAdd\}/)
  assert.match(menuCard, /`Add \$\{item\.name\} to order`/)
  assert.match(menuCard, /`Ordering is closed for \$\{item\.name\}`/)
  assert.match(menuCard, /h-11 w-11/)
  assert.match(detailSheet, /Increase \$\{item\.name\} quantity/)
  assert.match(detailSheet, /Decrease \$\{item\.name\} quantity/)
  assert.doesNotMatch(menuCard, /Unlimited/)
})

test("guest visibility preference controls unavailable items without making them orderable", () => {
  assert.match(menuView, /orderingPreferences\?\.hideOutOfStockItems \?\? false/)
  assert.match(menuView, /hideOutOfStock\s*\?\s*responseItems\.filter\(\(item: MenuItem\) => item\.isAvailable\)/)
  assert.match(menuView, /hideOutOfStock\s*\?\s*popularResponseItems\.filter\(\(item: MenuItem\) => item\.isAvailable\)/)
  assert.match(menuCard, /disabled=\{!canAdd\}/)
  assert.match(detailSheet, /const canOrderItem = item\.isAvailable && isBusinessOpen/)
  assert.match(detailSheet, /if \(!canOrderItem\) return/)
  assert.match(detailSheet, /\{unavailableLabel\}/)
})

test("cart affordance remains store-driven, persistent, and financially neutral", () => {
  assert.match(menuView, /itemCount > 0 &&/)
  assert.match(cartBar, /formatPrice\(subtotal, currency\)/)
  assert.match(cartBar, /\/s\/\$\{servicePointId\}\/order/)
  assert.match(cartBar, /env\(safe-area-inset-bottom\)/)
  assert.doesNotMatch(cartBar, /tax|fee|discount/i)
})
