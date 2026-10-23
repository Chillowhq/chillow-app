"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { apiClient } from "@/lib/axios-config"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import QRPoster from "@/components/print/QRPoster"
import { Loader2, Printer, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { getCanonicalFrontendOrigin } from "@/lib/frontend-origin"
import { buildServicePointQrUrl } from "@/lib/qr-capability"

export default function PrintPosterPage() {
  const { id } = useParams()
  const { user } = useAuthGuard({
    requiredPermission: MANAGER_PERMISSIONS.SERVICE_POINTS_MANAGE,
  })
  const [servicePoint, setServicePoint] = useState<any>(null)
  const [businessSettings, setBusinessSettings] = useState<any>(null)
  const [qrUrl, setQrUrl] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !id) return

    const fetchData = async () => {
      try {
        setIsLoading(true)
        const servicePointId = Array.isArray(id) ? id[0] : String(id)
        const [spRes, settingsRes, capabilityRes] = await Promise.all([
          apiClient.get(`/owner/service-points/${encodeURIComponent(servicePointId)}`),
          apiClient.get(`/business/settings?businessId=${user.businessId}`),
          apiClient.get(
            `/owner/service-points/${encodeURIComponent(servicePointId)}/qr-capability`,
          ),
        ])

        if (!spRes.data || !capabilityRes.data?.capability) {
          setError("Service point not found")
        } else {
          setServicePoint(spRes.data)
          setBusinessSettings(settingsRes.data)
          setQrUrl(
            buildServicePointQrUrl(
              getCanonicalFrontendOrigin(),
              user.businessId,
              spRes.data.servicePointId,
              capabilityRes.data.capability,
            ),
          )
        }
      } catch (error: any) {
        console.error("Failed to load secure print data", {
          status: error?.response?.status || null,
        })
        setError("Failed to load data for printing.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, id])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 flex-col gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-black tracking-widest uppercase text-sm">Preparing Poster...</p>
      </div>
    )
  }

  if (error || !servicePoint || !qrUrl) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 flex-col gap-4">
        <p className="text-red-500 font-bold">{error}</p>
        <Button variant="outline" onClick={() => window.close()}>Close Tab</Button>
      </div>
    )
  }

  const businessName =
    [businessSettings?.displayName, businessSettings?.businessName, businessSettings?.name]
      .find((name) => typeof name === "string" && name.trim()) || "QuickServe"

  return (
    <div className="min-h-screen bg-gray-100/50 flex flex-col items-center py-10 print:bg-white select-none">
      
      {/* Action Bar (Hidden in Print) */}
      <div className="flex items-center justify-between w-full max-w-[800px] mb-8 px-4 print:hidden">
        <Button variant="outline" onClick={() => window.close()} className="font-bold rounded-xl gap-2 shadow-sm bg-white">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
        <Button onClick={() => window.print()} className="font-bold rounded-xl gap-2 shadow-lg shadow-primary/20 px-8 text-md bg-primary text-primary-foreground">
          <Printer className="w-5 h-5" /> Print Poster
        </Button>
      </div>

      {/* A4 Wrapper to fix printing sizing */}
      <div id="print-root" className="w-full max-w-[800px] px-4 sm:px-0">
        <QRPoster 
          businessName={businessName}
          businessLogo={businessSettings?.logoUrl || ""}
          servicePointLabel={servicePoint.label}
          servicePointCode={servicePoint.code}
          qrValue={qrUrl}
        />
      </div>

      <style jsx global>{`
        @media print {
          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          /* Hide everything except the print-root container */
          body * {
            visibility: hidden;
          }
          #print-root, #print-root * {
            visibility: visible;
          }
          #print-root {
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            width: 100% !important;
            max-width: 210mm !important;
            height: auto !important;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  )
}
