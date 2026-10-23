"use client"

import { useState } from "react"
import {
  Ban,
  Armchair,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CircleSlash2,
  Loader2,
  MoreHorizontal,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type RestaurantReservationAction = {
  id: string
  label: string
  status: string
  icon: typeof CheckCircle2
  destructive?: boolean
}

/**
 * Finalized restaurant status action map.
 *
 * Statuses: pending | confirmed | arrived | cancelled | declined | no_show
 * Terminal states (cancelled, declined, no_show) have no transition actions.
 *
 * No Show is always a manual staff action — never automatic.
 * Mark Arrived is always first in the confirmed menu as the positive action.
 */
const STATUS_ACTIONS: Record<string, RestaurantReservationAction[]> = {
  pending: [
    {
      id: "accept",
      label: "Accept",
      status: "confirmed",
      icon: CheckCircle2,
    },
    {
      id: "decline",
      label: "Decline",
      status: "declined",
      icon: XCircle,
      destructive: true,
    },
  ],
  confirmed: [
    {
      id: "mark-arrived",
      label: "Mark Arrived",
      status: "arrived",
      icon: UserCheck,
    },
    {
      id: "no-show",
      label: "Mark No Show",
      status: "no_show",
      icon: CircleSlash2,
      destructive: true,
    },
    {
      id: "cancel",
      label: "Cancel Reservation",
      status: "cancelled",
      icon: Ban,
      destructive: true,
    },
  ],
  arrived: [
    {
      id: "seat",
      label: "Seat Guest",
      status: "seated",
      icon: Armchair,
    },
    {
      id: "cancel",
      label: "Cancel Reservation",
      status: "cancelled",
      icon: Ban,
      destructive: true,
    },
  ],
  seated: [
    {
      id: "complete",
      label: "Complete Visit",
      status: "completed",
      icon: BadgeCheck,
    },
  ],
  // completed, cancelled, declined and no_show are terminal.
}

function ActionItem({
  action,
  onSelect,
}: {
  action: RestaurantReservationAction
  onSelect: () => void
}) {
  const Icon = action.icon

  return (
    <button
      type="button"
      role="menuitem"
      className={"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring " + (
        action.destructive
          ? "text-red-600 dark:text-red-400"
          : "text-foreground"
      )}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {action.label}
    </button>
  )
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-ring dark:text-red-400 dark:hover:bg-red-950/30"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      Delete
    </button>
  )
}

export function RestaurantReservationActions({
  reservation,
  isBusy,
  onStatusChange,
  onDelete,
  compact = false,
}: {
  reservation: {
    status: string
    customerName?: string
  }
  isBusy: boolean
  onStatusChange: (status: string) => void | Promise<void>
  onDelete: () => void
  compact?: boolean
}) {
  const [manageOpen, setManageOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const actions = STATUS_ACTIONS[reservation.status] || []
  const guestLabel = reservation.customerName || "reservation"
  const isPending = reservation.status === "pending"

  function selectAction(action: RestaurantReservationAction) {
    setManageOpen(false)
    setMobileOpen(false)
    void onStatusChange(action.status)
  }

  function selectDelete() {
    setManageOpen(false)
    setMobileOpen(false)
    onDelete()
  }

  // Terminal states: show only a compact Delete button
  if (actions.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isBusy}
        aria-label={"Delete reservation for " + guestLabel}
        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
        onClick={(event) => {
          event.stopPropagation()
          selectDelete()
        }}
      >
        {isBusy ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    )
  }

  return (
    <div
      className="flex items-center gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Desktop */}
      <div className="hidden sm:flex">
        {isPending && !compact ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isBusy}
              aria-label={"Accept reservation for " + guestLabel}
              onClick={() => selectAction(actions[0])}
            >
              {isBusy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              aria-label={"Decline reservation for " + guestLabel}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => selectAction(actions[1])}
            >
              <XCircle />
              Decline
            </Button>
          </div>
        ) : (
          <Popover open={manageOpen} onOpenChange={setManageOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size={compact ? "icon-sm" : "sm"}
                disabled={isBusy}
                aria-label={"Manage reservation for " + guestLabel}
                aria-haspopup="menu"
              >
                {isBusy ? <Loader2 className="animate-spin" /> : compact ? <MoreHorizontal /> : null}
                {!compact && (
                  <>
                    Manage
                    <ChevronDown aria-hidden="true" />
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-52 p-1.5"
              role="menu"
            >
              {actions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  onSelect={() => selectAction(action)}
                />
              ))}
              {/* Separator before destructive delete */}
              <div className="my-1 border-t border-border/60" role="separator" />
              <DeleteButton onClick={selectDelete} />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Mobile drawer */}
      <div className="sm:hidden">
        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              aria-label={"Manage reservation for " + guestLabel}
            >
              {isBusy ? <Loader2 className="animate-spin" /> : null}
              Manage
              <ChevronDown aria-hidden="true" />
            </Button>
          </DrawerTrigger>
          <DrawerContent onClick={(event) => event.stopPropagation()}>
            <DrawerHeader className="text-left">
              <DrawerTitle>Reservation actions</DrawerTitle>
              <DrawerDescription>
                Choose an action for {guestLabel}.
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-1 px-4 pb-6" role="menu">
              {actions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  onSelect={() => selectAction(action)}
                />
              ))}
              <div className="my-1 border-t border-border/60" role="separator" />
              <DeleteButton onClick={selectDelete} />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  )
}
