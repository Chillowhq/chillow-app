"use client"

import { DollarSign } from "lucide-react"
import { formatPrice } from "@/lib/localization"

export type TipType = "percentage" | "custom" | null

export interface TipState {
  amount: number
  type: TipType
  percentage: number | null
}

interface TipSelectorProps {
  subtotal: number
  currency?: string
  value: TipState
  onChange: (tip: TipState) => void
}

const PRESET_TIPS = [10, 15, 20]

function roundMoney(value: number) {
  return Math.max(0, Math.round(value * 100) / 100)
}

function getCurrencySymbol(currency?: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0).find((part) => part.type === "currency")?.value || "$"
  } catch {
    return "$"
  }
}

export default function TipSelector({ subtotal, currency, value, onChange }: TipSelectorProps) {
  const customValue = value.type === "custom" && value.amount > 0 ? String(value.amount) : ""
  const currencySymbol = getCurrencySymbol(currency)

  const setPercentageTip = (percentage: number) => {
    onChange({
      amount: roundMoney(subtotal * (percentage / 100)),
      type: "percentage",
      percentage,
    })
  }

  const setCustomTip = (rawValue: string) => {
    const amount = roundMoney(Number(rawValue) || 0)
    onChange({
      amount,
      type: amount > 0 ? "custom" : null,
      percentage: null,
    })
  }

  const clearTip = () => {
    onChange({ amount: 0, type: null, percentage: null })
  }

  return (
    <section className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-base font-black text-foreground">Add a Tip</h3>
            <p className="text-xs text-muted-foreground font-medium">Optional</p>
          </div>
        </div>
        <label className="flex-1 min-w-0 relative">
          <span className="sr-only">Enter Tip</span>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">{currencySymbol}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={customValue}
            onChange={(event) => setCustomTip(event.target.value)}
            placeholder="Custom"
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-3 text-base font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PRESET_TIPS.map((percentage) => {
          const isActive = value.type === "percentage" && value.percentage === percentage
          const amount = roundMoney(subtotal * (percentage / 100))

          return (
            <button
              key={percentage}
              type="button"
              onClick={() => setPercentageTip(percentage)}
              className={`min-h-[64px] rounded-lg border px-2 py-2 text-center transition-colors ${
                isActive
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                  : "bg-background border-border hover:border-emerald-300 text-foreground"
              }`}
            >
              <span className="block text-lg font-black leading-tight">{percentage}%</span>
              <span className={`block text-xs font-bold mt-1 ${isActive ? "text-white/80" : "text-muted-foreground"}`}>
                {formatPrice(amount, currency)}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={clearTip}
          className={`min-h-[64px] rounded-lg border px-2 py-2 text-center transition-colors ${
            value.amount <= 0
              ? "bg-secondary border-border text-foreground shadow-sm"
              : "bg-background border-border hover:border-emerald-300 text-foreground"
          }`}
        >
          <span className="block text-lg font-black leading-tight">None</span>
          <span className="block text-xs font-bold mt-1 text-muted-foreground">{formatPrice(0, currency)}</span>
        </button>
      </div>
    </section>
  )
}
