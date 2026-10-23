"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertCircle,
  BedDouble,
  Calendar,
  CalendarOff,
  Check,
  ChevronDown,
  DoorOpen,
  Edit2,
  Info,
  LayoutGrid,
  Loader2,
  MapPin,
  MonitorOff,
  MonitorPlay,
  MoreHorizontal,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ErrorState } from "@/components/shared/ErrorState"
import { PageHeader } from "@/components/shared/PageHeader"
import { HotelServicePointModal } from "@/components/service-points/HotelServicePointModal"
import { HotelRoomWizard } from "@/components/service-points/HotelRoomWizard"
import { HotelRoomTypeWizard } from "@/components/service-points/HotelRoomTypeWizard"
import { RoomSupplyTemplateDialog } from "@/components/service-points/RoomSupplyTemplateDialog"
import {
  HotelRoomDetailsDialog,
  HotelRoomsView,
  HotelRoomTypesView,
} from "@/components/service-points/HotelServicePointViews"
import { RestaurantServicePointModal } from "@/components/service-points/RestaurantServicePointModal"
import { QrCodeModal } from "@/components/owner/QrCodeModal"
import { RoomUsageDialog } from "@/components/owner/inventory/RoomUsageDialog"
import { useServicePointTerm } from "@/contexts/BusinessContext"
import { useSetupProgress } from "@/contexts/SetupProgressContext"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEventSource } from "@/hooks/use-event-source"
import { apiClient } from "@/lib/axios-config"
import { getCanonicalFrontendOrigin } from "@/lib/frontend-origin"
import { pluralize } from "@/lib/localization"
import { buildServicePointQrUrl } from "@/lib/qr-capability"
import {
  hasManagementPermission,
  MANAGER_PERMISSIONS,
} from "@/lib/manager-permissions"
import type { ServicePointType } from "@/types/business-capabilities"
import type { HotelRoomType } from "@/types/hotel-room-type"
import type {
  ServicePoint,
  ServicePointFormPayload,
} from "@/types/service-point"
import { toast } from "sonner"

type StatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "reservations_on"
  | "reservations_off"

type HotelServicePointView = "list" | "rooms" | "others" | "room_types"

const NON_ROOM_SERVICE_POINT_TYPES = ["table", "booth", "other"] as const

function isHotelOtherServicePoint(servicePoint: ServicePoint) {
  return servicePoint.servicePointType === "table" ||
    servicePoint.servicePointType === "booth" ||
    servicePoint.servicePointType === "other"
}

type SessionOverview = {
  activeSessionsNow: number
  activeTablesNow: number
  activeServicePointsNow?: number
  activeGuestDevicesNow?: number
  nextActivityExpiryAt?: string | null
  tables: {
    servicePointLabel: string
    label?: string
    servicePointType?: ServicePointType | null
    activeDevices: number
  }[]
}

type QrCapabilityResponse = {
  capability: string
  version: number
}

type ServicePointsChangedPayload = {
  scope?: "activity" | "configuration"
}

const SERVICE_POINTS_REFRESH_DEBOUNCE_MS = 350

type MetricCardProps = {
  label: string
  detail: string
  value: number | null
  loading: boolean
  icon: ComponentType<{ className?: string }>
  tone: "primary" | "success" | "info" | "violet"
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Service Points" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "reservations_on", label: "Reservations On" },
  { value: "reservations_off", label: "Reservations Off" },
]

const TYPE_LABELS: Record<ServicePointType, string> = {
  table: "Table",
  room: "Room",
  booth: "Booth",
  other: "Other",
}

const METRIC_TONES = {
  primary: "bg-primary/10 text-primary",
  success:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const

function MetricCard({
  label,
  detail,
  value,
  loading,
  icon: Icon,
  tone,
}: MetricCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${METRIC_TONES[tone]}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="mb-1.5 h-7 w-12" />
          ) : (
            <p className="text-2xl font-black leading-none text-foreground">
              {value ?? "—"}
            </p>
          )}
          <h2 className="mt-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
            {label}
          </h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
    </section>
  )
}

function ActiveStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground"}`}
        aria-hidden="true"
      />
      {active ? "Active" : "Inactive"}
    </span>
  )
}

function ReservationStatusBadge({ reservable }: { reservable: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        reservable
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {reservable ? (
        <Calendar className="size-3" aria-hidden="true" />
      ) : (
        <CalendarOff className="size-3" aria-hidden="true" />
      )}
      {reservable ? "On" : "Off"}
    </span>
  )
}

function ServicePointActions({
  servicePoint,
  canManage,
  busy,
  onShowQr,
  onEdit,
  onToggleActive,
  onToggleReservable,
  onDelete,
  mobile = false,
}: {
  servicePoint: ServicePoint
  canManage: boolean
  busy: boolean
  onShowQr: (servicePoint: ServicePoint) => void
  onEdit: (servicePoint: ServicePoint) => void
  onToggleActive: (servicePoint: ServicePoint) => void
  onToggleReservable: (servicePoint: ServicePoint) => void
  onDelete: (servicePoint: ServicePoint) => void
  mobile?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={`flex items-center gap-1.5 ${mobile ? "w-full" : "justify-end"}`}>
      {canManage ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={mobile ? "flex-1" : "h-8 px-2.5 text-xs"}
            onClick={() => onShowQr(servicePoint)}
            aria-label={`View QR code for ${servicePoint.label}`}
          >
            <QrCode aria-hidden="true" />
            View QR
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={mobile ? "flex-1" : "h-8 px-2.5 text-xs"}
            onClick={() => onEdit(servicePoint)}
            aria-label={`Edit ${servicePoint.label}`}
          >
            <Edit2 aria-hidden="true" />
            Edit
          </Button>

          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={busy}
                aria-label={`More actions for ${servicePoint.label}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {busy ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <MoreHorizontal aria-hidden="true" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-56 p-1.5"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setMenuOpen(false)
                  onToggleReservable(servicePoint)
                }}
              >
                {servicePoint.reservable !== false ? (
                  <CalendarOff className="size-4" aria-hidden="true" />
                ) : (
                  <Calendar className="size-4" aria-hidden="true" />
                )}
                Turn reservations {servicePoint.reservable !== false ? "off" : "on"}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setMenuOpen(false)
                  onToggleActive(servicePoint)
                }}
              >
                {servicePoint.isActive ? (
                  <MonitorOff className="size-4" aria-hidden="true" />
                ) : (
                  <MonitorPlay className="size-4" aria-hidden="true" />
                )}
                {servicePoint.isActive ? "Deactivate" : "Activate"}
              </button>
              <div className="my-1 border-t border-border" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(servicePoint)
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete service point
              </button>
            </PopoverContent>
          </Popover>
        </>
      ) : null}
    </div>
  )
}

function ServicePointListSkeleton() {
  return (
    <div aria-label="Loading service points" role="status">
      <div className="hidden lg:block">
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-14 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-3 p-4 lg:hidden">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} className="h-44 w-full rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading service points</span>
    </div>
  )
}

export default function ServicePointManagementPage() {
  const searchParams = useSearchParams()
  const { user } = useAuthGuard()
  const { refreshSetupProgress } = useSetupProgress()
  const term = useServicePointTerm()
  const businessId = user?.businessId
  const canManageServicePoints = hasManagementPermission(
    user,
    MANAGER_PERMISSIONS.SERVICE_POINTS_MANAGE,
  )
  const isHotelDashboard = user?.capabilities
    ? user.capabilities.identity.shell === "hotel"
    : user?.businessType === "hotel"

  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([])
  const [hotelRoomTypes, setHotelRoomTypes] = useState<HotelRoomType[]>([])
  const [hotelRoomTypeSuggestions, setHotelRoomTypeSuggestions] = useState<string[]>([])
  const [roomTypesLoading, setRoomTypesLoading] = useState(false)
  const [roomTypesError, setRoomTypesError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [sessionOverview, setSessionOverview] =
    useState<SessionOverview | null>(null)
  const [isLiveLoading, setIsLiveLoading] = useState(true)
  const [liveError, setLiveError] = useState<string | null>(null)
  const realtimeRefreshTimerRef = useRef<number | null>(null)
  const pendingConfigurationRefreshRef = useRef(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [typeFilter, setTypeFilter] = useState<"all" | ServicePointType>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [hotelView, setHotelView] = useState<HotelServicePointView>(() => {
    const requestedView = searchParams.get("view")
    return requestedView === "list" || requestedView === "rooms" || requestedView === "others" || requestedView === "room_types"
      ? requestedView
      : "rooms"
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [restaurantModalType, setRestaurantModalType] = useState<"table" | "booth" | "other">("table")
  const [kindDialogOpen, setKindDialogOpen] = useState(false)
  const [kindDialogTypes, setKindDialogTypes] = useState<ServicePointType[] | null>(null)
  const [roomWizardOpen, setRoomWizardOpen] = useState(false)
  const [roomTypeWizardOpen, setRoomTypeWizardOpen] = useState(false)
  const [editingRoomType, setEditingRoomType] = useState<HotelRoomType | null>(null)
  const [supplyTemplateRoomType, setSupplyTemplateRoomType] = useState<HotelRoomType | null>(null)
  const [servicingRoom, setServicingRoom] = useState<ServicePoint | null>(null)
  const [preselectedRoomType, setPreselectedRoomType] = useState<string | undefined>()
  const [detailsRoom, setDetailsRoom] = useState<ServicePoint | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editingServicePoint, setEditingServicePoint] =
    useState<ServicePoint | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [activeQrServicePoint, setActiveQrServicePoint] =
    useState<ServicePoint | null>(null)
  const [qrCapability, setQrCapability] = useState("")
  const [qrCapabilityLoading, setQrCapabilityLoading] = useState(false)
  const [qrCapabilityError, setQrCapabilityError] = useState<string | null>(null)
  const [qrCapabilityRegenerating, setQrCapabilityRegenerating] = useState(false)
  const qrCapabilityRequestRef = useRef(0)
  const qrCapabilityRotationInFlightRef = useRef(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingServicePoint, setDeletingServicePoint] =
    useState<ServicePoint | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [busyServicePointId, setBusyServicePointId] = useState<string | null>(
    null,
  )

  const loadServicePoints = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      if (!businessId) return
      if (showLoading) setIsLoading(true)
      setPageError(null)
      try {
        const response = await apiClient.get<ServicePoint[]>(
          "/owner/service-points",
        )
        setServicePoints(Array.isArray(response.data) ? response.data : [])
      } catch (error) {
        console.error("Fetch service points error:", error)
        setPageError(
          "Service points could not be loaded. Check your connection and try again.",
        )
      } finally {
        if (showLoading) setIsLoading(false)
      }
    },
    [businessId],
  )

  const loadSessionOverview = useCallback(async (
    { showLoading = true }: { showLoading?: boolean } = {},
  ) => {
    if (!businessId) return
    if (showLoading) setIsLiveLoading(true)
    setLiveError(null)
    try {
      const response = await apiClient.get<SessionOverview>(
        "/owner/table-sessions/overview",
      )
      setSessionOverview(response.data)
    } catch (error) {
      console.error("Failed to fetch session overview", error)
      setLiveError("Live activity could not be refreshed.")
    } finally {
      if (showLoading) setIsLiveLoading(false)
    }
  }, [businessId])

  const loadHotelRoomTypes = useCallback(async () => {
    if (!businessId || !isHotelDashboard) return
    setRoomTypesLoading(true)
    setRoomTypesError(null)
    try {
      const response = await apiClient.get<{ hotelRoomTypes?: HotelRoomType[]; hotelRoomTypeSuggestions?: string[] }>(
        "/business/settings",
      )
      setHotelRoomTypes(
        Array.isArray(response.data.hotelRoomTypes)
          ? response.data.hotelRoomTypes.filter((roomType) => roomType.isDefault !== true)
          : [],
      )
      setHotelRoomTypeSuggestions(
        Array.isArray(response.data.hotelRoomTypeSuggestions)
          ? response.data.hotelRoomTypeSuggestions
          : [],
      )
    } catch (error) {
      console.error("Failed to fetch hotel Room Types", error)
      setRoomTypesError("Room Types could not be loaded.")
    } finally {
      setRoomTypesLoading(false)
    }
  }, [businessId, isHotelDashboard])

  useEffect(() => {
    if (!businessId) return
    void loadServicePoints()
    void loadSessionOverview()
    if (isHotelDashboard) void loadHotelRoomTypes()
  }, [businessId, isHotelDashboard, loadHotelRoomTypes, loadServicePoints, loadSessionOverview])

  const scheduleAuthoritativeRefresh = useCallback((
    scope: "activity" | "configuration" = "activity",
  ) => {
    if (!businessId || !isHotelDashboard) return
    if (scope === "configuration") {
      pendingConfigurationRefreshRef.current = true
    }
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current)
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null
      const refreshConfiguration = pendingConfigurationRefreshRef.current
      pendingConfigurationRefreshRef.current = false
      const requests: Promise<void>[] = [
        loadSessionOverview({ showLoading: false }),
      ]
      if (refreshConfiguration) {
        requests.push(loadServicePoints({ showLoading: false }))
      }
      void Promise.all(requests)
    }, SERVICE_POINTS_REFRESH_DEBOUNCE_MS)
  }, [businessId, isHotelDashboard, loadServicePoints, loadSessionOverview])

  const servicePointsSseUrl = businessId && isHotelDashboard
    ? `/events?role=owner&businessId=${businessId}&permission=${MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW}`
    : ""
  const servicePointsSseHandlers = useMemo(() => ({
    service_points_changed: (payload: ServicePointsChangedPayload) => {
      scheduleAuthoritativeRefresh(
        payload?.scope === "configuration" ? "configuration" : "activity",
      )
    },
  }), [scheduleAuthoritativeRefresh])

  useEventSource(servicePointsSseUrl, servicePointsSseHandlers, {
    onReconnect: () => scheduleAuthoritativeRefresh("configuration"),
  })

  useEffect(() => {
    if (!businessId || !isHotelDashboard) return

    const recoverAuthoritativeState = () => {
      scheduleAuthoritativeRefresh("configuration")
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") recoverAuthoritativeState()
    }

    window.addEventListener("focus", recoverAuthoritativeState)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      window.removeEventListener("focus", recoverAuthoritativeState)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [businessId, isHotelDashboard, scheduleAuthoritativeRefresh])

  useEffect(() => {
    if (!businessId || !isHotelDashboard || !sessionOverview?.nextActivityExpiryAt) return
    const expiresAt = new Date(sessionOverview.nextActivityExpiryAt).getTime()
    if (!Number.isFinite(expiresAt)) return
    const delay = Math.max(0, expiresAt - Date.now() + 250)
    const timeoutId = window.setTimeout(
      () => scheduleAuthoritativeRefresh("activity"),
      Math.min(delay, 2_147_000_000),
    )
    return () => window.clearTimeout(timeoutId)
  }, [businessId, isHotelDashboard, scheduleAuthoritativeRefresh, sessionOverview?.nextActivityExpiryAt])

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (modalOpen) return
    const timeoutId = window.setTimeout(
      () => setEditingServicePoint(null),
      200,
    )
    return () => window.clearTimeout(timeoutId)
  }, [modalOpen])

  useEffect(() => {
    if (!canManageServicePoints) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("create") === "1") {
      if (isHotelDashboard) setKindDialogOpen(true)
      else setModalOpen(true)
    }
  }, [canManageServicePoints, isHotelDashboard])

  const totalPoints = servicePoints.length
  const activePoints = servicePoints.filter(
    (servicePoint) => servicePoint.isActive,
  ).length
  const reservationsOn = servicePoints.filter(
    (servicePoint) => servicePoint.reservable !== false,
  ).length
  const activeServicePointsNow = sessionOverview?.activeServicePointsNow ??
    sessionOverview?.activeTablesNow ??
    sessionOverview?.tables.length ?? 0
  const liveGuestDevicesNow = sessionOverview?.activeGuestDevicesNow ??
    sessionOverview?.activeSessionsNow ?? null
  const visibleLiveConnections = sessionOverview?.tables || []
  const allowedServicePointTypes = useMemo<ServicePointType[]>(
    () => user?.capabilities?.servicePoints.allowedTypes || [
      isHotelDashboard ? "room" : "table",
    ],
    [isHotelDashboard, user?.capabilities?.servicePoints.allowedTypes],
  )
  const allowedNonRoomServicePointTypes = useMemo(
    () => allowedServicePointTypes.filter((type) =>
      NON_ROOM_SERVICE_POINT_TYPES.includes(type as (typeof NON_ROOM_SERVICE_POINT_TYPES)[number]),
    ),
    [allowedServicePointTypes],
  )
  const servicePointsForCurrentList = useMemo(
    () => isHotelDashboard && hotelView === "others"
      ? servicePoints.filter(isHotelOtherServicePoint)
      : servicePoints,
    [hotelView, isHotelDashboard, servicePoints],
  )
  const canManageRoomTypes = canManageServicePoints && user?.role !== "manager"
  const canManageSupplyTemplates = canManageRoomTypes && hasManagementPermission(
    user,
    MANAGER_PERMISSIONS.INVENTORY_MANAGE,
  )
  const canServiceRooms = isHotelDashboard && hasManagementPermission(
    user,
    MANAGER_PERMISSIONS.INVENTORY_MANAGE,
  )

  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set(
          servicePointsForCurrentList
            .map((servicePoint) => servicePoint.servicePointType)
            .filter((type): type is ServicePointType => Boolean(type)),
        ),
      ).sort((left, right) =>
        TYPE_LABELS[left].localeCompare(TYPE_LABELS[right]),
      ),
    [servicePointsForCurrentList],
  )

  const filteredServicePoints = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return servicePointsForCurrentList.filter((servicePoint) => {
      const matchesSearch =
        !normalizedQuery ||
        servicePoint.label.toLowerCase().includes(normalizedQuery) ||
        servicePoint.code?.toLowerCase().includes(normalizedQuery)
      const matchesType =
        typeFilter === "all" || servicePoint.servicePointType === typeFilter

      let matchesStatus = true
      if (statusFilter === "active") matchesStatus = servicePoint.isActive
      if (statusFilter === "inactive") matchesStatus = !servicePoint.isActive
      if (statusFilter === "reservations_on") {
        matchesStatus = servicePoint.reservable !== false
      }
      if (statusFilter === "reservations_off") {
        matchesStatus = servicePoint.reservable === false
      }

      return matchesSearch && matchesType && matchesStatus
    })
  }, [searchQuery, servicePointsForCurrentList, statusFilter, typeFilter])

  useEffect(() => {
    if (
      hotelView === "others" &&
      typeFilter !== "all" &&
      !NON_ROOM_SERVICE_POINT_TYPES.includes(typeFilter as (typeof NON_ROOM_SERVICE_POINT_TYPES)[number])
    ) {
      setTypeFilter("all")
    }
  }, [hotelView, typeFilter])

  const filtersAreDefault =
    statusFilter === "all" && typeFilter === "all" && !searchQuery.trim()

  const clearFilters = () => {
    setStatusFilter("all")
    setTypeFilter("all")
    setSearchQuery("")
  }

  const openAddServicePoint = () => {
    setEditingServicePoint(null)
    if (isHotelDashboard) {
      setKindDialogTypes(null)
      setKindDialogOpen(true)
      return
    }
    setRestaurantModalType("table")
    setModalOpen(true)
  }

  const openAddRoom = (roomTypeName?: string) => {
    setPreselectedRoomType(roomTypeName)
    setKindDialogTypes(null)
    setKindDialogOpen(false)
    setRoomWizardOpen(true)
  }

  const openCreateRoomType = () => {
    setKindDialogTypes(null)
    setKindDialogOpen(false)
    setEditingRoomType(null)
    setRoomTypeWizardOpen(true)
  }

  const openAddOtherServicePoint = () => {
    if (!allowedNonRoomServicePointTypes.length) return

    setEditingServicePoint(null)
    if (allowedNonRoomServicePointTypes.length === 1) {
      setRestaurantModalType(allowedNonRoomServicePointTypes[0] as "table" | "booth" | "other")
      setModalOpen(true)
      return
    }

    setKindDialogTypes(allowedNonRoomServicePointTypes)
    setKindDialogOpen(true)
  }

  const primaryActionLabel = !isHotelDashboard || hotelView === "list"
    ? "Add Service Point"
    : hotelView === "rooms"
      ? "Add Room"
      : hotelView === "others"
        ? "Add Other Service Point"
        : "Create Room Type"
  const canCreateForCurrentView = canManageServicePoints &&
    (!isHotelDashboard || hotelView !== "others" || allowedNonRoomServicePointTypes.length > 0)

  const handlePrimaryAction = () => {
    if (!isHotelDashboard || hotelView === "list") {
      openAddServicePoint()
      return
    }
    if (hotelView === "rooms") {
      openAddRoom()
      return
    }
    if (hotelView === "others") {
      openAddOtherServicePoint()
      return
    }
    openCreateRoomType()
  }

  const rememberRoomType = (roomType: HotelRoomType) => {
    setHotelRoomTypes((current) => [
      ...current.filter((item) => item.name !== roomType.name),
      roomType,
    ].sort((left, right) => left.sortOrder - right.sortOrder))
  }

  const handleRoomCreated = async (room: ServicePoint) => {
    setServicePoints((current) => [room, ...current.filter((item) => item.servicePointId !== room.servicePointId)])
    await refreshSetupProgress()
    toast.success(`${room.label} created successfully`)
  }

  const showRoomDetails = (room: ServicePoint) => {
    setDetailsRoom(room)
    setDetailsOpen(true)
  }

  const handleEdit = (servicePoint: ServicePoint) => {
    setEditingServicePoint(servicePoint)
    setModalOpen(true)
  }

  const handleSaveServicePoint = async (
    payload: ServicePointFormPayload,
  ) => {
    const response = editingServicePoint
      ? await apiClient.patch<ServicePoint>(
        `/owner/service-points/${editingServicePoint.servicePointId}`,
        payload,
      )
      : await apiClient.post<ServicePoint>("/owner/service-points", payload)
    setServicePoints((current) => editingServicePoint
      ? current.map((item) => item.servicePointId === response.data.servicePointId
          ? response.data
          : item)
      : [response.data, ...current])
    await refreshSetupProgress()
  }

  const handleToggleActive = async (servicePoint: ServicePoint) => {
    setBusyServicePointId(servicePoint.servicePointId)
    try {
      const response = await apiClient.patch<{ isActive: boolean }>(
        `/owner/service-points/${servicePoint.servicePointId}/toggle`,
      )
      setServicePoints((current) =>
        current.map((item) =>
          item.servicePointId === servicePoint.servicePointId
            ? { ...item, isActive: response.data.isActive }
            : item,
        ),
      )
      toast.success(
        `${servicePoint.label} marked as ${response.data.isActive ? "active" : "inactive"}`,
      )
    } catch (error) {
      console.error("Toggle error:", error)
      toast.error("Failed to change service point status")
    } finally {
      setBusyServicePointId(null)
    }
  }

  const handleToggleReservable = async (servicePoint: ServicePoint) => {
    setBusyServicePointId(servicePoint.servicePointId)
    try {
      const response = await apiClient.patch<{ reservable: boolean }>(
        `/owner/service-points/${servicePoint.servicePointId}/toggle-reservable`,
      )
      setServicePoints((current) =>
        current.map((item) =>
          item.servicePointId === servicePoint.servicePointId
            ? { ...item, reservable: response.data.reservable }
            : item,
        ),
      )
      toast.success(
        `Reservations turned ${response.data.reservable ? "on" : "off"} for ${servicePoint.label}`,
      )
    } catch (error) {
      console.error("Toggle reservable error:", error)
      toast.error("Failed to change reservation availability")
    } finally {
      setBusyServicePointId(null)
    }
  }

  const handleShowQr = async (servicePoint: ServicePoint) => {
    const requestId = ++qrCapabilityRequestRef.current
    setActiveQrServicePoint(servicePoint)
    setQrDialogOpen(true)
    setQrCapability("")
    setQrCapabilityError(null)
    setQrCapabilityLoading(true)
    try {
      const response = await apiClient.get<QrCapabilityResponse>(
        `/owner/service-points/${servicePoint.servicePointId}/qr-capability`,
      )
      if (requestId === qrCapabilityRequestRef.current) {
        setQrCapability(response.data.capability)
      }
    } catch (error: any) {
      console.error("QR capability load failed", {
        status: error?.response?.status || null,
      })
      if (requestId === qrCapabilityRequestRef.current) {
        setQrCapabilityError(
          error?.response?.data?.error || "Secure QR code could not be generated.",
        )
      }
    } finally {
      if (requestId === qrCapabilityRequestRef.current) {
        setQrCapabilityLoading(false)
      }
    }
  }

  const handleRegenerateQr = async () => {
    if (!activeQrServicePoint || qrCapabilityRotationInFlightRef.current) return
    const confirmed = window.confirm(
      "Regenerate this QR code? Previously printed or downloaded codes will stop creating new visits.",
    )
    if (!confirmed) return

    const requestId = ++qrCapabilityRequestRef.current
    const servicePointId = activeQrServicePoint.servicePointId
    qrCapabilityRotationInFlightRef.current = true
    setQrCapabilityRegenerating(true)
    setQrCapabilityError(null)
    try {
      const response = await apiClient.post<QrCapabilityResponse>(
        `/owner/service-points/${servicePointId}/qr-capability/rotate`,
      )
      if (requestId === qrCapabilityRequestRef.current) {
        setQrCapability(response.data.capability)
        toast.success("QR code regenerated. Replace all previously printed copies.")
      }
    } catch (error: any) {
      console.error("QR capability rotation failed", {
        status: error?.response?.status || null,
      })
      const message =
        error?.response?.data?.error || "QR code could not be regenerated."
      if (requestId === qrCapabilityRequestRef.current) {
        setQrCapabilityError(message)
        toast.error(message)
      }
    } finally {
      qrCapabilityRotationInFlightRef.current = false
      if (requestId === qrCapabilityRequestRef.current) {
        setQrCapabilityRegenerating(false)
      }
    }
  }

  const handleDelete = (servicePoint: ServicePoint) => {
    setDeletingServicePoint(servicePoint)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingServicePoint) return
    setIsDeleting(true)
    try {
      await apiClient.delete(
        `/owner/service-points/${deletingServicePoint.servicePointId}`,
      )
      setServicePoints((current) =>
        current.filter(
          (servicePoint) =>
            servicePoint.servicePointId !==
            deletingServicePoint.servicePointId,
        ),
      )
      toast.success(`${deletingServicePoint.label} deleted successfully`)
      setDeleteDialogOpen(false)
    } catch (error: any) {
      console.error("Delete error:", error)
      toast.error(
        error.response?.data?.error || "Failed to delete service point",
      )
    } finally {
      setIsDeleting(false)
      setDeletingServicePoint(null)
    }
  }

  const renderActions = (servicePoint: ServicePoint, mobile = false) => (
    <ServicePointActions
      servicePoint={servicePoint}
      canManage={canManageServicePoints}
      busy={busyServicePointId === servicePoint.servicePointId}
      onShowQr={handleShowQr}
      onEdit={handleEdit}
      onToggleActive={(item) => void handleToggleActive(item)}
      onToggleReservable={(item) => void handleToggleReservable(item)}
      onDelete={handleDelete}
      mobile={mobile}
    />
  )

  const origin = getCanonicalFrontendOrigin()
  const qrUrl =
    activeQrServicePoint && businessId && qrCapability
      ? buildServicePointQrUrl(
          origin,
          businessId,
          activeQrServicePoint.servicePointId,
          qrCapability,
        )
      : ""

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <PageHeader
          className="flex flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6"
          title="Service Points"
          description="Manage the places where guests interact with your business."
          action={
            canCreateForCurrentView &&
            (!isHotelDashboard || hotelView !== "room_types" || canManageRoomTypes) ? (
              <Button
                className="gap-2 shadow-lg shadow-primary/15"
                onClick={handlePrimaryAction}
              >
                <Plus aria-hidden="true" />
                {primaryActionLabel}
                {isHotelDashboard && hotelView === "list" ? <ChevronDown aria-hidden="true" /> : null}
              </Button>
            ) : null
          }
        />
      </header>

      <div className="space-y-5 px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Total Service Points"
            detail="All configured places"
            value={pageError ? null : totalPoints}
            loading={isLoading}
            icon={LayoutGrid}
            tone="primary"
          />
          <MetricCard
            label="Active"
            detail="Available for service"
            value={pageError ? null : activePoints}
            loading={isLoading}
            icon={Check}
            tone="success"
          />
          <MetricCard
            label="Reservations On"
            detail="Included in availability"
            value={pageError ? null : reservationsOn}
            loading={isLoading}
            icon={Calendar}
            tone="info"
          />
          <MetricCard
            label="Live Guest Devices"
            detail="Across ServicePoint connections"
            value={liveError && !sessionOverview ? null : liveGuestDevicesNow}
            loading={isLiveLoading && !sessionOverview}
            icon={Users}
            tone="violet"
          />
        </div>

        {pageError ? (
          <ErrorState
            className="min-h-80 rounded-xl border border-border bg-card px-6 py-12 shadow-sm"
            icon={
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
              </div>
            }
            title="Service points could not be loaded"
            description={pageError}
            action={
              <Button className="mt-5" onClick={() => void loadServicePoints()}>
                <RefreshCw aria-hidden="true" />
                Retry
              </Button>
            }
          />
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
            <section
              className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              aria-labelledby="service-points-list-title"
            >
              <h2 id="service-points-list-title" className="sr-only">
                Service point management
              </h2>

              {isHotelDashboard ? (
                <div className="flex gap-1 overflow-x-auto border-b border-border p-2" role="tablist" aria-label="Hotel Service Point views">
                  {([
                    { value: "list", label: "List", icon: LayoutGrid },
                    { value: "rooms", label: "Rooms", icon: DoorOpen },
                    { value: "others", label: "Others", icon: LayoutGrid },
                    { value: "room_types", label: "Room Types", icon: BedDouble },
                  ] as const).map((view) => {
                    const Icon = view.icon
                    return (
                      <Button key={view.value} type="button" role="tab" aria-selected={hotelView === view.value} variant={hotelView === view.value ? "default" : "ghost"} size="sm" className="shrink-0" onClick={() => setHotelView(view.value)}>
                        <Icon aria-hidden="true" />{view.label}
                      </Button>
                    )
                  })}
                </div>
              ) : null}

              {isHotelDashboard && hotelView === "rooms" ? (
                <HotelRoomsView
                  servicePoints={servicePoints}
                  roomTypes={hotelRoomTypes}
                  isLoading={isLoading}
                  canManage={canManageServicePoints}
                  canServiceRooms={canServiceRooms}
                  busyServicePointId={busyServicePointId}
                  onAddRoom={() => openAddRoom()}
                  onView={showRoomDetails}
                  onServiceRoom={setServicingRoom}
                  onEdit={handleEdit}
                  onQr={handleShowQr}
                  onToggleActive={(room) => void handleToggleActive(room)}
                  onToggleReservable={(room) => void handleToggleReservable(room)}
                  onDelete={handleDelete}
                />
              ) : isHotelDashboard && hotelView === "room_types" ? (
                roomTypesLoading ? (
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-72 rounded-2xl" />)}
                  </div>
                ) : roomTypesError ? (
                  <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                    <AlertCircle className="size-8 text-destructive" />
                    <h3 className="mt-4 font-bold">Room Types could not be loaded</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{roomTypesError}</p>
                    <Button className="mt-5" variant="outline" onClick={() => void loadHotelRoomTypes()}><RefreshCw />Retry</Button>
                  </div>
                ) : (
                  <HotelRoomTypesView
                    roomTypes={hotelRoomTypes}
                    rooms={servicePoints.filter((point) => point.servicePointType === "room")}
                    canManage={canManageServicePoints && user?.role !== "manager"}
                    canManageSupplyTemplates={canManageSupplyTemplates}
                    onCreate={openCreateRoomType}
                    onEdit={(roomType) => {
                      setEditingRoomType(roomType)
                      setRoomTypeWizardOpen(true)
                    }}
                    onAddRoom={(roomType) => openAddRoom(roomType.name)}
                    onEditSupplyTemplate={setSupplyTemplateRoomType}
                  />
                )
              ) : (
                <>

              <div
                className="flex flex-wrap gap-2 border-b border-border p-3"
                role="tablist"
                aria-label="Filter service points by status"
              >
                {STATUS_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    role="tab"
                    size="sm"
                    variant={
                      statusFilter === filter.value ? "default" : "ghost"
                    }
                    aria-selected={statusFilter === filter.value}
                    aria-controls="service-point-results"
                    className="h-8 px-3 text-xs"
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search name or code..."
                    aria-label="Search service points by name or code"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={typeFilter}
                  onValueChange={(value: "all" | ServicePointType) =>
                    setTypeFilter(value)
                  }
                >
                  <SelectTrigger aria-label="Filter service points by type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {availableTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {isHotelDashboard && hotelView !== "others" && type !== "room"
                          ? "Others"
                          : TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={filtersAreDefault}
                  onClick={clearFilters}
                  className="justify-self-start sm:justify-self-end"
                >
                  <X aria-hidden="true" />
                  Clear
                </Button>
              </div>

              <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
                Showing {filteredServicePoints.length} of {servicePointsForCurrentList.length} {pluralize(servicePointsForCurrentList.length, "service point", "service points")}
              </p>

              <div id="service-point-results" aria-busy={isLoading}>
                {isLoading ? (
                  <ServicePointListSkeleton />
                ) : filteredServicePoints.length === 0 ? (
                  <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <MapPin className="size-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-bold">
                      {filtersAreDefault
                        ? isHotelDashboard && hotelView === "others"
                          ? "No other service points yet"
                          : "No service points yet"
                        : "No service points match these filters"}
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {filtersAreDefault
                        ? isHotelDashboard && hotelView === "others"
                          ? "Other guest areas, such as tables, lounges, and poolside spaces, appear here."
                          : "Add the first place where guests can interact with your business."
                        : "Try another search or clear the current filters."}
                    </p>
                    {filtersAreDefault && canCreateForCurrentView ? (
                      <Button
                        className="mt-5"
                        onClick={handlePrimaryAction}
                      >
                        <Plus aria-hidden="true" />
                        {primaryActionLabel}
                      </Button>
                    ) : !filtersAreDefault ? (
                      <Button className="mt-5" variant="outline" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="hidden lg:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="pl-5">Name</TableHead>
                            <TableHead>Code</TableHead>
                            {isHotelDashboard && hotelView === "others" ? <TableHead>Type</TableHead> : null}
                            <TableHead>Capacity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reservations</TableHead>
                            <TableHead className="pr-4 text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredServicePoints.map((servicePoint) => (
                            <TableRow key={servicePoint.servicePointId}>
                              <TableCell className="pl-5">
                                <div className="flex min-w-24 items-center gap-2">
                                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <MapPin className="size-4" aria-hidden="true" />
                                  </div>
                                  <span className="font-bold text-foreground">
                                    {servicePoint.label}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {servicePoint.code || "Not set"}
                              </TableCell>
                              {isHotelDashboard && hotelView === "others" ? (
                                <TableCell className="text-sm font-medium text-muted-foreground">
                                  {servicePoint.servicePointType ? TYPE_LABELS[servicePoint.servicePointType] : "Not set"}
                                </TableCell>
                              ) : null}
                              <TableCell className="text-sm font-medium text-muted-foreground">
                                {servicePoint.capacity ??
                                  servicePoint.maxGuests ??
                                  "Not set"}
                              </TableCell>
                              <TableCell>
                                <ActiveStatusBadge active={servicePoint.isActive} />
                              </TableCell>
                              <TableCell>
                                <ReservationStatusBadge
                                  reservable={servicePoint.reservable !== false}
                                />
                              </TableCell>
                              <TableCell className="pr-4">
                                {renderActions(servicePoint)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="divide-y divide-border lg:hidden">
                      {filteredServicePoints.map((servicePoint) => (
                        <article
                          key={servicePoint.servicePointId}
                          className="space-y-4 p-4"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <MapPin className="size-4" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate font-bold text-foreground">
                                  {servicePoint.label}
                                </h3>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                  {servicePoint.code || "Code not set"}
                                </p>
                              </div>
                            </div>
                            <ActiveStatusBadge active={servicePoint.isActive} />
                          </div>

                          <dl className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3 text-sm">
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">Type</dt>
                              <dd className="mt-1 truncate font-bold">
                                {servicePoint.servicePointType
                                  ? TYPE_LABELS[servicePoint.servicePointType]
                                  : "Not set"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">
                                Capacity
                              </dt>
                              <dd className="mt-1 truncate font-bold">
                                {servicePoint.capacity ??
                                  servicePoint.maxGuests ??
                                  "Not set"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">
                                Reservations
                              </dt>
                              <dd className="mt-1">
                                <ReservationStatusBadge
                                  reservable={servicePoint.reservable !== false}
                                />
                              </dd>
                            </div>
                          </dl>

                          {servicePoint.servicePointType === "room" &&
                          servicePoint.roomType?.trim() ? (
                            <p className="text-xs text-muted-foreground">
                              Room type: <span className="font-semibold text-foreground">{servicePoint.roomType}</span>
                            </p>
                          ) : null}

                          <div className="border-t border-border pt-3">
                            {renderActions(servicePoint, true)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
                </>
              )}
            </section>

            <aside
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              aria-labelledby="active-service-points-title"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 id="active-service-points-title" className="font-bold">
                    Active Service Points Now
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Current guest connections
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isLiveLoading}
                  onClick={() => void loadSessionOverview()}
                  aria-label="Refresh live activity"
                >
                  <RefreshCw
                    className={isLiveLoading ? "animate-spin" : ""}
                    aria-hidden="true"
                  />
                </Button>
              </div>

              <div className="p-4" aria-live="polite">
                {isLiveLoading && !sessionOverview ? (
                  <div role="status" aria-label="Loading live activity">
                    <Skeleton className="mx-auto h-14 w-20" />
                    <Skeleton className="mx-auto mt-3 h-4 w-40" />
                    <Skeleton className="mt-6 h-28 w-full rounded-xl" />
                    <span className="sr-only">Loading live activity</span>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-4xl font-black text-foreground">
                        {sessionOverview ? activeServicePointsNow : "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        of {totalPoints} {pluralize(totalPoints, "service point", "service points")}
                      </p>
                    </div>

                    {liveError ? (
                      <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                        <div className="flex items-start gap-2 text-destructive">
                          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          <p>{liveError}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => void loadSessionOverview()}
                        >
                          Try again
                        </Button>
                      </div>
                    ) : null}

                    {!liveError &&
                    (!sessionOverview || visibleLiveConnections.length === 0) ? (
                      <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                        <Users className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
                        <p className="mt-2 text-sm font-semibold">
                          No active connections right now.
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Live activity appears here when a guest device connects.
                        </p>
                      </div>
                    ) : null}

                    {sessionOverview && visibleLiveConnections.length > 0 ? (
                      <ul className="mt-5 space-y-2" aria-label="Active guest devices by service point">
                        {visibleLiveConnections.map((item) => {
                          const label = item.label || item.servicePointLabel
                          return (
                            <li
                              key={item.servicePointLabel}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold">{label}</p>
                                {label !== item.servicePointLabel ? (
                                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                                  </p>
                                ) : null}
                              </div>
                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                {item.activeDevices} {pluralize(item.activeDevices, "device", "devices")}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>

              <div className="border-t border-border bg-sky-500/5 p-4">
                <div className="flex gap-2 text-sky-700 dark:text-sky-300">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold">What is this?</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      Shows which service points currently have active guest connections and how many guest devices are attached. This is not occupancy or a reservation count.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      <QrCodeModal
        open={qrDialogOpen}
        onOpenChange={(open) => {
            setQrDialogOpen(open)
            if (!open) {
              qrCapabilityRequestRef.current += 1
              setQrCapability("")
              setQrCapabilityError(null)
              setQrCapabilityLoading(false)
              setQrCapabilityRegenerating(false)
            }
        }}
        value={qrUrl}
        title={activeQrServicePoint?.label ?? ""}
        description={`Scan this code to start an order${
          activeQrServicePoint?.capacity
            ? ` (Capacity ${activeQrServicePoint.capacity})`
            : ""
          }.`}
          downloadFileName={`qr-${activeQrServicePoint?.servicePointId ?? "service-point"}`}
          copyValueLabel="Copy QR link"
          loading={qrCapabilityLoading}
        error={qrCapabilityError}
        regenerating={qrCapabilityRegenerating}
        onRegenerate={() => void handleRegenerateQr()}
        posterUrl={
          activeQrServicePoint
            ? `/owner/service-points/${activeQrServicePoint.servicePointId}/print`
            : undefined
        }
      />

      <HotelRoomDetailsDialog
        room={detailsRoom}
        roomTypes={hotelRoomTypes}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) setDetailsRoom(null)
        }}
      />

      {isHotelDashboard && canServiceRooms ? (
        <RoomUsageDialog
          open={Boolean(servicingRoom)}
          onOpenChange={(open) => {
            if (!open) setServicingRoom(null)
          }}
          onCompleted={() => setServicingRoom(null)}
          initialServicePointId={servicingRoom?.servicePointId}
          initialRoomLabel={servicingRoom?.label}
          workflow="service_room"
        />
      ) : null}

      {isHotelDashboard && canManageServicePoints ? (
        <>
          <Dialog open={kindDialogOpen} onOpenChange={(open) => {
            setKindDialogOpen(open)
            if (!open) setKindDialogTypes(null)
          }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>What kind of service point are you adding?</DialogTitle>
                <DialogDescription>
                  Choose from the ServicePoint types enabled for this business.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-3 sm:grid-cols-2">
                {(kindDialogTypes || allowedServicePointTypes).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      if (type === "room") {
                        openAddRoom()
                        return
                      }
                      setKindDialogOpen(false)
                      setEditingServicePoint(null)
                      setRestaurantModalType(type === "table" || type === "booth" || type === "other" ? type : "table")
                      setModalOpen(true)
                    }}
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {type === "room" ? <DoorOpen aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
                    </span>
                    <span>
                      <span className="block font-black">{type === "room" ? TYPE_LABELS[type] : "Other"}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {type === "room"
                          ? "Add an individual reservable hotel room."
                          : "Add another guest location, such as a table, poolside area, bar area, or cabana."}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <HotelRoomWizard
            open={roomWizardOpen}
            onOpenChange={setRoomWizardOpen}
            roomTypes={hotelRoomTypes}
            initialRoomTypeName={preselectedRoomType}
            onRoomTypeCreated={rememberRoomType}
            onCreated={(room) => void handleRoomCreated(room)}
            onViewRoomTypes={() => setHotelView("room_types")}
          />

          {canManageRoomTypes ? (
            <HotelRoomTypeWizard
              open={roomTypeWizardOpen}
              onOpenChange={(open) => {
                setRoomTypeWizardOpen(open)
                if (!open) setEditingRoomType(null)
              }}
              roomType={editingRoomType}
              nameSuggestions={hotelRoomTypeSuggestions.length
                ? hotelRoomTypeSuggestions.filter((suggestion) =>
                    !hotelRoomTypes.some((roomType) =>
                      roomType.name.trim().toLowerCase() === suggestion.trim().toLowerCase(),
                    ),
                  )
                : undefined}
              onCreated={rememberRoomType}
              onAddRoomNow={(roomType) => {
                setRoomTypeWizardOpen(false)
                openAddRoom(roomType.name)
              }}
              onViewRoomTypes={() => {
                setRoomTypeWizardOpen(false)
                setHotelView("room_types")
              }}
            />
          ) : null}

          {canManageSupplyTemplates ? (
            <RoomSupplyTemplateDialog
              open={Boolean(supplyTemplateRoomType)}
              roomType={supplyTemplateRoomType}
              onOpenChange={(open) => {
                if (!open) setSupplyTemplateRoomType(null)
              }}
              onSaved={(roomType) => {
                rememberRoomType(roomType)
                setSupplyTemplateRoomType(null)
              }}
            />
          ) : null}
        </>
      ) : null}

      {canManageServicePoints ? (
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!isDeleting) {
              setDeleteDialogOpen(open)
              if (!open) setDeletingServicePoint(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Service Point</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong>{deletingServicePoint?.label}</strong>? This action cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManageServicePoints ? (
        editingServicePoint?.servicePointType === "room" ? (
          <HotelServicePointModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            isEditing={Boolean(editingServicePoint)}
            initialData={editingServicePoint}
            onSave={handleSaveServicePoint}
            term={term}
            canManageRoomTypes={canManageRoomTypes}
          />
        ) : (
          <RestaurantServicePointModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            isEditing={Boolean(editingServicePoint)}
            initialData={editingServicePoint}
            onSave={handleSaveServicePoint}
            term={term}
            servicePointType={editingServicePoint?.servicePointType === "booth" || editingServicePoint?.servicePointType === "other" || editingServicePoint?.servicePointType === "table" ? editingServicePoint.servicePointType : restaurantModalType}
          />
        )
      ) : null}
    </div>
  )
}
