import { Skeleton } from "@/components/ui/skeleton"

export function AnalystSkeleton() {
  return (
    <div className="space-y-8 animate-pulse mt-4">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-64" />
        </div>
      </div>
      <Skeleton className="h-32 w-full max-w-3xl rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-64 max-w-3xl rounded-xl" />
      <Skeleton className="h-48 max-w-3xl rounded-xl" />
    </div>
  )
}
