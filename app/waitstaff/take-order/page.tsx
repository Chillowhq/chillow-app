"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Search } from "lucide-react"
import apiClient from "@/lib/axios-config"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { toast } from "sonner"
import type { ServicePoint } from "@/types/service-point"

export default function TakeOrderServicePointSelector() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuthGuard({ requiredRole: "waiter" })
    const [servicePoints, setServicePoints] = useState<ServicePoint[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [accessDenied, setAccessDenied] = useState(false)

    useEffect(() => {
        if (!user || authLoading) return

        const fetchData = async () => {
            try {
                // Verify waiter-assisted ordering is enabled before loading the flow.
                // The backend also enforces this, but we block early for a clean UX.
                const rid = user?.businessId || ""
                const settingsRes = await apiClient.get(`/public/business-config?businessId=${rid}`)
                if (settingsRes.data?.orderingPreferences?.enableWaiterOrdering === false) {
                    setAccessDenied(true)
                    return
                }

                const res = await apiClient.get("/waitstaff/service-points")
                if (Array.isArray(res.data)) {
                    setServicePoints(res.data.filter((sp: ServicePoint) => sp.isActive))
                }
            } catch (err) {
                console.error("Failed to load take-order page:", err)
                toast.error("Failed to load service points")
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [user, authLoading])

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-6">
                <div className="max-w-sm">
                    <h1 className="text-xl font-black text-foreground mb-2">Waiter-Assisted Ordering Disabled</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        Waiter-assisted ordering is disabled for this business. Please contact the owner to enable it.
                    </p>
                    <button
                        onClick={() => router.push("/waitstaff")}
                        className="px-5 py-2.5 bg-[var(--brand-primary,var(--color-primary))] hover:opacity-90 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    const filtered = servicePoints.filter(sp => 
        sp.label.toLowerCase().includes(search.toLowerCase()) || 
        sp.servicePointId.toLowerCase().includes(search.toLowerCase()) ||
        sp.code?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-background text-foreground pb-20 md:pb-6">
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/waitstaff")}
                            className="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-foreground" />
                        </button>
                        <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                            Take Order
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">
                <div className="mb-6">
                    <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Select Service Point</h2>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Search service point..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filtered.map(sp => (
                        <button
                            key={sp._id}
                            onClick={() => router.push(`/waitstaff/take-order/${sp.servicePointId}`)}
                            className="flex flex-col items-center justify-center gap-3 p-6 bg-card hover:bg-secondary border border-border rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-sm group"
                        >
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-foreground">{sp.label}</p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{sp.code || sp.servicePointId}</p>
                            </div>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                            No service points has bee created at this time
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
