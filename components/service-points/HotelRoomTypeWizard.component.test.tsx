import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"

import { HotelRoomTypeWizard } from "./HotelRoomTypeWizard"

const { patchMock, postMock, toastSuccess } = vi.hoisted(() => ({
  patchMock: vi.fn(),
  postMock: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/lib/axios-config", () => ({
  apiClient: {
    patch: patchMock,
    post: postMock,
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
  },
}))

const createdRoomType = {
  name: "Deluxe",
  sortOrder: 1,
  active: true,
  isDefault: false,
  description: "",
  roomSize: null,
  roomSizeUnit: "m2" as const,
  maxGuests: 2,
  bedConfiguration: [{ bedType: "King", count: 1 }],
  viewType: "",
  amenities: [],
  images: [],
}

function renderWizard(overrides: Partial<ComponentProps<typeof HotelRoomTypeWizard>> = {}) {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  const onAddRoomNow = vi.fn()
  const onViewRoomTypes = vi.fn()

  const result = render(
    <HotelRoomTypeWizard
      open
      onOpenChange={onOpenChange}
      onCreated={onCreated}
      onAddRoomNow={onAddRoomNow}
      onViewRoomTypes={onViewRoomTypes}
      nameSuggestions={["Deluxe"]}
      {...overrides}
    />,
  )

  return {
    ...result,
    onAddRoomNow,
    onCreated,
    onOpenChange,
    onViewRoomTypes,
  }
}

async function chooseDeluxe(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Choose a Room Type name" }))
  await user.click(await screen.findByRole("option", { name: "Deluxe" }))
}

async function advanceToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue" }))
  await user.click(screen.getByRole("button", { name: "Continue" }))
  await user.click(screen.getByRole("button", { name: "Continue" }))
  await user.click(screen.getByRole("button", { name: "Continue" }))
  await screen.findByRole("heading", { name: "Review and create" })
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
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: vi.fn(() => "test-uuid"),
  })
})

beforeEach(() => {
  patchMock.mockReset()
  postMock.mockReset()
  toastSuccess.mockReset()
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: vi.fn(() => "test-uuid"),
  })
})

afterEach(cleanup)

describe("HotelRoomTypeWizard", () => {
  it("renders the first wizard step with the existing defaults", () => {
    renderWizard()

    expect(screen.getByRole("heading", { name: "Basic information" })).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "Choose a Room Type name" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy()
  })

  it("keeps users on the invalid step and focuses the room type choice", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByText("Room type name is required.")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Basic information" })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Choose a Room Type name" }))
  })

  it("retains entered scalar values while navigating backward and forward", async () => {
    const user = userEvent.setup()
    renderWizard()

    await chooseDeluxe(user)
    await user.type(screen.getByPlaceholderText("Describe the room type, its features and what makes it special..."), "Large suite")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Guests & beds" })
    await user.click(screen.getByRole("button", { name: "Back" }))

    expect((screen.getByPlaceholderText("Describe the room type, its features and what makes it special...") as HTMLTextAreaElement).value).toBe("Large suite")
    expect(screen.getByRole("combobox", { name: "Choose a Room Type name" }).textContent).toContain("Deluxe")
  })

  it("preserves bed configuration across wizard navigation", async () => {
    const user = userEvent.setup()
    renderWizard()

    await chooseDeluxe(user)
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Guests & beds" })
    await user.click(screen.getByRole("button", { name: "Add bed" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity for Single" }), { target: { value: "2" } })
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "View & amenities" })
    await user.click(screen.getByRole("button", { name: "Back" }))

    expect((screen.getByRole("spinbutton", { name: "Quantity for Single" }) as HTMLInputElement).value).toBe("2")
    expect((screen.getByRole("spinbutton", { name: "Quantity for King" }) as HTMLInputElement).value).toBe("1")
  })

  it("uploads photos with the existing endpoint and handles upload errors without losing the uploaded image", async () => {
    const user = userEvent.setup()
    renderWizard()

    await chooseDeluxe(user)
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Room photos" })

    postMock.mockResolvedValueOnce({ data: { url: "https://images.example/cover.webp" } })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).toBeTruthy()
    fireEvent.change(input!, { target: { files: [new File(["cover"], "cover.webp", { type: "image/webp" })] } })

    await waitFor(() => expect(postMock).toHaveBeenCalledWith(
      "/upload/image",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    ))
    const uploadedPhoto = await screen.findByAltText("Room type photo 1")
    expect(uploadedPhoto.getAttribute("src")).toBe("https://images.example/cover.webp")

    postMock.mockRejectedValueOnce(new Error("upload unavailable"))
    fireEvent.change(input!, { target: { files: [new File(["retry"], "retry.webp", { type: "image/webp" })] } })

    expect(await screen.findByText("Photos could not be uploaded. Please try again.")).toBeTruthy()
    expect(screen.getByAltText("Room type photo 1")).toBeTruthy()
  })

  it("submits the preserved create payload once, keeps its idempotency key for a retry, and exposes success actions", async () => {
    const user = userEvent.setup()
    const { onAddRoomNow, onCreated } = renderWizard()

    await chooseDeluxe(user)
    await advanceToReview(user)

    postMock.mockRejectedValueOnce({
      response: { data: { message: "Room type name already exists." } },
    })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))
    expect(await screen.findByText("Room type name already exists.")).toBeTruthy()

    postMock.mockResolvedValueOnce({ data: { roomType: createdRoomType } })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    const expectedPayload = {
      name: "Deluxe",
      description: "",
      roomSize: null,
      roomSizeUnit: "m2",
      maxGuests: 2,
      bedConfiguration: [{ bedType: "King", count: 1 }],
      viewType: "",
      amenities: [],
      images: [],
    }
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/business/room-types",
      expectedPayload,
      { headers: { "Idempotency-Key": "room-type:test-uuid" } },
    )
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/business/room-types",
      expectedPayload,
      { headers: { "Idempotency-Key": "room-type:test-uuid" } },
    )
    expect(onCreated).toHaveBeenCalledWith(createdRoomType)
    expect(await screen.findByText("Room Type Created")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Add a room now" }))
    expect(onAddRoomNow).toHaveBeenCalledWith(createdRoomType)
  })

  it("keeps the existing edit request and handoff contract", async () => {
    const user = userEvent.setup()
    const { onCreated, onOpenChange } = renderWizard({ roomType: createdRoomType })

    await advanceToReview(user)

    patchMock.mockResolvedValueOnce({ data: { roomType: createdRoomType } })
    await user.click(screen.getByRole("button", { name: "Save Room Type" }))

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(1))
    expect(patchMock).toHaveBeenCalledWith("/business/room-types", {
      name: "Deluxe",
      description: "",
      roomSize: null,
      roomSizeUnit: "m2",
      maxGuests: 2,
      bedConfiguration: [{ bedType: "King", count: 1 }],
      viewType: "",
      amenities: [],
      images: [],
      currentName: "Deluxe",
    })
    expect(onCreated).toHaveBeenCalledWith(createdRoomType)
    expect(toastSuccess).toHaveBeenCalledWith("Deluxe updated")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("uses a fresh idempotency key after close and reopen", async () => {
    const user = userEvent.setup()
    let uuidCount = 0
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: vi.fn(() => `room-type-test-${++uuidCount}`),
    })
    const onOpenChange = vi.fn()
    const onCreated = vi.fn()
    const onAddRoomNow = vi.fn()
    const onViewRoomTypes = vi.fn()
    const props = {
      onOpenChange,
      onCreated,
      onAddRoomNow,
      onViewRoomTypes,
      nameSuggestions: ["Deluxe"],
    }
    const { rerender } = render(<HotelRoomTypeWizard open {...props} />)

    await chooseDeluxe(user)
    await advanceToReview(user)
    postMock.mockResolvedValueOnce({ data: { roomType: createdRoomType } })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))
    await screen.findByText("Room Type Created")

    rerender(<HotelRoomTypeWizard open={false} {...props} />)
    rerender(<HotelRoomTypeWizard open {...props} />)

    await chooseDeluxe(user)
    await advanceToReview(user)
    postMock.mockResolvedValueOnce({ data: { roomType: createdRoomType } })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))

    expect(postMock.mock.calls[0][2]?.headers?.["Idempotency-Key"]).not.toBe(
      postMock.mock.calls[1][2]?.headers?.["Idempotency-Key"],
    )
  })

  it("preserves the changed bed representation in the final create payload", async () => {
    const user = userEvent.setup()
    renderWizard()

    await chooseDeluxe(user)
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Add bed" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity for Single" }), { target: { value: "2" } })
    await user.click(screen.getByRole("button", { name: "Remove King" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Review and create" })

    postMock.mockResolvedValueOnce({
      data: {
        roomType: {
          ...createdRoomType,
          bedConfiguration: [{ bedType: "Single", count: 2 }],
        },
      },
    })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock).toHaveBeenCalledWith(
      "/business/room-types",
      expect.objectContaining({ bedConfiguration: [{ bedType: "Single", count: 2 }] }),
      expect.any(Object),
    )
  })

  it("keeps the idempotency key when values change after a server failure", async () => {
    const user = userEvent.setup()
    renderWizard()

    await chooseDeluxe(user)
    await user.type(screen.getByPlaceholderText("Describe the room type, its features and what makes it special..."), "Initial description")
    await advanceToReview(user)

    postMock.mockRejectedValueOnce({
      response: { data: { message: "Temporary server error." } },
    })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))
    await screen.findByText("Temporary server error.")

    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.type(screen.getByPlaceholderText("Describe the room type, its features and what makes it special..."), " updated")
    await advanceToReview(user)

    postMock.mockResolvedValueOnce({ data: { roomType: createdRoomType } })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))

    expect(postMock.mock.calls[0][2]?.headers?.["Idempotency-Key"]).toBe(
      postMock.mock.calls[1][2]?.headers?.["Idempotency-Key"],
    )
    expect(postMock.mock.calls[1][1]).toMatchObject({ description: "Initial description updated" })
  })

  it("includes successfully uploaded image URLs in the final create payload", async () => {
    const user = userEvent.setup()
    renderWizard()

    await chooseDeluxe(user)
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("heading", { name: "Room photos" })

    postMock.mockResolvedValueOnce({ data: { url: "https://images.example/cover.webp" } })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    fireEvent.change(input!, { target: { files: [new File(["cover"], "cover.webp", { type: "image/webp" })] } })
    await screen.findByAltText("Room type photo 1")

    await user.click(screen.getByRole("button", { name: "Continue" }))
    postMock.mockResolvedValueOnce({
      data: {
        roomType: {
          ...createdRoomType,
          images: ["https://images.example/cover.webp"],
        },
      },
    })
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    expect(postMock).toHaveBeenLastCalledWith(
      "/business/room-types",
      expect.objectContaining({ images: ["https://images.example/cover.webp"] }),
      expect.any(Object),
    )
  })

  it("prevents rapid duplicate create requests", async () => {
    const user = userEvent.setup()
    renderWizard()

    await chooseDeluxe(user)
    await advanceToReview(user)

    let resolveRequest: ((value: { data: { roomType: typeof createdRoomType } }) => void) | undefined
    postMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))

    await user.click(screen.getByRole("button", { name: "Create Room Type" }))
    await user.click(screen.getByRole("button", { name: "Create Room Type" }))
    expect(postMock).toHaveBeenCalledTimes(1)

    resolveRequest?.({ data: { roomType: createdRoomType } })
    expect(await screen.findByText("Room Type Created")).toBeTruthy()
  })
})
