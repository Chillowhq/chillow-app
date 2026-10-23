import { getInventoryStockState, type InventoryStockState } from "@/lib/inventory"
import { cn } from "@/lib/utils"
import type { InventoryItem } from "@/types/inventory"

const labels: Record<InventoryStockState, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
}

const styles: Record<InventoryStockState, string> = {
  in_stock: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  low_stock: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  out_of_stock: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
}

export function InventoryStockBadge({
  item,
  className,
}: {
  item: Pick<InventoryItem, "availableQuantity" | "lowStockThreshold">
  className?: string
}) {
  const state = getInventoryStockState(item)
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", styles[state], className)}>
      {labels[state]}
    </span>
  )
}
