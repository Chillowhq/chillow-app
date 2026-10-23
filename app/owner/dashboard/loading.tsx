export default function OwnerDashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="h-8 w-56 bg-secondary rounded-lg animate-pulse" />
              <div className="h-4 w-48 bg-secondary/50 rounded mt-2 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-48 bg-secondary rounded-xl animate-pulse" />
              <div className="h-10 w-10 bg-secondary rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse" />
                <div className="w-16 h-5 bg-secondary rounded animate-pulse" />
              </div>
              <div className="h-8 w-24 bg-secondary rounded animate-pulse" />
              <div className="h-4 w-20 bg-secondary/50 rounded mt-2 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
                  <div className="h-3 w-24 bg-secondary/50 rounded mt-2 animate-pulse" />
                </div>
              </div>
              <div className="h-[200px] bg-secondary/30 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>

        {/* Bottom Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="h-5 w-36 bg-secondary rounded mb-4 animate-pulse" />
              <div className="space-y-3">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-10 bg-secondary/30 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
