"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { ChefHat, Smartphone, UtensilsCrossed, CheckCircle2 } from "lucide-react"

interface QRPosterProps {
  businessName: string
  businessLogo?: string
  servicePointLabel: string
  servicePointCode?: string
  qrValue: string
}

export default function QRPoster({
  businessName,
  businessLogo,
  servicePointLabel,
  servicePointCode,
  qrValue,
}: QRPosterProps) {
  const [qrDataUrl, setQrDataUrl] = useState("")

  useEffect(() => {
    if (!qrValue) return
    QRCode.toDataURL(qrValue, {
      width: 1000,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(console.error)
  }, [qrValue])

  const displayLabel = servicePointLabel || servicePointCode || "Service Point"
  const displayBusinessName = businessName?.trim() || "Chillow"

  return (
    <div className="w-full max-w-[800px] mx-auto bg-white overflow-hidden shadow-2xl print:shadow-none print:max-w-[210mm] print:w-full print:min-h-[297mm]">
      {/* Top Section - Dark Header */}
      <div className="bg-[#0A0A0A] text-white pt-12 pb-24 px-8 text-center rounded-b-[3rem] relative z-0">
        
        {/* Subtle patterned background mock using standard Tailwind classes (optional but adds to the look) */}
        <div className="absolute inset-0 opacity-[0.03] overflow-hidden pointer-events-none rounded-b-[4rem]" style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.83-1.66 1.66-.83-.83.83-.83zM27.83 51.56l-1.66 1.66-.83-.83 1.66-1.66.83.83zM0 32.748l.83.83-1.66 1.66-.83-.83.83-.83z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center justify-center gap-3 mb-10">
            {businessLogo ? (
              <img src={businessLogo} alt={displayBusinessName} className="w-10 h-10 rounded-lg object-contain" />
            ) : (
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-primary-foreground" />
              </div>
            )}
            <h1 className="text-2xl font-black tracking-tight">{displayBusinessName}</h1>
          </div>

          <p className="text-xl font-bold uppercase tracking-widest text-primary mb-2">Scan To</p>
          <h2 className="text-5xl sm:text-6xl font-black tracking-tighter uppercase text-white mb-6">
            View Menu
          </h2>

          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-16 h-1 bg-primary rounded-full"></div>
            <div className="w-3 h-3 bg-primary rounded-full"></div>
            <div className="w-16 h-1 bg-primary rounded-full"></div>
          </div>

          <p className="text-base text-white/80 max-w-md mx-auto font-medium leading-relaxed">
            Browse our menu, place your order, and enjoy a seamless dining experience.
          </p>
        </div>
      </div>

      {/* Middle Section - QR & Table Code */}
      <div className="relative z-10 -mt-16 px-8 flex flex-col items-center pb-8 border-b border-border/50">
        <div className="bg-white p-4 rounded-[1.5rem] shadow-xl border border-gray-100 flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-[240px] h-[240px] object-contain rounded-xl" />
          ) : (
            <div className="w-[240px] h-[240px] bg-slate-50 animate-pulse rounded-xl" />
          )}
        </div>

        <div className="mt-8 text-center w-full max-w-sm">
        
          <div className="flex items-center justify-center gap-6">
            <div className="flex-1 h-1 bg-primary/20 rounded-full"></div>
            <h3 className="text-5xl font-black text-primary tracking-tighter">{displayLabel}</h3>
            <div className="flex-1 h-1 bg-primary/20 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* How To Use Section */}
      <div className="px-8 py-8 flex-1 flex flex-col justify-center">
        <h4 className="text-center text-lg font-black uppercase tracking-widest text-foreground mb-6">How To Use</h4>
        <div className="flex items-start justify-between gap-4 max-w-2xl mx-auto">
          {/* Step 1 */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#111] text-primary flex items-center justify-center mb-3 shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <h5 className="font-black text-xs uppercase tracking-wider mb-1">1. Scan</h5>
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed px-1">
              Open your phone camera and scan the QR code.
            </p>
          </div>
          
          <div className="w-px h-16 bg-border hidden sm:block mt-6"></div>

          {/* Step 2 */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#111] text-primary flex items-center justify-center mb-3 shadow-md">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h5 className="font-black text-xs uppercase tracking-wider mb-1">2. Browse</h5>
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed px-1">
              Explore our menu and add items to your cart.
            </p>
          </div>

          <div className="w-px h-16 bg-border hidden sm:block mt-6"></div>

          {/* Step 3 */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#111] text-primary flex items-center justify-center mb-3 shadow-md">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h5 className="font-black text-xs uppercase tracking-wider mb-1">3. Order</h5>
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed px-1">
              Place your order and we'll serve it fresh.
            </p>
          </div>
        </div>

        {/* Action Panel */}
       
      </div>

      {/* Footer */}
      <div className="bg-[#0A0A0A] text-white/50 text-[10px] uppercase tracking-widest font-bold py-4 px-8 flex items-center justify-center">
        <span>Powered by Chillow</span>
      </div>
    </div>
  )
}
