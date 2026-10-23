"use client"

import { useRef, type ElementType } from "react"
import { formatDistanceToNowStrict } from "date-fns"
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CircleAlert,
  Loader2,
  MessageSquare,
  PackageSearch,
  ReceiptText,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatUnreadBadge } from "@/lib/owner-notification-contract.mjs"
import type { OwnerNotificationsController } from "@/hooks/use-owner-notifications"
import type {
  OwnerNotification,
  OwnerNotificationCategory,
  OwnerNotificationSeverity,
} from "@/types/owner-notifications"

type NotificationPresentation = {
  icon: ElementType
  iconClassName: string
  surfaceClassName: string
}

const CATEGORY_PRESENTATION: Record<OwnerNotificationCategory, NotificationPresentation> = {
  reservations: {
    icon: CalendarClock,
    iconClassName: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
    surfaceClassName: "border-l-blue-500",
  },
  inventory: {
    icon: PackageSearch,
    iconClassName: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    surfaceClassName: "border-l-amber-500",
  },
  feedback: {
    icon: MessageSquare,
    iconClassName: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    surfaceClassName: "border-l-violet-500",
  },
  billing: {
    icon: ReceiptText,
    iconClassName: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
    surfaceClassName: "border-l-rose-500",
  },
}

const SEVERITY_ICON: Record<OwnerNotificationSeverity, ElementType | null> = {
  info: null,
  warning: AlertTriangle,
  critical: CircleAlert,
}

function relativeTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

function renderNotificationBell(
  variant: "desktop" | "mobile",
  controller: OwnerNotificationsController,
) {
  const badge = formatUnreadBadge(controller.unreadCount)
  const label = controller.unreadCount && controller.unreadCount > 0
    ? `Notifications, ${controller.unreadCount} unread`
    : "Notifications"

  return (
    <Button
      type="button"
      variant="ghost"
      size={variant === "mobile" ? "icon" : "default"}
      className={cn(
        "relative",
        variant === "desktop" &&
          "h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground",
        variant === "mobile" && "size-10 rounded-lg",
      )}
      aria-label={label}
      aria-expanded={controller.openSurface === variant}
      aria-haspopup="dialog"
    >
      <Bell className="size-4" aria-hidden="true" />
      {variant === "desktop" && <span>Notifications</span>}
      {badge ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black leading-5 text-primary-foreground",
            variant === "desktop" ? "ml-auto" : "absolute -right-0.5 -top-0.5 h-5",
          )}
        >
          {badge}
        </span>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {controller.unreadCount === null
          ? "Notification count loading"
          : `${controller.unreadCount} unread notifications`}
      </span>
    </Button>
  )
}

function NotificationListSkeleton() {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading notifications">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex gap-3 rounded-xl border border-border/70 p-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

function NotificationRow({
  notification,
  controller,
}: {
  notification: OwnerNotification
  controller: OwnerNotificationsController
}) {
  const presentation = CATEGORY_PRESENTATION[notification.category]
  const CategoryIcon = presentation?.icon || Bell
  const SeverityIcon = SEVERITY_ICON[notification.severity]
  const isBusy = controller.markingNotificationId === notification.notificationId
  const createdLabel = relativeTimestamp(notification.occurredAt || notification.createdAt)

  return (
    <button
      type="button"
      onClick={() => void controller.selectNotification(notification)}
      disabled={Boolean(controller.markingNotificationId) || controller.markingAll}
      className={cn(
        "group flex w-full min-w-0 gap-3 border-l-2 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60",
        presentation?.surfaceClassName || "border-l-muted-foreground",
        notification.read ? "bg-background" : "bg-primary/[0.035]",
      )}
      aria-label={`${notification.title}. ${notification.message}. ${createdLabel}. ${notification.read ? "Read" : "Unread"}`}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
          presentation?.iconClassName || "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {isBusy ? <Loader2 className="size-4 animate-spin" /> : <CategoryIcon className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start gap-2">
          <span className={cn("min-w-0 flex-1 text-sm leading-5", notification.read ? "font-semibold" : "font-black")}>
            {notification.title}
          </span>
          {!notification.read ? (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {notification.message}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          {SeverityIcon ? <SeverityIcon className="size-3" aria-hidden="true" /> : null}
          <time dateTime={notification.occurredAt || notification.createdAt}>{createdLabel}</time>
        </span>
      </span>
    </button>
  )
}

function NotificationPanel({
  controller,
  mobile = false,
  onClose,
}: {
  controller: OwnerNotificationsController
  mobile?: boolean
  onClose?: () => void
}) {
  const visibleUnread = controller.notifications.filter((notification) => !notification.read).length
  const unread = controller.unreadCount ?? visibleUnread

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", !mobile && "max-h-[min(70vh,36rem)]")}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-base font-black text-foreground">Notifications</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {unread === 0 ? "No unread notifications" : `${unread} unread`}
          </p>
        </div>
        <div className={cn("flex items-center gap-1", mobile && "pr-8")}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void controller.markAllRead()}
            disabled={unread === 0 || controller.markingAll || Boolean(controller.markingNotificationId) || controller.listStatus !== "ready"}
            className="h-8 px-2 text-xs font-bold text-primary"
          >
            {controller.markingAll ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Mark all as read
          </Button>
          {!mobile && onClose ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close notifications">
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {controller.countError && controller.listStatus === "ready" ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
          <span>Unread count could not be refreshed.</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={controller.retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {controller.actionError ? (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive" role="alert">
          {controller.actionError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {controller.listStatus === "loading" || controller.listStatus === "idle" ? (
          <NotificationListSkeleton />
        ) : controller.listStatus === "error" ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center" role="alert">
            <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-foreground">Notifications are temporarily unavailable</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {controller.listError || "Please try again."}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={controller.retry}>
              Retry
            </Button>
          </div>
        ) : controller.notifications.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Bell className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-black text-foreground">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">New notifications will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {controller.notifications.map((notification) => (
              <NotificationRow
                key={notification.notificationId}
                notification={notification}
                controller={controller}
              />
            ))}
            {controller.hasNextPage ? (
              <div className="p-3 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void controller.loadMore()}
                  disabled={controller.loadingMore}
                  className="min-w-28"
                >
                  {controller.loadingMore ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                  Load more
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export function OwnerNotificationCenter({
  variant,
  controller,
}: {
  variant: "desktop" | "mobile"
  controller: OwnerNotificationsController
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const open = controller.openSurface === variant
  const trigger = renderNotificationBell(variant, controller)

  if (variant === "mobile") {
    return (
      <Sheet open={open} onOpenChange={(nextOpen) => controller.setSurfaceOpen("mobile", nextOpen)}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="right"
          className="!translate-x-0 !animate-none h-[100dvh] w-full max-w-full gap-0 overflow-hidden p-0 sm:max-w-sm"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>Recent Owner Dashboard notifications</SheetDescription>
          </SheetHeader>
          <NotificationPanel controller={controller} mobile />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => controller.setSurfaceOpen("desktop", nextOpen)}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        ref={panelRef}
        side="right"
        align="end"
        sideOffset={10}
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0"
        aria-label="Notifications"
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          panelRef.current?.focus()
        }}
      >
        <NotificationPanel
          controller={controller}
          onClose={() => controller.setSurfaceOpen("desktop", false)}
        />
      </PopoverContent>
    </Popover>
  )
}
