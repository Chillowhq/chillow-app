import { Layers3 } from "lucide-react"
import { AnalyticsSection } from "@/components/analytics/shared/AnalyticsSection"
import { formatPrice } from "@/lib/localization"
import type { LodgingRoomTypePerformance } from "@/types/owner-analytics"

type RoomTypePerformanceProps = {
  data: LodgingRoomTypePerformance[]
  currency: string
}

function formatCents(cents: number, currency: string) {
  return formatPrice(cents / 100, currency)
}

export function RoomTypePerformance({
  data,
  currency,
}: RoomTypePerformanceProps) {
  return (
    <AnalyticsSection
      icon={<Layers3 className="h-5 w-5 text-white" />}
      iconClassName="bg-gradient-to-br from-fuchsia-500 to-purple-600"
      title="Room Type Performance"
      subtitle="Revenue uses the booking room-type snapshot; occupancy uses current active, reservable room inventory."
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-border bg-muted/50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-4">Room Type</th>
                  <th className="px-5 py-4 text-right">Current Rooms</th>
                  <th className="px-5 py-4 text-right">Paid Bookings</th>
                  <th className="px-5 py-4 text-right">Booked Nights</th>
                  <th className="px-5 py-4 text-right">Paid Revenue</th>
                  <th className="px-5 py-4 text-right">Average Value</th>
                  <th className="px-5 py-4 text-right">Occupancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((item) => (
                  <tr key={item.roomType}>
                    <td className="px-5 py-4 font-bold text-foreground">
                      {item.roomType}
                    </td>
                    <td className="px-5 py-4 text-right text-foreground">
                      {item.roomCount}
                    </td>
                    <td className="px-5 py-4 text-right text-foreground">
                      {item.paidBookingCount}
                    </td>
                    <td className="px-5 py-4 text-right text-foreground">
                      {item.bookedNights}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-foreground">
                      {formatCents(item.paidRevenueCents, currency)}
                    </td>
                    <td className="px-5 py-4 text-right text-foreground">
                      {formatCents(item.averageBookingValueCents, currency)}
                    </td>
                    <td className="px-5 py-4 text-right text-foreground">
                      {item.occupancyRatePercent === null
                        ? "Unavailable"
                        : `${item.occupancyRatePercent.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            No typed room inventory or room-type booking activity is available.
          </p>
        )}
      </div>
    </AnalyticsSection>
  )
}
