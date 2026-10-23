import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const modalUrl = new URL("./components/feedback-modal.tsx", import.meta.url)
const validationUrl = new URL(
  "./components/feedback-modal.validation.ts",
  import.meta.url,
)
const apiErrorUrl = new URL("./lib/forms/api-error.ts", import.meta.url)

async function loadTypeScriptModule(url) {
  const source = await readFile(url, "utf8")
  const typescript = require("typescript")
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText
  const compiledModule = { exports: {} }

  new Function("require", "module", "exports", compiled)(
    require,
    compiledModule,
    compiledModule.exports,
  )

  return compiledModule.exports
}

function responseError(status, data = { error: "Request failed" }) {
  const { AxiosError } = require("axios")
  return new AxiosError(
    "Request failed",
    undefined,
    undefined,
    undefined,
    { status, data },
  )
}

test("feedback schema accepts existing inputs and preserves its request payload", async () => {
  const {
    feedbackModalSchema,
    getFeedbackModalDefaultValues,
    toFeedbackPayload,
  } = await loadTypeScriptModule(validationUrl)
  const valid = feedbackModalSchema.safeParse({
    rating: 5,
    comment: "  Wonderful service.  ",
  })

  assert.equal(valid.success, true)
  assert.deepEqual(getFeedbackModalDefaultValues(), { rating: 0, comment: "" })
  assert.deepEqual(
    toFeedbackPayload(valid.data, {
      orderId: "order-1",
      businessId: "business-1",
      sessionId: "session-1",
    }),
    {
      orderId: "order-1",
      businessId: "business-1",
      overallRating: 5,
      tags: [],
      comment: "  Wonderful service.  ",
      sessionId: "session-1",
    },
  )
  assert.equal(
    toFeedbackPayload(valid.data, {
      orderId: "order-1",
      businessId: "business-1",
      sessionId: null,
    }).sessionId,
    null,
  )

  assert.equal(
    feedbackModalSchema.safeParse({ rating: 0, comment: "" }).success,
    false,
  )
  assert.equal(
    feedbackModalSchema.safeParse({ rating: 6, comment: "" }).success,
    false,
  )
  assert.equal(
    feedbackModalSchema.safeParse({ rating: 4, comment: "x".repeat(501) })
      .success,
    false,
  )
  assert.equal(
    feedbackModalSchema.safeParse({ rating: 4, comment: "" }).success,
    true,
  )
})

test("feedback-specific 409 remains a successful already-submitted outcome", async () => {
  const { isFeedbackAlreadySubmittedConflict } = await loadTypeScriptModule(
    validationUrl,
  )

  assert.equal(isFeedbackAlreadySubmittedConflict(responseError(409)), true)
  assert.equal(isFeedbackAlreadySubmittedConflict(responseError(400)), false)
  assert.equal(isFeedbackAlreadySubmittedConflict(new Error("Network Error")), false)
})

test("generic feedback failures retain transport classification without field parsing", async () => {
  const { classifyFormApiError } = await loadTypeScriptModule(apiErrorUrl)
  const { AxiosError } = require("axios")

  assert.equal(classifyFormApiError(responseError(400), "fallback").kind, "validation")
  assert.equal(classifyFormApiError(responseError(401), "fallback").kind, "authentication")
  assert.equal(classifyFormApiError(responseError(403), "fallback").kind, "authorization")
  assert.equal(classifyFormApiError(responseError(429), "fallback").kind, "rate_limit")
  assert.equal(classifyFormApiError(responseError(500), "fallback").kind, "server")
  assert.equal(
    classifyFormApiError(new AxiosError("Network Error"), "fallback").kind,
    "network",
  )
})

test("feedback modal keeps request, pending, error, and accessibility ownership local", async () => {
  const source = await readFile(modalUrl, "utf8")
  const conflictIndex = source.indexOf("isFeedbackAlreadySubmittedConflict(error)")
  const genericErrorIndex = source.indexOf("classifyFormApiError(error, fallbackMessage)")

  assert.match(source, /from "react-hook-form"/)
  assert.equal(source.includes("zodResolver(feedbackModalSchema)"), true)
  assert.match(source, /<Controller/)
  assert.match(source, /<Field/)
  assert.match(source, /<FormNotice/)
  assert.equal(source.includes("await apiClient.post("), true)
  assert.equal(source.includes('"/feedback",'), true)
  assert.equal(source.includes("toFeedbackPayload(values, {"), true)
  assert.match(source, /submissionInFlight/)
  assert.equal(source.includes("disabled={isSubmitting}"), true)
  assert.equal(source.includes("aria-busy={isSubmitting}"), true)
  assert.equal(source.includes("aria-invalid={errors.rating"), true)
  assert.equal(source.includes("aria-describedby={errors.rating"), true)
  assert.match(source, /role="group"/)
  assert.equal(source.includes("handleSubmit(submitFeedback)"), true)
  assert.doesNotMatch(source, /Idempotency-Key/)
  assert.equal(conflictIndex >= 0, true)
  assert.equal(genericErrorIndex > conflictIndex, true)
  assert.equal(source.includes("reset("), false)
})
