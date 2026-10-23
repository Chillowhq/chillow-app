import type { ComponentProps } from "react"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { BusinessData } from "@/hooks/use-onboarding"
import { BusinessIdentityStep } from "./BusinessIdentityStep"

afterEach(() => {
  cleanup()
})

const validBusinessData: BusinessData = {
  name: "Golden Fork",
  displayName: "",
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

    expect(businessNameInput().value).toBe("Golden Fork")
    expect(slugInput().value).toBe("golden-fork")
    expect(emailInput().value).toBe("owner@goldenfork.example")

    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("renders inline required errors with focus and accessible relationships", async () => {
    const user = userEvent.setup()
    const { props } = renderBusinessIdentityStep({ initial: {}, ownerEmail: "" })

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

  it("submits the unchanged parent payload contract for valid input", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue({ success: true })
    renderBusinessIdentityStep({ onComplete })

    await user.click(screen.getByRole("button", { name: /Hotel \/ Apartment/ }))
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        name: "Golden Fork",
        displayName: "Golden Fork",
        businessType: "hotel",
        slug: "golden-fork",
        contactEmail: "owner@goldenfork.example",
        phoneNumber: "+14155552671",
      })
    })
  })

  it("retains values and exposes an unsuccessful parent result as a root notice", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue({ success: false, message: "Session could not be saved." })
    renderBusinessIdentityStep({ onComplete })

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const notice = await screen.findByRole("alert")
    expect(notice.textContent).toContain("Session could not be saved.")
    expect(businessNameInput().value).toBe("Golden Fork")
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
