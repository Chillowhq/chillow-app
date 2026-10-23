import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageUrl = new URL(
  "./app/s/[servicePointId]/waitstaff-request/page.tsx",
  import.meta.url,
)
const hookUrl = new URL("./hooks/use-waitstaff-request.ts", import.meta.url)
const realtimeProviderUrl = new URL(
  "./components/providers/customer-guest-realtime-provider.tsx",
  import.meta.url,
)

test("waiter-call HTTP create and list send the canonical visit device identity", async () => {
  const [page, hook, realtimeProvider] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(hookUrl, "utf8"),
    readFile(realtimeProviderUrl, "utf8"),
  ])

  assert.match(page, /useCustomerGuestRealtime\(\)\.waitstaff/)
  assert.match(realtimeProvider, /useWaitstaffRequest\(\{/)
  assert.match(hook, /import \{[\s\S]*ensureSessionId[\s\S]*getTableToken[\s\S]*isTableSessionValid[\s\S]*\} from "@\/lib\/guest-session"/)
  assert.match(hook, /apiClient\.get\("\/waitstaff\/calls", \{[\s\S]*servicePointId,[\s\S]*token,[\s\S]*sessionId/)
  assert.match(hook, /apiClient\.post\("\/waitstaff\/calls", \{[\s\S]*token: currentToken,[\s\S]*sessionId: currentSessionId/)
})
