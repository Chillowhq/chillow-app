"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  BedDouble,
  Calendar,
  CalendarOff,
  Check,
  DoorOpen,
  Edit2,
  Eye,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Plus,
  QrCode,
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
import type { HotelRoomType } from "@/types/hotel-room-type"
import type { ServicePoint } from "@/types/service-point"

type RoomStatusFilter = "all" | "active" | "inactive" | "reservations_on" | "reservations_off"

function roomTypeKey(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() || ""
}

export function getRoomTypeForRoom(room: ServicePoint, roomTypes: HotelRoomType[]) {
  const key = roomTypeKey(room.roomType)
  return roomTypes.find((roomType) => roomTypeKey(roomType.name) === key)
}

function roomImage(room: ServicePoint, roomType?: HotelRoomType) {
  return room.images?.[0] || roomType?.images?.[0] || null
}

function bedsSummary(room: ServicePoint, roomType?: HotelRoomType) {
  const beds = room.bedConfiguration?.length ? room.bedConfiguration : roomType?.bedConfiguration || []
  if (beds.length) return beds.map((bed) => `${bed.count} ${bed.bedType}`).join(" · ")
  if (room.beds) return `${room.beds} ${room.bedType || "bed"}${room.beds === 1 ? "" : "s"}`
  return null
}

function StatusChip({ active, children, tone = "emerald" }: { active: boolean; children: ReactNode; tone?: "emerald" | "sky" }) {
  const activeClasses = tone === "sky"
    ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300"
    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black ${active ? activeClasses : "border-border bg-background/90 text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${active ? tone === "sky" ? "bg-sky-500" : "bg-emerald-500" : "bg-muted-foreground"}`} />{children}</span>
}

function RoomReadinessChip({ state = "ready" }: { state?: "ready" | "needs_cleaning" | "cleaning" }) {
  const presentation = state === "needs_cleaning"
    ? { label: "Needs Cleaning", classes: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" }
    : state === "cleaning"
      ? { label: "Cleaning", classes: "border-violet-200 bg-violet-50 text-violet-800", dot: "bg-violet-500" }
      : { label: "Ready", classes: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" }
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black ${presentation.classes}`}><span className={`size-1.5 rounded-full ${presentation.dot}`} />{presentation.label}</span>
}

function RoomOverflow({
  room,
  busy,
  onQr,
  onToggleActive,
  onToggleReservable,
  onDelete,
}: {
  room: ServicePoint
  busy: boolean
  onQr: (room: ServicePoint) => void
  onToggleActive: (room: ServicePoint) => void
  onToggleReservable: (room: ServicePoint) => void
  onDelete: (room: ServicePoint) => void
}) {
  const [open, setOpen] = useState(false)
  const action = (callback: (room: ServicePoint) => void) => {
    setOpen(false)
    callback(room)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="secondary" size="icon-sm" disabled={busy} className="absolute right-2 top-2 bg-background/95 shadow-sm" aria-label={`More actions for ${room.label}`}>{busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5" role="menu">
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-muted" onClick={() => action(onQr)}><QrCode className="size-4" />View QR</button>
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-muted" onClick={() => action(onToggleReservable)}>{room.reservable !== false ? <CalendarOff className="size-4" /> : <Calendar className="size-4" />}Turn reservations {room.reservable !== false ? "off" : "on"}</button>
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-muted" onClick={() => action(onToggleActive)}>{room.isActive ? <X className="size-4" /> : <Check className="size-4" />}{room.isActive ? "Deactivate" : "Activate"}</button>
        <div className="my-1 border-t border-border" />
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-destructive/10" onClick={() => action(onDelete)}><Trash2 className="size-4" />Delete service point</button>
      </PopoverContent>
    </Popover>
  )
}

export function HotelRoomsView({
  servicePoints,
  roomTypes,
  isLoading,
  canManage,
  canServiceRooms,
  busyServicePointId,
  onAddRoom,
  onView,
  onServiceRoom,
  onEdit,
  onQr,
  onToggleActive,
  onToggleReservable,
  onDelete,
}: {
  servicePoints: ServicePoint[]
  roomTypes: HotelRoomType[]
  isLoading: boolean
  canManage: boolean
  canServiceRooms: boolean
  busyServicePointId: string | null
  onAddRoom: () => void
  onView: (room: ServicePoint) => void
  onServiceRoom: (room: ServicePoint) => void
  onEdit: (room: ServicePoint) => void
  onQr: (room: ServicePoint) => void
  onToggleActive: (room: ServicePoint) => void
  onToggleReservable: (room: ServicePoint) => void
  onDelete: (room: ServicePoint) => void
}) {
  const [search, setSearch] = useState("")
  const [roomTypeFilter, setRoomTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<RoomStatusFilter>("all")
  const rooms = useMemo(() => servicePoints.filter((point) => point.servicePointType === "room"), [servicePoints])
  const filterTypes = useMemo(() => Array.from(new Set(rooms.map((room) => room.roomType).filter(Boolean) as string[])).sort(), [rooms])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rooms.filter((room) => {
      const matchesSearch = !query || [room.label, room.code, room.roomType].some((value) => value?.toLowerCase().includes(query))
      const matchesType = roomTypeFilter === "all" || roomTypeKey(room.roomType) === roomTypeFilter
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && room.isActive) ||
        (statusFilter === "inactive" && !room.isActive) ||
        (statusFilter === "reservations_on" && room.reservable !== false) ||
        (statusFilter === "reservations_off" && room.reservable === false)
      return matchesSearch && matchesType && matchesStatus
    })
  }, [roomTypeFilter, rooms, search, statusFilter])
  const filtersDefault = !search.trim() && roomTypeFilter === "all" && statusFilter === "all"

  return (
    <div>
      <div className="grid gap-3 border-b border-border p-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rooms..." aria-label="Search rooms" className="pl-9" /></div>
        <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}><SelectTrigger aria-label="Filter rooms by Room Type"><SelectValue placeholder="All room types" /></SelectTrigger><SelectContent><SelectItem value="all">All room types</SelectItem>{filterTypes.map((type) => <SelectItem key={type} value={roomTypeKey(type)}>{type}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={(value: RoomStatusFilter) => setStatusFilter(value)}><SelectTrigger aria-label="Filter rooms by status"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="reservations_on">Reservations On</SelectItem><SelectItem value="reservations_off">Reservations Off</SelectItem></SelectContent></Select>
        <Button type="button" variant="ghost" disabled={filtersDefault} onClick={() => { setSearch(""); setRoomTypeFilter("all"); setStatusFilter("all") }}><X />Clear</Button>
      </div>
      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground" aria-live="polite">Showing {filtered.length} of {rooms.length} rooms</p>

      {isLoading ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-80 rounded-2xl" />)}</div>
      ) : filtered.length ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((room) => {
            const roomType = getRoomTypeForRoom(room, roomTypes)
            const image = roomImage(room, roomType)
            const beds = bedsSummary(room, roomType)
            const guests = room.maxGuests ?? room.capacity ?? roomType?.maxGuests
            const view = room.viewType || roomType?.viewType
            return (
              <article key={room.servicePointId} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="relative h-36 bg-muted">{image ? <img src={image} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-muted-foreground"><ImageIcon className="size-9" /><span className="sr-only">No room photo</span></div>}<div className="absolute left-2 top-2 flex max-w-[calc(100%-3rem)] flex-wrap gap-1.5"><StatusChip active={room.isActive}>{room.isActive ? "Active" : "Inactive"}</StatusChip><StatusChip active={room.reservable !== false} tone="sky">{room.reservable !== false ? "Reservations On" : "Reservations Off"}</StatusChip><RoomReadinessChip state={room.roomReadiness?.state || "ready"} /></div>{canManage ? <RoomOverflow room={room} busy={busyServicePointId === room.servicePointId} onQr={onQr} onToggleActive={onToggleActive} onToggleReservable={onToggleReservable} onDelete={onDelete} /> : null}</div>
                <div className="space-y-3 p-4"><div><h3 className="text-lg font-black">{room.label}</h3><p className="text-sm font-semibold text-primary">{room.roomType || "Room Type not set"}</p><p className="text-xs text-muted-foreground">Code {room.code}</p></div><dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">{guests ? <div className="flex items-center gap-2"><Users className="size-3.5" /><span>{guests} guests</span></div> : null}{beds ? <div className="flex items-center gap-2"><BedDouble className="size-3.5" /><span className="truncate">{beds}</span></div> : null}{roomType?.roomSize != null ? <div className="flex items-center gap-2"><DoorOpen className="size-3.5" /><span>{roomType.roomSize} {roomType.roomSizeUnit === "ft2" ? "ft²" : "m²"}</span></div> : null}{view ? <div className="flex items-center gap-2"><Eye className="size-3.5" /><span className="truncate">{view}</span></div> : null}</dl><div className="grid grid-cols-2 gap-2 border-t border-border pt-3">{canServiceRooms ? <Button type="button" size="sm" className="col-span-2" onClick={() => onServiceRoom(room)} disabled={!room.isActive} title={room.isActive ? `Record supplies used while servicing ${room.label}` : "Activate this room before recording service supplies"}><PackageCheck />Service Room</Button> : null}<Button type="button" variant="outline" size="sm" onClick={() => onView(room)}><Eye />View details</Button>{canManage ? <Button type="button" variant="outline" size="sm" onClick={() => onEdit(room)}><Edit2 />Edit</Button> : <Button type="button" variant="outline" size="sm" onClick={() => onQr(room)}><QrCode />View QR</Button>}</div></div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><DoorOpen className="size-5" /></div><h3 className="mt-4 font-bold">{filtersDefault ? "No rooms yet" : "No rooms match your filters"}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtersDefault ? "Add your first room to start managing hotel availability." : "Try another search or clear the current filters."}</p>{filtersDefault && canManage ? <Button className="mt-5" onClick={onAddRoom}><Plus />Add Room</Button> : !filtersDefault ? <Button variant="outline" className="mt-5" onClick={() => { setSearch(""); setRoomTypeFilter("all"); setStatusFilter("all") }}>Clear filters</Button> : null}</div>
      )}
    </div>
  )
}

export function HotelRoomTypesView({
  roomTypes,
  rooms,
  canManage,
  canManageSupplyTemplates,
  onCreate,
  onEdit,
  onAddRoom,
  onEditSupplyTemplate,
}: {
  roomTypes: HotelRoomType[]
  rooms: ServicePoint[]
  canManage: boolean
  canManageSupplyTemplates: boolean
  onCreate: () => void
  onEdit: (roomType: HotelRoomType) => void
  onAddRoom: (roomType: HotelRoomType) => void
  onEditSupplyTemplate: (roomType: HotelRoomType) => void
}) {
  const configuredRoomTypes = roomTypes.filter((roomType) => roomType.isDefault !== true)
  if (!configuredRoomTypes.length) return <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><BedDouble className="size-5" /></div><h3 className="mt-4 font-bold">No room types yet</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">Choose a suggested name or create a custom Room Type, then add rooms to it.</p>{canManage ? <Button className="mt-5" onClick={onCreate}><Plus />Create Room Type</Button> : null}</div>
  return (
    <div>
      <div className="border-b border-border px-4 py-3"><p className="text-sm text-muted-foreground">{configuredRoomTypes.length} configured Room Types</p></div>
      <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
        {configuredRoomTypes.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((roomType) => {
          const roomCount = rooms.filter((room) => roomTypeKey(room.roomType) === roomTypeKey(roomType.name)).length
          const supplyCount = roomType.standardSupplyTemplate?.length || 0
          return (
            <article key={roomType.name} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {roomType.images?.[0] ? <img src={roomType.images[0]} alt="" className="h-36 w-full object-cover" /> : <div className="flex h-28 items-center justify-center bg-muted text-muted-foreground"><BedDouble className="size-8" /></div>}
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{roomType.name}</h3><p className="text-xs text-muted-foreground">{roomCount} {roomCount === 1 ? "room" : "rooms"}</p></div><StatusChip active={roomType.active !== false}>{roomType.active !== false ? "Active" : "Inactive"}</StatusChip></div>
                {roomType.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{roomType.description}</p> : null}
                <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">{roomType.maxGuests ? <div className="flex items-center gap-2"><Users className="size-3.5" />Up to {roomType.maxGuests}</div> : null}{roomType.bedConfiguration?.length ? <div className="flex items-center gap-2"><BedDouble className="size-3.5" /><span className="truncate">{roomType.bedConfiguration.map((bed) => `${bed.count} ${bed.bedType}`).join(" · ")}</span></div> : null}{roomType.roomSize != null ? <div>{roomType.roomSize} {roomType.roomSizeUnit === "ft2" ? "ft²" : "m²"}</div> : null}{roomType.viewType ? <div className="truncate">{roomType.viewType}</div> : null}</dl>
                {roomType.amenities?.length ? <div className="flex flex-wrap gap-1.5">{roomType.amenities.slice(0, 4).map((amenity) => <span key={amenity} className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">{amenity}</span>)}{roomType.amenities.length > 4 ? <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">+{roomType.amenities.length - 4}</span> : null}</div> : null}
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><PackageCheck className="size-4 text-primary" aria-hidden="true" /><span>{supplyCount} {supplyCount === 1 ? "supply" : "supplies"} set up</span></div>
                {canManage ? (
                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                    {canManageSupplyTemplates ? <Button type="button" variant="outline" size="sm" className="col-span-2" onClick={() => onEditSupplyTemplate(roomType)}><PackageCheck />Room supplies</Button> : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(roomType)}><Edit2 />Edit Room Type</Button>
                    <Button type="button" size="sm" onClick={() => onAddRoom(roomType)}><Plus />Add Room</Button>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export function HotelRoomDetailsDialog({ room, roomTypes, open, onOpenChange }: { room: ServicePoint | null; roomTypes: HotelRoomType[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!room) return null
  const roomType = getRoomTypeForRoom(room, roomTypes)
  const image = roomImage(room, roomType)
  const beds = bedsSummary(room, roomType)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-lg"><DialogHeader className="px-6 pt-6 pr-12"><DialogTitle>{room.label}</DialogTitle><DialogDescription>Room information for ServicePoint {room.code}</DialogDescription></DialogHeader>{image ? <img src={image} alt="" className="h-56 w-full object-cover" /> : null}<div className="space-y-5 px-6 pb-6"><div className="flex flex-wrap gap-2"><StatusChip active={room.isActive}>{room.isActive ? "Active" : "Inactive"}</StatusChip><StatusChip active={room.reservable !== false} tone="sky">{room.reservable !== false ? "Reservations On" : "Reservations Off"}</StatusChip></div><dl className="grid grid-cols-2 gap-3 text-sm"><Detail label="Room Type" value={room.roomType || "Not set"} /><Detail label="Maximum guests" value={String(room.maxGuests ?? room.capacity ?? roomType?.maxGuests ?? "Not set")} /><Detail label="Beds" value={beds || "Not set"} /><Detail label="Nightly price" value={room.pricePerNight == null ? "Not set" : `€${Number(room.pricePerNight).toFixed(2)}`} /><Detail label="Room size" value={roomType?.roomSize == null ? "Not set" : `${roomType.roomSize} ${roomType.roomSizeUnit === "ft2" ? "ft²" : "m²"}`} /><Detail label="View" value={room.viewType || roomType?.viewType || "Not set"} /></dl>{room.fullDescription || roomType?.description ? <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Description</p><p className="mt-1 text-sm leading-6">{room.fullDescription || roomType?.description}</p></div> : null}{(room.amenities?.length || roomType?.amenities?.length) ? <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Amenities</p><div className="mt-2 flex flex-wrap gap-2">{(room.amenities?.length ? room.amenities : roomType?.amenities || []).map((amenity) => <span key={amenity} className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{amenity}</span>)}</div></div> : null}</div></DialogContent></Dialog>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>
}
