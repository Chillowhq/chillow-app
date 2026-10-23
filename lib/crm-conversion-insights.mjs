export const MIN_SAMPLE_FOR_PERFORMANCE_INSIGHT = 10

const formatCount = (value) => value.toLocaleString("en-US")

const formatPercentage = (value) => {
  const normalized = Number.isFinite(Number(value)) ? Number(value) : 0
  return Number(normalized.toFixed(1)).toString()
}

const pluralize = (count, singular, plural = `${singular}s`) =>
  count === 1 ? singular : plural

const sampleContext = (convertedJourneys) => {
  if (convertedJourneys >= MIN_SAMPLE_FOR_PERFORMANCE_INSIGHT) return ""

  return ` At least ${MIN_SAMPLE_FOR_PERFORMANCE_INSIGHT} converted journeys are needed before assessing performance.`
}

/**
 * Builds owner-facing interpretations from the existing customer-journey snapshot.
 * Keeping the snapshot as a single input leaves room for a future comparison
 * snapshot without coupling this logic to data fetching or the funnel UI.
 *
 * @param {{
 *   totalOrderingVisitors: number
 *   visitorsWhoOrdered: number
 *   visitorsWithoutOrder: number
 *   identifiedOrderingVisitors: number
 *   anonymousOrderingVisitors: number
 *   visitToOrderConversionRate: number
 *   orderToIdentifiedConversionRate: number
 *   customerJourneyRevenueCents: number
 * }} snapshot
 * @param {(cents: number) => string} formatCurrency
 * @returns {string[]}
 */
export function buildConversionInsights(snapshot, formatCurrency) {
  const {
    totalOrderingVisitors,
    visitorsWhoOrdered,
    visitorsWithoutOrder,
    identifiedOrderingVisitors,
    anonymousOrderingVisitors,
    visitToOrderConversionRate,
    orderToIdentifiedConversionRate,
    customerJourneyRevenueCents,
  } = snapshot

  if (totalOrderingVisitors === 0) {
    return ["No customer journeys were recorded during this period."]
  }

  if (visitorsWhoOrdered === 0) {
    return [
      `${formatCount(totalOrderingVisitors)} ${pluralize(totalOrderingVisitors, "visit")} were recorded during this period, but none resulted in an order yet.`,
      "More data is needed before customer identification performance can be evaluated.",
    ]
  }

  const noOrderSentence = visitorsWithoutOrder === 0
    ? "No visits ended without an order."
    : `${formatCount(visitorsWithoutOrder)} ${pluralize(visitorsWithoutOrder, "visit")} ended without an order.`

  const insights = [
    `${formatCount(visitorsWhoOrdered)} of ${formatCount(totalOrderingVisitors)} visits resulted in an order (${formatPercentage(visitToOrderConversionRate)}% conversion). ${noOrderSentence}`,
  ]

  const hasFullIdentification =
    identifiedOrderingVisitors === visitorsWhoOrdered &&
    anonymousOrderingVisitors === 0
  const performanceSampleContext = sampleContext(visitorsWhoOrdered)

  if (hasFullIdentification) {
    const identificationSubject = visitorsWhoOrdered === 1
      ? "The customer who ordered was"
      : `All ${formatCount(visitorsWhoOrdered)} customers who ordered were`

    insights.push(
      `${identificationSubject} identified (${formatPercentage(orderToIdentifiedConversionRate)}%), with no anonymous orders.${performanceSampleContext}`,
    )
  } else {
    insights.push(
      `${formatCount(identifiedOrderingVisitors)} of ${formatCount(visitorsWhoOrdered)} ${pluralize(visitorsWhoOrdered, "customer")} who ordered ${identifiedOrderingVisitors === 1 ? "was" : "were"} identified (${formatPercentage(orderToIdentifiedConversionRate)}%).${performanceSampleContext}`,
    )

    if (anonymousOrderingVisitors > 0) {
      const anonymousRate = (anonymousOrderingVisitors / visitorsWhoOrdered) * 100
      insights.push(
        `${formatCount(anonymousOrderingVisitors)} ${pluralize(anonymousOrderingVisitors, "customer")} ordered without being identified, representing ${formatPercentage(anonymousRate)}% of ordering customers.`,
      )
    }
  }

  if (customerJourneyRevenueCents > 0) {
    const revenuePerConvertedJourneyCents = Math.round(
      customerJourneyRevenueCents / visitorsWhoOrdered,
    )
    insights.push(
      `Converted visits generated ${formatCurrency(customerJourneyRevenueCents)} in tracked revenue, averaging ${formatCurrency(revenuePerConvertedJourneyCents)} per converted journey.`,
    )
  }

  return insights
}
