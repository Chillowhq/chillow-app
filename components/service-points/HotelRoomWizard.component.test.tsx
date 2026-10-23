import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { HotelRoomType } from "@/types/hotel-room-type"
import type { ServicePoint } from "@/types/service-point"
import { HotelRoomWizard } from "./HotelRoomWizard"

const { postMock, createdRoomType } = vi.hoisted(() => ({
  postMock: vi.fn(),
  createdRoomType: {
    name: "Garden Suite",
    sortOrder: 2,
    active: true,
    isDefault: false,
    maxGuests: 4,
  },
}))

vi.mock("@/lib/axios-config", () => ({
  apiClient: { post: postMock },
}))

type RoomTypeWizardBoundaryProps = {
  open: boolean
  onCreated: (roomType: HotelRoomType) => void
  onAddRoomNow: (roomType: HotelRoomType) => void
}

vi.mock("./HotelRoomTypeWizard", () => ({
  HotelRoomTypeWizard: ({ open, onCreated, onAddRoomNow }: RoomTypeWizardBoundaryProps) => open ? (
    <div role="dialog" aria-label="Create Room Type">
      <button type="button" onClick={() => {
        onCreated(createdRoomType as HotelRoomType)
        onAddRoomNow(createdRoomType as HotelRoomType)
      }}>Return new room type</button>
    </div>
  ) : null,
}))

const roomTypes: HotelRoomType[] = [
  {
    name: "Deluxe Room",
    sortOrder: 1,
    active: true,
    isDefault: false,
    maxGuests: 2,
    bedConfiguration: [{ bedType: "King", count: 1 }],
  },
  {
    name: "Inactive Room",
    sortOrder: 3,
    active: false,
    isDefault: false,
    maxGuests: 2,
  },
]

const createdRoom: ServicePoint = {
  servicePointId: "room-401",
  label: "Room 401",
  code: "401",
  servicePointType: "room",
  roomType: "Deluxe Room",
  pricePerNight: 120.5,
  maxGuests: 3,
  isActive: true,
  reservable: true,
}

let uuidCounter = 0

beforeAll(() => {
  const pointerCaptureFallbacks = {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  }

  for (const [method, implementation] of Object.entries(pointerCaptureFallbacks)) {
    if (!(method in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, method, { configurable: true, value: implementation })
    }
  }

  if (!("scrollIntoView" in Element.prototype)) {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: () => undefined })
  }
})

beforeEach(() => {
  uuidCounter = 0
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => `uuid-${++uuidCounter}`) })
})

afterEach(() => {
  cleanup()
  postMock.mockReset()
  vi.unstubAllGlobals()
})

function renderWizard(options: { initialRoomTypeName?: string; open?: boolean } = {}) {
  const onOpenChange = vi.fn()
  const onRoomTypeCreated = vi.fn()
  const onCreated = vi.fn()
  const onViewRoomTypes = vi.fn()
  const result = render(
    <HotelRoomWizard
      open={options.open ?? true}
      onOpenChange={onOpenChange}
      roomTypes={roomTypes}
      initialRoomTypeName={options.initialRoomTypeName}
      onRoomTypeCreated={onRoomTypeCreated}
      onCreated={onCreated}
      onViewRoomTypes={onViewRoomTypes}
    />,
  )

  return { ...result, onCreated, onOpenChange, onRoomTypeCreated, onViewRoomTypes }
}

function roomLabel() {
  return screen.getByRole("textbox", { name: "Room label" }) as HTMLInputElement
}

function roomCode() {
  return screen.getByRole("textbox", { name: "Room number / code" }) as HTMLInputElement
}

function nightlyPrice() {
  return screen.getByRole("spinbutton", { name: "Nightly price" }) as HTMLInputElement
}

function maximumGuests() {
  return screen.getByRole("spinbutton", { name: "Maximum guests" }) as HTMLInputElement
}

async function selectRoomType(user: ReturnType<typeof userEvent.setup>, roomTypeName = "Deluxe Room") {
  await user.click(screen.getByRole("combobox", { name: "Select Room Type" }))
  await user.click(await screen.findByRole("option", { name: roomTypeName }))
}

async function reachReview(user: ReturnType<typeof userEvent.setup>) {
  await user.type(roomLabel(), "Room 401")
  await user.type(roomCode(), "401")
  await selectRoomType(user)
  await user.click(screen.getByRole("button", { name: "Continue" }))
  await screen.findByText("Room settings")
  await user.type(nightlyPrice(), "120.50")
  await user.clear(maximumGuests())
  await user.type(maximumGuests(), "3")
  await user.click(screen.getByRole("button", { name: "Continue" }))
  await screen.findByText("Review room")
}

describe("HotelRoomWizard", () => {
  it("opens on Details with the selected Room Type default and does not validate Settings yet", async () => {
    const user = userEvent.setup({ delay: null })
    renderWizard({ initialRoomTypeName: "Deluxe Room" })

    expect(screen.getByText("Room details")).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "Select Room Type" }).textContent).toContain("Deluxe Room")
    await user.type(roomLabel(), "Room 402")
    await user.type(roomCode(), "402")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await screen.findByText("Room settings")
    expect(maximumGuests().value).toBe("2")
    expect(screen.queryByText("Enter a valid nightly price")).toBeNull()
  })

  it("blocks an invalid active step with inline errors and focuses its first field", async () => {
    const user = userEvent.setup({ delay: null })
    renderWizard({ initialRoomTypeName: "Deluxe Room" })

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const error = await screen.findByText("Room label is required")
    expect(roomLabel().getAttribute("aria-invalid")).toBe("true")
    expect(roomLabel().getAttribute("aria-describedby")).toBe("new-room-label-error")
    expect(error.id).toBe("new-room-label-error")
    expect(document.activeElement).toBe(roomLabel())
    expect(screen.queryByRole("spinbutton", { name: "Nightly price" })).toBeNull()
  })

  it("retains entered scalar values through Next and Back navigation", async () => {
    const user = userEvent.setup({ delay: null })
    renderWizard()

    await reachReview(user)
    await user.click(screen.getByRole("button", { name: "Back" }))
    await screen.findByText("Room settings")
    expect(nightlyPrice().value).toBe("120.5")
    expect(maximumGuests().value).toBe("3")
    await user.click(screen.getByRole("button", { name: "Back" }))

    await screen.findByText("Room details")
    expect(roomLabel().value).toBe("Room 401")
    expect(roomCode().value).toBe("401")
    expect(screen.getByRole("combobox", { name: "Select Room Type" }).textContent).toContain("Deluxe Room")
  })

  it("preserves room data when a newly created Room Type returns to the wizard", async () => {
    const user = userEvent.setup({ delay: null })
    const { onRoomTypeCreated } = renderWizard()

    await user.type(roomLabel(), "Garden 1")
    await user.type(roomCode(), "G-1")
    await user.click(screen.getByRole("button", { name: /Create new room type/ }))
    fireEvent.click(await screen.findByRole("button", { name: "Return new room type", hidden: true }))

    expect(onRoomTypeCreated).toHaveBeenCalledWith(createdRoomType)
    expect(roomLabel().value).toBe("Garden 1")
    expect(roomCode().value).toBe("G-1")
    expect(screen.getByRole("combobox", { name: "Select Room Type" }).textContent).toContain("Garden Suite")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByText("Room settings")
    expect(maximumGuests().value).toBe("4")
  })

  it("submits the unchanged canonical room payload and Idempotency-Key exactly once", async () => {
    const user = userEvent.setup({ delay: null })
    postMock.mockResolvedValueOnce({ data: createdRoom })
    const { onCreated, onOpenChange } = renderWizard()

    await reachReview(user)
    await user.click(screen.getByRole("button", { name: "Create Room" }))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/owner/service-points",
        {
          label: "Room 401",
          code: "401",
          servicePointType: "room",
          roomType: "Deluxe Room",
          pricePerNight: 120.5,
          maxGuests: 3,
          isActive: true,
          reservable: true,
        },
        { headers: { "Idempotency-Key": expect.stringMatching(/^room:/) } },
      )
    })
    expect(onCreated).toHaveBeenCalledWith(createdRoom)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("keeps the same idempotency key and entered data for a safe retry after failure", async () => {
    const user = userEvent.setup({ delay: null })
    postMock
      .mockRejectedValueOnce({ response: { data: { error: "Room code is already in use." } } })
      .mockResolvedValueOnce({ data: createdRoom })
    renderWizard()

    await reachReview(user)
    await user.click(screen.getByRole("button", { name: "Create Room" }))

    const notice = await screen.findByRole("alert")
    expect(notice.textContent).toContain("Room code is already in use.")
    expect(screen.getByText("Room 401")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Create Room" }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))

    expect(postMock.mock.calls[1][2].headers["Idempotency-Key"]).toBe(postMock.mock.calls[0][2].headers["Idempotency-Key"])
  })

  it("prevents parallel creates, blocks pending close, and generates a new key after reopen", async () => {
    const user = userEvent.setup({ delay: null })
    let resolveFirstSave: ((response: { data: ServicePoint }) => void) | undefined
    postMock.mockImplementationOnce(() => new Promise<{ data: ServicePoint }>((resolve) => {
      resolveFirstSave = resolve
    }))
    const onOpenChange = vi.fn()
    const onRoomTypeCreated = vi.fn()
    const onCreated = vi.fn()
    const onViewRoomTypes = vi.fn()
    const rendered = render(
      <HotelRoomWizard
        open
        onOpenChange={onOpenChange}
        roomTypes={roomTypes}
        onRoomTypeCreated={onRoomTypeCreated}
        onCreated={onCreated}
        onViewRoomTypes={onViewRoomTypes}
      />,
    )

    await reachReview(user)
    const createButton = screen.getByRole("button", { name: "Create Room" }) as HTMLButtonElement
    await user.click(createButton)
    await waitFor(() => expect(postMock).toHaveBeenCalledOnce())
    expect(createButton.disabled).toBe(true)
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()
    await user.click(createButton)
    await user.keyboard("{Escape}")
    expect(postMock).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()

    const firstKey = postMock.mock.calls[0][2].headers["Idempotency-Key"]
    resolveFirstSave?.({ data: createdRoom })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))

    rendered.rerender(
      <HotelRoomWizard
        open={false}
        onOpenChange={onOpenChange}
        roomTypes={roomTypes}
        onRoomTypeCreated={onRoomTypeCreated}
        onCreated={onCreated}
        onViewRoomTypes={onViewRoomTypes}
      />,
    )
    rendered.rerender(
      <HotelRoomWizard
        open
        onOpenChange={onOpenChange}
        roomTypes={roomTypes}
        onRoomTypeCreated={onRoomTypeCreated}
        onCreated={onCreated}
        onViewRoomTypes={onViewRoomTypes}
      />,
    )
    postMock.mockResolvedValueOnce({ data: createdRoom })
    await reachReview(user)
    await user.click(screen.getByRole("button", { name: "Create Room" }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))

    expect(postMock.mock.calls[1][2].headers["Idempotency-Key"]).not.toBe(firstKey)
  })

  it("retains the existing cancel behavior for pristine and edited wizard state", async () => {
    const user = userEvent.setup({ delay: null })
    const { onOpenChange } = renderWizard()

    await user.type(roomLabel(), "Unsaved Room")
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
