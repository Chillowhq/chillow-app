import { formatInventoryQuantity } from "@/lib/inventory"
import { cn } from "@/lib/utils"
import type { InventoryTrackingUnit } from "@/types/inventory"

type InventoryQuantitySummaryProps = {
  onHandQuantity: number
  reservedQuantity: number
  availableQuantity: number
  trackingUnit: InventoryTrackingUnit
  className?: string
  showFormula?: boolean
  compact?: boolean
}

const quantityDefinitions = [
  { key: "onHandQuantity", label: "On hand", description: "Physical stock recorded" },
  { key: "reservedQuantity", label: "Reserved", description: "Committed to orders" },
  { key: "availableQuantity", label: "Available", description: "Ready to use" },
] as const

export function InventoryQuantitySummary({
  onHandQuantity,
  reservedQuantity,
  availableQuantity,
  trackingUnit,
  className,
  showFormula = false,
  compact = false,
}: InventoryQuantitySummaryProps) {
  const quantities = { onHandQuantity, reservedQuantity, availableQuantity }

  return (
    <div className={cn("rounded-xl border bg-muted/20", className)}>
      <dl className={cn("grid grid-cols-3 divide-x", compact ? "p-2" : "p-3")}>
        {quantityDefinitions.map((quantity) => (
          <div key={quantity.key} className={cn("min-w-0", compact ? "px-2" : "px-3")}>
            <dt className="text-xs font-medium text-muted-foreground">{quantity.label}</dt>
            <dd className={cn("font-semibold tabular-nums", compact ? "mt-1 text-sm" : "mt-1.5 text-base")}>
              {formatInventoryQuantity(quantities[quantity.key], trackingUnit)}
            </dd>
            {!compact ? <p className="mt-1 text-xs text-muted-foreground">{quantity.description}</p> : null}
          </div>
        ))}
      </dl>
      {showFormula ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">On hand − Reserved = Available.</span> Available stock is ready for new orders or use.
        </p>
      ) : null}
    </div>
  )
}
