import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { PropertyProfileResponse } from "@/types/property-profile"
import { PropertyProfileSettings } from "./PropertyProfileSettings"

const { getMock, patchMock, postMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock("@/lib/axios-config", () => ({
  apiClient: {
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    loading: false,
    user: {
      businessId: "business-1",
      businessType: "hotel",
      capabilities: { identity: { shell: "hotel" } },
    },
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}))

const profile: PropertyProfileResponse = {
  businessId: "business-1",
  businessType: "hotel",
  details: {
    propertyName: "Harbour View Hotel",
    accommodationType: "hotel",
    description: "Waterfront rooms and breakfast.",
    starRating: 4,
  },
  location: {
    address: "1 Harbour Road",
    city: "Valletta",
    region: "Central",
    postalCode: "VLT 1234",
    country: "Malta",
    countryCode: "mt",
    verified: true,
    latitude: 35.8997,
    longitude: 14.5147,
  },
  photos: [{ id: "photo-1", url: "https://images.example/photo.jpg", publicId: "photo-1" }],
  facilities: {
    facilityIds: ["wifi"],
    parking: { available: true, cost: "paid", reservation: "required", location: "onsite", access: "private" },
    breakfastOffered: true,
  },
  languages: ["en"],
  arrivalDeparture: {
    checkInFrom: "15:00",
    checkInUntil: "22:00",
    checkOutFrom: "07:00",
    checkOutUntil: "11:00",
    timezone: "Europe/Malta",
  },
  policies: { childrenAllowed: true, petsPolicy: "on_request" },
  contact: {
    phone: "+356 1234 5678",
    email: "stay@harbour.example",
    website: "https://harbour.example",
  },
  discoveryPublication: {
    discoveryPublished: false,
    publishedAt: null,
    eligibility: { eligible: true, blockers: [] },
    effectivePublic: false,
  },
  completeness: {
    percentage: 60,
    completedCount: 3,
    totalCount: 5,
    requiredComplete: false,
    checklist: [{ id: "property_details", label: "Details", category: "required", complete: true }],
  },
  catalogs: {
    accommodationTypes: [{ id: "hotel", label: "Hotel" }],
    facilityGroups: [{ id: "essentials", label: "Essentials", facilities: [{ id: "wifi", label: "Wi-Fi" }] }],
    languages: [{ id: "en", label: "English" }],
  },
  updatedAt: null,
}

function profileWithContact(contact: PropertyProfileResponse["contact"]): PropertyProfileResponse {
  return { ...profile, contact }
}

afterEach(() => {
  cleanup()
  getMock.mockReset()
  patchMock.mockReset()
  postMock.mockReset()
  toastErrorMock.mockReset()
  toastSuccessMock.mockReset()
})

async function renderPropertyProfile() {
  getMock.mockResolvedValue({ data: profile })
  const result = render(<PropertyProfileSettings />)

  await waitFor(() => {
    expect((screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement).value).toBe("+356 1234 5678")
  })

  return result
}

function sectionById(id: string) {
  const section = document.getElementById(id)
  if (!section) throw new Error(`Expected section ${id}`)
  return within(section)
}

function contactPhone() {
  return screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement
}

function contactEmail() {
  return screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement
}

function contactWebsite() {
  return screen.getByRole("textbox", { name: /Website/ }) as HTMLInputElement
}

describe("PropertyProfileSettings", () => {
  it("hydrates contact values while specialized profile controls still render", async () => {
    await renderPropertyProfile()

    expect(contactEmail().value).toBe("stay@harbour.example")
    expect(contactWebsite().value).toBe("https://harbour.example")
    expect(screen.getByRole("button", { name: /Upload property photos/ })).toBeTruthy()
    expect(screen.getByPlaceholderText("Search facilities and services…")).toBeTruthy()
    expect(screen.getByPlaceholderText("Search languages…")).toBeTruthy()
  }, 15_000)

  it("publishes through the dedicated Discovery action", async () => {
    const user = userEvent.setup({ delay: null })
    patchMock.mockResolvedValue({
      data: {
        ...profile,
        discoveryPublication: {
          ...profile.discoveryPublication,
          discoveryPublished: true,
          publishedAt: "2026-10-12T10:00:00.000Z",
          effectivePublic: true,
        },
      },
    })
    await renderPropertyProfile()

    await user.click(screen.getByRole("button", { name: "Publish on Chillow Discovery" }))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith(
        "/business/property-profile/discovery-publication",
        { discoveryPublished: true },
      )
    })
    expect(toastSuccessMock).toHaveBeenCalledWith("Published to Chillow Discovery")
    expect(screen.getByRole("button", { name: "Remove from Chillow Discovery" })).toBeTruthy()
  }, 15_000)

  it("renders inline email validation with accessible focus", async () => {
    const user = userEvent.setup({ delay: null })
    await renderPropertyProfile()

    await user.clear(contactEmail())
    await user.type(contactEmail(), "x")
    await user.click(sectionById("contact").getByRole("button", { name: "Save section" }))

    const emailError = await screen.findByText("Enter a valid email address")
    expect(contactEmail().getAttribute("aria-invalid")).toBe("true")
    expect(contactEmail().getAttribute("aria-describedby")).toBe("property-email-error")
    expect(emailError.id).toBe("property-email-error")
    expect(document.activeElement).toBe(contactEmail())
    expect(patchMock).not.toHaveBeenCalled()
  }, 15_000)

  it("renders inline website validation with accessible focus", async () => {
    const user = userEvent.setup({ delay: null })
    await renderPropertyProfile()

    await user.clear(contactWebsite())
    await user.type(contactWebsite(), "x")
    await user.click(sectionById("contact").getByRole("button", { name: "Save section" }))

    const websiteError = await screen.findByText("Enter a valid website URL")
    expect(contactWebsite().getAttribute("aria-invalid")).toBe("true")
    expect(contactWebsite().getAttribute("aria-describedby")).toBe("property-website-error")
    expect(websiteError.id).toBe("property-website-error")
    expect(document.activeElement).toBe(contactWebsite())
  }, 15_000)

  it("submits only Guest Contact with the unchanged endpoint and payload, then resets to saved values", async () => {
    const user = userEvent.setup({ delay: null })
    patchMock.mockResolvedValueOnce({
      data: profileWithContact({
        phone: "+356 9999 0000",
        email: "saved@harbour.example",
        website: "https://harbour.example",
      }),
    })
    await renderPropertyProfile()

    await user.clear(contactPhone())
    await user.type(contactPhone(), "+356 9999 0000")
    await user.click(sectionById("contact").getByRole("button", { name: "Save section" }))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith("/business/property-profile/contact", {
        phone: "+356 9999 0000",
        email: "stay@harbour.example",
        website: "https://harbour.example",
        socialLinks: { instagram: "", facebook: "" },
      })
    })
    await waitFor(() => {
      expect(contactPhone().value).toBe("+356 9999 0000")
      expect(contactEmail().value).toBe("saved@harbour.example")
      expect(contactWebsite().value).toBe("https://harbour.example")
    })
  }, 15_000)

  it("keeps failed contact edits and unrelated section state intact", async () => {
    const user = userEvent.setup({ delay: null })
    patchMock.mockRejectedValueOnce({ response: { data: { message: "Guest contact could not be saved." } } })
    await renderPropertyProfile()

    await user.clear(contactPhone())
    await user.type(contactPhone(), "+356 2222 3333")
    await user.click(sectionById("contact").getByRole("button", { name: "Save section" }))

    const notice = await sectionById("contact").findByRole("alert")
    expect(notice.textContent).toContain("Guest contact could not be saved.")
    expect(contactPhone().value).toBe("+356 2222 3333")
    expect((screen.getByRole("textbox", { name: "Property name" }) as HTMLInputElement).value).toBe("Harbour View Hotel")
  }, 15_000)

  it("keeps unsaved contact edits when another section saves", async () => {
    const user = userEvent.setup({ delay: null })
    patchMock.mockResolvedValueOnce({ data: profile })
    await renderPropertyProfile()

    await user.clear(contactPhone())
    await user.type(contactPhone(), "+356 7777 8888")
    await user.click(sectionById("property-details").getByRole("button", { name: "Save section" }))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith("/business/property-profile/details", profile.details)
    })
    expect(contactPhone().value).toBe("+356 7777 8888")
  }, 15_000)

  it("prevents rapid duplicate Guest Contact saves while the request is pending", async () => {
    const user = userEvent.setup({ delay: null })
    let resolveSave: ((response: { data: PropertyProfileResponse }) => void) | undefined
    patchMock.mockImplementationOnce(() => new Promise<{ data: PropertyProfileResponse }>((resolve) => {
      resolveSave = resolve
    }))
    await renderPropertyProfile()
    const saveButton = sectionById("contact").getByRole("button", { name: "Save section" }) as HTMLButtonElement

    await user.click(saveButton)
    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledOnce()
      expect(saveButton.disabled).toBe(true)
      expect(document.querySelector("#contact [aria-busy]")?.getAttribute("aria-busy")).toBe("true")
    })

    await user.click(saveButton)
    expect(patchMock).toHaveBeenCalledOnce()

    resolveSave?.({ data: profile })
    await waitFor(() => {
      expect(saveButton.disabled).toBe(false)
    })
  }, 15_000)
  it("saves a selected Google address without sending editable address or coordinate fields", async () => {
    const user = userEvent.setup({ delay: null })
    const savedProfile: PropertyProfileResponse = {
      ...profile,
      location: {
        ...profile.location,
        address: "41 Triq il-Borg, Birgu, Malta",
        city: "Birgu",
        region: "Southern Region",
        postalCode: "BRG 1300",
        latitude: 35.8871,
        longitude: 14.5223,
        verified: true,
      },
    }
    getMock
      .mockResolvedValueOnce({ data: profile })
      .mockResolvedValueOnce({
        data: {
          suggestions: [{
            placeId: "place_canonical_123",
            text: "41 Triq il-Borg, Birgu, Malta",
            mainText: "41 Triq il-Borg",
            secondaryText: "Birgu, Malta",
          }],
        },
      })
    patchMock.mockResolvedValueOnce({ data: savedProfile })
    render(<PropertyProfileSettings />)

    await screen.findByRole("textbox", { name: "Business address" })

    const location = sectionById("location")
    const addressInput = location.getByRole("textbox", { name: "Business address" })
    await user.clear(addressInput)
    await user.type(addressInput, "41 Triq")

    const suggestion = await location.findByRole("option", { name: /41 Triq il-Borg/i })
    await user.click(suggestion)
    await user.click(location.getByRole("button", { name: "Save section" }))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith("/business/property-profile/location", {
        addressPlaceId: "place_canonical_123",
        addressSessionToken: expect.any(String),
        countryCode: "mt",
      })
    })
    expect((location.getByRole("textbox", { name: "Business address" }) as HTMLInputElement).value).toBe("41 Triq il-Borg, Birgu, Malta")
  }, 15_000)
})
