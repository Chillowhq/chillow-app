import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const modalUrl = new URL("./components/receipt-modal.tsx", import.meta.url)
const validationUrl = new URL(
  "./components/receipt-modal.validation.ts",
  import.meta.url,
)
const apiErrorUrl = new URL("./lib/forms/api-error.ts", import.meta.url)
const transactionsPageUrl = new URL(
  "./app/owner/transactions/page.tsx",
  import.meta.url,
)

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

test("receipt schema keeps raw valid-email payloads and rejects missing, malformed, or whitespace-padded values", async () => {
  const {
    receiptModalSchema,
    getReceiptModalDefaultValues,
    toReceiptModalSubmission,
  } = await loadTypeScriptModule(validationUrl)
  const valid = receiptModalSchema.safeParse({
    email: "guest@example.com",
    marketingConsent: true,
  })

  assert.equal(valid.success, true)
  assert.deepEqual(getReceiptModalDefaultValues("saved@example.com"), {
    email: "saved@example.com",
    marketingConsent: false,
  })
  assert.deepEqual(toReceiptModalSubmission(valid.data), {
    email: "guest@example.com",
    marketingConsent: true,
  })
  assert.equal(
    receiptModalSchema.safeParse({ email: "", marketingConsent: false }).success,
    false,
  )
  assert.equal(
    receiptModalSchema.safeParse({
      email: "not-an-email",
      marketingConsent: false,
    }).success,
    false,
  )
  assert.equal(
    receiptModalSchema.safeParse({
      email: " guest@example.com ",
      marketingConsent: false,
    }).success,
    false,
  )
})

test("receipt root failures use the existing transport classifier", async () => {
  const { classifyFormApiError } = await loadTypeScriptModule(apiErrorUrl)
  const { AxiosError } = require("axios")

  assert.equal(classifyFormApiError(responseError(400), "fallback").kind, "validation")
  assert.equal(classifyFormApiError(responseError(500), "fallback").kind, "server")
  assert.equal(
    classifyFormApiError(new AxiosError("Network Error"), "fallback").kind,
    "network",
  )
})

test("receipt modal delegates the unchanged order receipt request to its existing parent", async () => {
  const [modalSource, transactionsSource] = await Promise.all([
    readFile(modalUrl, "utf8"),
    readFile(transactionsPageUrl, "utf8"),
  ])

  assert.equal(modalSource.includes("await onSend(submission.email, submission.marketingConsent)"), true)
  assert.equal(modalSource.includes("apiClient.post"), false)
  assert.equal(modalSource.includes("onClose()"), false)
  assert.equal(transactionsSource.includes("selectedTransaction.orderId"), true)
  assert.equal(transactionsSource.includes("/receipt"), true)
  assert.equal(transactionsSource.includes("email,"), true)
  assert.doesNotMatch(modalSource, /Idempotency-Key/)
})

test("receipt modal provides inline field errors and preserves callback-owned success behavior", async () => {
  const source = await readFile(modalUrl, "utf8")

  assert.equal(source.includes("zodResolver(receiptModalSchema)"), true)
  assert.match(source, /<Field/)
  assert.match(source, /<FormNotice/)
  assert.equal(source.includes('type="email"'), true)
  assert.equal(source.includes("required"), true)
  assert.equal(source.includes("autoFocus"), true)
  assert.equal(source.includes("noValidate"), true)
  assert.equal(source.includes("aria-busy={isSubmitting}"), true)
  assert.equal(source.includes("submissionInFlight"), true)
  assert.equal(source.includes("disabled={isSubmitting}"), true)
  assert.equal(source.includes("handleSubmit(submitReceipt)"), true)
  assert.equal(source.includes("reset(getReceiptModalDefaultValues(defaultEmail))"), true)
  assert.equal(source.includes("toast.error"), false)
})
