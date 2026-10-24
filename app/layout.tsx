import type React from "react"
import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

const productSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-product-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Chillow — The Connected Hospitality Ecosystem",
    template: "%s | Chillow",
  },
  description: "Chillow connects guests and hospitality businesses through discovery, reservations, digital menus, ordering, payments, and operations.",
  applicationName: "Chillow",
  openGraph: {
    title: "Chillow — The Connected Hospitality Ecosystem",
    description: "Make hospitality easier to receive and easier to deliver.",
    siteName: "Chillow",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Chillow — The Connected Hospitality Ecosystem",
    description: "Make hospitality easier to receive and easier to deliver.",
  },
  generator: "",
  icons: {
    icon: "/chillow-mark.png",
    apple: "/chillow-mark.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${productSans.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  )
}
