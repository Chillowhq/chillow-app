"use client"

import { ReactNode } from "react"
import MenuButton from "@/components/menu-button"
import OrderEtaWidget from "@/components/order-eta-widget"
import { CustomerGuestRealtimeProvider } from "@/components/providers/customer-guest-realtime-provider"
import { CustomerThemeProvider } from "@/components/providers/customer-theme-provider"

export default function TableLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerThemeProvider>
      <CustomerGuestRealtimeProvider>
        {children}
        <OrderEtaWidget />
        <MenuButton />
      </CustomerGuestRealtimeProvider>
    </CustomerThemeProvider>
  )
}
