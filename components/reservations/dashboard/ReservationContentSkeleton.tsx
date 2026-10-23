import { Skeleton } from "@/components/ui/skeleton";

export function ReservationContentSkeleton({
  view,
}: {
  view: "list" | "calendar";
}) {
  if (view === "calendar") {
    return (
      <div
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        role="status"
        aria-label="Loading reservation calendar"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-px bg-border/50 p-px">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="min-h-[90px] bg-card p-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              {index % 4 === 0 && <Skeleton className="mt-3 h-2 w-10" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      role="status"
      aria-label="Loading reservations"
    >
      <div className="hidden grid-cols-6 gap-4 border-b border-border bg-muted/30 px-5 py-3 lg:grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className={columnIndex === 0 ? "h-5 w-32" : "h-5 w-24"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
