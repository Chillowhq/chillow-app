"use client"

import { useEffect, useState } from "react"
import { Calendar, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type {
  OwnerAnalyticsCustomRange,
  OwnerAnalyticsRange,
} from "@/types/owner-analytics"

type AnalyticsRangeSelectorProps = {
  range: OwnerAnalyticsRange
  customRange: OwnerAnalyticsCustomRange
  onRangeChange: (range: OwnerAnalyticsRange) => void
  onCustomRangeChange: (range: OwnerAnalyticsCustomRange) => void
}

const RANGE_LABELS: Record<OwnerAnalyticsRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7days": "Last 7 Days",
  "30days": "Last 30 Days",
  thisMonth: "This Month",
  custom: "Custom",
}

const RANGES: OwnerAnalyticsRange[] = [
  "today",
  "yesterday",
  "7days",
  "30days",
  "thisMonth",
  "custom",
]

export function AnalyticsRangeSelector({
  range,
  customRange,
  onRangeChange,
  onCustomRangeChange,
}: AnalyticsRangeSelectorProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [tempCustomRange, setTempCustomRange] =
    useState<OwnerAnalyticsCustomRange>(customRange)

  useEffect(() => {
    setTempCustomRange(customRange)
  }, [customRange])

  function applyCustomRange() {
    if (!tempCustomRange.from || !tempCustomRange.to) return
    onCustomRangeChange(tempCustomRange)
    setShowCustomPicker(false)
  }

  return (
    <div className="min-w-0 flex-1 overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-none">
    <div className="flex min-w-max bg-secondary p-1 rounded-xl border border-border relative">
      {RANGES.map((rangeOption) => {
        if (rangeOption === "custom") {
          return (
            <Popover
              key={rangeOption}
              open={showCustomPicker}
              onOpenChange={setShowCustomPicker}
            >
              <PopoverTrigger asChild>
                <button
                  onClick={() => onRangeChange("custom")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all whitespace-nowrap ${
                    range === rangeOption
                      ? "bg-white dark:bg-black shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Custom{" "}
                  {range === "custom" && customRange.from
                    ? `(${customRange.from} - ${customRange.to})`
                    : ""}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-4 bg-card rounded-xl border border-border shadow-xl flex flex-col gap-4"
                align="end"
              >
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-sm font-bold text-foreground">
                    Select Custom Range
                  </h3>
                  <button
                    onClick={() => setShowCustomPicker(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      From
                    </label>
                    <input
                      type="date"
                      value={tempCustomRange.from}
                      onChange={(event) =>
                        setTempCustomRange((current) => ({
                          ...current,
                          from: event.target.value,
                        }))
                      }
                      className="w-full text-sm bg-background border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      To
                    </label>
                    <input
                      type="date"
                      value={tempCustomRange.to}
                      onChange={(event) =>
                        setTempCustomRange((current) => ({
                          ...current,
                          to: event.target.value,
                        }))
                      }
                      className="w-full text-sm bg-background border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <Button
                  onClick={applyCustomRange}
                  className="w-full font-bold"
                  disabled={
                    !tempCustomRange.from || !tempCustomRange.to
                  }
                >
                  Apply Range
                </Button>
              </PopoverContent>
            </Popover>
          )
        }

        return (
          <button
            key={rangeOption}
            onClick={() => {
              onRangeChange(rangeOption)
              setShowCustomPicker(false)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all whitespace-nowrap ${
              range === rangeOption
                ? "bg-white dark:bg-black shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {RANGE_LABELS[rangeOption]}
          </button>
        )
      })}
    </div>
    </div>
  )
}
