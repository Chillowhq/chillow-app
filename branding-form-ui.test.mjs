import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const pageUrl = new URL("./app/owner/branding/page.tsx", import.meta.url)
const validationUrl = new URL(
  "./app/owner/branding/page.validation.ts",
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

test("branding schema preserves existing defaults and PATCH payload shape", async () => {
  const {
    brandingFormSchema,
    getBrandingFormDefaultValues,
    toBrandingPayload,
  } = await loadTypeScriptModule(validationUrl)
  const defaults = getBrandingFormDefaultValues()
  const valid = brandingFormSchema.safeParse({
    ...defaults,
    enabled: true,
    logoUrl: "https://cdn.example.com/logo.png",
    coverImageUrl: "https://cdn.example.com/cover.png",
    removeQuickServeBranding: true,
  })

  assert.deepEqual(defaults, {
    enabled: false,
    logoUrl: "",
    coverImageUrl: "",
    primaryColor: "#EA601A",
    secondaryColor: "#2B304C",
    accentColor: "#FB923C",
    backgroundColor: "#F8F9FA",
    removeQuickServeBranding: false,
  })
  assert.equal(valid.success, true)
  assert.deepEqual(toBrandingPayload(valid.data), valid.data)
})

test("branding schema rejects incomplete or malformed hex colors", async () => {
  const { brandingFormSchema, getBrandingFormDefaultValues } =
    await loadTypeScriptModule(validationUrl)
  const defaults = getBrandingFormDefaultValues()

  assert.equal(
    brandingFormSchema.safeParse({ ...defaults, primaryColor: "#EA601" }).success,
    false,
  )
  assert.equal(
    brandingFormSchema.safeParse({ ...defaults, secondaryColor: "orange" }).success,
    false,
  )
})

test("branding page keeps form, upload, entitlement, and error ownership local", async () => {
  const pageSource = await readFile(pageUrl, "utf8")

  assert.match(pageSource, /useForm<BrandingFormValues>/)
  assert.match(pageSource, /zodResolver\(brandingFormSchema\)/)
  assert.match(pageSource, /<form onSubmit=\{handleSubmit\(handleSave\)\}/)
  assert.match(pageSource, /<BrandingColorField/)
  assert.match(pageSource, /<FormNotice/)
  assert.match(pageSource, /classifyFormApiError\(err, "Failed to save branding"\)/)
  assert.match(
    pageSource,
    /apiClient\.patch\("\/owner\/branding", toBrandingPayload\(values\)\)/,
  )
  assert.match(pageSource, /reset\(getBrandingFormDefaultValues\(data\.branding\)\)/)
  assert.match(pageSource, /setValue\("logoUrl", res\.data\.logoUrl, \{ shouldDirty: true \}\)/)
  assert.match(pageSource, /setValue\("coverImageUrl", res\.data\.logoUrl, \{ shouldDirty: true \}\)/)
  assert.match(pageSource, /form\.append\("businessId", businessId\)/)
  assert.match(pageSource, /apiClient\.post\("\/upload\/business-logo", form/)
  assert.match(pageSource, /const hasAdvancedBranding = !!user\?\.entitlements\?\.advancedBranding/)
  assert.match(pageSource, /disabled=\{!isPro\}/)
  assert.match(pageSource, /disabled=\{isLoading \|\| loadError \|\| isSubmitting \|\| isBasicPlan\}/)
  assert.match(pageSource, /aria-busy=\{isSubmitting\}/)
  assert.doesNotMatch(pageSource, /const \[branding, setBranding\]/)
})
