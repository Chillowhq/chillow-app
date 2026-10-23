import {
  RESERVATION_STATUS_CONFIG,
  type ReservationDashboardMode,
} from "./useReservationDashboard"

export function ReservationStatusBadge({
  mode,
  status,
}: {
  mode: ReservationDashboardMode
  status: string
}) {
  const statusConfig = RESERVATION_STATUS_CONFIG[mode]
  const style = statusConfig[status] || statusConfig.pending

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} inline-block`} />
      {style.label}
    </span>
  )
}
