"use client"

import { useRouter } from "next/navigation"
import { QrCode, Sparkles, ArrowRight } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-lg w-full text-center relative z-10">
        {/* Logo with animation */}
        <div className="flex items-center justify-center gap-4 mb-8 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#EA601A] to-[#ff8c42] rounded-3xl blur-xl opacity-30 animate-pulse" />
            <img
              src="/chillow-mark.png"
              alt="Chillow"
              className="w-24 h-24 rounded-3xl shadow-2xl object-contain relative z-10 ring-4 ring-white/10"
            />
          </div>
        </div>

        {/* Title with gradient */}
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <h1 className="text-5xl sm:text-6xl font-black mb-3 tracking-tight">
            <span className="text-[#2B304C] dark:text-white">Chillow</span>
          </h1>
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="w-4 h-4 text-[#EA601A]" />
            <span>The Connected Hospitality Ecosystem</span>
            <Sparkles className="w-4 h-4 text-[#EA601A]" />
          </div>
        </div>

        {/* Description with better spacing */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <p className="text-lg text-foreground/80 mb-3 leading-relaxed font-medium">
            Scan your table's QR code to browse our menu and place your order instantly
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <QrCode className="w-4 h-4" />
            <span>No app download required</span>
          </div>
        </div>

        {/* Enhanced Test Links Section */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl blur-xl" />
            <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-xl">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center justify-center gap-2">
                <span className="w-8 h-px bg-border" />
                Chillow Demo Access
                <span className="w-8 h-px bg-border" />
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => router.push("/s/table-1")}
                  className="group w-full bg-gradient-to-r from-[#EA601A] to-[#ff8c42] hover:from-[#ff8c42] hover:to-[#EA601A] text-white rounded-xl py-4 px-6 font-bold transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-[#EA601A]/20 flex items-center justify-between"
                >
                  <span>Table 1</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => router.push("/s/table-2")}
                  className="group w-full bg-gradient-to-r from-[#2B304C] to-[#404968] hover:from-[#404968] hover:to-[#2B304C] text-white rounded-xl py-4 px-6 font-bold transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-[#2B304C]/20 flex items-center justify-between"
                >
                  <span>Table 2</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                These demo tables showcase the full ordering experience
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
