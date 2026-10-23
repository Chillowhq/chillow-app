import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(path, import.meta.url), "utf8")

test("invoice history uses the invoice currency and integer minor units", async () => {
  const source = await read("./app/owner/billing/page.tsx")
  assert.match(source, /formatMinorCurrency/)
  assert.match(source, /invoice\.currency \|\| billingInfo\?\.currency/)
  assert.match(source, /Number\.isSafeInteger\(invoice\.amountPaid\)/)
  assert.match(source, /Number\.isSafeInteger\(invoice\.amountDue\)/)
  assert.match(source, /formatInvoiceAmount\(inv\)/)
})

test("invoice history consumes durable URLs and Stripe creation time", async () => {
  const source = await read("./app/owner/billing/page.tsx")
  assert.match(source, /inv\.hostedInvoiceUrl \|\| inv\.hosted_invoice_url/)
  assert.match(source, /inv\.invoicePdf \|\| inv\.invoice_pdf/)
  assert.match(source, /inv\.stripeCreatedAt \|\| inv\.createdAt/)
})

test("shared minor-unit formatter derives each currency exponent", async () => {
  const source = await read("./lib/localization.ts")
  assert.match(source, /resolvedOptions\(\)\.maximumFractionDigits \?\? 2/)
  assert.match(source, /amount \/ \(10 \*\* exponent\)/)

  const formatMinor = (amount, currency) => {
    const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency })
    const exponent = formatter.resolvedOptions().maximumFractionDigits
    return formatter.format(amount / (10 ** exponent))
  }
  assert.match(formatMinor(5000, "JPY"), /5,000/)
  assert.doesNotMatch(formatMinor(5000, "JPY"), /50\.00/)
  assert.match(formatMinor(5000, "EUR"), /50\.00/)
  assert.match(formatMinor(5000, "USD"), /50\.00/)
})
