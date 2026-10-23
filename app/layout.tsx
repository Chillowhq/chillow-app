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
  title: "QuickServe - QR Menu",
  description: "Modern restaurant QR-code ordering experience",
  generator: "",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
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
