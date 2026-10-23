"use client"

import { useState } from "react"
import {
  Archive,
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  LogOut,
  MoreHorizontal,
  Send,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  getHotelReservationActions,
  type HotelReservationActionId,
} from "./hotel-reservation-actions"

const ACTION_DETAILS: Record<
  HotelReservationActionId,
  {
    label: string
    icon: typeof CheckCircle2
    destructive?: boolean
  }
> = {
  accept: { label: "Accept Reservation", icon: CheckCircle2 },
  decline: {
    label: "Decline Reservation",
    icon: XCircle,
    destructive: true,
  },
  resend_payment_link: { label: "Resend Payment Link", icon: Send },
  copy_payment_link: { label: "Copy Payment Link", icon: Copy },
  cancel: {
    label: "Cancel Reservation",
    icon: Ban,
    destructive: true,
  },
  check_in: { label: "Check In", icon: KeyRound },
  check_out: { label: "Check Out", icon: LogOut },
  view: { label: "View Reservation", icon: Eye },
  archive: {
    label: "Archive",
    icon: Archive,
    destructive: true,
  },
}

export function HotelReservationActionsMenu({
  reservation,
  isBusy,
  onAction,
}: {
  reservation: {
    status: string
    paymentUrl?: string | null
    paymentStatus?: string
    refundPending?: boolean
    canRefund?: boolean
    customerName?: string
  }
  isBusy: boolean
  onAction: (action: HotelReservationActionId) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const actions = getHotelReservationActions(reservation)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          aria-label={`Actions for ${reservation.customerName || "reservation"}`}
          onClick={(event) => event.stopPropagation()}
        >
          {isBusy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <MoreHorizontal />
          )}
          <span className="hidden xl:inline">Actions</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 p-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-0.5">
          {actions.map((action) => {
            const details = ACTION_DETAILS[action]
            const Icon = details.icon
            const label =
              action === "cancel" &&
              ["paid", "partially_refunded", "refunded"].includes(
                reservation.paymentStatus || "",
              )
                ? "Cancel Reservation..."
                : details.label
            return (
              <button
                type="button"
                key={action}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted ${
                  details.destructive
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground"
                }`}
                onClick={() => {
                  setOpen(false)
                  void onAction(action)
                }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
