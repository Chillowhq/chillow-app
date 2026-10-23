"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { X, Camera, AlertCircle, RefreshCcw } from "lucide-react"
import { CameraLoadingOverlaySkeleton } from "@/components/customer-loading-skeletons"

export default function ScanPage() {
  const router = useRouter()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [status, setStatus] = useState<"loading" | "scanning" | "error" | "scanned">("loading")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let isMounted = true

    const initializeScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        })
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              handleScanSuccess(decodedText, html5QrCode)
            }
          },
          () => {
            // we ignore background scan errors as they just mean "no QR found yet"
          }
        )
        
        if (isMounted) {
          setStatus("scanning")
        }
      } catch (err: any) {
        console.error("Error starting scanner", err)
        if (isMounted) {
          setStatus("error")
          setErrorMessage(err?.message || "Could not access the camera. Please check your permissions.")
        }
      }
    }

    initializeScanner()

    return () => {
      isMounted = false
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const handleScanSuccess = async (decodedText: string, scanner: Html5Qrcode) => {
    setStatus("scanned")
    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
    } catch (e) {
      console.error("Failed to stop scanner", e)
    }

    // Try to parse URL and redirect
    try {
      // Validate string is a URL
      const url = new URL(decodedText)
      window.location.href = url.toString()
    } catch {
      // If it's not a valid full URL, attempt router.push just in case it's a relative path,
      // or fallback to letting them know it was invalid.
      if (decodedText.startsWith("/")) {
        router.push(decodedText)
      } else {
        setStatus("error")
        setErrorMessage("Scanned QR code is not a valid URL")
      }
    }
  }

  const handleRetry = () => {
    setStatus("loading")
    setErrorMessage("")
    // Need to trigger a full re-render/remount of the scanner because camera APIs 
    // can be finicky when recovering from failures
    window.location.reload()
  }

  // Determine what to display based on status
  return (
    <main className="h-[100dvh] w-full bg-black relative flex flex-col pt-safe px-0 m-0 overflow-hidden text-white font-sans">
      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all active:scale-95"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="text-sm font-bold tracking-wider text-white/90 drop-shadow-md flex items-center gap-2">
          <Camera className="w-4 h-4" />
          SCAN TABLE
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      <div className="flex-1 flex flex-col relative">
        { /* The div where html5-qrcode mounts its video element */ }
        <div 
          id="qr-reader" 
          className="absolute inset-0 w-full h-full object-cover z-0 [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
        />

        {/* Custom UI Overlays */}
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
          
          {status === "loading" && (
            <CameraLoadingOverlaySkeleton />
          )}

          {status === "error" && (
            <div className="bg-black/95 inset-0 absolute flex flex-col items-center justify-center p-6 text-center backdrop-blur-md z-20 pointer-events-auto">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Camera Unavailable</h2>
              <p className="text-white/60 text-sm mb-8 max-w-xs leading-relaxed">
                {errorMessage}
              </p>
              <button 
                onClick={handleRetry}
                className="flex items-center gap-2 px-6 py-3.5 bg-white text-black font-bold rounded-2xl hover:bg-white/90 transition-all active:scale-95"
              >
                <RefreshCcw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {status === "scanning" && (
            <>
              {/* Dimmed outer background to create a focus frame effect */}
              <div className="absolute inset-0 border-[rgba(0,0,0,0.5)] border-[50px] sm:border-[100px]" />
              
              {/* Scanning frame corner markers */}
              <div className="relative w-[250px] h-[250px] flex items-center justify-center">
                {/* Top left */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                {/* Top right */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                {/* Bottom left */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                {/* Bottom right */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
              </div>

              {/* Guidance Text */}
              <div className="absolute bottom-20 px-6 py-3 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10">
                <p className="text-sm font-semibold text-white/90">Point your camera at the table QR code</p>
              </div>
            </>
          )}

          {status === "scanned" && (
            <div className="bg-black/80 inset-0 absolute flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(var(--primary),0.5)]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <p className="font-bold text-white text-lg tracking-wide">QR Code Found!</p>
              <p className="text-white/60 text-sm mt-1">Opening your table...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
