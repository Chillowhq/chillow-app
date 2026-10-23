import type { ComponentProps } from "react"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import ReceiptModal from "./receipt-modal"

afterEach(() => {
  cleanup()
})

type ReceiptModalOverrides = Partial<ComponentProps<typeof ReceiptModal>>

function renderReceiptModal(overrides: ReceiptModalOverrides = {}) {
  const props: ComponentProps<typeof ReceiptModal> = {
    isOpen: true,
    onClose: vi.fn(),
    onDecline: vi.fn(),
    onSend: vi.fn(),
    businessName: "Chillow Hotel",
    ...overrides,
  }

  return {
    ...render(<ReceiptModal {...props} />),
    props,
  }
}

function emailInput() {
  return screen.getByRole("textbox", { name: "Email address" }) as HTMLInputElement
}

describe("ReceiptModal", () => {
  it("hydrates the email, focuses it, and renders accessible inline validation", async () => {
    const user = userEvent.setup()
    const { props } = renderReceiptModal({ defaultEmail: "guest@example.com" })
    const email = emailInput()

    expect(email.value).toBe("guest@example.com")
    expect(document.activeElement).toBe(email)

    await user.clear(email)
    await user.click(screen.getByRole("button", { name: "I want a receipt" }))

    const error = await screen.findByText("Please enter a valid email address.")
    expect(email.getAttribute("aria-invalid")).toBe("true")
    expect(email.getAttribute("aria-describedby")).toBe("receipt-email-error")
    expect(error.id).toBe("receipt-email-error")
    expect(props.onSend).not.toHaveBeenCalled()
  })

  it("submits typed values with keyboard focus and button activation", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    renderReceiptModal({ onSend })
    const email = emailInput()

    await user.type(email, "guest@example.com")
    const consent = screen.getByRole("checkbox") as HTMLInputElement
    await user.tab()
    expect(document.activeElement).toBe(consent)
    await user.click(consent)
    expect(consent.checked).toBe(true)
    await user.tab()
    const submit = screen.getByRole("button", { name: "I want a receipt" })
    expect(document.activeElement).toBe(submit)
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith("guest@example.com", true)
    })
  })

  it("disables duplicate submission while the callback is pending", async () => {
    const user = userEvent.setup()
    let resolveSend: (() => void) | undefined
    const onSend = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveSend = resolve
      }),
    )
    const { container } = renderReceiptModal({ onSend })

    await user.type(emailInput(), "guest@example.com")
    const submit = screen.getByRole("button", { name: "I want a receipt" }) as HTMLButtonElement
    await user.click(submit)

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledOnce()
      expect(submit.disabled).toBe(true)
      expect(container.querySelector("form")?.getAttribute("aria-busy")).toBe("true")
    })

    await user.click(submit)
    expect(onSend).toHaveBeenCalledOnce()

    resolveSend?.()
    await waitFor(() => {
      expect(submit.disabled).toBe(false)
    })
  })

  it("retains entered values and exposes callback failures as a root alert", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockRejectedValue(new Error("Receipt delivery failed."))
    renderReceiptModal({ onSend })
    const email = emailInput()

    await user.type(email, "guest@example.com")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "I want a receipt" }))

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Receipt delivery failed.")
    expect(email.value).toBe("guest@example.com")
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true)
  })

  it("keeps success behavior parent-owned and resets on a controlled reopen", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSend = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderReceiptModal({
      defaultEmail: "saved@example.com",
      onClose,
      onSend,
    })
    const email = emailInput()

    await user.clear(email)
    await user.type(email, "new@example.com")
    await user.click(screen.getByRole("button", { name: "I want a receipt" }))

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith("new@example.com", false)
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(email.value).toBe("new@example.com")

    rerender(
      <ReceiptModal
        isOpen={false}
        onClose={onClose}
        onDecline={vi.fn()}
        onSend={onSend}
        defaultEmail="saved@example.com"
        businessName="Chillow Hotel"
      />,
    )
    rerender(
      <ReceiptModal
        isOpen
        onClose={onClose}
        onDecline={vi.fn()}
        onSend={onSend}
        defaultEmail="reopened@example.com"
        businessName="Chillow Hotel"
      />,
    )

    await waitFor(() => {
      expect(emailInput().value).toBe("reopened@example.com")
    })
  })
})