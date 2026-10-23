import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const modalUrl = new URL(
  "./components/service-points/RestaurantServicePointModal.tsx",
  import.meta.url,
)
const validationUrl = new URL(
  "./components/service-points/RestaurantServicePointModal.validation.ts",
  import.meta.url,
)
const fieldUrl = new URL("./components/forms/Field.tsx", import.meta.url)
const formNoticeUrl = new URL("./components/forms/FormNotice.tsx", import.meta.url)
const apiErrorUrl = new URL("./lib/forms/api-error.ts", import.meta.url)

async function loadRestaurantServicePointValidation() {
  const source = await readFile(validationUrl, "utf8")
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

test("restaurant service point form uses the approved RHF and Zod pilot stack", async () => {
  const source = await readFile(modalUrl, "utf8")

  assert.match(source, /from "react-hook-form"/)
  assert.match(source, /zodResolver\(restaurantServicePointSchema\)/)
  assert.match(source, /mode: "onBlur"/)
  assert.match(source, /shouldFocusError: true/)
  assert.match(source, /<Field id="restaurant-service-point-label"/)
  assert.match(source, /<FormNotice/)
  assert.match(source, /aria-busy=\{isSubmitting\}/)
  assert.match(source, /disabled=\{isSubmitting\}/)
  assert.match(source, /handleSubmit\(handleSave\)/)
})

test("restaurant service point form preserves the existing payload and leaves idempotency unchanged", async () => {
  const [modalSource, validationSource] = await Promise.all([
    readFile(modalUrl, "utf8"),
    readFile(validationUrl, "utf8"),
  ])

  assert.match(modalSource, /await onSave\(toRestaurantServicePointPayload\(values, servicePointType\)\)/)
  assert.match(validationSource, /label: values\.label\.trim\(\)/)
  assert.match(validationSource, /code: values\.code\.trim\(\)/)
  assert.match(validationSource, /capacity: values\.capacity \? Number\.parseInt\(values\.capacity, 10\) : null/)
  assert.match(validationSource, /servicePointType,/)
  assert.doesNotMatch(modalSource, /Idempotency-Key/)
  assert.doesNotMatch(validationSource, /Idempotency-Key/)
})

test("pilot form foundation separates field presentation from root transport errors", async () => {
  const [fieldSource, noticeSource, apiErrorSource] = await Promise.all([
    readFile(fieldUrl, "utf8"),
    readFile(formNoticeUrl, "utf8"),
    readFile(apiErrorUrl, "utf8"),
  ])

  assert.match(fieldSource, /aria-describedby/)
  assert.match(fieldSource, /aria-invalid/)
  assert.match(fieldSource, /htmlFor=\{id\}/)
  assert.match(fieldSource, /\$\{id\}-error/)
  assert.match(noticeSource, /role="alert"/)
  assert.match(apiErrorSource, /"validation"/)
  assert.match(apiErrorSource, /"authentication"/)
  assert.match(apiErrorSource, /"authorization"/)
  assert.match(apiErrorSource, /"conflict"/)
  assert.match(apiErrorSource, /"rate_limit"/)
  assert.match(apiErrorSource, /"network"/)
  assert.match(apiErrorSource, /"server"/)
  assert.doesNotMatch(apiErrorSource, /fieldErrors/)
})

test("restaurant service point schema accepts payload-compatible values and rejects invalid fields", async () => {
  const {
    restaurantServicePointSchema,
    toRestaurantServicePointPayload,
    formatRestaurantServicePointLabel,
  } = await loadRestaurantServicePointValidation()
  const valid = restaurantServicePointSchema.safeParse({
    label: "Table 10",
    code: "T10",
    capacity: "4",
  })

  assert.equal(valid.success, true)
  assert.deepEqual(toRestaurantServicePointPayload(valid.data, "table"), {
    label: "Table 10",
    code: "T10",
    capacity: 4,
    servicePointType: "table",
  })

  const blankCapacity = restaurantServicePointSchema.safeParse({
    label: "Table 11",
    code: "T11",
    capacity: "",
  })
  assert.equal(blankCapacity.success, true)
  assert.equal(toRestaurantServicePointPayload(blankCapacity.data, "table").capacity, null)

  for (const invalid of [
    { label: " ", code: "T1", capacity: "" },
    { label: "Table", code: "", capacity: "" },
    { label: "Table", code: "T1", capacity: "0" },
    { label: "Table", code: "T1", capacity: "not-a-number" },
  ]) {
    assert.equal(restaurantServicePointSchema.safeParse(invalid).success, false)
  }

  assert.equal(formatRestaurantServicePointLabel("  table 10"), "  Table 10")
})
