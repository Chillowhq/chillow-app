"use client"

import { useParams } from "next/navigation"
import TableMenuView from "@/components/table-menu-view"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { CustomerThemeProvider } from "@/components/providers/customer-theme-provider"

export default function WaiterTakeOrderMenuPage() {
    const params = useParams()
    const servicePointId = params.servicePointId as string

    // Ensure the waiter is authenticated
    const { user, loading } = useAuthGuard({ requiredRole: "waiter" })

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        // Pass businessId directly so CustomerThemeProvider doesn't have to guess from sessionStorage
        <CustomerThemeProvider businessId={user.businessId}>
            <TableMenuView
                businessId={user.businessId}
                servicePointId={servicePointId}
                isWaiterMode={true}
            />
        </CustomerThemeProvider>
    )
}
