import type { ComponentProps } from "react"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock("@/lib/axios-config", () => ({
  apiClient: { get: getMock },
}))

import {
  mergeOnboardingBusinessData,
  withoutConflictingLegacyBusinessType,
  type BusinessData,
} from "@/hooks/use-onboarding"
import { BusinessIdentityStep } from "./BusinessIdentityStep"

const venueCatalog = {
  version: 1,
  groups: [
    {
      id: "food_and_drinks",
      label: "Food & Drinks",
      venueTypes: [
        { id: "restaurant", label: "Restaurant", classificationGroup: "food_and_drinks", legacyBusinessType: "restaurant", defaultModules: ["foodService"], onboardingAvailable: true },
        { id: "cafe", label: "Café", classificationGroup: "food_and_drinks", legacyBusinessType: "restaurant", defaultModules: ["foodService"], onboardingAvailable: true },
        { id: "bar_lounge", label: "Bar & Lounge", classificationGroup: "food_and_drinks", legacyBusinessType: "bar_lounge", defaultModules: ["foodService"], onboardingAvailable: true },
        { id: "bakery", label: "Bakery", classificationGroup: "food_and_drinks", legacyBusinessType: "restaurant", defaultModules: ["foodService"], onboardingAvailable: true },
      ],
    },
    {
      id: "accommodation",
      label: "Accommodation",
      venueTypes: [
        { id: "hotel", label: "Hotel", classificationGroup: "accommodation", legacyBusinessType: "hotel", defaultModules: ["lodging"], onboardingAvailable: true },
        { id: "resort", label: "Resort", classificationGroup: "accommodation", legacyBusinessType: "hotel", defaultModules: ["lodging"], onboardingAvailable: true },
      ],
    },
  ],
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  getMock.mockReset()
  getMock.mockResolvedValue({ data: venueCatalog })
})

const validBusinessData: BusinessData = {
  name: "Golden Fork",
  displayName: "",
  venueType: "restaurant",
  businessType: "restaurant",
  slug: "golden-fork",
  contactEmail: "owner@goldenfork.example",
  phoneNumber: "+14155552671",
  countryCode: "US",
}

type BusinessIdentityStepOverrides = Partial<ComponentProps<typeof BusinessIdentityStep>>

function renderBusinessIdentityStep(overrides: BusinessIdentityStepOverrides = {}) {
  const props: ComponentProps<typeof BusinessIdentityStep> = {
    initial: validBusinessData,
    ownerEmail: "owner@goldenfork.example",
    onComplete: vi.fn().mockResolvedValue({ success: true }),
    onBack: vi.fn(),
    isLoading: false,
    ...overrides,
  }

  return {
    ...render(<BusinessIdentityStep {...props} />),
    props,
  }
}

async function waitForVenueCatalog() {
  await screen.findByRole("radio", { name: "Restaurant" })
}

function businessNameInput() {
  return screen.getByRole("textbox", { name: "Business Name" }) as HTMLInputElement
}

function slugInput() {
  return screen.getByRole("textbox", { name: "Your Chillow URL" }) as HTMLInputElement
}

function emailInput() {
  return screen.getByRole("textbox", { name: "Contact Email" }) as HTMLInputElement
}

function phoneInput() {
  return screen.getByRole("textbox", { name: "Phone Number" }) as HTMLInputElement
}

describe("BusinessIdentityStep", () => {
  it("hydrates parent values and delegates Back navigation", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderBusinessIdentityStep({ onBack })
    await waitForVenueCatalog()

    expect(businessNameInput().value).toBe("Golden Fork")
    expect(slugInput().value).toBe("golden-fork")
    expect(emailInput().value).toBe("owner@goldenfork.example")
    expect(screen.getByRole("radio", { name: "Restaurant" }).getAttribute("aria-checked")).toBe("true")

    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("renders the backend-provided groups and selectable venue types", async () => {
    renderBusinessIdentityStep()
    await waitForVenueCatalog()

    expect(screen.getByRole("heading", { name: "Food & Drinks" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Accommodation" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Café" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Resort" })).toBeTruthy()
  })

  it("renders inline required errors with focus and accessible relationships", async () => {
    const user = userEvent.setup()
    const { props } = renderBusinessIdentityStep({ initial: {}, ownerEmail: "" })
    await waitForVenueCatalog()

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const nameError = await screen.findByText("Business name is required")
    const name = businessNameInput()
    expect(name.getAttribute("aria-invalid")).toBe("true")
    expect(name.getAttribute("aria-describedby")).toBe("ob-biz-name-error")
    expect(nameError.id).toBe("ob-biz-name-error")
    expect(document.activeElement).toBe(name)
    expect(props.onComplete).not.toHaveBeenCalled()
  })

  it("validates the existing phone control without changing its submission representation", async () => {
    const user = userEvent.setup()
    renderBusinessIdentityStep({ initial: { ...validBusinessData, phoneNumber: "+1415" } })
    await waitForVenueCatalog()
    const phone = phoneInput()

    await user.clear(phone)
    await user.type(phone, "+1415")
    await user.tab()

    const phoneError = await screen.findByText("Enter a complete, valid phone number")
    expect(phone.getAttribute("aria-invalid")).toBe("true")
    expect(phone.getAttribute("aria-describedby")).toBe("ob-phone-error")
    expect(phoneError.id).toBe("ob-phone-error")
  })

  it("derives a slug automatically and preserves a manual slug when the name changes", async () => {
    const user = userEvent.setup({ delay: null })
    renderBusinessIdentityStep({ initial: {}, ownerEmail: "" })
    await waitForVenueCatalog()
    const name = businessNameInput()
    const slug = slugInput()

    await user.type(name, "A B")
    await waitFor(() => {
      expect(slug.value).toBe("a-b")
    })

    await user.clear(slug)
    await user.type(slug, "mine")
    await user.clear(name)
    await user.type(name, "C D")

    expect(slug.value).toBe("mine")
    expect(screen.getByRole("button", { name: /Auto-generate from name/ })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: /Auto-generate from name/ }))
    expect(slug.value).toBe("c-d")
  })

  it.each([
    ["Café", "cafe"],
    ["Resort", "resort"],
  ])("submits the selected %s venueType without a client businessType", async (label, venueType) => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue({ success: true })
    renderBusinessIdentityStep({ onComplete })
    await waitForVenueCatalog()

    await user.click(screen.getByRole("radio", { name: label }))
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        name: "Golden Fork",
        displayName: "Golden Fork",
        venueType,
        slug: "golden-fork",
        contactEmail: "owner@goldenfork.example",
        phoneNumber: "+14155552671",
      })
    })
  })

  it("updates the selected venue type when the user changes their choice", async () => {
    const user = userEvent.setup()
    renderBusinessIdentityStep()
    await waitForVenueCatalog()

    const cafe = screen.getByRole("radio", { name: "Café" })
    const resort = screen.getByRole("radio", { name: "Resort" })
    await user.click(cafe)
    expect(cafe.getAttribute("aria-checked")).toBe("true")

    await user.click(resort)
    expect(cafe.getAttribute("aria-checked")).toBe("false")
    expect(resort.getAttribute("aria-checked")).toBe("true")
  })

  it("retains values and exposes an unsuccessful parent result as a root notice", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue({ success: false, message: "Session could not be saved." })
    renderBusinessIdentityStep({ onComplete })
    await waitForVenueCatalog()

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const notice = await screen.findByRole("alert")
    expect(notice.textContent).toContain("Session could not be saved.")
    expect(businessNameInput().value).toBe("Golden Fork")
  })

  it("shows a recoverable catalog error and retries without allowing submission", async () => {
    const user = userEvent.setup()
    getMock.mockRejectedValueOnce(new Error("Business types could not be loaded."))
    renderBusinessIdentityStep()

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Business types could not be loaded.")
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true)

    await user.click(screen.getByRole("button", { name: /Try again/ }))
    await waitForVenueCatalog()
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("does not allow an unsupported restored venue type to be submitted", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue({ success: true })
    renderBusinessIdentityStep({
      initial: { ...validBusinessData, venueType: "spa" },
      onComplete,
    })
    await waitForVenueCatalog()

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByText("Choose the type of business you operate")).toBeTruthy()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("prevents rapid duplicate completion callbacks while a valid save is pending", async () => {
    const user = userEvent.setup()
    let resolveCompletion: ((result: { success: boolean }) => void) | undefined
    const onComplete = vi.fn(
      () => new Promise<{ success: boolean }>((resolve) => {
        resolveCompletion = resolve
      }),
    )
    const { container } = renderBusinessIdentityStep({ onComplete })
    await waitForVenueCatalog()
    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement

    await user.click(continueButton)
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce()
      expect(continueButton.disabled).toBe(true)
      expect(container.querySelector("form")?.getAttribute("aria-busy")).toBe("true")
    })

    await user.click(continueButton)
    expect(onComplete).toHaveBeenCalledOnce()

    resolveCompletion?.({ success: true })
    await waitFor(() => {
      expect(continueButton.disabled).toBe(false)
    })
  })
})

describe("withoutConflictingLegacyBusinessType", () => {
  it("does not allow a stale businessType to be sent with a selected venueType", () => {
    expect(withoutConflictingLegacyBusinessType({
      ...validBusinessData,
      venueType: "resort",
      businessType: "restaurant",
    })).toEqual({
      name: "Golden Fork",
      displayName: "",
      venueType: "resort",
      slug: "golden-fork",
      contactEmail: "owner@goldenfork.example",
      phoneNumber: "+14155552671",
      countryCode: "US",
    })
  })

  it("keeps Location and Plan fields while preventing later saves from restoring businessType", () => {
    expect(mergeOnboardingBusinessData(
      { ...validBusinessData, venueType: "resort", businessType: "hotel" },
      { country: "Malta", countryCode: "MT", plan: "professional", currentPlan: "professional" },
    )).toEqual({
      name: "Golden Fork",
      displayName: "",
      venueType: "resort",
      slug: "golden-fork",
      contactEmail: "owner@goldenfork.example",
      phoneNumber: "+14155552671",
      country: "Malta",
      countryCode: "MT",
      plan: "professional",
      currentPlan: "professional",
    })
  })
})
