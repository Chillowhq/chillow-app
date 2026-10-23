"use client"

import { ShieldX } from "lucide-react"

export default function ManagementAccessDeniedPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <ShieldX className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-foreground">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access denied. You don&apos;t have permission to view this page. Your account remains signed in.
        </p>
      </div>
    </div>
  )
}
