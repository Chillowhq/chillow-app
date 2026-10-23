export type InventoryStockStatusFilter = "all" | "low_stock" | "out_of_stock"

export type InventoryActiveFilter = "all" | "true" | "false"

export type InventoryDomain =
  | "food_service"
  | "housekeeping"
  | "guest_supplies"
  | "cleaning"
  | "linen"
  | "general"

export type InventoryTrackingUnit =
  | "g"
  | "ml"
  | "piece"
  | "bottle"
  | "can"
  | "pack"
  | "portion"

export type InventoryUnit = InventoryTrackingUnit | "kg" | "L"

export type InventoryItem = {
  inventoryItemId: string
  name: string
  domain?: InventoryDomain
  category: string | null
  trackingUnit: InventoryTrackingUnit
  baseUnitDimension: "weight" | "volume" | "count"
  onHandQuantity: number
  reservedQuantity: number
  availableQuantity: number
  lowStockThreshold: number
  unitCostMinor: number | null
  costCurrency: string | null
  isActive: boolean
  isDeleted?: boolean
  deletedAt?: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type InventoryDuplicateCandidate = Pick<
  InventoryItem,
  "inventoryItemId" | "name" | "category" | "trackingUnit" | "isActive" | "availableQuantity"
>

export type InventoryDuplicateSignal = {
  conflictType: "strong" | "category_variant"
  candidate: InventoryDuplicateCandidate
  canContinue: boolean
}

export type SimpleStockMenuRemovalPreview = {
  menuItemId: string
  menuItemName: string
  inventoryItem: Pick<
    InventoryItem,
    "inventoryItemId" | "name" | "trackingUnit" | "availableQuantity"
  >
  canRemoveInventory: boolean
  sharedActiveRelationshipCount: number
}

export type InventoryOverviewResponse = {
  recentMovements: InventoryMovement[]
  summary: {
    activeItems: number
    lowStockItems: number
    outOfStockItems: number
  }
}

export type InventoryItemsResponse = {
  items: InventoryItem[]
  pagination: {
    limit: number
    hasNextPage: boolean
    nextCursor: string | null
  }
}

export type InventoryMovement = {
  movementId: string
  inventoryItemId: string
  inventoryItem: Pick<InventoryItem, "inventoryItemId" | "name" | "category" | "trackingUnit"> | null
  type: string
  quantityDeltaOnHand: number
  quantityDeltaReserved: number
  unit: InventoryUnit
  canonicalQuantity: number
  onHandBefore: number
  onHandAfter: number
  reservedBefore: number
  reservedAfter: number
  availableBefore: number
  availableAfter: number
  sourceType: string
  sourceId: string | null
  servicePointId?: string
  operationId?: string
  servicePoint?: {
    servicePointId: string
    label: string
    roomType: string | null
  }
  reasonCode: string | null
  note: string | null
  performedBy: {
    staffId: string
    role: string
    name: string
  } | null
  unitCostMinor: number | null
  costCurrency: string | null
  createdAt: string | null
}

export type InventoryMovementsResponse = {
  movements: InventoryMovement[]
  pagination: {
    limit: number
    hasNextPage: boolean
    nextCursor: string | null
  }
}

export type InventoryRecipeStatus = "active" | "disabled" | "orphaned"

export type InventoryRecipeMenuItem = {
  id: string
  name: string
  category: string | null
  type: string
  price: number
  manualIsAvailable: boolean
}

export type InventoryRecipeComponent = {
  inventoryItemId: string
  inventoryItemName: string | null
  quantity: number
  unit: InventoryUnit
  canonicalQuantity: number
  trackingUnit: InventoryTrackingUnit | null
  inventoryItemActive: boolean | null
  unitCostMinor: number | null
  costCurrency: string | null
  estimatedComponentCostMinor: number | null
}

export type InventoryRecipeCosting = {
  status: "complete" | "missing_cost" | "mixed_currency"
  estimatedCostMinor: number | null
  knownCostMinor: number | null
  currency: string | null
  missingCostInventoryItemIds: string[]
  currencies: string[]
}

export type InventoryRecipe = {
  menuInventoryRecipeId: string
  menuItemId: string
  mode: "simple" | "recipe"
  status: InventoryRecipeStatus
  version: number
  menuItem: InventoryRecipeMenuItem | null
  components: InventoryRecipeComponent[]
  costing: InventoryRecipeCosting
  simpleStock: {
    active: boolean
    status: "active" | "disabled" | "archived" | "orphaned"
    inventoryItemId: string
    inventoryItemName: string | null
    onHandQuantity: number | null
    reservedQuantity: number | null
    availableQuantity: number | null
    unit: InventoryTrackingUnit
  } | null
  ingredientBehavior: "sidecar"
}

export type LinkedInventoryRecipe = InventoryRecipe

export type InventoryRecipesResponse = {
  recipes: InventoryRecipe[]
  pagination: {
    limit: number
    hasNextPage: boolean
    nextCursor: string | null
  }
}

export type InventoryRecipeResponse = {
  recipe: InventoryRecipe
  replayed?: boolean
}

export type InventoryRecipeMenuCandidate = {
  _id?: string
  id?: string
  name: string
  category?: string | null
  type?: string
  trackStock?: boolean
  stockQuantity?: number | null
  inventory?: {
    trackingState: "untracked" | "legacy" | "canonical_simple" | "canonical_recipe"
    mode: "simple" | "recipe" | null
    mappingStatus: "active" | "disabled" | "orphaned" | null
    availableQuantity?: number | null
    unit?: InventoryTrackingUnit | null
    ingredientTracking?: {
      configured: boolean
      status: InventoryRecipeStatus | null
      componentCount: number
      behavior: "sidecar" | "authoritative" | null
    }
  }
}

export type InventoryMovementResponse = {
  item: InventoryItem
  movement: InventoryMovement
  replayed: boolean
}

export type RoomUsageResponse = {
  operationId: string
  replayed: boolean
  housekeepingOperationId?: string | null
  room: {
    servicePointId: string
    label: string
    roomType: string | null
  }
  items: InventoryItem[]
  movements: InventoryMovement[]
}

export type RoomUsageContextResponse = {
  items: InventoryItem[]
  rooms: Array<{
    servicePointId: string
    label: string
    roomType: string | null
  }>
  selectedRoom: {
    servicePointId: string
    label: string
    roomType: string | null
  } | null
  template: {
    roomTypeName: string | null
    configured: boolean
    suggestions: Array<{
      inventoryItemId: string
      quantity: number
      unit: InventoryUnit
      canonicalQuantity: number
      status: "available"
      inventoryItem: InventoryItem
    }>
    unavailableItems: Array<{
      inventoryItemId: string
      status: "missing" | "deleted" | "inactive" | "not_room_usage_eligible" | "unit_changed"
      name: string | null
    }>
  } | null
}
