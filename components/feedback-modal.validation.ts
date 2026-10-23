import { z } from "zod"

export const feedbackModalSchema = z.object({
  rating: z.number().int().min(1, "Please select a rating.").max(5),
  comment: z.string().max(500, "Comment must be 500 characters or fewer."),
})

export type FeedbackModalFormValues = z.infer<typeof feedbackModalSchema>

type FeedbackPayloadContext = {
  orderId: string
  businessId: string
  sessionId: string | null
}

export function getFeedbackModalDefaultValues(): FeedbackModalFormValues {
  return {
    rating: 0,
    comment: "",
  }
}

export function toFeedbackPayload(
  values: FeedbackModalFormValues,
  context: FeedbackPayloadContext,
) {
  return {
    orderId: context.orderId,
    businessId: context.businessId,
    overallRating: values.rating,
    tags: [],
    comment: values.comment,
    sessionId: context.sessionId,
  }
}

export function isFeedbackAlreadySubmittedConflict(error: unknown) {
  if (!error || typeof error !== "object") return false

  const response = (error as { response?: { status?: unknown } }).response
  return response?.status === 409
}
