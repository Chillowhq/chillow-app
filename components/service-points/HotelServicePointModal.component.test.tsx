import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"

import { HotelServicePointModal } from "./HotelServicePointModal"

const { deleteMock, getMock, postMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/axios-config", () => ({
  apiClient: {
    delete: deleteMock,
    get: getMock,
    post: postMock,
  },
}))

const managedRoomType = {
  name: "Deluxe",
  sortOrder: 1,
  active: true,
  isDefault: false,
}

const existingRoom = {
  servicePointId: "room-401",
  label: "Deluxe Ocean King",
  code: "401",
  servicePointType: "room" as const,
  isActive: true,
  roomType: "Deluxe",
  capacity: 2,
  maxGuests: 2,
  pricePerNight: 0,
  bedConfiguration: [{ bedType: "King", count: 1 }],
  viewType: "Ocean View",
  amenities: ["Free WiFi"],
  images: ["https://images.example/existing.webp"],
  description: "Ocean-facing room",
}

function renderModal(overrides: Partial<ComponentProps<typeof HotelServicePointModal>> = {}) {
  const onClose = vi.fn()
  const onSave = vi.fn().mockResolvedValue(undefined)
  const result = render(
    <HotelServicePointModal
      isOpen
      isEditing
      initialData={existingRoom}
      onClose={onClose}
      onSave={onSave}
      term={{ singular: "Room", plural: "Rooms" }}
      {...overrides}
    />,
  )

  return { ...result, onClose, onSave }
}

function saveButton() {
  return screen.getByRole("button", { name: "Save Changes" })
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  })
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
})

beforeEach(() => {
  deleteMock.mockReset()
  getMock.mockReset()
  postMock.mockReset()
  getMock.mockResolvedValue({ data: { hotelRoomTypes: [managedRoomType] } })
})

afterEach(cleanup)

describe("HotelServicePointModal", () => {
  it("hydrates current room values including zero nightly price", async () => {
    renderModal()

    expect((screen.getByDisplayValue("Deluxe Ocean King") as HTMLInputElement).value).toBe("Deluxe Ocean King")
    expect((screen.getByDisplayValue("401") as HTMLInputElement).value).toBe("401")
    expect((screen.getByRole("spinbutton", { name: /Max Guests/ }) as HTMLInputElement).value).toBe("2")
    expect((screen.getByRole("spinbutton", { name: /Price \/ Night/ }) as HTMLInputElement).value).toBe("0")
    expect(screen.getByRole("combobox", { name: /Room Type/ }).textContent).toContain("Deluxe")
    expect((screen.getByRole("combobox", { name: "View" }) as HTMLSelectElement).value).toBe("Ocean View")
    expect(screen.getByRole("checkbox", { name: "Free WiFi" }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByAltText("Room").getAttribute("src")).toBe("https://images.example/existing.webp")
    expect((screen.getByPlaceholderText("Describe this room, its views, and special features...") as HTMLTextAreaElement).value).toBe("Ocean-facing room")
    expect((screen.getByRole("spinbutton", { name: "Count for King" }) as HTMLInputElement).value).toBe("1")
  })

  it("resets values when editing a different room", async () => {
    const user = userEvent.setup()
    const { rerender } = renderModal()

    await user.clear(screen.getByDisplayValue("Deluxe Ocean King"))
    await user.type(screen.getByPlaceholderText("e.g. Deluxe Ocean King"), "Dirty value")

    rerender(
      <HotelServicePointModal
        isOpen
        isEditing
        initialData={{
          ...existingRoom,
          servicePointId: "room-402",
          label: "Garden Twin",
          code: "402",
          roomType: "Garden",
          pricePerNight: 120,
          bedConfiguration: [{ bedType: "Twin", count: 2 }],
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        term={{ singular: "Room", plural: "Rooms" }}
      />,
    )

    await waitFor(() => expect((screen.getByDisplayValue("Garden Twin") as HTMLInputElement).value).toBe("Garden Twin"))
    expect((screen.getByDisplayValue("402") as HTMLInputElement).value).toBe("402")
    expect((screen.getByRole("spinbutton", { name: /Price \/ Night/ }) as HTMLInputElement).value).toBe("120")
    expect((screen.getByRole("spinbutton", { name: "Count for Twin" }) as HTMLInputElement).value).toBe("2")
  })

  it("shows inline required validation and focuses the first invalid field", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.clear(screen.getByDisplayValue("Deluxe Ocean King"))
    await user.click(saveButton())

    expect(await screen.findByText("Room Name / Label is required.")).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByPlaceholderText("e.g. Deluxe Ocean King"))
  })

  it("validates code, room type, guests, price, invalid bed counts, and duplicate beds", async () => {
    const user = userEvent.setup()
    const { rerender } = renderModal({
      initialData: {
        ...existingRoom,
        code: "",
        roomType: "",
        maxGuests: 0,
        pricePerNight: -1,
        bedConfiguration: [
          { bedType: "King", count: 0 },
          { bedType: "King", count: 1 },
        ],
      },
    })

    await user.click(saveButton())

    expect(await screen.findByText("Room Number / Code is required.")).toBeTruthy()
    expect(screen.getByText("Room Type is required.")).toBeTruthy()
    expect(screen.getByText("Max Guests must be a positive whole number.")).toBeTruthy()
    expect(screen.getByText("Valid Price per Night is required.")).toBeTruthy()
    expect(screen.getByText("Each bed row needs a type and a positive whole-number count.")).toBeTruthy()
    expect(screen.getByText("Each bed type can only be added once.")).toBeTruthy()

    rerender(
      <HotelServicePointModal
        isOpen
        isEditing
        initialData={existingRoom}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        term={{ singular: "Room", plural: "Rooms" }}
      />,
    )
  })

  it("preserves changed bed configuration in the exact save payload", async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal()

    await user.click(screen.getByRole("button", { name: "Add bed" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "Count for Single" }), { target: { value: "2" } })
    await user.click(screen.getByRole("button", { name: "Remove King" }))
    await user.click(saveButton())

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({
      label: "Deluxe Ocean King",
      code: "401",
      roomType: "Deluxe",
      pricePerNight: 0,
      currency: "eur",
      description: "Ocean-facing room",
      amenities: ["Free WiFi"],
      images: ["https://images.example/existing.webp"],
      capacity: 2,
      maxGuests: 2,
      viewType: "Ocean View",
      bedConfiguration: [{ bedType: "Single", count: 2 }],
    })
  })

  it("preserves untouched legacy beds and switches to canonical configuration after a bed edit", async () => {
    const user = userEvent.setup()
    const legacyRoom = {
      ...existingRoom,
      bedConfiguration: undefined,
      beds: 2,
    }
    const first = renderModal({ initialData: legacyRoom })

    await user.click(saveButton())
    await waitFor(() => expect(first.onSave).toHaveBeenCalledTimes(1))
    expect(first.onSave).toHaveBeenCalledWith(expect.objectContaining({ beds: 2 }))
    expect(first.onSave.mock.calls[0][0].bedConfiguration).toBeUndefined()

    cleanup()
    const second = renderModal({ initialData: legacyRoom })
    await user.click(screen.getByRole("button", { name: "Add bed" }))
    await user.click(saveButton())

    await waitFor(() => expect(second.onSave).toHaveBeenCalledTimes(1))
    expect(second.onSave.mock.calls[0][0]).toMatchObject({
      bedConfiguration: [{ bedType: "Single", count: 1 }],
    })
    expect(second.onSave.mock.calls[0][0].beds).toBeUndefined()
  })

  it("keeps an unmanaged legacy room type visible and sends it unchanged", async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal({
      initialData: {
        ...existingRoom,
        roomType: "Legacy Penthouse",
      },
    })

    expect(await screen.findByText(/Legacy Penthouse.*not in your managed room types/)).toBeTruthy()
    await user.click(saveButton())

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ roomType: "Legacy Penthouse" }))
  })

  it("preserves image hydration, removal, upload, and upload-failure state", async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole("button", { name: "Remove image 1" }))
    expect(screen.queryByAltText("Room")).toBeNull()

    postMock.mockResolvedValueOnce({ data: { url: "https://images.example/uploaded.webp" } })
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).toBeTruthy()
    fireEvent.change(fileInput!, { target: { files: [new File(["upload"], "upload.webp", { type: "image/webp" })] } })

    expect((await screen.findByAltText("Room")).getAttribute("src")).toBe("https://images.example/uploaded.webp")
    expect(postMock).toHaveBeenCalledWith(
      "/upload/image",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    )

    postMock.mockRejectedValueOnce(new Error("upload unavailable"))
    fireEvent.change(fileInput!, { target: { files: [new File(["retry"], "retry.webp", { type: "image/webp" })] } })

    expect(await screen.findByText("Failed to upload image. Please try again.")).toBeTruthy()
    expect(screen.getByAltText("Room")).toBeTruthy()
  })

  it("prevents a fourth image from exposing another upload control", () => {
    renderModal({
      initialData: {
        ...existingRoom,
        images: ["https://images.example/one.webp", "https://images.example/two.webp", "https://images.example/three.webp"],
      },
    })

    expect(screen.queryByRole("button", { name: "Add Image" })).toBeNull()
  })

  it("uses the existing parent failure path without clearing entered values", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue({
      response: { data: { error: "Room code already exists." } },
    })
    renderModal({ onSave })

    await user.clear(screen.getByDisplayValue("401"))
    await user.type(screen.getByPlaceholderText("e.g. 401"), "405")
    await user.click(saveButton())

    expect(await screen.findByText("Room code already exists.")).toBeTruthy()
    expect((screen.getByDisplayValue("405") as HTMLInputElement).value).toBe("405")
  })

  it("does not issue parallel parent saves on rapid repeated clicks", async () => {
    const user = userEvent.setup()
    let resolveSave: (() => void) | undefined
    const onSave = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSave = resolve
    }))
    renderModal({ onSave })

    await user.click(saveButton())
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledTimes(1)

    resolveSave?.()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })
})
