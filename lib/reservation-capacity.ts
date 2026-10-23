export interface ReservationServicePointCapacity {
  servicePointId: string
  capacity?: number | null
}

export function getConfiguredServicePointCapacity(
  servicePoint: ReservationServicePointCapacity | null | undefined,
) {
  const capacity = Number(servicePoint?.capacity)
  return Number.isInteger(capacity) && capacity >= 1 ? capacity : null
}

export function getMaximumConfiguredServicePointCapacity(
  servicePoints: ReservationServicePointCapacity[] = [],
) {
  const capacities = servicePoints
    .map(getConfiguredServicePointCapacity)
    .filter((capacity): capacity is number => capacity !== null)

  return capacities.length > 0 ? Math.max(...capacities) : null
}

export function getReservationGuestCapacity({
  servicePoints = [],
  servicePointId,
}: {
  servicePoints?: ReservationServicePointCapacity[]
  servicePointId?: string
}) {
  if (servicePointId) {
    const selectedServicePoint = servicePoints.find(
      (servicePoint) => servicePoint.servicePointId === servicePointId,
    )
    return getConfiguredServicePointCapacity(selectedServicePoint)
  }

  return getMaximumConfiguredServicePointCapacity(servicePoints)
}
