"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import type { LucideIcon } from "lucide-react"
import {
  BadgeCheck,
  BedDouble,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundX,
  Users,
  Utensils,
  Wine,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ErrorState } from "@/components/shared/ErrorState"
import { PageHeader } from "@/components/shared/PageHeader"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSetupProgress } from "@/contexts/SetupProgressContext"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEventSource } from "@/hooks/use-event-source"
import { apiClient } from "@/lib/axios-config"
import {
  hasManagementPermission,
  MANAGER_PERMISSION_GROUPS,
  MANAGER_PERMISSIONS,
  toggleManagerPermission,
  type ManagerPermission,
} from "@/lib/manager-permissions"
import { cn } from "@/lib/utils"

type StaffRole = "waiter" | "kitchen" | "manager" | "bartender" | "housekeeping"
type ActivityFilter = "all" | "active" | "offline"
type RoleFilter = "all" | StaffRole
type SortOrder = "name-asc" | "name-desc" | "newest" | "oldest"
type DialogStep = "select-role" | "form"

const RECONCILIATION_PERMISSION = "orders.reconcile"
const RECONCILIATION_VIEW_PERMISSION = "orders.reconciliation.view"

interface StaffMember {
  _id?: string
  staffId?: string
  name: string
  email: string
  role?: StaffRole
  createdAt: string
  accountStatus: "pending" | "active" | "disabled"
  presenceStatus: "active" | "offline"
  status: "active" | "offline"
  expiresAt?: number
  lastSeenAt?: string | null
  permissions?: string[]
}

interface StaffPresenceEvent {
  staffId?: string
  presenceStatus?: "active" | "offline"
  expiresAt?: number | null
  lastSeenAt?: string | null
}

interface StaffTypeDefinition {
  role: StaffRole
  label: string
  icon: LucideIcon
  description: string
}

const PRESENCE_FALLBACK_MS = 90_000

const STAFF_TYPES: StaffTypeDefinition[] = [
  {
    role: "waiter",
    label: "Waitstaff",
    icon: Utensils,
    description: "Handles guests and takes orders",
  },
  {
    role: "kitchen",
    label: "Kitchen Staff",
    icon: ChefHat,
    description: "Prepares and manages kitchen operations",
  },
  {
    role: "manager",
    label: "Manager",
    icon: BriefcaseBusiness,
    description: "Oversees operations and staff",
  },
  {
    role: "bartender",
    label: "Bartender",
    icon: Wine,
    description: "Handles drink orders and bar operations",
  },
  {
    role: "housekeeping",
    label: "Housekeeping",
    icon: BedDouble,
    description: "Turns over rooms and records supplies used",
  },
]

const ROLE_LABELS: Record<StaffRole, string> = {
  waiter: "Waitstaff",
  kitchen: "Kitchen Staff",
  manager: "Manager",
  bartender: "Bartender",
  housekeeping: "Housekeeping",
}

const ACCOUNT_LABELS: Record<StaffMember["accountStatus"], string> = {
  active: "Active",
  pending: "Pending",
  disabled: "Disabled",
}

function getMemberKey(member: StaffMember) {
  return member.staffId || member._id || member.email
}

function getMemberRole(member: StaffMember): StaffRole {
  return member.role || "waiter"
}

function canReceiveReconciliationAccess(member: StaffMember) {
  const role = getMemberRole(member)
  return role === "manager" || role === "waiter"
}

function hasReconciliationAccess(member: StaffMember) {
  return Array.isArray(member.permissions) && member.permissions.includes(RECONCILIATION_PERMISSION)
}

function hasReconciliationViewPermission(member: StaffMember) {
  return Array.isArray(member.permissions) && member.permissions.includes(RECONCILIATION_VIEW_PERMISSION)
}

function hasPastOrdersAccess(member: StaffMember) {
  return hasReconciliationAccess(member) || hasReconciliationViewPermission(member)
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return initials || "ST"
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not recorded"

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

function formatLastSeen(value: string | null | undefined, includeYear = false) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const response = (error as {
    response?: { data?: { error?: string; message?: string } }
  })?.response

  return response?.data?.error || response?.data?.message || fallback
}

function generateStaffId(role: StaffRole) {
  const prefix = role === "waiter"
    ? "WTR"
    : role === "kitchen"
      ? "KIT"
      : role === "bartender"
        ? "BAR"
        : role === "housekeeping"
          ? "HSK"
          : "MGR"

  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
}

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#DED9FF] bg-[#F4F1FF] px-2.5 py-1 text-[11px] font-bold text-[#5744C7]">
      {ROLE_LABELS[role]}
    </span>
  )
}

function ActivityStatus({
  member,
  compact = false,
  includeYear = false,
}: {
  member: StaffMember
  compact?: boolean
  includeYear?: boolean
}) {
  const active = member.presenceStatus === "active"
  const lastSeen = !active ? formatLastSeen(member.lastSeenAt, includeYear) : null

  return (
    <div className={cn("min-w-0", compact ? "space-y-0.5" : "space-y-1")}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            active ? "bg-emerald-500" : "bg-slate-400",
          )}
        />
        {active ? "Active now" : "Offline"}
      </div>
      {lastSeen && (
        <p className="truncate pl-4 text-[11px] text-muted-foreground" title={`Last seen: ${lastSeen}`}>
          Last seen: {lastSeen}
        </p>
      )}
    </div>
  )
}

function AccountBadge({ status }: { status: StaffMember["accountStatus"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        status === "active" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
        status === "disabled" && "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active" && "bg-emerald-500",
          status === "pending" && "bg-amber-500",
          status === "disabled" && "bg-red-500",
        )}
      />
      {ACCOUNT_LABELS[status]}
    </span>
  )
}

function StaffAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF1FF] text-xs font-black text-[#00225B]",
        className,
      )}
    >
      {getInitials(name)}
    </span>
  )
}

function ManagerPermissionsEditor({
  value,
  onChange,
  reconciliationAllowed,
  reconciliationViewAllowed,
  onReconciliationChange,
  onReconciliationViewChange,
  canEditReconciliation,
}: {
  value: string[]
  onChange: (permissions: string[]) => void
  reconciliationAllowed: boolean
  reconciliationViewAllowed: boolean
  onReconciliationChange: (allowed: boolean) => void
  onReconciliationViewChange: (allowed: boolean) => void
  canEditReconciliation: boolean
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-foreground">Manager Permissions</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose which Management Portal areas this Manager can use.
        </p>
      </div>
      {MANAGER_PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.label} className="space-y-2.5">
          <legend className="text-[11px] font-black uppercase tracking-[0.12em] text-[#00225B]">
            {group.label}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.permissions.map((permission) => (
              <label
                key={permission.key}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold transition-colors hover:border-[#FE6006]/40 hover:bg-[#FFF7F2] focus-within:ring-2 focus-within:ring-[#FE6006]/30"
              >
                <input
                  type="checkbox"
                  checked={value.includes(permission.key)}
                  onChange={() => onChange(toggleManagerPermission(value, permission.key as ManagerPermission))}
                  className="h-4 w-4 shrink-0 rounded border-border accent-[#FE6006]"
                />
                <span>{permission.label}</span>
              </label>
            ))}
            {group.label === "Orders" && canEditReconciliation && (
              <>
                <label className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold transition-colors",
                  reconciliationAllowed ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:border-[#FE6006]/40 hover:bg-[#FFF7F2] focus-within:ring-2 focus-within:ring-[#FE6006]/30",
                )}>
                  <input
                    type="checkbox"
                    checked={reconciliationViewAllowed || reconciliationAllowed}
                    disabled={reconciliationAllowed}
                    onChange={(event) => onReconciliationViewChange(event.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-border accent-[#FE6006]"
                  />
                  <span>
                    <span className="block">View Reconciliation</span>
                    <span className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">
                      {reconciliationAllowed
                        ? "Included with Reconcile Past Orders."
                        : "View, search, and inspect Past Orders without making changes."}
                    </span>
                  </span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold transition-colors hover:border-[#FE6006]/40 hover:bg-[#FFF7F2] focus-within:ring-2 focus-within:ring-[#FE6006]/30">
                  <input
                    type="checkbox"
                    checked={reconciliationAllowed}
                    onChange={(event) => onReconciliationChange(event.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-border accent-[#FE6006]"
                  />
                  <span>
                    <span className="block">Reconcile Past Orders</span>
                    <span className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">
                      Review past orders and correct missed cash or POS-card records.
                    </span>
                  </span>
                </label>
              </>
            )}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function WaitstaffPermissionsEditor({
  reconciliationAllowed,
  reconciliationViewAllowed,
  onReconciliationChange,
  onReconciliationViewChange,
}: {
  reconciliationAllowed: boolean
  reconciliationViewAllowed: boolean
  onReconciliationChange: (allowed: boolean) => void
  onReconciliationViewChange: (allowed: boolean) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-foreground">Waitstaff Permissions</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose the additional access this Waitstaff member needs.
        </p>
      </div>
      <fieldset className="space-y-2.5">
        <legend className="text-[11px] font-black uppercase tracking-[0.12em] text-[#00225B]">
          Orders
        </legend>
        <label className={cn(
          "flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold transition-colors",
          reconciliationAllowed ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:border-[#FE6006]/40 hover:bg-[#FFF7F2] focus-within:ring-2 focus-within:ring-[#FE6006]/30",
        )}>
          <input
            type="checkbox"
            checked={reconciliationViewAllowed || reconciliationAllowed}
            disabled={reconciliationAllowed}
            onChange={(event) => onReconciliationViewChange(event.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-border accent-[#FE6006]"
          />
          <span>
            <span className="block">View Reconciliation</span>
            <span className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">
              {reconciliationAllowed
                ? "Included with Reconcile Past Orders."
                : "View, search, and inspect Past Orders without making changes."}
            </span>
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold transition-colors hover:border-[#FE6006]/40 hover:bg-[#FFF7F2] focus-within:ring-2 focus-within:ring-[#FE6006]/30">
          <input
            type="checkbox"
            checked={reconciliationAllowed}
            onChange={(event) => onReconciliationChange(event.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-border accent-[#FE6006]"
          />
          <span>
            <span className="block">Reconcile Past Orders</span>
            <span className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">
              Review past orders and correct missed cash or POS-card records.
            </span>
          </span>
        </label>
      </fieldset>
    </div>
  )
}

function StaffActionsMenu({
  member,
  canManageStaff,
  canEditPermissions,
  onCopy,
  onEditPermissions,
  onRemove,
}: {
  member: StaffMember
  canManageStaff: boolean
  canEditPermissions: boolean
  onCopy: () => void
  onEditPermissions: () => void
  onRemove: () => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-muted-foreground"
          aria-label={`Actions for ${member.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-xl border border-border bg-popover p-1.5 text-sm text-popover-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 font-medium outline-none focus:bg-accent"
            onSelect={onCopy}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy Staff ID
          </DropdownMenu.Item>
          {canEditPermissions && (
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 font-medium outline-none focus:bg-accent"
              onSelect={onEditPermissions}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Edit Permissions
            </DropdownMenu.Item>
          )}
          {canManageStaff && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 font-medium text-destructive outline-none focus:bg-destructive/10"
                onSelect={onRemove}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove Staff
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function StaffDetailsSheet({
  member,
  open,
  copied,
  canManageStaff,
  canEditPermissions,
  onOpenChange,
  onCopy,
  onEditPermissions,
  onRemove,
}: {
  member: StaffMember | null
  open: boolean
  copied: boolean
  canManageStaff: boolean
  canEditPermissions: boolean
  onOpenChange: (open: boolean) => void
  onCopy: () => void
  onEditPermissions: () => void
  onRemove: () => void
}) {
  if (!member) return null

  const role = getMemberRole(member)
  const roleDefinition = STAFF_TYPES.find((type) => type.role === role)
  const reconciliationAllowed = hasReconciliationAccess(member)
  const pastOrdersAllowed = hasPastOrdersAccess(member)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-[420px]"
        aria-describedby="staff-details-description"
      >
        <SheetHeader className="shrink-0 border-b border-border bg-card px-5 py-5 pr-12 text-left">
          <SheetTitle className="text-base font-bold text-[#00225B]">Staff Details</SheetTitle>
          <SheetDescription id="staff-details-description">
            Review this staff member&apos;s access and account information.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto bg-[#FCFBFA]">
          <div className="border-b border-border bg-card px-5 py-6">
            <div className="flex items-start gap-3.5">
              <StaffAvatar name={member.name} className="h-12 w-12 text-sm" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black text-[#00225B]">{member.name}</h2>
                <div className="mt-1.5">
                  <RoleBadge role={role} />
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-border bg-secondary/20 px-4 py-3">
              <ActivityStatus member={member} includeYear />
            </div>
          </div>

          <div className="space-y-6 px-5 py-6">
            <section aria-labelledby="staff-contact-title">
              <h3 id="staff-contact-title" className="mb-3 text-sm font-bold text-[#00225B]">
                Contact
              </h3>
              <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                  <p className="mt-1 break-all text-sm font-semibold text-foreground">{member.email}</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="staff-role-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id="staff-role-title" className="text-sm font-bold text-[#00225B]">
                  Role &amp; Permissions
                </h3>
                {canEditPermissions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={onEditPermissions}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit Permissions
                  </Button>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <RoleBadge role={role} />
                {roleDefinition?.description && (
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">
                    {roleDefinition.description}
                  </p>
                )}
              </div>
            </section>

            {canReceiveReconciliationAccess(member) && (
              <section aria-labelledby="staff-reconciliation-title">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 id="staff-reconciliation-title" className="text-sm font-bold text-[#00225B]">
                      Past Order Access
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Lets this person review and safely correct past orders.
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold",
                    pastOrdersAllowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600",
                  )}>
                    {reconciliationAllowed ? "Can reconcile" : pastOrdersAllowed ? "View only" : "Not allowed"}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm leading-5 text-muted-foreground">
                    {reconciliationAllowed
                      ? "Can review past orders and correct missed cash or POS-card records. This does not give access to refunds, online payments, or general order management."
                      : "Can view, search, and inspect past orders, but cannot make changes."}
                  </p>
                </div>
              </section>
            )}

            <section aria-labelledby="staff-account-title">
              <h3 id="staff-account-title" className="mb-3 text-sm font-bold text-[#00225B]">
                Account
              </h3>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Status
                  </div>
                  <AccountBadge status={member.accountStatus} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Joined
                  </span>
                  <span className="text-right text-muted-foreground">{formatDate(member.createdAt)}</span>
                </div>
              </div>
            </section>

            <section aria-labelledby="staff-id-title">
              <h3 id="staff-id-title" className="mb-3 text-sm font-bold text-[#00225B]">
                Staff ID
              </h3>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <code className="min-w-0 truncate text-sm font-bold tracking-wide text-foreground">
                  {member.staffId || "Not recorded"}
                </code>
                {member.staffId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={onCopy}
                    aria-label={`Copy Staff ID ${member.staffId}`}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
            </section>

            {(canEditPermissions || canManageStaff) && (
              <section aria-labelledby="staff-actions-title">
                <h3 id="staff-actions-title" className="mb-3 text-sm font-bold text-[#00225B]">
                  Actions
                </h3>
                <div className="space-y-2">
                  {canEditPermissions && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-between rounded-xl"
                      onClick={onEditPermissions}
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Edit Permissions
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  )}
                  {canManageStaff && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-between rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={onRemove}
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove Staff
                      </span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StaffLoadingState() {
  return (
    <>
      <div className="hidden lg:block" aria-label="Loading staff members">
        <div className="space-y-1">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="grid grid-cols-[2fr_1fr_1.35fr_.8fr_.8fr_44px] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-3.5 w-20" /><Skeleton className="h-3 w-28" /></div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-3 lg:hidden" aria-label="Loading staff members">
        {[0, 1, 2].map((row) => (
          <div key={row} className="rounded-xl border border-border p-4">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-44" /></div>
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3"><Skeleton className="h-12 rounded-lg" /><Skeleton className="h-12 rounded-lg" /></div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function StaffManagementPage() {
  const { user } = useAuthGuard()
  const { refreshSetupProgress } = useSetupProgress()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("name-asc")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogStep, setDialogStep] = useState<DialogStep>("select-role")
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null)
  const [newStaffId, setNewStaffId] = useState("")
  const [newStaffName, setNewStaffName] = useState("")
  const [newStaffEmail, setNewStaffEmail] = useState("")
  const [newManagerPermissions, setNewManagerPermissions] = useState<string[]>([])
  const [formError, setFormError] = useState("")
  const [isCreatingStaff, setIsCreatingStaff] = useState(false)

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [editingManager, setEditingManager] = useState<StaffMember | null>(null)
  const [editingManagerPermissions, setEditingManagerPermissions] = useState<string[]>([])
  const [editingManagerReconciliationAllowed, setEditingManagerReconciliationAllowed] = useState(false)
  const [editingManagerReconciliationViewAllowed, setEditingManagerReconciliationViewAllowed] = useState(false)
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)
  const [editingWaiter, setEditingWaiter] = useState<StaffMember | null>(null)
  const [editingWaiterReconciliationAllowed, setEditingWaiterReconciliationAllowed] = useState(false)
  const [editingWaiterReconciliationViewAllowed, setEditingWaiterReconciliationViewAllowed] = useState(false)
  const [isSavingWaiterPermissions, setIsSavingWaiterPermissions] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<StaffMember | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyAnnouncement, setCopyAnnouncement] = useState("")

  const canManageStaff = hasManagementPermission(user, MANAGER_PERMISSIONS.STAFF_MANAGE)
  const canAdministerManagers = ["owner", "co_owner", "restaurant_owner", "admin"].includes(user?.role || "")
  const canAdministerReconciliation = canManageStaff
    && ["owner", "co_owner", "restaurant_owner"].includes(user?.role || "")
  const hasLodging = Boolean(user?.capabilities?.visibleModules.includes("lodging"))
  const availableStaffTypes = useMemo(() => STAFF_TYPES.filter(({ role }) => (
    (canAdministerManagers || role !== "manager") &&
    (hasLodging || role !== "housekeeping")
  )), [canAdministerManagers, hasLodging])

  const fetchStaff = useCallback(async ({
    showLoading = false,
    notifyOnError = true,
  }: { showLoading?: boolean; notifyOnError?: boolean } = {}) => {
    if (!user?.businessId) return

    if (showLoading) setIsLoading(true)
    setLoadError(null)

    try {
      const response = await apiClient.get("/owner/staff", {
        params: { businessId: user.businessId },
      })
      const now = Date.now()
      const nextStaff = Array.isArray(response.data)
        ? response.data.map((member: StaffMember) => ({
            ...member,
            expiresAt: member.presenceStatus === "active"
              ? now + PRESENCE_FALLBACK_MS
              : undefined,
          }))
        : []

      setStaff(nextStaff)
    } catch (error) {
      console.error("Fetch staff error:", error)
      setLoadError("We couldn’t load your staff members. Please try again.")
      if (notifyOnError) toast.error("Could not load staff members")
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [user?.businessId])

  useEffect(() => {
    if (user?.businessId) void fetchStaff({ showLoading: true })
  }, [fetchStaff, user?.businessId])

  useEffect(() => {
    if (!dialogOpen) {
      setDialogStep("select-role")
      setSelectedRole(null)
      setNewStaffId("")
      setNewStaffName("")
      setNewStaffEmail("")
      setNewManagerPermissions([])
      setFormError("")
    }
  }, [dialogOpen])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("create") === "1" && canManageStaff) setDialogOpen(true)
  }, [canManageStaff])

  useEffect(() => {
    if (selectedRole) setNewStaffId(generateStaffId(selectedRole))
  }, [selectedRole])

  const handleRoleSelect = (role: StaffRole) => {
    setSelectedRole(role)
    setDialogStep("form")
  }

  const handleAddStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRole) return
    if (!newStaffName.trim()) { setFormError("Name is required"); return }
    if (!newStaffEmail.trim()) { setFormError("Email is required"); return }
    if (!newStaffId.trim()) { setFormError("Staff ID is required"); return }
    if (!user?.businessId) return

    try {
      setIsCreatingStaff(true)
      const response = await apiClient.post("/owner/staff", {
        staffId: newStaffId,
        name: newStaffName,
        email: newStaffEmail,
        role: selectedRole,
        permissions: selectedRole === "manager" ? newManagerPermissions : [],
        status: "offline",
      }, {
        params: { businessId: user.businessId },
      })

      setStaff((current) => [response.data as StaffMember, ...current])
      setDialogOpen(false)
      toast.success("Staff member created and invite sent successfully")
      refreshSetupProgress()
      void fetchStaff({ notifyOnError: false })
    } catch (error) {
      console.error("Create staff error:", error)
      toast.error(getApiErrorMessage(error, "Failed to add staff member"))
    } finally {
      setIsCreatingStaff(false)
    }
  }

  const handleEditManagerPermissions = (member: StaffMember) => {
    setEditingManager(member)
    setEditingManagerPermissions((member.permissions || []).filter((permission) => (
      permission !== RECONCILIATION_PERMISSION
      && permission !== RECONCILIATION_VIEW_PERMISSION
    )))
    setEditingManagerReconciliationAllowed(hasReconciliationAccess(member))
    setEditingManagerReconciliationViewAllowed(hasReconciliationViewPermission(member))
  }

  const handleEditWaiterPermissions = (member: StaffMember) => {
    if (!canReceiveReconciliationAccess(member)) return
    setEditingWaiter(member)
    setEditingWaiterReconciliationAllowed(hasReconciliationAccess(member))
    setEditingWaiterReconciliationViewAllowed(hasReconciliationViewPermission(member))
  }

  const handleSaveManagerPermissions = async () => {
    if (!editingManager?.staffId) return

    try {
      setIsSavingPermissions(true)
      const response = await apiClient.patch(`/owner/staff/${editingManager.staffId}/permissions`, {
        permissions: editingManagerPermissions,
      })
      let permissions = response.data.permissions || []

      if (
        canAdministerReconciliation
        && editingManagerReconciliationViewAllowed !== permissions.includes(RECONCILIATION_VIEW_PERMISSION)
      ) {
        const reconciliationViewResponse = await apiClient.patch(
          `/owner/staff/${editingManager.staffId}/reconciliation-view-permission`,
          { allowed: editingManagerReconciliationViewAllowed },
        )
        permissions = reconciliationViewResponse.data.permissions || []
      }

      if (
        canAdministerReconciliation
        && editingManagerReconciliationAllowed !== permissions.includes(RECONCILIATION_PERMISSION)
      ) {
        const reconciliationResponse = await apiClient.patch(
          `/owner/staff/${editingManager.staffId}/reconciliation-permission`,
          { allowed: editingManagerReconciliationAllowed },
        )
        permissions = reconciliationResponse.data.permissions || []
      }

      setStaff((current) => current.map((member) => (
        member.staffId === editingManager.staffId
          ? { ...member, permissions }
          : member
      )))
      setEditingManager(null)
      toast.success("Manager permissions updated")
    } catch (error) {
      void fetchStaff({ notifyOnError: false })
      toast.error(getApiErrorMessage(error, "Manager permissions may not have fully updated. Please review the current access."))
    } finally {
      setIsSavingPermissions(false)
    }
  }

  const handleSaveWaiterPermissions = async () => {
    if (!editingWaiter?.staffId || !canAdministerReconciliation) return

    try {
      setIsSavingWaiterPermissions(true)
      let permissions = editingWaiter.permissions || []

      if (editingWaiterReconciliationViewAllowed !== hasReconciliationViewPermission(editingWaiter)) {
        const reconciliationViewResponse = await apiClient.patch(
          `/owner/staff/${editingWaiter.staffId}/reconciliation-view-permission`,
          { allowed: editingWaiterReconciliationViewAllowed },
        )
        permissions = reconciliationViewResponse.data.permissions || []
      }

      if (editingWaiterReconciliationAllowed !== hasReconciliationAccess(editingWaiter)) {
        const reconciliationResponse = await apiClient.patch(
          `/owner/staff/${editingWaiter.staffId}/reconciliation-permission`,
          { allowed: editingWaiterReconciliationAllowed },
        )
        permissions = reconciliationResponse.data.permissions || []
      }

      setStaff((current) => current.map((member) => (
        member.staffId === editingWaiter.staffId
          ? { ...member, permissions }
          : member
      )))
      setEditingWaiter(null)
      toast.success("Waitstaff permissions updated")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update Waitstaff permissions"))
    } finally {
      setIsSavingWaiterPermissions(false)
    }
  }

  const handleRemoveStaff = async () => {
    if (!pendingRemoval?.staffId || !user?.businessId) return

    try {
      setIsRemoving(true)
      await apiClient.delete(`/owner/staff/${pendingRemoval.staffId}`, {
        params: { businessId: user.businessId },
      })
      const removedKey = getMemberKey(pendingRemoval)
      setStaff((current) => current.filter((member) => getMemberKey(member) !== removedKey))
      if (selectedStaffId === removedKey) setSelectedStaffId(null)
      setPendingRemoval(null)
      toast.success("Staff member removed")
      refreshSetupProgress()
    } catch (error) {
      console.error("Remove staff error:", error)
      toast.error(getApiErrorMessage(error, "Failed to remove staff member"))
    } finally {
      setIsRemoving(false)
    }
  }

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      setCopiedId(id)
      setCopyAnnouncement(`Staff ID ${id} copied`)
      window.setTimeout(() => setCopiedId((current) => current === id ? null : current), 2000)
    } catch {
      toast.error("Could not copy the Staff ID")
    }
  }

  const sseUrl = user?.businessId
    ? `/events?role=owner&businessId=${user.businessId}&permission=${MANAGER_PERMISSIONS.STAFF_VIEW}`
    : ""

  useEventSource(sseUrl, {
    staff_presence_changed: (data: StaffPresenceEvent) => {
      if (!data.staffId || !data.presenceStatus) return
      setStaff((current) => current.map((member) => (
        member._id === data.staffId
          ? {
              ...member,
              presenceStatus: data.presenceStatus as "active" | "offline",
              expiresAt: data.expiresAt || undefined,
              lastSeenAt: data.lastSeenAt !== undefined ? data.lastSeenAt : member.lastSeenAt,
            }
          : member
      )))
    },
  }, {
    onReconnect: () => void fetchStaff({ notifyOnError: false }),
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()
      setStaff((current) => {
        let changed = false
        const nextStaff = current.map((member) => {
          if (member.presenceStatus === "active" && member.expiresAt && now > member.expiresAt) {
            changed = true
            return {
              ...member,
              presenceStatus: "offline" as const,
              expiresAt: undefined,
              lastSeenAt: new Date(now).toISOString(),
            }
          }
          return member
        })

        return changed ? nextStaff : current
      })
    }, 10_000)

    return () => window.clearInterval(interval)
  }, [])

  const selectedStaff = useMemo(
    () => staff.find((member) => getMemberKey(member) === selectedStaffId) || null,
    [selectedStaffId, staff],
  )

  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    const matches = staff.filter((member) => {
      const matchesSearch = !query
        || member.name.toLocaleLowerCase().includes(query)
        || member.email.toLocaleLowerCase().includes(query)
      const matchesRole = roleFilter === "all" || getMemberRole(member) === roleFilter
      const matchesActivity = activityFilter === "all" || member.presenceStatus === activityFilter
      return matchesSearch && matchesRole && matchesActivity
    })

    return matches.sort((a, b) => {
      if (sortOrder === "name-asc") return a.name.localeCompare(b.name)
      if (sortOrder === "name-desc") return b.name.localeCompare(a.name)
      const aDate = new Date(a.createdAt).getTime()
      const bDate = new Date(b.createdAt).getTime()
      return sortOrder === "newest" ? bDate - aDate : aDate - bDate
    })
  }, [activityFilter, roleFilter, searchQuery, sortOrder, staff])

  const totalActive = staff.filter((member) => member.presenceStatus === "active").length
  const totalOffline = staff.filter((member) => member.presenceStatus === "offline").length
  const filtersAreActive = Boolean(searchQuery.trim())
    || roleFilter !== "all"
    || activityFilter !== "all"
    || sortOrder !== "name-asc"

  const clearFilters = () => {
    setSearchQuery("")
    setRoleFilter("all")
    setActivityFilter("all")
    setSortOrder("name-asc")
  }

  const openStaffDetails = (member: StaffMember) => setSelectedStaffId(getMemberKey(member))
  const requestRemoval = (member: StaffMember) => setPendingRemoval(member)
  const canEditSelectedPermissions = Boolean(
    selectedStaff && (
      (canAdministerManagers && getMemberRole(selectedStaff) === "manager")
      || (canAdministerReconciliation && getMemberRole(selectedStaff) === "waiter")
    ),
  )

  return (
    <div className="min-h-full bg-[#FCFBFA] pb-16">
      <span className="sr-only" aria-live="polite" aria-atomic="true">{copyAnnouncement}</span>

      <header className="border-b border-border bg-background/95 backdrop-blur-sm">
        <PageHeader
          className="flex items-start justify-between gap-4 px-4 py-5 sm:px-6 [&>div:first-of-type]:min-w-0"
          title="Staff Management"
          titleClassName="text-[#00225B]"
          description="Manage your team, roles and access"
          descriptionClassName="mt-1"
          action={
            canManageStaff ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0 gap-2 rounded-lg bg-[#FE6006] text-white shadow-sm hover:bg-[#E85605]">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Add Staff</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
                {dialogStep === "select-role" ? (
                  <>
                    <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
                      <DialogTitle className="text-xl font-black text-[#00225B]">Add New Staff Member</DialogTitle>
                      <DialogDescription>Select the staff member&apos;s operational role to continue.</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
                      <div className="grid gap-3">
                        {availableStaffTypes
                          .map(({ role, label, icon: RoleIcon, description }) => (
                            <button
                              type="button"
                              key={role}
                              onClick={() => handleRoleSelect(role)}
                              className="group flex min-h-20 items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:border-[#FE6006]/50 hover:bg-[#FFF7F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE6006]/40"
                            >
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0E7] text-[#FE6006]">
                                <RoleIcon className="h-5 w-5" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-black text-[#00225B]">{label}</span>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleAddStaff}>
                    <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
                      <button
                        type="button"
                        onClick={() => setDialogStep("select-role")}
                        className="mb-1 flex w-fit items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE6006]/40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Change role
                      </button>
                      <DialogTitle className="text-xl font-black text-[#00225B]">
                        Add {selectedRole ? ROLE_LABELS[selectedRole] : "Staff Member"}
                      </DialogTitle>
                      <DialogDescription>Fill in the staff member&apos;s details. Their role is pre-assigned.</DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
                      <div className="space-y-2">
                        <Label htmlFor="staffId">Staff ID</Label>
                        <div className="flex gap-2">
                          <Input
                            id="staffId"
                            value={newStaffId}
                            onChange={(event) => setNewStaffId(event.target.value)}
                            placeholder="WTR-1234"
                            required
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => selectedRole && setNewStaffId(generateStaffId(selectedRole))}
                            aria-label="Generate a new Staff ID"
                          >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      {selectedRole === "manager" && canAdministerManagers && (
                        <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                          <ManagerPermissionsEditor
                            value={newManagerPermissions}
                            onChange={setNewManagerPermissions}
                            reconciliationAllowed={false}
                            reconciliationViewAllowed={false}
                            onReconciliationChange={() => undefined}
                            onReconciliationViewChange={() => undefined}
                            canEditReconciliation={false}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="staff-name">Full Name *</Label>
                        <Input
                          id="staff-name"
                          autoComplete="name"
                          value={newStaffName}
                          onChange={(event) => { setNewStaffName(event.target.value); setFormError("") }}
                          placeholder="e.g. John Doe"
                          aria-invalid={Boolean(formError) && !newStaffName.trim()}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="staff-email">Email Address *</Label>
                        <Input
                          id="staff-email"
                          type="email"
                          autoComplete="email"
                          value={newStaffEmail}
                          onChange={(event) => { setNewStaffEmail(event.target.value); setFormError("") }}
                          placeholder="staff@restaurant.com"
                          aria-invalid={Boolean(formError) && !newStaffEmail.trim()}
                          required
                        />
                      </div>

                      {formError && (
                        <p role="alert" className="flex items-center gap-2 text-sm font-medium text-destructive">
                          <CircleAlert className="h-4 w-4" aria-hidden="true" />
                          {formError}
                        </p>
                      )}
                    </div>

                    <DialogFooter className="shrink-0 border-t border-border bg-card px-6 py-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreatingStaff}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-[#FE6006] text-white hover:bg-[#E85605]" disabled={isCreatingStaff}>
                        {isCreatingStaff && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        Add Staff Member
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
            ) : null
          }
        />
      </header>

      <main className="space-y-5 px-4 py-5 sm:px-6">
        <section aria-label="Staff summary" className="rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              { label: "Total Staff", value: staff.length, icon: Users, iconClass: "bg-[#FFF0E7] text-[#FE6006]" },
              { label: "Active now", value: totalActive, icon: UserCheck, iconClass: "bg-emerald-50 text-emerald-600" },
              { label: "Offline", value: totalOffline, icon: UserRoundX, iconClass: "bg-slate-100 text-slate-500" },
            ].map(({ label, value, icon: SummaryIcon, iconClass }) => (
              <div key={label} className="flex min-w-0 items-center gap-2.5 px-3 py-4 sm:gap-4 sm:px-5">
                <span className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex", iconClass)}>
                  <SummaryIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  {isLoading ? (
                    <Skeleton className="h-6 w-8" />
                  ) : (
                    <p className="text-xl font-black leading-none text-[#00225B] sm:text-2xl">{value}</p>
                  )}
                  <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Staff filters" className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Label htmlFor="staff-search" className="sr-only">Search staff by name or email</Label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="staff-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search staff by name or email..."
                className="h-10 pl-9"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:shrink-0">
              <div>
                <Label htmlFor="staff-role-filter" className="sr-only">Filter by role</Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)} disabled={isLoading}>
                  <SelectTrigger id="staff-role-filter" className="h-10 min-w-0 md:w-36" aria-label="Filter staff by role">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {availableStaffTypes
                      .map(({ role, label }) => <SelectItem key={role} value={role}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="staff-activity-filter" className="sr-only">Filter by activity</Label>
                <Select value={activityFilter} onValueChange={(value) => setActivityFilter(value as ActivityFilter)} disabled={isLoading}>
                  <SelectTrigger id="staff-activity-filter" className="h-10 min-w-0 md:w-36" aria-label="Filter staff by activity">
                    <SelectValue placeholder="Activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any activity</SelectItem>
                    <SelectItem value="active">Active now</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="staff-sort" className="sr-only">Sort staff</Label>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)} disabled={isLoading}>
                  <SelectTrigger id="staff-sort" className="h-10 min-w-0 md:w-40" aria-label="Sort staff members">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name: A–Z</SelectItem>
                    <SelectItem value="name-desc">Name: Z–A</SelectItem>
                    <SelectItem value="newest">Recently joined</SelectItem>
                    <SelectItem value="oldest">Oldest joined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtersAreActive && (
              <Button type="button" variant="ghost" size="sm" className="self-start text-[#FE6006] hover:bg-[#FFF0E7] hover:text-[#E85605] md:self-auto" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-labelledby="staff-directory-title" aria-busy={isLoading}>
          <h2 id="staff-directory-title" className="sr-only">Staff directory</h2>

          {isLoading ? (
            <StaffLoadingState />
          ) : loadError && staff.length === 0 ? (
            <ErrorState
              className="min-h-64 px-6 py-12"
              icon={
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <CircleAlert className="h-6 w-6" aria-hidden="true" />
                </span>
              }
              title={<span className="text-base text-[#00225B]">Staff couldn&apos;t be loaded</span>}
              description={loadError}
              descriptionClassName="max-w-sm"
              action={
                <Button type="button" variant="outline" className="mt-5" onClick={() => void fetchStaff({ showLoading: true })}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </Button>
              }
            />
          ) : staff.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0E7] text-[#FE6006]">
                <Users className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-[#00225B]">No staff members yet.</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Add your first staff member to give your team access to Chillow.</p>
              {canManageStaff && (
                <Button type="button" className="mt-5 bg-[#FE6006] text-white hover:bg-[#E85605]" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Staff
                </Button>
              )}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
              <h3 className="mt-4 text-base font-bold text-[#00225B]">No staff members match these filters.</h3>
              <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>Clear filters</Button>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                      <TableHead className="h-11 pl-4 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Staff member</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Role</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Status / Activity</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Account</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Joined</TableHead>
                      <TableHead className="w-14 pr-4 text-right text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((member) => {
                      const memberKey = getMemberKey(member)
                      const role = getMemberRole(member)
                      const canEditPermissions = (
                        (canAdministerManagers && role === "manager")
                        || (canAdministerReconciliation && role === "waiter")
                      )
                      return (
                        <TableRow
                          key={memberKey}
                          data-state={selectedStaffId === memberKey ? "selected" : undefined}
                          className="cursor-pointer hover:bg-[#FFF8F4] data-[state=selected]:bg-[#FFF3EB]"
                          onClick={() => openStaffDetails(member)}
                        >
                          <TableCell className="min-w-[230px] py-3 pl-4">
                            <button
                              type="button"
                              className="flex max-w-full items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE6006]/50 focus-visible:ring-offset-2"
                              onClick={() => openStaffDetails(member)}
                              aria-label={`View details for ${member.name}`}
                            >
                              <StaffAvatar name={member.name} />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-[#00225B]">{member.name}</span>
                                <span className="mt-0.5 block max-w-48 truncate text-xs text-muted-foreground" title={member.email}>{member.email}</span>
                              </span>
                            </button>
                          </TableCell>
                          <TableCell><RoleBadge role={role} /></TableCell>
                          <TableCell className="min-w-[175px]"><ActivityStatus member={member} compact /></TableCell>
                          <TableCell><AccountBadge status={member.accountStatus} /></TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">{formatDate(member.createdAt)}</TableCell>
                          <TableCell className="pr-4 text-right">
                            <StaffActionsMenu
                              member={member}
                              canManageStaff={canManageStaff}
                              canEditPermissions={canEditPermissions}
                              onCopy={() => member.staffId && void handleCopyId(member.staffId)}
                              onEditPermissions={() => {
                                if (role === "manager") handleEditManagerPermissions(member)
                                if (role === "waiter") handleEditWaiterPermissions(member)
                              }}
                              onRemove={() => requestRemoval(member)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-border lg:hidden">
                {filteredStaff.map((member) => {
                  const role = getMemberRole(member)
                  return (
                    <button
                      type="button"
                      key={getMemberKey(member)}
                      className="block w-full px-4 py-4 text-left transition-colors hover:bg-[#FFF8F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FE6006]/50"
                      onClick={() => openStaffDetails(member)}
                      aria-label={`View details for ${member.name}`}
                    >
                      <span className="flex items-start gap-3">
                        <StaffAvatar name={member.name} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-bold text-[#00225B]">{member.name}</span>
                            <RoleBadge role={role} />
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{member.email}</span>
                        </span>
                        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </span>
                      <span className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-secondary/25 p-3">
                        <span className="min-w-0">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Activity</span>
                          <ActivityStatus member={member} compact />
                        </span>
                        <span className="min-w-0 border-l border-border pl-3">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Account</span>
                          <AccountBadge status={member.accountStatus} />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                Showing {filteredStaff.length} of {staff.length} staff {staff.length === 1 ? "member" : "members"}
              </div>
            </>
          )}
        </section>
      </main>

      <StaffDetailsSheet
        member={selectedStaff}
        open={Boolean(selectedStaff)}
        copied={Boolean(selectedStaff?.staffId && copiedId === selectedStaff.staffId)}
        canManageStaff={canManageStaff}
        canEditPermissions={canEditSelectedPermissions}
        onOpenChange={(open) => { if (!open) setSelectedStaffId(null) }}
        onCopy={() => selectedStaff?.staffId && void handleCopyId(selectedStaff.staffId)}
        onEditPermissions={() => {
          if (!selectedStaff) return
          if (getMemberRole(selectedStaff) === "manager") handleEditManagerPermissions(selectedStaff)
          if (getMemberRole(selectedStaff) === "waiter") handleEditWaiterPermissions(selectedStaff)
        }}
        onRemove={() => selectedStaff && requestRemoval(selectedStaff)}
      />

      <Dialog open={Boolean(editingManager)} onOpenChange={(open) => { if (!open && !isSavingPermissions) setEditingManager(null) }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-5 pr-12">
            <DialogTitle className="text-xl font-black text-[#00225B]">Edit Manager Permissions</DialogTitle>
            <DialogDescription>
              Update Management Portal access for {editingManager?.name || "this Manager"}. Changes take effect the next time they use the Management Portal.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-5">
            <ManagerPermissionsEditor
              value={editingManagerPermissions}
              onChange={setEditingManagerPermissions}
              reconciliationAllowed={editingManagerReconciliationAllowed}
              reconciliationViewAllowed={editingManagerReconciliationViewAllowed}
              onReconciliationChange={setEditingManagerReconciliationAllowed}
              onReconciliationViewChange={setEditingManagerReconciliationViewAllowed}
              canEditReconciliation={canAdministerReconciliation}
            />
          </div>
          <DialogFooter className="border-t border-border bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setEditingManager(null)} disabled={isSavingPermissions}>Cancel</Button>
            <Button type="button" className="bg-[#FE6006] text-white hover:bg-[#E85605]" onClick={handleSaveManagerPermissions} disabled={isSavingPermissions}>
              {isSavingPermissions && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingWaiter)} onOpenChange={(open) => { if (!open && !isSavingWaiterPermissions) setEditingWaiter(null) }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border px-6 py-5 pr-12">
            <DialogTitle className="text-xl font-black text-[#00225B]">Edit Waitstaff Permissions</DialogTitle>
            <DialogDescription>
              Update access for {editingWaiter?.name || "this Waitstaff member"}. This access is limited to past-order reconciliation.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-5">
            <WaitstaffPermissionsEditor
              reconciliationAllowed={editingWaiterReconciliationAllowed}
              reconciliationViewAllowed={editingWaiterReconciliationViewAllowed}
              onReconciliationChange={setEditingWaiterReconciliationAllowed}
              onReconciliationViewChange={setEditingWaiterReconciliationViewAllowed}
            />
          </div>
          <DialogFooter className="border-t border-border bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setEditingWaiter(null)} disabled={isSavingWaiterPermissions}>Cancel</Button>
            <Button type="button" className="bg-[#FE6006] text-white hover:bg-[#E85605]" onClick={handleSaveWaiterPermissions} disabled={isSavingWaiterPermissions}>
              {isSavingWaiterPermissions && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => { if (!open && !isRemoving) setPendingRemoval(null) }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-[#00225B]">Remove Staff Member?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              Are you sure you want to remove <strong className="text-foreground">{pendingRemoval?.name}</strong>? They will lose access to the system immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isRemoving}
              onClick={(event) => { event.preventDefault(); void handleRemoveStaff() }}
            >
              {isRemoving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Remove Staff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
