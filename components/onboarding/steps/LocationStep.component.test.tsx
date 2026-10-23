import type { ComponentProps } from "react"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { BusinessData } from "@/hooks/use-onboarding"
import { findCountryMetadata } from "@/lib/country-metadata"
import { LocationStep } from "./LocationStep"

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock("@/lib/axios-config", () => ({
  apiClient: { get: apiGet },
}))

const unitedStates = findCountryMetadata("US")
const canada = findCountryMetadata("CA")

if (!unitedStates || !canada) {
  throw new Error("Expected country metadata is unavailable")
}

const unitedStatesTimezone = unitedStates.timezones.includes("America/New_York")
  ? "America/New_York"
  : unitedStates.timezone

const validLocationData: BusinessData = {
  country: unitedStates.country,
  countryCode: unitedStates.countryCode,
  address: "1 Market Street, San Francisco, CA",
  addressPlaceId: "place-existing",
  latitude: 37.7936,
  longitude: -122.3958,
  currency: unitedStates.currency,
  timezone: unitedStatesTimezone,
  language: "en",
}

afterEach(() => {
  cleanup()
  apiGet.mockReset()
})

type LocationStepOverrides = Partial<ComponentProps<typeof LocationStep>>

function renderLocationStep(overrides: LocationStepOverrides = {}) {
  const props: ComponentProps<typeof LocationStep> = {
    sessionId: "onboarding-session",
    initial: validLocationData,
    onComplete: vi.fn().mockResolvedValue({ success: true }),
    onBack: vi.fn(),
    isLoading: false,
    ...overrides,
  }

  return {
    ...render(<LocationStep {...props} />),
    props,
  }
}

function countryInput() {
  return screen.getByRole("textbox", { name: "Country" }) as HTMLInputElement
}

function addressInput() {
  return screen.getByRole("textbox", { name: "Business Address" }) as HTMLInputElement
}

function languageSelect() {
  return screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement
}

function timezoneSelect() {
  return screen.getByRole("combobox", { name: "Timezone" }) as HTMLSelectElement
}

describe("LocationStep", () => {
  it("hydrates parent location values on each mount and delegates Back navigation", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const { unmount } = renderLocationStep({ onBack })

    expect(countryInput().value).toBe(unitedStates.country)
    expect(addressInput().value).toBe("1 Market Street, San Francisco, CA")
    expect(languageSelect().value).toBe("en")
    expect(timezoneSelect().value).toBe(unitedStatesTimezone)

    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(onBack).toHaveBeenCalledOnce()

    unmount()
    renderLocationStep()
    expect(addressInput().value).toBe("1 Market Street, San Francisco, CA")
  })

  it("renders inline required errors with focus and accessible relationships", async () => {
    const user = userEvent.setup()
    const { props } = renderLocationStep({ initial: {} })

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const countryError = await screen.findByText("Country is required")
    const country = countryInput()
    const address = addressInput()
    expect(country.getAttribute("aria-invalid")).toBe("true")
    expect(country.getAttribute("aria-describedby")).toBe("ob-country-error")
    expect(countryError.id).toBe("ob-country-error")
    expect(address.getAttribute("aria-invalid")).toBe("true")
    expect(address.getAttribute("aria-describedby")).toBe("ob-address-error")
    expect(document.activeElement).toBe(country)
    expect(props.onComplete).not.toHaveBeenCalled()
  })

  it("requests suggestions, applies the selection, and submits the unchanged location payload", async () => {
    const user = userEvent.setup({ delay: null })
    const onComplete = vi.fn().mockResolvedValue({ success: true })
    apiGet.mockResolvedValueOnce({
      data: {
        suggestions: [{
          placeId: "place-market",
          text: "123 Market Street, San Francisco, CA",
          mainText: "123 Market Street",
          secondaryText: "San Francisco, CA",
        }],
      },
    })
    renderLocationStep({
      initial: {
        countryCode: unitedStates.countryCode,
        timezone: unitedStatesTimezone,
        language: "en",
        latitude: 37.7936,
        longitude: -122.3958,
      },
      onComplete,
    })

    await user.type(addressInput(), "123")

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledOnce()
    })
    expect(apiGet).toHaveBeenCalledWith(
      "/onboarding/session/onboarding-session/address-suggestions",
      expect.objectContaining({
        params: expect.objectContaining({ input: "123", countryCode: unitedStates.countryCode }),
        signal: expect.any(AbortSignal),
      }),
    )

    await user.click(screen.getByRole("button", { name: /123 Market Street/ }))
    expect(addressInput().value).toBe("123 Market Street, San Francisco, CA")

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const addressSessionToken = apiGet.mock.calls[0][1].params.sessionToken as string
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        country: unitedStates.country,
        countryCode: unitedStates.countryCode,
        address: "123 Market Street, San Francisco, CA",
        addressPlaceId: "place-market",
        addressSessionToken,
        latitude: 37.7936,
        longitude: -122.3958,
        currency: unitedStates.currency,
        timezone: unitedStatesTimezone,
        language: "en",
      })
    })
  })

  it("keeps persisted input intact when address search fails", async () => {
    const user = userEvent.setup({ delay: null })
    apiGet.mockRejectedValueOnce({ response: { data: { message: "Address lookup is unavailable" } } })
    renderLocationStep({ initial: { countryCode: unitedStates.countryCode } })

    await user.type(addressInput(), "123")

    const error = await screen.findByText("Address lookup is unavailable")
    expect(error.id).toBe("ob-address-error")
    expect(addressInput().value).toBe("123")
  })

  it("aborts stale address requests before rendering the newer suggestion set", async () => {
    const user = userEvent.setup({ delay: null })
    let firstSignal: AbortSignal | undefined
    apiGet
      .mockImplementationOnce((_url: string, config: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
        firstSignal = config.signal
        config.signal.addEventListener("abort", () => reject({ code: "ERR_CANCELED" }))
      }))
      .mockResolvedValueOnce({
        data: {
          suggestions: [{ placeId: "place-new", text: "1234 New Street", mainText: "1234 New Street" }],
        },
      })
    renderLocationStep({ initial: { countryCode: unitedStates.countryCode } })

    await user.type(addressInput(), "123")
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledOnce()
    })

    await user.type(addressInput(), "4")
    await waitFor(() => {
      expect(firstSignal?.aborted).toBe(true)
      expect(apiGet).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByRole("button", { name: "1234 New Street" })).toBeTruthy()
    expect(screen.queryByText("Address search is temporarily unavailable")).toBeNull()
  })

  it("clears country-dependent address state and uses a new provider session for the new country", async () => {
    const user = userEvent.setup({ delay: null })
    apiGet
      .mockResolvedValueOnce({
        data: {
          suggestions: [{ placeId: "place-us", text: "123 Market Street", mainText: "123 Market Street" }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          suggestions: [{ placeId: "place-ca", text: "456 King Street, Toronto", mainText: "456 King Street" }],
        },
      })
    renderLocationStep({ initial: { countryCode: unitedStates.countryCode } })

    await user.type(addressInput(), "123")
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledOnce()
    })
    await user.click(screen.getByRole("button", { name: "123 Market Street" }))

    await user.click(countryInput())
    await user.type(countryInput(), "Canada")
    await user.click(screen.getByRole("button", { name: /Canada/ }))
    expect(addressInput().value).toBe("")
    await waitFor(() => {
      expect(timezoneSelect().value).toBe(canada.timezone)
    })

    await user.type(addressInput(), "456")
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledTimes(2)
    })
    expect(apiGet.mock.calls[1][1].params.countryCode).toBe(canada.countryCode)
    expect(apiGet.mock.calls[1][1].params.sessionToken).not.toBe(apiGet.mock.calls[0][1].params.sessionToken)
  })

  it("preserves timezone and language values in the exact submit representation", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue({ success: true })
    const selectedTimezone = unitedStates.timezones.find((option) => option !== unitedStatesTimezone) ?? unitedStatesTimezone
    renderLocationStep({ onComplete })

    await user.selectOptions(languageSelect(), "de")
    await user.selectOptions(timezoneSelect(), selectedTimezone)
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        country: unitedStates.country,
        countryCode: unitedStates.countryCode,
        address: "1 Market Street, San Francisco, CA",
        addressPlaceId: "place-existing",
        addressSessionToken: undefined,
        latitude: 37.7936,
        longitude: -122.3958,
        currency: unitedStates.currency,
        timezone: selectedTimezone,
        language: "de",
      })
    })
  })

  it("retains valid values in a root notice after an unsuccessful parent result", async () => {
    const user = userEvent.setup()
    renderLocationStep({ onComplete: vi.fn().mockResolvedValue({ success: false, message: "Location could not be saved." }) })

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const notice = await screen.findByRole("alert")
    expect(notice.textContent).toContain("Location could not be saved.")
    expect(addressInput().value).toBe("1 Market Street, San Francisco, CA")
  })

  it("prevents rapid duplicate completion callbacks while a valid save is pending", async () => {
    const user = userEvent.setup()
    let resolveCompletion: ((result: { success: boolean }) => void) | undefined
    const onComplete = vi.fn(
      () => new Promise<{ success: boolean }>((resolve) => {
        resolveCompletion = resolve
      }),
    )
    const { container } = renderLocationStep({ onComplete })
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
