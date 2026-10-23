import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface CartItem {
  id: string
  name: string
  price: number
  image: string
  category: string
  description: string
  quantity: number
  orderCategory: "food" | "drinks"
}

export type CartActor = "customer" | "waitstaff"

export interface CartContext {
  actor: CartActor
  businessId: string
  servicePointId: string
}

interface CartStore {
  items: CartItem[]
  allergies: string[]
  specialNotes: string
  servicePointId: string | null
  orderType: "dine-in" | "takeout" | null
  context: CartContext | null
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  setItemQuantity: (id: string, quantity: number) => void
  setItems: (items: CartItem[]) => void
  clearCart: () => void
  setAllergies: (allergies: string[]) => void
  setSpecialNotes: (notes: string) => void
  clearOrderDetails: () => void
  setTableId: (servicePointId: string) => void
  setOrderType: (orderType: "dine-in" | "takeout") => void
  ensureContext: (context: CartContext) => void
}

function isSameContext(current: CartContext | null, next: CartContext) {
  return Boolean(
    current &&
    current.actor === next.actor &&
    current.businessId === next.businessId &&
    current.servicePointId === next.servicePointId,
  )
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      allergies: [],
      specialNotes: "",
      servicePointId: null,
      orderType: null,
      context: null,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id)
          if (existing) {
            return {
              // Fix: merge new item props (like orderCategory) into existing item to handle data updates
              items: state.items.map((i) => (i.id === item.id ? { ...i, ...item, quantity: i.quantity + item.quantity } : i)),
            }
          }
          return { items: [...state.items, item] }
        }),

      removeItem: (id) =>
        set((state) => {
          const item = state.items.find((i) => i.id === id)
          if (!item) return state

          if (item.quantity > 1) {
            return {
              items: state.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i)),
            }
          }
          return { items: state.items.filter((i) => i.id !== id) }
        }),

      setItemQuantity: (id, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.id !== id) }
          }
          return {
            items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
          }
        }),

      setItems: (items) => set({ items }),

      clearCart: () => set({ items: [] }),

      setAllergies: (allergies) => set({ allergies }),

      setSpecialNotes: (notes) => set({ specialNotes: notes }),

      clearOrderDetails: () => set({ allergies: [], specialNotes: "", orderType: null }),

      setTableId: (servicePointId) => set({ servicePointId }),

      setOrderType: (orderType) => set({ orderType }),

      // One persisted cart may be reused only inside the exact same ordering
      // context. Crossing actor, tenant, or ServicePoint boundaries atomically
      // clears order data before the new context becomes active.
      ensureContext: (context) =>
        set((state) => {
          if (isSameContext(state.context, context)) return state
          return {
            items: [],
            allergies: [],
            specialNotes: "",
            orderType: null,
            servicePointId: context.servicePointId,
            context,
          }
        }),
    }),
    {
      name: "quickserve-cart",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as any))),
    },
  ),
)
