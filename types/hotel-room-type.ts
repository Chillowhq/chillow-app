import type { InventoryItem, InventoryUnit } from "./inventory"

export type HotelBedConfiguration = {
  bedType: string
  count: number
}

export type HotelRoomTypeSupplyTemplateItem = {
  inventoryItemId: string
  quantity: number
  unit: InventoryUnit
  canonicalQuantity: number
}

export type HotelRoomTypeSupplyTemplateLine = HotelRoomTypeSupplyTemplateItem & {
  status: "available" | "missing" | "deleted" | "inactive" | "not_room_usage_eligible" | "unit_changed"
  inventoryItem: InventoryItem | null
}

export type HotelRoomTypeSupplyTemplateResponse = {
  roomTypeName: string
  roomType?: HotelRoomType
  items: HotelRoomTypeSupplyTemplateLine[]
}

export type HotelRoomType = {
  name: string
  sortOrder: number
  active: boolean
  isDefault: boolean
  description?: string
  roomSize?: number | null
  roomSizeUnit?: "m2" | "ft2"
  maxGuests?: number | null
  bedConfiguration?: HotelBedConfiguration[]
  viewType?: string
  amenities?: string[]
  images?: string[]
  standardSupplyTemplate?: HotelRoomTypeSupplyTemplateItem[]
}

export type HotelRoomTypeCreatePayload = {
  name: string
  description: string
  roomSize: number | null
  roomSizeUnit: "m2" | "ft2"
  maxGuests: number
  bedConfiguration: HotelBedConfiguration[]
  viewType: string
  amenities: string[]
  images: string[]
}
