import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

function StepSkeleton() {
  return (
    <div className="flex items-center gap-0">
      {[0, 1, 2, 3].map((step) => (
        <div key={step} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="mt-2 h-2.5 w-10" />
          </div>
          {step < 3 && <Skeleton className="mx-2 mb-4 h-0.5 flex-1" />}
        </div>
      ))}
    </div>
  )
}

function SummaryRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className={cn("h-3.5", index % 2 === 0 ? "w-24" : "w-20")} />
          </div>
          <Skeleton className={cn("h-3.5", index % 2 === 0 ? "w-28" : "w-20")} />
        </div>
      ))}
    </div>
  )
}

export function CustomerLandingSkeleton() {
  return (
    <LoadingRegion label="Loading QuickServe" className="min-h-screen overflow-hidden bg-background px-4">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center text-center">
        <Skeleton className="mb-8 h-24 w-24 rounded-3xl" />
        <Skeleton className="mb-3 h-12 w-64 max-w-full" />
        <Skeleton className="mb-10 h-4 w-48 max-w-full" />
        <div className="w-full rounded-2xl border border-border/50 bg-card/50 p-6">
          <Skeleton className="mx-auto mb-5 h-3 w-32" />
          <Skeleton className="mb-3 h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </LoadingRegion>
  )
}

export function PublicHubSkeleton() {
  return (
    <LoadingRegion label="Loading business profile" className="min-h-screen overflow-hidden bg-background pb-12">
      <div className="relative h-64 w-full bg-muted sm:h-80">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2 px-4">
          <Skeleton className="mx-auto h-28 w-28 rounded-full border-4 border-background sm:h-32 sm:w-32" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 pt-20 text-center sm:pt-24">
        <Skeleton className="mx-auto mb-4 h-9 w-64 max-w-[80%] sm:h-11" />
        <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="mx-auto mb-10 h-4 w-full max-w-lg" />
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex min-h-48 flex-col items-center justify-center rounded-2xl border bg-card p-6">
              <Skeleton className="mb-4 h-14 w-14 rounded-full" />
              <Skeleton className="mb-2 h-5 w-36" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  )
}

export function MenuPageSkeleton() {
  return (
    <LoadingRegion label="Loading menu" className="min-h-screen overflow-x-hidden bg-background pb-24">
      <div className="lg:mx-auto lg:mt-5 lg:max-w-6xl lg:px-4">
        <Skeleton className="h-[23rem] w-full rounded-none min-[390px]:h-[24rem] sm:h-[29rem] lg:h-[32rem] lg:rounded-[2rem]" />
      </div>
      <div className="relative z-10 -mt-8 rounded-t-[2.75rem] bg-background px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
        <div className="mx-auto flex max-w-5xl items-center gap-4 sm:gap-6">
          <Skeleton className="h-24 w-24 shrink-0 rounded-full min-[380px]:h-[6.5rem] min-[380px]:w-[6.5rem] sm:h-28 sm:w-28" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-44 max-w-full" />
              <Skeleton className="h-9 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <Skeleton className="mx-auto mt-8 h-16 w-full max-w-4xl rounded-full" />
      </div>
      <div className="border-b border-border/60 bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl gap-2.5 overflow-hidden">
          {["w-24", "w-32", "w-24", "w-32"].map((width, index) => (
            <Skeleton key={index} className={cn("h-13 shrink-0 rounded-full", width)} />
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="w-[54vw] min-w-[172px] max-w-[232px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  )
}

export function ReservationPageSkeleton() {
  return (
    <LoadingRegion label="Loading reservation experience" className="min-h-screen overflow-x-hidden bg-background pb-20">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
        <Skeleton className="mb-6 h-11 w-24 rounded-xl" />
        <StepSkeleton />
        <div className="mt-8">
          <Skeleton className="mb-2 h-6 w-44" />
          <Skeleton className="mb-6 h-4 w-64 max-w-full" />
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {Array.from({ length: 42 }, (_, index) => (
                <Skeleton key={index} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="mt-6 h-14 w-full rounded-2xl" />
        </div>
      </div>
    </LoadingRegion>
  )
}

export function RoomAvailabilitySkeleton() {
  return (
    <LoadingRegion label="Checking room availability" className="mt-6 w-full">
      <div className="mb-6 flex gap-2 overflow-hidden border-b border-border/50 py-4">
        {["w-24", "w-28", "w-32"].map((width, index) => (
          <Skeleton key={index} className={cn("h-11 shrink-0 rounded-xl", width)} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function ReservationDetailsSkeleton({ label = "Loading reservation details" }: { label?: string }) {
  return (
    <LoadingRegion label={label} className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-2xl" />
          <Skeleton className="mx-auto mb-2 h-7 w-56 max-w-full" />
          <Skeleton className="mx-auto h-4 w-64 max-w-full" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/30 px-5 py-4">
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="p-5"><SummaryRows count={5} /></div>
        </div>
        <Skeleton className="mt-4 h-14 w-full rounded-2xl" />
        <Skeleton className="mx-auto mt-5 h-3 w-4/5" />
      </div>
    </LoadingRegion>
  )
}

export function ReservationLinkSkeleton() {
  return (
    <LoadingRegion label="Checking reservation" className="min-h-screen bg-background px-5 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        <div className="space-y-4 bg-muted/50 px-7 py-8">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-full max-w-xs" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-5 p-6 sm:p-7">
          <div className="rounded-2xl border border-border bg-muted/25 p-4">
            <Skeleton className="mb-4 h-3 w-32" />
            <SummaryRows count={3} />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </LoadingRegion>
  )
}

export function OrderSummarySkeleton() {
  return (
    <LoadingRegion label="Loading order summary" className="min-h-screen overflow-x-hidden bg-background">
      <div className="border-b border-border bg-background/95">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Skeleton className="mb-4 h-8 w-20" />
          <Skeleton className="h-7 w-44" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex gap-4 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <SummaryRows count={4} />
        </div>
      </div>
    </LoadingRegion>
  )
}

export function OrderStatusSkeleton() {
  return (
    <LoadingRegion label="Loading order status" className="min-h-screen overflow-x-hidden bg-background">
      <div className="border-b border-border bg-background/95">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Skeleton className="mb-4 h-8 w-20" />
          <Skeleton className="h-7 w-36" />
        </div>
      </div>
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-8">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-8">
          <div className="mb-8 flex items-start justify-between border-b border-border/40 pb-6">
            <div className="space-y-3"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-32" /><Skeleton className="h-7 w-24 rounded-lg" /></div>
            <div className="flex flex-col items-end space-y-3"><Skeleton className="h-3 w-12" /><Skeleton className="h-7 w-20" /><Skeleton className="h-6 w-16 rounded-full" /></div>
          </div>
          <Skeleton className="mx-auto mb-6 h-3 w-28" />
          <div className="mb-8 flex items-center justify-between gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex flex-1 items-center last:flex-none">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                {index < 2 && <Skeleton className="mx-2 h-0.5 flex-1" />}
              </div>
            ))}
          </div>
          <div className="space-y-3"><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" /></div>
        </div>
      </div>
    </LoadingRegion>
  )
}

export function OrderHistorySkeleton({ page = false }: { page?: boolean }) {
  const cards = (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
            <div className="space-y-2"><Skeleton className="ml-auto h-6 w-20 rounded-full" /><Skeleton className="ml-auto h-4 w-16" /></div>
          </div>
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  )

  if (!page) return <LoadingRegion label="Loading order history">{cards}</LoadingRegion>

  return (
    <LoadingRegion label="Loading order history" className="min-h-screen bg-background">
      <div className="border-b border-border bg-background/95">
        <div className="mx-auto max-w-2xl px-4 py-4"><Skeleton className="mb-4 h-8 w-20" /><Skeleton className="h-7 w-40" /></div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-8">{cards}</div>
    </LoadingRegion>
  )
}

export function WaitstaffRequestSkeleton() {
  return (
    <LoadingRegion label="Loading waiter request" className="min-h-screen bg-background">
      <div className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-44" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <Skeleton className="mx-auto mb-5 h-20 w-20 rounded-full" />
          <Skeleton className="mx-auto mb-3 h-7 w-52 max-w-full" />
          <Skeleton className="mx-auto mb-8 h-4 w-72 max-w-full" />
          <div className="mb-6 flex flex-wrap justify-center gap-2 border-t border-border pt-6">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </LoadingRegion>
  )
}

function OrderConfirmationDetailsShape() {
  return (
    <div className="my-4 h-40 w-full rounded-3xl border border-border/50 bg-card/40 p-4 shadow-sm">
      <div className="flex justify-between border-b border-border/40 pb-3"><div className="space-y-2"><Skeleton className="h-2.5 w-12" /><Skeleton className="h-4 w-28" /></div><div className="space-y-2"><Skeleton className="ml-auto h-2.5 w-16" /><Skeleton className="ml-auto h-5 w-20" /></div></div>
      <Skeleton className="my-3 h-3 w-4/5" />
      <div className="flex justify-between border-t border-border/40 pt-3"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /></div>
    </div>
  )
}

export function OrderConfirmationDetailsSkeleton() {
  return (
    <LoadingRegion label="Loading order details">
      <OrderConfirmationDetailsShape />
    </LoadingRegion>
  )
}

export function OrderConfirmationPageSkeleton() {
  return (
    <LoadingRegion label="Loading order confirmation" className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-background px-4 py-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center"><Skeleton className="mb-4 h-20 w-20 rounded-full" /><Skeleton className="mb-2 h-8 w-56" /><Skeleton className="h-4 w-64 max-w-full" /></div>
        <OrderConfirmationDetailsShape />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /></div>
      </div>
    </LoadingRegion>
  )
}

export function CameraScannerSkeleton() {
  return (
    <LoadingRegion label="Preparing camera scanner" className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6">
        <Skeleton className="h-10 w-10 rounded-full bg-white/15" />
        <Skeleton className="h-4 w-28 bg-white/15" />
        <div className="h-10 w-10" />
      </div>
      <div className="flex h-full flex-col items-center justify-center">
        <Skeleton className="h-[250px] w-[250px] rounded-2xl border-4 border-white/20 bg-white/5" />
        <Skeleton className="mt-10 h-11 w-72 max-w-[80%] rounded-2xl bg-white/15" />
      </div>
    </LoadingRegion>
  )
}

export function CameraLoadingOverlaySkeleton() {
  return (
    <LoadingRegion
      label="Preparing camera scanner"
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <Skeleton className="h-[250px] w-[250px] rounded-2xl border-4 border-white/20 bg-white/5" />
      <Skeleton className="mt-10 h-11 w-72 max-w-[80vw] rounded-2xl bg-white/15" />
    </LoadingRegion>
  )
}

export function CustomerRouteSkeleton({ pathname = "" }: { pathname?: string }) {
  if (pathname.includes("/status")) return <OrderStatusSkeleton />
  if (pathname.includes("/confirmation")) return <OrderConfirmationPageSkeleton />
  if (pathname.includes("/orders")) return <OrderHistorySkeleton page />
  if (pathname.includes("/order")) return <OrderSummarySkeleton />
  if (pathname.includes("/waitstaff-request")) return <WaitstaffRequestSkeleton />
  return <MenuPageSkeleton />
}
