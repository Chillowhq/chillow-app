"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { AlertCircle, Copy, Download, Loader2, Printer, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export interface QrCodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The value to encode in the QR code (e.g. a full URL) */
  value: string
  /** Modal title (e.g. business name) */
  title: string
  /** Modal description (e.g. "Scan to visit...") */
  description: string
  /** Download filename (without extension, e.g. "jules-corner-business-qr") */
  downloadFileName: string
  /** Optional sanitized URL string to display below the QR code. */
  displayUrl?: string
  /** Optional explanation for a sanitized display URL. */
  displayUrlHint?: string
  /** Optional explicit action for copying the full encoded QR value. */
  copyValueLabel?: string
  /** Optional: If provided, shows a "Generate Poster" button linking to this URL */
  posterUrl?: string
  loading?: boolean
  error?: string | null
  regenerating?: boolean
  onRegenerate?: () => void
}

export function QrCodeModal({
  open,
  onOpenChange,
  value,
  title,
  description,
  downloadFileName,
  displayUrl,
  displayUrlHint,
  copyValueLabel,
  posterUrl,
  loading = false,
  error = null,
  regenerating = false,
  onRegenerate,
}: QrCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("")

  useEffect(() => {
    if (open && value) {
      QRCode.toDataURL(value, {
        width: 1000,
        margin: 2,
        color: {
          dark: "#2B304C",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code generation error", err))
    } else {
      setQrDataUrl("")
    }
  }, [open, value])

  const handleDownload = () => {
    if (!qrDataUrl) return

    const a = document.createElement("a")
    a.href = qrDataUrl
    a.download = `${downloadFileName}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success("QR Code downloaded successfully")
  }

  const handleCopyValue = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Secure QR link copied. Treat it like the printed QR code.")
    } catch {
      toast.error("Secure QR link could not be copied.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs flex flex-col items-center p-4 sm:p-5 gap-2.5 overflow-hidden">
        <DialogHeader className="w-full text-center">
          <DialogTitle className="text-lg font-black text-center">{title}</DialogTitle>
          <DialogDescription className="text-center font-medium text-xs mt-0.5">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-1.5 p-2 bg-white rounded-2xl shadow-md border border-border inline-block flex-shrink-0">
          {qrDataUrl && !loading ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${title}`}
              className="rounded-lg w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] object-contain"
            />
          ) : (
            <div className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] flex items-center justify-center">
              {error ? (
                <AlertCircle className="w-7 h-7 text-destructive" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-center text-xs font-semibold text-destructive">
            {error}
          </p>
        ) : null}

        {displayUrl ? (
          <div className="w-full space-y-1.5">
            <div className="bg-secondary/50 p-2 rounded-lg font-mono text-[10px] text-muted-foreground text-center break-all">
              {displayUrl}
            </div>
            {displayUrlHint ? (
              <p className="text-center text-[10px] font-medium leading-relaxed text-muted-foreground">
                {displayUrlHint}
              </p>
            ) : null}
          </div>
        ) : null}

        {copyValueLabel ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopyValue()}
            disabled={!value || loading || regenerating}
            className="h-9 w-full gap-1.5 rounded-lg text-xs font-bold"
          >
            <Copy className="w-3.5 h-3.5" />
            {copyValueLabel}
          </Button>
        ) : null}

        <div className="flex w-full gap-2 mt-1">
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={!qrDataUrl || loading || regenerating}
            className="flex-1 gap-1 rounded-lg h-9 font-bold text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Save PNG
          </Button>
          {posterUrl ? (
            <Button
              onClick={() => window.open(posterUrl, "_blank")}
              disabled={!qrDataUrl || loading || regenerating}
              className="flex-[1.5] gap-1 rounded-lg h-9 font-bold text-xs shadow-md shadow-primary/20"
            >
              <Printer className="w-3.5 h-3.5" />
              Generate Poster
            </Button>
          ) : null}
        </div>
        {onRegenerate ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onRegenerate}
            disabled={loading || regenerating}
            className="h-8 gap-1.5 text-xs font-bold text-destructive hover:text-destructive"
          >
            {regenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Regenerate QR
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
