"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  BedDouble,
  Boxes,
  PackageCheck,
  Pencil,
  RefreshCw,
} from "lucide-react"

import { RoomSupplyTemplateDialog } from "@/components/service-points/RoomSupplyTemplateDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthContext } from "@/contexts/AuthContext"
import apiClient from "@/lib/axios-config"
import { formatInventoryQuantity } from "@/lib/inventory"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import type { HotelRoomType, HotelRoomTypeSupplyTemplateResponse } from "@/types/hotel-room-type"

type RoomSuppliesWorkspace = {
  roomType: HotelRoomType
  supplies: HotelRoomTypeSupplyTemplateResponse
}

function requestMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data
  if (typeof data?.error === "string" && data.error.trim()) return data.error
  if (typeof data?.message === "string" && data.message.trim()) return data.message
  return fallback
}

function supplyStatus(status: HotelRoomTypeSupplyTemplateResponse["items"][number]["status"]) {
  switch (status) {
    case "inactive":
      return "No longer active"
    case "not_room_usage_eligible":
      return "Cannot be used for rooms"
    case "unit_changed":
      return "Unit needs checking"
    case "deleted":
    case "missing":
      return "No longer in inventory"
    default:
      return "Needs checking"
  }
}

function RoomSuppliesSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading room supplies">
      {[0, 1, 2, 3].map((index) => (
        <Card key={index}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function RoomSuppliesPage() {
  const { user, loading: authLoading } = useAuthContext()
  const [workspace, setWorkspace] = useState<RoomSuppliesWorkspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoomType, setSelectedRoomType] = useState<HotelRoomType | null>(null)

  const isHotel = user?.capabilities
    ? user.capabilities.identity.shell === "hotel"
    : user?.businessType === "hotel"
  const canManageRoomSupplies = user?.role !== "manager" &&
    hasManagementPermission(user, MANAGER_PERMISSIONS.SERVICE_POINTS_MANAGE) &&
    hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_MANAGE)

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    if (!user?.businessId || !isHotel) return

    setLoading(true)
    setError(null)
    try {
      const settings = await apiClient.get<{ hotelRoomTypes?: HotelRoomType[] }>(
        "/business/settings",
        { signal },
      )
      const roomTypes = Array.isArray(settings.data.hotelRoomTypes)
        ? settings.data.hotelRoomTypes
          .filter((roomType) => roomType.isDefault !== true)
          .sort((first, second) => first.sortOrder - second.sortOrder)
        : []
      const loadedWorkspace = await Promise.all(roomTypes.map(async (roomType) => {
        const response = await apiClient.get<HotelRoomTypeSupplyTemplateResponse>(
          "/business/room-types/supply-template",
          { params: { roomTypeName: roomType.name }, signal },
        )
        return { roomType, supplies: response.data }
      }))
      if (!signal?.aborted) setWorkspace(loadedWorkspace)
    } catch (requestError) {
      if (!signal?.aborted) {
        setWorkspace([])
        setError(requestMessage(requestError, "Room supplies could not be loaded. Please try again."))
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [isHotel, user?.businessId])

  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    void loadWorkspace(controller.signal)
    return () => controller.abort()
  }, [authLoading, loadWorkspace])

  const configuredSupplyCount = useMemo(
    () => workspace.reduce((total, entry) => total + entry.supplies.items.length, 0),
    [workspace],
  )

  if (!isHotel && !authLoading) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-semibold">Room supplies</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the supplies your team normally uses to prepare each type of room.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/owner/service-points?view=room_types">
            <BedDouble className="size-4" aria-hidden="true" />
            Manage room types
          </Link>
        </Button>
      </div>

      <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <PackageCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-muted-foreground">
          Setting these supplies does not change your stock. Stock changes only when your team records what they actually used while servicing a room.
        </p>
      </div>

      {loading || authLoading ? <RoomSuppliesSkeleton /> : error ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            <h3 className="mt-4 font-semibold">Room supplies could not be loaded</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
            <Button className="mt-5" variant="outline" onClick={() => void loadWorkspace()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : workspace.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BedDouble className="size-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold">No room types yet</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Add a room type first, then come back here to choose the supplies your team normally uses.
            </p>
            <Button asChild className="mt-5">
              <Link href="/owner/service-points?view=room_types">Set up room types</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {workspace.length} {workspace.length === 1 ? "room type" : "room types"} · {configuredSupplyCount} {configuredSupplyCount === 1 ? "supply" : "supplies"} set up
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {workspace.map(({ roomType, supplies }) => {
              const issueCount = supplies.items.filter((line) => line.status !== "available").length
              return (
                <Card key={roomType.name} className="flex flex-col overflow-hidden">
                  <CardHeader className="border-b bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{roomType.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {supplies.items.length === 0
                            ? "No supplies have been added yet."
                            : `${supplies.items.length} ${supplies.items.length === 1 ? "supply" : "supplies"} set for each room.`}
                        </CardDescription>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        issueCount > 0
                          ? "bg-amber-100 text-amber-900"
                          : supplies.items.length > 0
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-muted text-muted-foreground"
                      }`}>
                        {issueCount > 0 ? "Needs attention" : supplies.items.length > 0 ? "Set up" : "Not set up"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pt-5">
                    {supplies.items.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        Add the items your team usually uses when preparing this room type.
                      </div>
                    ) : (
                      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                        {supplies.items.map((line) => {
                          const item = line.inventoryItem
                          return (
                            <div key={line.inventoryItemId} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item?.name || "Unavailable supply"}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {line.status === "available"
                                      ? `${formatInventoryQuantity(line.quantity, line.unit)} per room`
                                      : supplyStatus(line.status)}
                                  </p>
                                </div>
                              </div>
                              {item && line.status === "available" ? (
                                <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                                  <div>
                                    <dt className="text-muted-foreground">In stock</dt>
                                    <dd className="mt-0.5 font-medium">{formatInventoryQuantity(item.onHandQuantity, item.trackingUnit)}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground">Set aside</dt>
                                    <dd className="mt-0.5 font-medium">{formatInventoryQuantity(item.reservedQuantity, item.trackingUnit)}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground">Available</dt>
                                    <dd className="mt-0.5 font-medium">{formatInventoryQuantity(item.availableQuantity, item.trackingUnit)}</dd>
                                  </div>
                                </dl>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/10 py-3">
                    <Button variant="outline" size="sm" onClick={() => setSelectedRoomType(roomType)}>
                      {canManageRoomSupplies ? <Pencil className="size-4" aria-hidden="true" /> : <Boxes className="size-4" aria-hidden="true" />}
                      {canManageRoomSupplies ? "Edit supplies" : "View supplies"}
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/owner/inventory/activity?context=hotelOperations">View stock history</Link>
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </>
      )}

      <RoomSupplyTemplateDialog
        open={Boolean(selectedRoomType)}
        roomType={selectedRoomType}
        canManage={canManageRoomSupplies}
        onOpenChange={(open) => {
          if (!open) setSelectedRoomType(null)
        }}
        onSaved={() => {
          setSelectedRoomType(null)
          void loadWorkspace()
        }}
      />
    </div>
  )
}
