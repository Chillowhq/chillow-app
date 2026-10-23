import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("customer ordering sends stable per-attempt idempotency keys and renders 409 stock failures", async () => {
  const source = await readFile(
    new URL("./app/s/[servicePointId]/order/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /useRef<Partial<Record<PaymentChannel, string>>>/)
  assert.match(source, /headers:\s*\{\s*"Idempotency-Key": idempotencyKey\s*\}/)
  assert.match(source, /status === 400 \|\| status === 409/)
  assert.doesNotMatch(source, /release.*inventory|cancel.*checkout.*endpoint/i)
})

test("waitstaff ordering uses the same durable request and stock-conflict UX", async () => {
  const source = await readFile(
    new URL("./app/waitstaff/take-order/[servicePointId]/checkout/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /orderIdempotencyKey = useRef<string \| null>/)
  assert.match(source, /headers:\s*\{\s*"Idempotency-Key": orderIdempotencyKey\.current\s*\}/)
  assert.match(source, /status === 400 \|\| status === 409/)
})
