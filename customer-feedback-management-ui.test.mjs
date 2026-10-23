import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageUrl = new URL("./app/owner/feedback/page.tsx", import.meta.url)
const controllerUrl = new URL(
  "../Quickserve-be/src/controllers/feedbackController.js",
  import.meta.url,
)

test("feedback page uses the approved hierarchy and existing date ranges", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(source, />\s*Customer Feedback\s*<\/h1>/)
  assert.match(
    source,
    /Understand guest satisfaction and what guests are telling you\./,
  )
  for (const label of [
    "Today",
    "Yesterday",
    "Last 7 days",
    "This month",
    "Custom",
  ]) {
    assert.match(source, new RegExp('label: "' + label + '"|: "' + label + '"'))
  }
  assert.match(source, /useState<FeedbackRange>\("thisMonth"\)/)
  assert.doesNotMatch(source, /getBusinessId/)
})

test("feedback metrics preserve their authoritative calculations and denominator semantics", async () => {
  const [page, controller] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(controllerUrl, "utf8"),
  ])

  for (const label of [
    "Total Reviews",
    "CSAT Score",
    "Average Rating",
    "Response Rate",
  ]) {
    assert.match(page, new RegExp('label="' + label + '"'))
  }
  assert.match(page, /totalReviews \+[\s\S]*" of " \+[\s\S]*completedOrders/)
  assert.match(page, /completedOrders > 0[\s\S]*data\.overview\.responseRate \+ "%"/)
  assert.match(page, /"No completed orders"/)
  assert.match(
    page,
    /Response rate is calculated as feedback received divided[\s\S]*by completed orders in the selected period\./,
  )

  assert.match(
    controller,
    /Order\.countDocuments\(\{[\s\S]*businessId,[\s\S]*createdAt:[\s\S]*status: "completed"/,
  )
  assert.match(
    controller,
    /Math\.round\(\(totalFeedbacks \/ totalCompletedOrders\) \* 100\)/,
  )
  assert.match(controller, /overallRating >= 4\) csatPositives\+\+/)
  assert.match(controller, /sumOverall \/ totalFeedbacks/)
})

test("Needs Attention is exactly the low-rating classification and has no workflow actions", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(
    source,
    /\(data\?\.ratingDistribution\?\.\[1\] \|\| 0\) \+[\s\S]*ratingDistribution\?\.\[2\]/,
  )
  assert.match(source, /review\.overallRating < 3/)
  assert.match(source, /setClassification\("needs_attention"\)/)
  assert.match(source, /View low-rated feedback/)
  assert.doesNotMatch(
    source,
    /Reply|Resolve|Dismiss|Acknowledge|Mark as reviewed|Contact guest/,
  )
  assert.doesNotMatch(source, />\s*Positive\s*</)
})

test("filters and sorting use only fields present in the loaded feedback records", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(source, /review\.comment\?\.toLowerCase\(\)\.includes/)
  assert.match(source, /review\.orderId\?\.toLowerCase\(\)\.includes/)
  assert.match(source, /servicePoint\.toLowerCase\(\)\.includes/)
  assert.match(source, /review\.orderType === serviceTypeFilter/)
  assert.match(source, /servicePoint === servicePointFilter/)
  assert.match(source, /review\.overallRating === Number\(ratingFilter\)/)
  for (const sort of [
    "most_recent",
    "oldest",
    "highest_rating",
    "lowest_rating",
  ]) {
    assert.match(source, new RegExp('"' + sort + '"'))
  }
  assert.match(source, /Showing the latest/)
  assert.match(source, /recentReviews\.length/)
})

test("feedback cards prioritize rating, comment, context, and accessible text", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(source, /aria-label=\{rating \+ " out of 5 stars"\}/)
  assert.match(source, /No written feedback/)
  assert.doesNotMatch(source, /No comment provided/)
  assert.match(source, /review\.orderType/)
  assert.match(source, /review\.servicePointLabel \|\| review\.servicePointId/)
  assert.match(source, /Order \{review\.orderId\}/)
  assert.match(source, /formatPrice\(review\.orderValue, currency\)/)
  assert.match(source, /formatFeedbackDate\(review\.createdAt, timezone\)/)
})

test("loading, empty, filtered-empty, error, distribution, and honest AI states are present", async () => {
  const source = await readFile(pageUrl, "utf8")

  assert.match(source, /function FeedbackLoadingState/)
  assert.match(source, /Customer feedback could not be loaded/)
  assert.match(source, />\s*Retry\s*<\/Button>/)
  assert.match(source, /No feedback received in this period\./)
  assert.match(source, /No feedback matches these filters\./)
  assert.match(source, /No ratings in this period\./)
  assert.match(source, /Rating Distribution/)
  assert.match(source, /Feedback Insights/)
  assert.match(source, /Automated theme analysis is not enabled\./)
  assert.match(source, /aria-live="polite"/)
})
