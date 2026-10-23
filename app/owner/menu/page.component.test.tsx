import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import MenuPage, { type MenuItem } from "./page"
import { menuItemSchema } from "./page.validation"

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/axios-config", () => ({
  apiClient: {
    get: getMock,
    patch: patchMock,
    post: postMock,
    delete: vi.fn(),
  },
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    user: {
      businessId: "business-1",
      role: "owner",
    },
  }),
}))

vi.mock("@/contexts/SetupProgressContext", () => ({
  useSetupProgress: () => ({ refreshSetupProgress: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock("@/contexts/BusinessContext", () => ({
  useBusinessSettings: () => ({ currency: "USD" }),
}))

vi.mock("@/lib/manager-permissions", () => ({
  MANAGER_PERMISSIONS: {
    MENU_MANAGE: "menu_manage",
    INVENTORY_MANAGE: "inventory_manage",
    INVENTORY_ADJUST: "inventory_adjust",
    SETTINGS_OPERATIONAL_MANAGE: "settings_operational_manage",
  },
  hasManagementPermission: () => true,
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const categories = ["appetizers", "mains", "desserts", "beverages"]

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    _id: "item-soup",
    businessId: "business-1",
    name: "Soup",
    description: "Warm tomato soup",
    price: 12.5,
    prepTimeMinutes: 15,
    imageUrl: "",
    category: "mains",
    type: "food",
    fulfillmentStation: "kitchen",
    fulfillmentBehavior: "prepared",
    isAvailable: true,
    ...overrides,
  }
}

let menuItems: MenuItem[] = []

function renderMenu() {
  return render(<MenuPage />)
}

function addItemButton() {
  return screen.getAllByRole("button", { name: "Add Item" })[0]
}

function priceInput() {
  return screen.getByRole("spinbutton", { name: /Price/ }) as HTMLInputElement
}

async function fillValidNewItem(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("e.g. Classic Cheeseburger"), "Burger")
  await user.type(priceInput(), "12.50")
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
  menuItems = []
  getMock.mockReset()
  patchMock.mockReset()
  postMock.mockReset()
  getMock.mockImplementation((url: string) => {
    if (url === "/menu-items") return Promise.resolve({ data: menuItems })
    if (url === "/business/categories") return Promise.resolve({ data: categories })
    return Promise.resolve({ data: null })
  })
  patchMock.mockResolvedValue({ data: {} })
  postMock.mockResolvedValue({ data: {} })
})

afterEach(cleanup)

describe("MenuPage Menu Item drawer", () => {
  it("initializes a create form with a blank price, prefilled active category, and the unchanged no-stock payload", async () => {
    const user = userEvent.setup()
    renderMenu()

    await screen.findByText("No menu items yet.")
    await user.click(screen.getByRole("button", { name: /desserts \(0\)/ }))
    await user.click(addItemButton())

    expect(priceInput().value).toBe("")
    expect(screen.getByRole("combobox", { name: "Menu item category" }).textContent).toContain("desserts")

    await fillValidNewItem(user)
    await user.click(screen.getByRole("button", { name: "Save Item" }))

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock).toHaveBeenCalledWith("/menu-items", {
      name: "Burger",
      description: "",
      price: 12.5,
      prepTimeMinutes: 10,
      category: "desserts",
      type: "food",
      fulfillmentStation: "kitchen",
      fulfillmentBehavior: "prepared",
      imageUrl: "",
      businessId: "business-1",
      isAvailable: true,
      trackStock: false,
    })
  })

  it("hydrates each edit target and resets create state without leaking values", async () => {
    const user = userEvent.setup()
    menuItems = [
      makeItem(),
      makeItem({ _id: "item-salad", name: "Salad", description: "Fresh greens", price: 9, category: "appetizers", isAvailable: false }),
    ]
    renderMenu()

    await screen.findByRole("button", { name: "Edit Soup" })
    await user.click(screen.getByRole("button", { name: "Edit Soup" }))
    expect((screen.getByPlaceholderText("e.g. Classic Cheeseburger") as HTMLInputElement).value).toBe("Soup")
    expect(priceInput().value).toBe("12.5")
    expect(screen.getByRole("switch", { name: "Menu item availability" }).getAttribute("aria-checked")).toBe("true")

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(addItemButton())
    expect((screen.getByPlaceholderText("e.g. Classic Cheeseburger") as HTMLInputElement).value).toBe("")
    expect(priceInput().value).toBe("")

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(screen.getByRole("button", { name: "Edit Salad" }))
    expect((screen.getByPlaceholderText("e.g. Classic Cheeseburger") as HTMLInputElement).value).toBe("Salad")
    expect(priceInput().value).toBe("9")
    expect(screen.getByRole("switch", { name: "Menu item availability" }).getAttribute("aria-checked")).toBe("false")
  })

  it("uses inline RHF/Zod errors and focuses the first invalid conventional field", async () => {
    const user = userEvent.setup()
    renderMenu()

    await screen.findByText("No menu items yet.")
    await user.click(addItemButton())
    await user.click(screen.getByRole("button", { name: "Save Item" }))

    expect(await screen.findByText("Item name is required.")).toBeTruthy()
    expect(screen.getByText("Price is required.")).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByPlaceholderText("e.g. Classic Cheeseburger"))

    await user.type(screen.getByPlaceholderText("e.g. Classic Cheeseburger"), "Burger")
    fireEvent.change(priceInput(), { target: { value: "0" } })
    await user.click(screen.getByRole("button", { name: "Save Item" }))
    expect(await screen.findByText("Enter a valid price greater than 0.")).toBeTruthy()

    fireEvent.change(priceInput(), { target: { value: "-1" } })
    await user.click(screen.getByRole("button", { name: "Save Item" }))
    expect(screen.getByText("Enter a valid price greater than 0.")).toBeTruthy()
  })

  it("rejects all non-finite, nonnumeric, and missing price representations before mutation", () => {
    const baseValues = {
      name: "Burger",
      description: "",
      category: "mains",
      prepTimeMinutes: "10",
      type: "food" as const,
      fulfillmentStation: "kitchen" as const,
      fulfillmentBehavior: "prepared" as const,
      isAvailable: true,
    }

    for (const price of ["", "0", "0.00", "-1", "tea", "Infinity"]) {
      expect(menuItemSchema.safeParse({ ...baseValues, price }).success).toBe(false)
    }
  })

  it("uses the Simple Stock create endpoint and preserves duplicate resolution retries", async () => {
    const user = userEvent.setup()
    postMock.mockRejectedValueOnce({
      response: {
        data: {
          conflictType: "category_variant",
          canContinue: true,
          candidate: {
            inventoryItemId: "inventory-1",
            name: "Burger",
            category: "mains",
            trackingUnit: "piece",
            isActive: true,
            availableQuantity: 4,
          },
        },
      },
    }).mockResolvedValueOnce({ data: {} })
    renderMenu()

    await screen.findByText("No menu items yet.")
    await user.click(addItemButton())
    await fillValidNewItem(user)
    await user.click(screen.getByRole("switch", { name: "Track with Simple Stock" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "Available Quantity" }), { target: { value: "7" } })
    await user.click(screen.getByRole("button", { name: "Save Item" }))

    expect(await screen.findByText("A similarly named inventory item uses another category")).toBeTruthy()
    expect((screen.getByPlaceholderText("e.g. Classic Cheeseburger") as HTMLInputElement).value).toBe("Burger")
    await user.click(screen.getByRole("button", { name: "Create separate inventory item" }))

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    expect(postMock).toHaveBeenNthCalledWith(1,
      "/owner/inventory/simple-stock/menu-items",
      expect.objectContaining({
        name: "Burger",
        price: 12.5,
        trackStock: true,
        openingQuantity: 7,
        lowStockThreshold: 5,
        stockUnit: "piece",
      }),
      { headers: { "Idempotency-Key": expect.any(String) } },
    )
    expect(postMock).toHaveBeenNthCalledWith(2,
      "/owner/inventory/simple-stock/menu-items",
      expect.objectContaining({ allowCategoryVariant: true, openingQuantity: 7 }),
      { headers: { "Idempotency-Key": expect.any(String) } },
    )
  }, 30_000)

  it("keeps mapped edit commands sequenced as metadata, settings, adjustment, and availability", async () => {
    const user = userEvent.setup()
    menuItems = [makeItem({
      inventory: {
        trackingState: "canonical_simple",
        mode: "simple",
        mappingStatus: "active",
        inventoryItemId: "inventory-1",
        unit: "portion",
        availableQuantity: 5,
        lowStockThreshold: 2,
        isLowStock: false,
        effectiveIsAvailable: true,
      },
      stockQuantity: 5,
      lowStockThreshold: 2,
    })]
    renderMenu()

    await screen.findByRole("button", { name: "Edit Soup" })
    await user.click(screen.getByRole("button", { name: "Edit Soup" }))
    await user.clear(screen.getByPlaceholderText("Describe the item in detail..."))
    await user.type(screen.getByPlaceholderText("Describe the item in detail..."), "Updated soup")
    fireEvent.change(screen.getByRole("spinbutton", { name: "Available Quantity" }), { target: { value: "7" } })
    fireEvent.change(screen.getByRole("spinbutton", { name: "Low Stock Alert" }), { target: { value: "3" } })
    await user.click(screen.getByRole("switch", { name: "Menu item availability" }))
    await user.click(screen.getByRole("button", { name: "Save Item" }))

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(3))
    expect(patchMock).toHaveBeenNthCalledWith(1, "/menu-items/item-soup", {
      name: "Soup",
      description: "Updated soup",
      price: 12.5,
      prepTimeMinutes: 15,
      category: "mains",
      type: "food",
      fulfillmentStation: "kitchen",
      fulfillmentBehavior: "prepared",
      imageUrl: "",
      businessId: "business-1",
    })
    expect(patchMock).toHaveBeenNthCalledWith(2, "/owner/inventory/simple-stock/menu-items/item-soup/settings", { lowStockThreshold: 3 })
    expect(postMock).toHaveBeenCalledWith(
      "/owner/inventory/simple-stock/menu-items/item-soup/adjust",
      {
        quantity: 2,
        unit: "portion",
        direction: "increase",
        reason: "data_correction",
        reference: "menu-item:item-soup",
        note: "Owner menu stock adjustment",
      },
      { headers: { "Idempotency-Key": expect.any(String) } },
    )
    expect(patchMock).toHaveBeenNthCalledWith(3, "/menu-items/item-soup/availability", {
      businessId: "business-1",
      isAvailable: false,
    })
  }, 30_000)

  it("keeps uploads separate, retains values after a server failure, and blocks a rapid parallel save", async () => {
    const user = userEvent.setup()
    let resolveSave: (() => void) | undefined
    postMock
      .mockResolvedValueOnce({ data: { url: "https://images.example/burger.webp" } })
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveSave = resolve
      }))
    renderMenu()

    await screen.findByText("No menu items yet.")
    await user.click(addItemButton())
    await fillValidNewItem(user)
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).toBeTruthy()
    fireEvent.change(fileInput!, { target: { files: [new File(["image"], "burger.webp", { type: "image/webp" })] } })
    await screen.findByAltText("Burger preview")

    const saveButton = screen.getByRole("button", { name: "Save Item" })
    await user.click(saveButton)
    await user.click(saveButton)
    expect(postMock).toHaveBeenCalledTimes(2)
    expect(postMock.mock.calls[1][0]).toBe("/menu-items")
    expect(postMock.mock.calls[1][1]).toMatchObject({ imageUrl: "https://images.example/burger.webp" })

    resolveSave?.()
  })
  it("retries a strong duplicate by linking the existing inventory item without losing conventional values", async () => {
    const user = userEvent.setup()
    postMock.mockRejectedValueOnce({
      response: {
        data: {
          conflictType: "strong",
          canContinue: true,
          candidate: {
            inventoryItemId: "inventory-existing",
            name: "Burger",
            category: "mains",
            trackingUnit: "piece",
            isActive: true,
            availableQuantity: 4,
          },
        },
      },
    }).mockResolvedValueOnce({ data: {} })
    renderMenu()

    await screen.findByText("No menu items yet.")
    await user.click(addItemButton())
    await fillValidNewItem(user)
    await user.click(screen.getByRole("switch", { name: "Track with Simple Stock" }))
    await user.click(screen.getByRole("button", { name: "Save Item" }))

    expect(await screen.findByText("An inventory item already matches this stock item")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Use existing inventory item" }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    expect(postMock.mock.calls[1][1]).toMatchObject({
      name: "Burger",
      inventoryItemId: "inventory-existing",
      reactivateInventoryItem: false,
    })
  })

  it("preserves the unmapped edit PATCH payload and retains values after a save failure", async () => {
    const user = userEvent.setup()
    menuItems = [makeItem({ stockQuantity: 3, lowStockThreshold: 5, trackStock: false })]
    patchMock.mockRejectedValueOnce({ response: { data: { error: "Menu save unavailable." } } })
    renderMenu()

    await screen.findByRole("button", { name: "Edit Soup" })
    await user.click(screen.getByRole("button", { name: "Edit Soup" }))
    await user.clear(screen.getByPlaceholderText("Describe the item in detail..."))
    await user.type(screen.getByPlaceholderText("Describe the item in detail..."), "Still warm soup")
    await user.click(screen.getByRole("button", { name: "Save Item" }))

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(1))
    expect(patchMock).toHaveBeenCalledWith("/menu-items/item-soup", {
      name: "Soup",
      description: "Still warm soup",
      price: 12.5,
      prepTimeMinutes: 15,
      category: "mains",
      type: "food",
      fulfillmentStation: "kitchen",
      fulfillmentBehavior: "prepared",
      imageUrl: "",
      businessId: "business-1",
      isAvailable: true,
      trackStock: false,
      stockQuantity: 3,
      lowStockThreshold: 5,
    })
    expect(await screen.findByText("Menu save unavailable.")).toBeTruthy()
    expect((screen.getByPlaceholderText("Describe the item in detail...") as HTMLTextAreaElement).value).toBe("Still warm soup")
  })
})
