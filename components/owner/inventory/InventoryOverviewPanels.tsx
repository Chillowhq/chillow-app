import Link from "next/link"
import { ArrowRight, CheckCircle2, History, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatInventoryQuantity } from "@/lib/inventory"
import { formatDateTime } from "@/lib/localization"
import type { InventoryItem, InventoryMovement } from "@/types/inventory"
import { InventoryStockBadge } from "./InventoryStockBadge"

type InventoryAttentionListProps = {
  items: InventoryItem[]
  canReceive: boolean
  loading?: boolean
  error?: string | null
  onReceive: (item: InventoryItem) => void
  onViewItem: (inventoryItemId: string) => void
}

type InventoryActivityListProps = {
  movements: InventoryMovement[]
  timezone?: string
  itemHref?: (inventoryItemId: string) => string
}

const movementLabels: Record<string, string> = {
  RECEIVE: "Received stock",
  RESERVE: "Stock reserved",
  RELEASE: "Reservation released",
  CONSUME: "Stock consumed",
  WASTE: "Waste recorded",
  ADJUSTMENT_INCREASE: "Stock corrected up",
  ADJUSTMENT_DECREASE: "Stock corrected down",
  COUNT_RECONCILIATION_INCREASE: "Count corrected up",
  COUNT_RECONCILIATION_DECREASE: "Count corrected down",
  LEGACY_ORDER_DEDUCTION: "Legacy stock deduction",
  LEGACY_ORDER_RESTORE: "Legacy stock restored",
}

const movementTone: Record<string, string> = {
  RECEIVE: "bg-emerald-500",
  RESERVE: "bg-sky-500",
  RELEASE: "bg-sky-400",
  CONSUME: "bg-violet-500",
  WASTE: "bg-destructive",
  ADJUSTMENT_INCREASE: "bg-amber-500",
  ADJUSTMENT_DECREASE: "bg-amber-500",
  COUNT_RECONCILIATION_INCREASE: "bg-amber-500",
  COUNT_RECONCILIATION_DECREASE: "bg-amber-500",
  LEGACY_ORDER_DEDUCTION: "bg-muted-foreground",
  LEGACY_ORDER_RESTORE: "bg-muted-foreground",
}

function formatMovementTime(value: string | null, timezone: string) {
  if (!value) return "Time unavailable"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Time unavailable"
  try {
    return formatDateTime(date, timezone)
  } catch {
    return "Time unavailable"
  }
}

function formatReason(value: string | null) {
  if (!value) return null
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ")
}

function movementQuantity(movement: InventoryMovement) {
  const quantityDelta = movement.type === "RESERVE" || movement.type === "RELEASE"
    ? movement.quantityDeltaReserved
    : movement.quantityDeltaOnHand
  if (!movement.inventoryItem || !Number.isFinite(quantityDelta)) return null
  return formatInventoryQuantity(Math.abs(quantityDelta), movement.inventoryItem.trackingUnit)
}

function movementDescription(movement: InventoryMovement) {
  const itemName = movement.inventoryItem?.name || "Inventory item unavailable"
  const quantity = movementQuantity(movement)
  if (!quantity) return itemName

  switch (movement.type) {
    case "RESERVE":
      return `${itemName} · ${quantity} committed to orders`
    case "RELEASE":
      return `${itemName} · ${quantity} released from orders`
    case "RECEIVE":
    case "ADJUSTMENT_INCREASE":
    case "COUNT_RECONCILIATION_INCREASE":
    case "LEGACY_ORDER_RESTORE":
      return `${itemName} · +${quantity}`
    default:
      return `${itemName} · −${quantity}`
  }
}

export function InventoryAttentionList({
  items,
  canReceive,
  loading = false,
  error,
  onReceive,
  onViewItem,
}: InventoryAttentionListProps) {
  if (loading) {
    return <div className="h-52 animate-pulse rounded-xl bg-muted" aria-label="Loading items needing attention" />
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center">
        <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">No items need attention</p>
        <p className="mt-1 text-xs text-muted-foreground">All active stock is above its alert level.</p>
      </div>
    )
  }

  return (
    <div className="divide-y rounded-xl border">
      {items.slice(0, 5).map((item) => (
        <div key={item.inventoryItemId} className="flex items-center gap-3 p-3 sm:p-4">
          <button
            type="button"
            onClick={() => onViewItem(item.inventoryItemId)}
            className="min-w-0 flex-1 text-left outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View ${item.name}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatInventoryQuantity(item.availableQuantity, item.trackingUnit)} available
                </p>
              </div>
              <InventoryStockBadge item={item} />
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {canReceive ? (
              <Button size="sm" variant="outline" onClick={() => onReceive(item)}>
                <PackagePlus className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">Receive</span>
              </Button>
            ) : null}
            <Button size="icon-sm" variant="ghost" onClick={() => onViewItem(item.inventoryItemId)} aria-label={`Open ${item.name}`}>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function InventoryActivityList({
  movements,
  timezone = "UTC",
  itemHref,
}: InventoryActivityListProps) {
  if (movements.length === 0) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center">
        <History className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">No stock activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Receiving, waste, corrections, and fulfilment will appear here.</p>
      </div>
    )
  }

  return (
    <div className="divide-y rounded-xl border">
      {movements.map((movement) => {
        const itemLink = movement.inventoryItem && itemHref
          ? itemHref(movement.inventoryItem.inventoryItemId)
          : null
        const reason = formatReason(movement.reasonCode)
        const note = movement.note || reason
        return (
          <div key={movement.movementId} className="flex items-start gap-3 p-3 sm:p-4">
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${movementTone[movement.type] || "bg-muted-foreground"}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{movementLabels[movement.type] || movement.type}</p>
              {itemLink ? (
                <Link href={itemLink} className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {movementDescription(movement)}
                </Link>
              ) : <p className="mt-1 truncate text-xs text-muted-foreground">{movementDescription(movement)}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMovementTime(movement.createdAt, timezone)}
                {movement.performedBy?.name ? ` · By ${movement.performedBy.name}` : ""}
              </p>
              {note ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note}</p> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}