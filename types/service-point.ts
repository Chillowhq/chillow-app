import type {
  ServicePointTerminology,
  ServicePointType,
} from "@/types/business-capabilities"

export type ServicePoint = {
  _id?: string
  servicePointId: string
  businessId?: string
  label: string
  code: string
  servicePointType?: ServicePointType
  roomType?: string | null
  roomReadiness?: {
    state: "ready" | "needs_cleaning" | "cleaning"
    operationId?: string | null
    changedAt?: string | null
    changedBy?: string | null
  }
  capacity?: number | null
  isActive: boolean
  reservable?: boolean
  createdAt?: string
  updatedAt?: string
  pricePerNight?: number | null
  currency?: string
  description?: string
  fullDescription?: string
  amenities?: string[]
  images?: string[]
  beds?: number | null
  bedType?: string | null
  bedConfiguration?: { bedType: string; count: number }[]
  viewType?: string | null
  maxGuests?: number | null
}

import type { RoomPricingSummary } from "@/components/reservations/hotel/HotelRoomPriceDisplay"

export type StayServicePoint = ServicePoint & {
  pricePerNight: number
  pricingSummary?: RoomPricingSummary | null
}

export type ServicePointFormPayload = {
  label: string
  code: string
  capacity?: number | null
  servicePointType?: ServicePointType
  roomType?: string | null
  pricePerNight?: number
  currency?: string
  beds?: number | null
  bedType?: string | null
  bedConfiguration?: { bedType: string; count: number }[]
  viewType?: string | null
  maxGuests?: number | null
  description?: string
  amenities?: string[]
  images?: string[]
  isActive?: boolean
  reservable?: boolean
}

export type ServicePointModalProps = {
  isOpen: boolean
  onClose: () => void
  isEditing: boolean
  initialData: ServicePoint | null
  onSave: (payload: ServicePointFormPayload) => Promise<void>
  term: Pick<ServicePointTerminology, "singular" | "plural">
}
