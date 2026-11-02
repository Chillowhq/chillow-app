import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readBrandingPage = () => readFile(new URL("./app/owner/branding/page.tsx", import.meta.url), "utf8")

test("Operations Branding uses storefront terminology without changing the cover-image field", async () => {
  const page = await readBrandingPage()

  assert.match(page, /title="Business Branding"/)
  assert.match(page, /Customize how your business appears across Chillow's guest-facing experiences\./)
  assert.match(page, /<h2[^>]*>Brand Assets<\/h2>/)
  assert.match(page, /Manage your business logo and storefront cover image\./)
  assert.match(page, /Storefront Cover Image/)
  assert.match(page, /The main image displayed on your public business storefront\./)
  assert.match(page, /setValue\("coverImageUrl", res\.data\.branding\.coverImageUrl/)
  assert.match(page, /Storefront cover image saved successfully\./)
  assert.doesNotMatch(page, /Customer Menu Branding|Menu Cover Image|Current menu cover|customer-facing QR menu/)
})

test("branding asset upload labels use venue-neutral terminology", async () => {
  const page = await readBrandingPage()

  assert.match(page, /aria-label="Upload storefront cover image"/)
  assert.match(page, /alt="Current storefront cover image"/)
  assert.match(page, /aria-label="Upload business logo"/)
  assert.match(page, /Upload a square or circular logo with a transparent background for best results\./)
})
