import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const hookUrl = new URL("./hooks/use-ai-business-analyst.ts", import.meta.url)
const typesUrl = new URL("./types/ai-business-analyst.ts", import.meta.url)

test("AI analyst exposes the current grouped period-selection contract", async () => {
  const [hook, types] = await Promise.all([
    readFile(hookUrl, "utf8"),
    readFile(typesUrl, "utf8"),
  ])

  assert.match(hook, /\/owner\/ai-business-analyst\/latest/)
  assert.match(hook, /\/owner\/ai-business-analyst\/history\?limit=20/)
  assert.match(hook, /\/owner\/ai-business-analyst\/current-week/)
  assert.match(hook, /badge: "live"/)
  assert.match(hook, /isCurrentWeek: true/)
  assert.match(hook, /isSelectable: true/)
  assert.match(hook, /const selectCurrentWeek = useCallback/)
  assert.match(hook, /setSelectedView\(\{ type: "current-week" \}\)/)
  assert.match(hook, /thisWeek,[\s\S]*lastWeek,[\s\S]*customHistory/)
  assert.match(types, /badge: "live" \| "final" \| "unavailable" \| "generating"/)
})

test("a missing latest final report remains visible but cannot be selected", async () => {
  const hook = await readFile(hookUrl, "utf8")

  assert.match(
    hook,
    /latestCompletedWeek\s*&&\s*isLatestFinalMissing\s*&&\s*!items\.some/,
  )
  assert.match(hook, /periodKey: latestCompletedWeek\.periodKey/)
  assert.match(hook, /badge: "generating"/)
  assert.match(hook, /isCurrentWeek: false/)
  assert.match(hook, /isSelectable: false/)
})
