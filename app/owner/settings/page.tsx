"use client"

import { useState, useEffect, useRef } from "react"
import {
  Building2,
  Settings,
  Store,
  Clock,
  DollarSign,
  ShoppingBag,
  CreditCard,
  QrCode,
  Bell,
  Save,
  Image as ImageIcon,
  Loader2,
  Globe,
  Upload,
  ExternalLink,
  CheckCircle2,
  Users,
  Lock,
  ChevronDown,
  Check,
  UtensilsCrossed
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { apiClient, SESSION_REVOKED_EVENT } from "@/lib/axios-config"
import { getCanonicalFrontendOrigin } from "@/lib/frontend-origin"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { hasManagementArea, MANAGEMENT_ACCESS_AREAS, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { Input } from "@/components/ui/input"
import { useSetupProgress } from "@/contexts/SetupProgressContext"
import { useServicePointTerm } from "@/contexts/BusinessContext"
import { PASSWORD_POLICY_MESSAGE, validateNewPassword } from "@/lib/password-policy"
import { QrCodeModal } from "@/components/owner/QrCodeModal"
import { toast } from "sonner"
import { PropertyProfileSettings } from "@/components/property-profile/PropertyProfileSettings"

type SettingsTab = "business" | "property-profile" | "operations" | "preferences" | "team" | "security"

const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"))
const TIME_PERIODS = ["AM", "PM"] as const

type TimePeriod = typeof TIME_PERIODS[number]

function parseTimeValue(value?: string) {
  const [rawHour = "09", rawMinute = "00"] = (value || "09:00").split(":")
  const hour24 = Math.min(23, Math.max(0, Number(rawHour) || 0))
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0))
  const period: TimePeriod = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 || 12

  return {
    hour: String(hour12).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    period,
  }
}

function toTimeValue(hour: string, minute: string, period: TimePeriod) {
  let hour24 = Number(hour)

  if (period === "PM" && hour24 !== 12) hour24 += 12
  if (period === "AM" && hour24 === 12) hour24 = 0

  return `${String(hour24).padStart(2, "0")}:${minute}`
}

function formatTimeLabel(value?: string) {
  const parsed = parseTimeValue(value)
  return `${parsed.hour}:${parsed.minute} ${parsed.period}`
}

function TimeColumn({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: readonly string[]
  value: string
  onSelect: (value: string) => void
}) {
  return (
    <div>
      <div className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
        {options.map((option) => {
          const isSelected = option === value

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`relative flex h-9 w-full items-center justify-center rounded-lg text-sm font-bold transition-colors ${isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-secondary"
                }`}
            >
              {isSelected && <Check className="absolute left-2 h-3.5 w-3.5" />}
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModernTimePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const parsed = parseTimeValue(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex h-11 w-[150px] items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left font-bold text-foreground shadow-sm transition-all hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 data-[state=open]:border-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary/20"
        >
          <span>{formatTimeLabel(value)}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[286px] rounded-2xl border border-border bg-card p-3 shadow-2xl"
      >
        <div className="grid grid-cols-[1fr_1fr_0.85fr] gap-2">
          <TimeColumn
            label="Hour"
            options={TIME_HOURS}
            value={parsed.hour}
            onSelect={(hour) => onChange(toTimeValue(hour, parsed.minute, parsed.period))}
          />
          <TimeColumn
            label="Minute"
            options={TIME_MINUTES}
            value={parsed.minute}
            onSelect={(minute) => onChange(toTimeValue(parsed.hour, minute, parsed.period))}
          />
          <TimeColumn
            label="Period"
            options={TIME_PERIODS}
            value={parsed.period}
            onSelect={(period) => onChange(toTimeValue(parsed.hour, parsed.minute, period as TimePeriod))}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: typeof Store }> = [
  { id: "business", label: "Business Info", icon: Store },
  { id: "property-profile", label: "Property Profile", icon: Building2 },
  { id: "operations", label: "Operations", icon: Clock },
  { id: "preferences", label: "Preferences", icon: Settings },
  { id: "team", label: "Team & Access", icon: Users },
  { id: "security", label: "Security", icon: Lock as any },
]

const SETTINGS_MANAGEMENT_ROLES = ["owner", "co_owner", "manager"]

export default function SettingsPage() {
  const { user, refreshUser } = useAuthGuard({
    allowedRoles: SETTINGS_MANAGEMENT_ROLES,
    requiredPermission: MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE,
  })
  const { refreshSetupProgress } = useSetupProgress()
  const businessId = user?.businessId
  const isManager = user?.role === "manager"
  const canManageBranding = hasManagementArea(user, MANAGEMENT_ACCESS_AREAS.BRANDING)
  const term = useServicePointTerm()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>("business")
  const [propertyProfileMounted, setPropertyProfileMounted] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // QR Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrModalData, setQrModalData] = useState<{
    value: string
    title: string
    description: string
    downloadFileName: string
    displayUrl: string
  } | null>(null)

  // Security State
  const [securityData, setSecurityData] = useState({
    currentPasswordForEmail: "",
    newEmail: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [emailVerificationSent, setEmailVerificationSent] = useState(false)


  // State for Section A: Business Info
  const [profile, setProfile] = useState({
    name: "",
    displayName: "",
    slug: "",
    address: "",
    phoneNumber: "",
    contactEmail: "",
    currency: "",
    timezone: "",
    logoUrl: "",
    plan: "",
    businessType: "",
    taxRate: 0,
    countryCode: ""
  })

  // State for Section B: Operating Hours
  // The backend uses an object with keys (Monday, Tuesday, etc.)
  // The frontend uses an array for rendering. I'll need to convert between them.
  const [hours, setHours] = useState<any[]>([])
  const [hotelSettings, setHotelSettings] = useState({
    checkInTime: "15:00",
    checkOutTime: "11:00",
    onlineBookingConfirmationMode: "instant" as "instant" | "confirmation_required",
  })
  const [foodServiceEnabled, setFoodServiceEnabled] = useState(false)
  const [savedFoodServiceEnabled, setSavedFoodServiceEnabled] = useState(false)

  // State for Section C: Ordering Preferences
  const [ordering, setOrdering] = useState<{
    dineIn: boolean | null
    takeout: boolean | null
    serviceRequest: boolean | null
    orderStartAssistanceDelayMinutes: number
    hideOutOfStock: boolean | null
    qrOrdering: boolean | null
    enableWaiterOrdering: boolean | null
    reservationsEnabled: boolean | null

  }>({
    dineIn: null,
    takeout: null,
    serviceRequest: null,
    orderStartAssistanceDelayMinutes: 10,
    hideOutOfStock: null,
    qrOrdering: null,
    enableWaiterOrdering: null,
    reservationsEnabled: null,

  })

  // State for Section D: Payment Preferences
  const [payments, setPayments] = useState({
    onlinePayments: true,
    offlinePayments: true,
    acceptCash: true,
    acceptPosCard: true,
    showStatusToWaiter: true,
    receiptEmail: ""
  })

  const [tipsEnabled, setTipsEnabled] = useState(false)

  // State for Section E: Table & QR Preferences (Local for now)
  const [tablePrefs, setTablePrefs] = useState({
    sessionExpiry: "120", // minutes
    requireVerification: false,
    qrEnabled: true,
    maxSessions: "5"
  })

  useEffect(() => {
    if (businessId) {
      fetchSettings()
    }
  }, [businessId])

  const fetchSettings = async () => {
    try {
      if (!businessId) return
      setIsLoading(true)
      const res = await apiClient.get(`/business/settings?businessId=${businessId}`)
      const data = res.data

      setProfile({
        name: data.name || "",
        displayName: data.displayName || "",
        slug: data.slug || "",
        address: data.address || "",
        phoneNumber: data.phoneNumber || "",
        contactEmail: data.contactEmail || "",
        currency: data.currency || "USD",
        timezone: data.timezone || "America/New_York",
        logoUrl: data.logoUrl || "",
        plan: data.plan || "starter",
        businessType: data.businessType || "restaurant",
        taxRate: data.taxRate || 0,
        countryCode: data.countryCode || "mt"
      })

      // Convert backend object to frontend array
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      const hoursArray = days.map(day => ({
        day,
        open: data.operatingHours?.[day]?.enabled ?? true,
        start: data.operatingHours?.[day]?.openTime || "09:00",
        end: data.operatingHours?.[day]?.closeTime || "22:00"
      }))
      setHours(hoursArray)
      setHotelSettings({
        checkInTime: data.hotelSettings?.checkInTime || "15:00",
        checkOutTime: data.hotelSettings?.checkOutTime || "11:00",
        onlineBookingConfirmationMode: data.hotelSettings?.onlineBookingConfirmationMode ?? "instant",
      })
      const isFoodServiceEnabled = data.modules?.includes("foodService")
        ?? data.capabilities?.visibleModules?.includes("foodService")
        ?? user?.capabilities?.visibleModules?.includes("foodService")
        ?? false
      setFoodServiceEnabled(isFoodServiceEnabled)
      setSavedFoodServiceEnabled(isFoodServiceEnabled)

      // Map ordering preferences from real API response
      const prefs = data.orderingPreferences
      setOrdering(prev => ({
        ...prev,
        dineIn: prefs?.dineInEnabled ?? true,
        takeout: prefs?.takeoutEnabled ?? false,
        serviceRequest: prefs?.callWaiterEnabled ?? true,
        orderStartAssistanceDelayMinutes: Number.isInteger(prefs?.orderStartAssistanceDelayMinutes)
          ? prefs.orderStartAssistanceDelayMinutes
          : 10,
        hideOutOfStock: prefs?.hideOutOfStockItems ?? false,
        qrOrdering: prefs?.qrOrderingEnabled ?? true,
        enableWaiterOrdering: prefs?.enableWaiterOrdering ?? true,
        reservationsEnabled: data.settings?.reservationsEnabled ?? true,
      }))
      setTipsEnabled(data.settings?.tipsEnabled ?? data.tipsEnabled ?? false)

      // Map payment preferences from real API response
      const pPrefs = data.paymentPreferences
      setPayments(prev => ({
        ...prev,
        onlinePayments: pPrefs?.acceptOnlinePayments ?? true,
        offlinePayments: pPrefs?.acceptOfflinePayments ?? true,
        acceptCash: pPrefs?.acceptCash ?? true,
        acceptPosCard: pPrefs?.acceptPosCard ?? true,
      }))

      // Map table preferences from real API response
      const tPrefs = data.tablePreferences
      setTablePrefs(prev => ({
        ...prev,
        sessionExpiry: tPrefs?.sessionExpiryMinutes?.toString() || "120",
        maxSessions: tPrefs?.maxActiveSessionsPerTable?.toString() || "5"
      }))

    } catch (err) {
      console.error("Failed to fetch settings", err)
      toast.error("Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!securityData.newEmail || !securityData.currentPasswordForEmail) {
      toast.error("Please fill in all fields")
      return
    }
    try {
      setIsUpdatingEmail(true)
      await apiClient.post("/auth/request-email-change", {
        newEmail: securityData.newEmail,
        currentPassword: securityData.currentPasswordForEmail
      })
      setEmailVerificationSent(true)
      setSecurityData(prev => ({ ...prev, currentPasswordForEmail: "", newEmail: "" }))
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send verification email")
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!securityData.currentPassword || !securityData.newPassword || !securityData.confirmPassword) {
      toast.error("Please fill in all fields")
      return
    }
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (!validateNewPassword(securityData.newPassword).valid) {
      toast.error(PASSWORD_POLICY_MESSAGE)
      return
    }
    if (isUpdatingPassword) return
    try {
      setIsUpdatingPassword(true)
      const response = await apiClient.post("/auth/change-password", {
        currentPassword: securityData.currentPassword,
        newPassword: securityData.newPassword
      })
      toast.success("Password changed successfully")
      setSecurityData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }))
      if (response.data?.reauthenticationRequired) {
        window.dispatchEvent(new Event(SESSION_REVOKED_EVENT))
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to change password")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      // 1. Save owner-only identity/profile fields.
      if (!isManager) {
        await apiClient.patch("/business/settings", {
          businessId,
          ...profile,
          hotelSettings
        })
      }

      const didChangeFoodService = isHotel && foodServiceEnabled !== savedFoodServiceEnabled

      // 2. Save Operating Hours
      const hoursObject = hours.reduce((acc, curr) => {
        acc[curr.day] = {
          enabled: curr.open,
          openTime: curr.start,
          closeTime: curr.end
        }
        return acc
      }, {})

      await apiClient.patch("/business/operating-hours", {
        businessId,
        operatingHours: hoursObject
      })

      if (hasFoodService) {
        // 3. Save Ordering & Settings
        await apiClient.patch("/business/settings/ordering-preferences", {
          businessId,
          orderingPreferences: {
            dineInEnabled: ordering.dineIn,
            takeoutEnabled: ordering.takeout,
            callWaiterEnabled: ordering.serviceRequest,
            orderStartAssistanceDelayMinutes: ordering.orderStartAssistanceDelayMinutes,
            hideOutOfStockItems: ordering.hideOutOfStock,
            qrOrderingEnabled: ordering.qrOrdering,
            enableWaiterOrdering: ordering.enableWaiterOrdering,
          },
          settings: {
            reservationsEnabled: ordering.reservationsEnabled,
            tipsEnabled
          }
        })

        // 4. Save Payment Preferences
        if (!payments.onlinePayments && !payments.offlinePayments) {
          toast.error("You must enable at least one payment channel (Online or Offline)")
          setIsSaving(false)
          return
        }

        if (payments.offlinePayments && !payments.acceptCash && !payments.acceptPosCard) {
          toast.error("When Offline Payments are enabled, you must accept at least one method (Cash or POS Card)")
          setIsSaving(false)
          return
        }

        await apiClient.patch("/business/settings/payment-preferences", {
          businessId,
          paymentPreferences: {
            acceptOnlinePayments: payments.onlinePayments,
            acceptOfflinePayments: payments.offlinePayments,
            acceptCash: payments.acceptCash,
            acceptPosCard: payments.acceptPosCard,
          },
        })

        // 5. Save Table Preferences
        await apiClient.patch("/business/settings/table-preferences", {
          businessId,
          tablePreferences: {
            sessionExpiryMinutes: Number(tablePrefs.sessionExpiry) || 120,
            maxActiveSessionsPerTable: Number(tablePrefs.maxSessions) || 5
          }
        })
      }

      if (!isManager && didChangeFoodService) {
        await apiClient.patch("/business/settings/modules", {
          foodServiceEnabled,
        })
        setSavedFoodServiceEnabled(foodServiceEnabled)
      }

      await refreshUser()
      if (!isManager) await refreshSetupProgress()
      toast.success("Settings saved successfully!")
    } catch (err: any) {
      console.error("Save error:", err)
      const msg = err.response?.data?.message || "Failed to save settings"
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !businessId || !canManageBranding) return

    const form = new FormData()
    form.append("image", file)
    form.append("businessId", businessId)

    try {
      setIsUploadingLogo(true)
      const res = await apiClient.post("/upload/business-logo", form, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      setProfile(prev => ({ ...prev, logoUrl: res.data.logoUrl }))
      toast.success("Logo uploaded successfully!")
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Logo upload failed")
    } finally {
      setIsUploadingLogo(false)
      // Reset input so same file can be re-selected
      if (logoInputRef.current) logoInputRef.current.value = ""
    }
  }

  // Helper for Toggle Switches
  const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean, onChange: () => void, label?: string }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${checked ? "bg-green-500" : "bg-muted"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  )

  const capabilitySections = user?.capabilities?.settings.sections
  const hasLodging = capabilitySections?.includes("lodging") || false
  const hasHotelPropertyProfile = user?.capabilities
    ? user.capabilities.identity.shell === "hotel"
      && (capabilitySections?.includes("propertyProfile") || user.capabilities.visibleModules.includes("lodging"))
    : profile.businessType === "hotel"
  const isHotel = hasHotelPropertyProfile

  const hasBusinessProfile = user?.capabilities
    ? ["hotel", "restaurant", "bar_lounge"].includes(user.capabilities.identity.shell)
    : ["hotel", "restaurant", "bar_lounge"].includes(profile.businessType || "")

  const hasFoodService = isHotel
    ? foodServiceEnabled
    : (capabilitySections ? capabilitySections.includes("foodService") : true)
  const visibleSettingsTabs = settingsTabs.filter((tab) => {
    if (isManager && !["operations", "preferences"].includes(tab.id)) return false
    if (tab.id === "property-profile") return hasBusinessProfile && !isManager
    return true
  }).map(tab => {
    if (tab.id === "property-profile") {
      return {
        ...tab,
        label: isHotel ? "Property Profile" : "Business Profile",
        icon: isHotel ? Building2 : Store
      }
    }
    return tab
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const requestedTab = new URLSearchParams(window.location.search).get("tab")
    if (requestedTab === "property-profile" && hasBusinessProfile && !isManager) {
      setPropertyProfileMounted(true)
      setActiveTab("property-profile")
    }
  }, [hasBusinessProfile, isManager])

  const selectTab = (tab: SettingsTab) => {
    if (tab === "property-profile") setPropertyProfileMounted(true)
    setActiveTab(tab)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (tab === "property-profile") url.searchParams.set("tab", "property-profile")
    else url.searchParams.delete("tab")
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    if (isManager && !["operations", "preferences"].includes(activeTab)) {
      setActiveTab("operations")
    }
  }, [activeTab, isManager])

  return (
    <div className="pb-20">
      <header className="sticky top-0 lg:top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your business information, operations and preferences.
            </p>
          </div>
          {activeTab !== "property-profile" && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold gap-2"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </Button>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading business settings...</p>
        </div>
      ) : (
        <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2 border-b border-border pb-3" role="tablist" aria-label="Settings sections">
              {visibleSettingsTabs.map((tab) => {
                const Icon = tab.icon

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-colors whitespace-nowrap ${activeTab === tab.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-secondary/50"
                      }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {!isManager && activeTab === "business" && (
            <>
              {/* Section A — Business Info */}
              <section className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Business Info</h2>
                    <p className="text-xs text-muted-foreground font-medium">Basic information and identity</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col items-center gap-3">
                      {/* Hidden real file input */}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <button
                        type="button"
                        disabled={!canManageBranding || isUploadingLogo}
                        aria-label="Change business logo"
                        onClick={() => canManageBranding && !isUploadingLogo && logoInputRef.current?.click()}
                        className={`w-32 h-32 rounded-2xl bg-secondary border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground overflow-hidden relative group ${canManageBranding ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                      >
                        {isUploadingLogo ? (
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        ) : profile.logoUrl ? (
                          <img src={profile.logoUrl} alt="Business logo" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 opacity-50 mb-2" />
                            <span className="text-xs font-bold uppercase">Upload Logo</span>
                          </>
                        )}
                        {canManageBranding && !isUploadingLogo && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                            <Upload className="w-5 h-5 text-white" />
                            <span className="text-white text-xs font-bold">Change</span>
                          </div>
                        )}
                      </button>
                      {!canManageBranding && <span className="text-[10px] text-muted-foreground font-bold text-center">Branding access is restricted</span>}
                      <span className="text-[10px] text-muted-foreground font-medium text-center">Max 5MB · JPG, PNG, WebP</span>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <span>Subscription Plan</span>
                          <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Read-only</span>
                        </label>
                        <input type="text" value={profile.plan.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} readOnly className="w-full p-3 rounded-xl border border-border bg-muted/40 text-muted-foreground focus:outline-none font-medium cursor-default capitalize" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <span>Business Type</span>
                          <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Read-only</span>
                        </label>
                        <input type="text" value={profile.businessType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} readOnly className="w-full p-3 rounded-xl border border-border bg-muted/40 text-muted-foreground focus:outline-none font-medium cursor-default capitalize" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Tax Rate (%)</label>
                        <input
                          type="number"
                          value={profile.taxRate}
                          onChange={(e) => setProfile({ ...profile, taxRate: Number(e.target.value) })}
                          className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 8.5"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">This percentage will be applied to the subtotal on the customer checkout page.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Business Name</label>
                        <input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Display Name</label>
                        <input type="text" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
                      </div>

                      {/* Public URLs Section */}
                      <div className="md:col-span-2">
                        <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-4">
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Public URLs</span>
                          </div>

                          {profile.slug ? (() => {
                            const countryCode = profile.countryCode || "mt"
                            const slug = profile.slug
                            const businessPath = `/b/${countryCode}/${slug}`
                            const reservePath = `/reserve/${countryCode}/${slug}`
                            const frontendOrigin = getCanonicalFrontendOrigin()
                            const frontendHost = new URL(frontendOrigin).host
                            const publicBusinessUrl = `${frontendOrigin}${businessPath}`
                            const reservationUrl = `${frontendOrigin}${reservePath}`
                            const displayName = profile.displayName || profile.name || "Business"
                            const safeSlug = slug.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()

                            return (
                              <div className="space-y-3">
                                {/* Public Hub URL */}
                                <div>
                                  <p className="text-xs font-bold text-foreground mb-1.5">Public Business URL</p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center flex-1 min-w-0">
                                      <span className="text-xs font-medium text-muted-foreground bg-secondary px-3 py-3 rounded-l-xl border-y border-l border-border select-none whitespace-nowrap shrink-0">
                                        {frontendHost}/b/{countryCode}/
                                      </span>
                                      <input
                                        type="text"
                                        value={slug}
                                        readOnly
                                        className="flex-1 min-w-0 p-3 rounded-r-xl border border-border bg-muted/40 text-foreground font-bold cursor-default focus:outline-none focus:ring-0"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQrModalData({
                                          value: publicBusinessUrl,
                                          title: displayName,
                                          description: "Scan to visit this business",
                                          downloadFileName: `${safeSlug}-business-qr`,
                                          displayUrl: publicBusinessUrl,
                                        })
                                        setQrModalOpen(true)
                                      }}
                                      className="shrink-0 p-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                      title="View business QR code"
                                      aria-label="View business QR code"
                                    >
                                      <QrCode className="w-4 h-4" />
                                    </button>
                                    <a
                                      href={businessPath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 p-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                      title="Open public business page"
                                      aria-label="Open public business page"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  </div>
                                </div>

                                {/* Reservation URL */}
                                <div>
                                  <p className="text-xs font-bold text-foreground mb-1.5">Reservation URL</p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center flex-1 min-w-0">
                                      <span className="text-xs font-medium text-muted-foreground bg-secondary px-3 py-3 rounded-l-xl border-y border-l border-border select-none whitespace-nowrap shrink-0">
                                        {frontendHost}/reserve/{countryCode}/
                                      </span>
                                      <input
                                        type="text"
                                        value={slug}
                                        readOnly
                                        className="flex-1 min-w-0 p-3 rounded-r-xl border border-border bg-muted/40 text-foreground font-bold cursor-default focus:outline-none focus:ring-0"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQrModalData({
                                          value: reservationUrl,
                                          title: `${displayName} Reservations`,
                                          description: "Scan to make a reservation",
                                          downloadFileName: `${safeSlug}-reservations-qr`,
                                          displayUrl: reservationUrl,
                                        })
                                        setQrModalOpen(true)
                                      }}
                                      className="shrink-0 p-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                      title="View reservation QR code"
                                      aria-label="View reservation QR code"
                                    >
                                      <QrCode className="w-4 h-4" />
                                    </button>
                                    <a
                                      href={reservePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 p-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                      title="Open reservation page"
                                      aria-label="Open reservation page"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  </div>
                                </div>

                                <p className="text-[10px] text-muted-foreground font-medium">
                                  Generated from your display name. Share these links with customers.
                                </p>
                              </div>
                            )
                          })() : (
                            <p className="text-xs text-muted-foreground font-medium">
                              Save your Display Name to generate your public URLs.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Address</label>
                        <input type="text" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Phone Number</label>
                        <input type="tel" value={profile.phoneNumber} onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Contact Email</label>
                        <input type="email" value={profile.contactEmail} onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Currency</label>
                        <select value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium appearance-none">
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="NGN">NGN (₦)</option>
                          <option value="GHS">GHS (₵)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Timezone</label>
                        <select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium appearance-none">
                          {/* ── Africa ── */}
                          <optgroup label="Africa">
                            <option value="Africa/Abidjan">UTC+0 — Abidjan (Côte d'Ivoire)</option>
                            <option value="Africa/Accra">UTC+0 — Accra (Ghana)</option>
                            <option value="Africa/Addis_Ababa">UTC+3 — Addis Ababa (Ethiopia)</option>
                            <option value="Africa/Algiers">UTC+1 — Algiers (Algeria)</option>
                            <option value="Africa/Cairo">UTC+2 — Cairo (Egypt)</option>
                            <option value="Africa/Casablanca">UTC+1 — Casablanca (Morocco)</option>
                            <option value="Africa/Dakar">UTC+0 — Dakar (Senegal)</option>
                            <option value="Africa/Dar_es_Salaam">UTC+3 — Dar es Salaam (Tanzania)</option>
                            <option value="Africa/Douala">UTC+1 — Douala (Cameroon)</option>
                            <option value="Africa/Harare">UTC+2 — Harare (Zimbabwe)</option>
                            <option value="Africa/Johannesburg">UTC+2 — Johannesburg (South Africa)</option>
                            <option value="Africa/Kampala">UTC+3 — Kampala (Uganda)</option>
                            <option value="Africa/Khartoum">UTC+3 — Khartoum (Sudan)</option>
                            <option value="Africa/Kinshasa">UTC+1 — Kinshasa (DR Congo)</option>
                            <option value="Africa/Lagos">UTC+1 — Lagos (Nigeria)</option>
                            <option value="Africa/Luanda">UTC+1 — Luanda (Angola)</option>
                            <option value="Africa/Lusaka">UTC+2 — Lusaka (Zambia)</option>
                            <option value="Africa/Maputo">UTC+2 — Maputo (Mozambique)</option>
                            <option value="Africa/Nairobi">UTC+3 — Nairobi (Kenya)</option>
                            <option value="Africa/Tripoli">UTC+2 — Tripoli (Libya)</option>
                            <option value="Africa/Tunis">UTC+1 — Tunis (Tunisia)</option>
                          </optgroup>
                          {/* ── Americas ── */}
                          <optgroup label="Americas">
                            <option value="America/Anchorage">UTC-9 — Anchorage (USA — Alaska)</option>
                            <option value="America/Argentina/Buenos_Aires">UTC-3 — Buenos Aires (Argentina)</option>
                            <option value="America/Asuncion">UTC-4 — Asunción (Paraguay)</option>
                            <option value="America/Bogota">UTC-5 — Bogotá (Colombia)</option>
                            <option value="America/Caracas">UTC-4 — Caracas (Venezuela)</option>
                            <option value="America/Chicago">UTC-6 — Chicago / Central Time (USA)</option>
                            <option value="America/Costa_Rica">UTC-6 — San José (Costa Rica)</option>
                            <option value="America/Denver">UTC-7 — Denver / Mountain Time (USA)</option>
                            <option value="America/Edmonton">UTC-7 — Edmonton (Canada — Alberta)</option>
                            <option value="America/Fortaleza">UTC-3 — Fortaleza (Brazil — Northeast)</option>
                            <option value="America/Godthab">UTC-3 — Nuuk (Greenland)</option>
                            <option value="America/Guatemala">UTC-6 — Guatemala City (Guatemala)</option>
                            <option value="America/Guayaquil">UTC-5 — Guayaquil (Ecuador)</option>
                            <option value="America/Guyana">UTC-4 — Georgetown (Guyana)</option>
                            <option value="America/Halifax">UTC-4 — Halifax (Canada — Atlantic)</option>
                            <option value="America/Havana">UTC-5 — Havana (Cuba)</option>
                            <option value="America/Jamaica">UTC-5 — Kingston (Jamaica)</option>
                            <option value="America/La_Paz">UTC-4 — La Paz (Bolivia)</option>
                            <option value="America/Lima">UTC-5 — Lima (Peru)</option>
                            <option value="America/Los_Angeles">UTC-8 — Los Angeles / Pacific Time (USA)</option>
                            <option value="America/Managua">UTC-6 — Managua (Nicaragua)</option>
                            <option value="America/Manaus">UTC-4 — Manaus (Brazil — Amazonas)</option>
                            <option value="America/Mazatlan">UTC-7 — Mazatlán (Mexico — Pacific)</option>
                            <option value="America/Mexico_City">UTC-6 — Mexico City (Mexico)</option>
                            <option value="America/Montevideo">UTC-3 — Montevideo (Uruguay)</option>
                            <option value="America/New_York">UTC-5 — New York / Eastern Time (USA)</option>
                            <option value="America/Noronha">UTC-2 — Fernando de Noronha (Brazil)</option>
                            <option value="America/Panama">UTC-5 — Panama City (Panama)</option>
                            <option value="America/Phoenix">UTC-7 — Phoenix (USA — Arizona, no DST)</option>
                            <option value="America/Port-au-Prince">UTC-5 — Port-au-Prince (Haiti)</option>
                            <option value="America/Port_of_Spain">UTC-4 — Port of Spain (Trinidad)</option>
                            <option value="America/Puerto_Rico">UTC-4 — San Juan (Puerto Rico)</option>
                            <option value="America/Regina">UTC-6 — Regina (Canada — Saskatchewan, no DST)</option>
                            <option value="America/Santiago">UTC-4 — Santiago (Chile)</option>
                            <option value="America/Santo_Domingo">UTC-4 — Santo Domingo (Dominican Republic)</option>
                            <option value="America/Sao_Paulo">UTC-3 — São Paulo (Brazil)</option>
                            <option value="America/St_Johns">UTC-3:30 — St. John's (Canada — Newfoundland)</option>
                            <option value="America/Tegucigalpa">UTC-6 — Tegucigalpa (Honduras)</option>
                            <option value="America/Toronto">UTC-5 — Toronto (Canada — Ontario)</option>
                            <option value="America/Vancouver">UTC-8 — Vancouver (Canada — BC)</option>
                            <option value="America/Winnipeg">UTC-6 — Winnipeg (Canada — Manitoba)</option>
                          </optgroup>
                          {/* ── Antarctica ── */}
                          <optgroup label="Antarctica">
                            <option value="Antarctica/McMurdo">UTC+13 — McMurdo (Antarctica)</option>
                          </optgroup>
                          {/* ── Arctic ── */}
                          <optgroup label="Arctic">
                            <option value="Arctic/Longyearbyen">UTC+1 — Longyearbyen (Svalbard)</option>
                          </optgroup>
                          {/* ── Asia ── */}
                          <optgroup label="Asia">
                            <option value="Asia/Almaty">UTC+6 — Almaty (Kazakhstan)</option>
                            <option value="Asia/Amman">UTC+2 — Amman (Jordan)</option>
                            <option value="Asia/Baghdad">UTC+3 — Baghdad (Iraq)</option>
                            <option value="Asia/Baku">UTC+4 — Baku (Azerbaijan)</option>
                            <option value="Asia/Bangkok">UTC+7 — Bangkok (Thailand)</option>
                            <option value="Asia/Beirut">UTC+2 — Beirut (Lebanon)</option>
                            <option value="Asia/Colombo">UTC+5:30 — Colombo (Sri Lanka)</option>
                            <option value="Asia/Damascus">UTC+2 — Damascus (Syria)</option>
                            <option value="Asia/Dhaka">UTC+6 — Dhaka (Bangladesh)</option>
                            <option value="Asia/Dubai">UTC+4 — Dubai (UAE)</option>
                            <option value="Asia/Dushanbe">UTC+5 — Dushanbe (Tajikistan)</option>
                            <option value="Asia/Gaza">UTC+2 — Gaza (Palestinian Territory)</option>
                            <option value="Asia/Hong_Kong">UTC+8 — Hong Kong</option>
                            <option value="Asia/Irkutsk">UTC+8 — Irkutsk (Russia)</option>
                            <option value="Asia/Jakarta">UTC+7 — Jakarta (Indonesia — WIB)</option>
                            <option value="Asia/Jerusalem">UTC+2 — Jerusalem (Israel)</option>
                            <option value="Asia/Kabul">UTC+4:30 — Kabul (Afghanistan)</option>
                            <option value="Asia/Kamchatka">UTC+12 — Kamchatka (Russia)</option>
                            <option value="Asia/Karachi">UTC+5 — Karachi (Pakistan)</option>
                            <option value="Asia/Kathmandu">UTC+5:45 — Kathmandu (Nepal)</option>
                            <option value="Asia/Kolkata">UTC+5:30 — Mumbai / Delhi (India)</option>
                            <option value="Asia/Krasnoyarsk">UTC+7 — Krasnoyarsk (Russia)</option>
                            <option value="Asia/Kuala_Lumpur">UTC+8 — Kuala Lumpur (Malaysia)</option>
                            <option value="Asia/Kuwait">UTC+3 — Kuwait City (Kuwait)</option>
                            <option value="Asia/Macau">UTC+8 — Macau (China SAR)</option>
                            <option value="Asia/Magadan">UTC+11 — Magadan (Russia)</option>
                            <option value="Asia/Makassar">UTC+8 — Makassar (Indonesia — WITA)</option>
                            <option value="Asia/Manila">UTC+8 — Manila (Philippines)</option>
                            <option value="Asia/Muscat">UTC+4 — Muscat (Oman)</option>
                            <option value="Asia/Nicosia">UTC+2 — Nicosia (Cyprus)</option>
                            <option value="Asia/Novosibirsk">UTC+7 — Novosibirsk (Russia)</option>
                            <option value="Asia/Omsk">UTC+6 — Omsk (Russia)</option>
                            <option value="Asia/Phnom_Penh">UTC+7 — Phnom Penh (Cambodia)</option>
                            <option value="Asia/Pyongyang">UTC+9 — Pyongyang (North Korea)</option>
                            <option value="Asia/Qatar">UTC+3 — Doha (Qatar)</option>
                            <option value="Asia/Rangoon">UTC+6:30 — Yangon (Myanmar)</option>
                            <option value="Asia/Riyadh">UTC+3 — Riyadh (Saudi Arabia)</option>
                            <option value="Asia/Seoul">UTC+9 — Seoul (South Korea)</option>
                            <option value="Asia/Shanghai">UTC+8 — Shanghai / Beijing (China)</option>
                            <option value="Asia/Singapore">UTC+8 — Singapore</option>
                            <option value="Asia/Taipei">UTC+8 — Taipei (Taiwan)</option>
                            <option value="Asia/Tashkent">UTC+5 — Tashkent (Uzbekistan)</option>
                            <option value="Asia/Tbilisi">UTC+4 — Tbilisi (Georgia)</option>
                            <option value="Asia/Tehran">UTC+3:30 — Tehran (Iran)</option>
                            <option value="Asia/Thimphu">UTC+6 — Thimphu (Bhutan)</option>
                            <option value="Asia/Tokyo">UTC+9 — Tokyo (Japan)</option>
                            <option value="Asia/Ulaanbaatar">UTC+8 — Ulaanbaatar (Mongolia)</option>
                            <option value="Asia/Vladivostok">UTC+10 — Vladivostok (Russia)</option>
                            <option value="Asia/Yakutsk">UTC+9 — Yakutsk (Russia)</option>
                            <option value="Asia/Yekaterinburg">UTC+5 — Yekaterinburg (Russia)</option>
                            <option value="Asia/Yerevan">UTC+4 — Yerevan (Armenia)</option>
                          </optgroup>
                          {/* ── Atlantic ── */}
                          <optgroup label="Atlantic">
                            <option value="Atlantic/Azores">UTC-1 — Azores (Portugal)</option>
                            <option value="Atlantic/Cape_Verde">UTC-1 — Praia (Cape Verde)</option>
                            <option value="Atlantic/Reykjavik">UTC+0 — Reykjavik (Iceland)</option>
                            <option value="Atlantic/South_Georgia">UTC-2 — South Georgia</option>
                            <option value="Atlantic/Stanley">UTC-3 — Stanley (Falkland Islands)</option>
                          </optgroup>
                          {/* ── Australia ── */}
                          <optgroup label="Australia">
                            <option value="Australia/Adelaide">UTC+9:30 — Adelaide (South Australia)</option>
                            <option value="Australia/Brisbane">UTC+10 — Brisbane (Queensland, no DST)</option>
                            <option value="Australia/Darwin">UTC+9:30 — Darwin (Northern Territory, no DST)</option>
                            <option value="Australia/Hobart">UTC+10 — Hobart (Tasmania)</option>
                            <option value="Australia/Melbourne">UTC+10 — Melbourne (Victoria)</option>
                            <option value="Australia/Perth">UTC+8 — Perth (Western Australia)</option>
                            <option value="Australia/Sydney">UTC+10 — Sydney (New South Wales)</option>
                          </optgroup>
                          {/* ── Europe ── */}
                          <optgroup label="Europe">
                            <option value="Europe/Amsterdam">UTC+1 — Amsterdam (Netherlands)</option>
                            <option value="Europe/Athens">UTC+2 — Athens (Greece)</option>
                            <option value="Europe/Belgrade">UTC+1 — Belgrade (Serbia)</option>
                            <option value="Europe/Berlin">UTC+1 — Berlin (Germany)</option>
                            <option value="Europe/Brussels">UTC+1 — Brussels (Belgium)</option>
                            <option value="Europe/Bucharest">UTC+2 — Bucharest (Romania)</option>
                            <option value="Europe/Budapest">UTC+1 — Budapest (Hungary)</option>
                            <option value="Europe/Copenhagen">UTC+1 — Copenhagen (Denmark)</option>
                            <option value="Europe/Dublin">UTC+0 — Dublin (Ireland)</option>
                            <option value="Europe/Helsinki">UTC+2 — Helsinki (Finland)</option>
                            <option value="Europe/Istanbul">UTC+3 — Istanbul (Turkey)</option>
                            <option value="Europe/Kiev">UTC+2 — Kyiv (Ukraine)</option>
                            <option value="Europe/Lisbon">UTC+0 — Lisbon (Portugal)</option>
                            <option value="Europe/Ljubljana">UTC+1 — Ljubljana (Slovenia)</option>
                            <option value="Europe/London">UTC+0 — London (United Kingdom)</option>
                            <option value="Europe/Luxembourg">UTC+1 — Luxembourg</option>
                            <option value="Europe/Madrid">UTC+1 — Madrid (Spain)</option>
                            <option value="Europe/Malta">UTC+1 — Valletta (Malta)</option>
                            <option value="Europe/Minsk">UTC+3 — Minsk (Belarus)</option>
                            <option value="Europe/Moscow">UTC+3 — Moscow (Russia)</option>
                            <option value="Europe/Nicosia">UTC+2 — Nicosia (Cyprus)</option>
                            <option value="Europe/Oslo">UTC+1 — Oslo (Norway)</option>
                            <option value="Europe/Paris">UTC+1 — Paris (France)</option>
                            <option value="Europe/Prague">UTC+1 — Prague (Czech Republic)</option>
                            <option value="Europe/Riga">UTC+2 — Riga (Latvia)</option>
                            <option value="Europe/Rome">UTC+1 — Rome (Italy)</option>
                            <option value="Europe/Samara">UTC+4 — Samara (Russia)</option>
                            <option value="Europe/Sarajevo">UTC+1 — Sarajevo (Bosnia)</option>
                            <option value="Europe/Skopje">UTC+1 — Skopje (North Macedonia)</option>
                            <option value="Europe/Sofia">UTC+2 — Sofia (Bulgaria)</option>
                            <option value="Europe/Stockholm">UTC+1 — Stockholm (Sweden)</option>
                            <option value="Europe/Tallinn">UTC+2 — Tallinn (Estonia)</option>
                            <option value="Europe/Tirane">UTC+1 — Tirana (Albania)</option>
                            <option value="Europe/Ulyanovsk">UTC+4 — Ulyanovsk (Russia)</option>
                            <option value="Europe/Vienna">UTC+1 — Vienna (Austria)</option>
                            <option value="Europe/Vilnius">UTC+2 — Vilnius (Lithuania)</option>
                            <option value="Europe/Warsaw">UTC+1 — Warsaw (Poland)</option>
                            <option value="Europe/Zagreb">UTC+1 — Zagreb (Croatia)</option>
                            <option value="Europe/Zurich">UTC+1 — Zurich (Switzerland)</option>
                          </optgroup>
                          {/* ── Indian Ocean ── */}
                          <optgroup label="Indian Ocean">
                            <option value="Indian/Maldives">UTC+5 — Malé (Maldives)</option>
                            <option value="Indian/Mauritius">UTC+4 — Port Louis (Mauritius)</option>
                            <option value="Indian/Reunion">UTC+4 — Saint-Denis (Réunion)</option>
                          </optgroup>
                          {/* ── Pacific ── */}
                          <optgroup label="Pacific">
                            <option value="Pacific/Apia">UTC+13 — Apia (Samoa)</option>
                            <option value="Pacific/Auckland">UTC+12 — Auckland (New Zealand)</option>
                            <option value="Pacific/Chatham">UTC+12:45 — Chatham Islands (NZ)</option>
                            <option value="Pacific/Easter">UTC-6 — Easter Island (Chile)</option>
                            <option value="Pacific/Fakaofo">UTC+13 — Fakaofo (Tokelau)</option>
                            <option value="Pacific/Fiji">UTC+12 — Suva (Fiji)</option>
                            <option value="Pacific/Gambier">UTC-9 — Gambier Islands (French Polynesia)</option>
                            <option value="Pacific/Guadalcanal">UTC+11 — Honiara (Solomon Islands)</option>
                            <option value="Pacific/Guam">UTC+10 — Hagåtña (Guam)</option>
                            <option value="Pacific/Honolulu">UTC-10 — Honolulu (USA — Hawaii)</option>
                            <option value="Pacific/Kiritimati">UTC+14 — Kiritimati (Kiribati)</option>
                            <option value="Pacific/Majuro">UTC+12 — Majuro (Marshall Islands)</option>
                            <option value="Pacific/Marquesas">UTC-9:30 — Marquesas Islands (French Polynesia)</option>
                            <option value="Pacific/Nauru">UTC+12 — Yaren (Nauru)</option>
                            <option value="Pacific/Niue">UTC-11 — Alofi (Niue)</option>
                            <option value="Pacific/Norfolk">UTC+11 — Kingston (Norfolk Island)</option>
                            <option value="Pacific/Noumea">UTC+11 — Nouméa (New Caledonia)</option>
                            <option value="Pacific/Pago_Pago">UTC-11 — Pago Pago (American Samoa)</option>
                            <option value="Pacific/Palau">UTC+9 — Ngerulmud (Palau)</option>
                            <option value="Pacific/Pitcairn">UTC-8 — Adamstown (Pitcairn Islands)</option>
                            <option value="Pacific/Port_Moresby">UTC+10 — Port Moresby (Papua New Guinea)</option>
                            <option value="Pacific/Rarotonga">UTC-10 — Avarua (Cook Islands)</option>
                            <option value="Pacific/Tahiti">UTC-10 — Papeete (French Polynesia)</option>
                            <option value="Pacific/Tarawa">UTC+12 — South Tarawa (Kiribati)</option>
                            <option value="Pacific/Tongatapu">UTC+13 — Nukuʻalofa (Tonga)</option>
                            <option value="Pacific/Wake">UTC+12 — Wake Island (USA)</option>
                            <option value="Pacific/Wallis">UTC+12 — Mata-Utu (Wallis &amp; Futuna)</option>
                          </optgroup>
                          {/* ── UTC ── */}
                          <optgroup label="UTC">
                            <option value="UTC">UTC+0 — Universal Coordinated Time</option>
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>



            </>
          )}

          {!isManager && hasBusinessProfile && propertyProfileMounted && (
            <div hidden={activeTab !== "property-profile"}>
              <PropertyProfileSettings />
            </div>
          )}

          {activeTab === "operations" && (
            <>
              {isHotel && !isManager && (
                <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 flex items-center justify-center">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-foreground">Food Service</h2>
                      <p className="text-xs text-muted-foreground font-medium">Add restaurant operations to this hotel</p>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-6 p-4 rounded-xl border border-border/50 max-w-2xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">Enable food service</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${foodServiceEnabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-secondary text-muted-foreground"}`}>
                            {foodServiceEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                          Adds Orders, Menu, and other food-service capabilities while keeping the hotel dashboard as the primary experience.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={foodServiceEnabled}
                        onChange={() => setFoodServiceEnabled((enabled) => !enabled)}
                        label="Enable food service"
                      />
                    </div>
                    {foodServiceEnabled !== savedFoodServiceEnabled && (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-3">
                        Save changes to apply this update your dashboard.
                      </p>
                    )}
                  </div>
                </section>
              )}
              {/* Section B — Operating Hours */}
              <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Operating Hours</h2>
                    <p className="text-xs text-muted-foreground font-medium">Define when you accept orders</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4 max-w-2xl">
                    {hours.map((dayHours, idx) => (
                      <div key={dayHours.day} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-secondary/20 transition-colors">
                        <div className="w-32 flex items-center gap-3">
                          <ToggleSwitch
                            checked={dayHours.open}
                            label={`${dayHours.open ? "Close" : "Open"} on ${dayHours.day}`}
                            onChange={() => {
                              const newHours = [...hours];
                              newHours[idx].open = !newHours[idx].open;
                              setHours(newHours);
                            }}
                          />
                          <span className={`font-bold ${!dayHours.open && 'text-muted-foreground opacity-50'}`}>{dayHours.day}</span>
                        </div>
                        <div className={`flex items-center gap-3 ${!dayHours.open && 'opacity-50 pointer-events-none'}`}>
                          <ModernTimePicker
                            value={dayHours.start}
                            onChange={(value) => {
                              const newHours = [...hours];
                              newHours[idx].start = value;
                              setHours(newHours);
                            }}
                          />
                          <span className="text-muted-foreground font-bold">to</span>
                          <ModernTimePicker
                            value={dayHours.end}
                            onChange={(value) => {
                              const newHours = [...hours];
                              newHours[idx].end = value;
                              setHours(newHours);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {hasLodging && !isManager && (
                <>
                  <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-foreground">Stay Times</h2>
                      <p className="text-xs text-muted-foreground font-medium">Set the check-in code validity window for hotel reservations</p>
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                    <div className="p-4 rounded-xl border border-border/50">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Check-in Time</label>
                      <ModernTimePicker
                        value={hotelSettings.checkInTime}
                        onChange={(value) => setHotelSettings((prev) => ({ ...prev, checkInTime: value }))}
                      />
                      <p className="text-xs text-muted-foreground mt-3">Guest check-in codes become valid at this time on arrival day.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-border/50">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Check-out Time</label>
                      <ModernTimePicker
                        value={hotelSettings.checkOutTime}
                        onChange={(value) => setHotelSettings((prev) => ({ ...prev, checkOutTime: value }))}
                      />
                      <p className="text-xs text-muted-foreground mt-3">Guest check-in codes expire at this time on departure day.</p>
                    </div>
                  </div>
                </section>

                {/* Online Booking Confirmation Mode */}
                <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Online Booking</h3>
                      <p className="text-xs text-muted-foreground font-medium">Booking confirmation</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-4 max-w-2xl">
                    <label
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                        hotelSettings.onlineBookingConfirmationMode === "instant"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/50 hover:border-border"
                      }`}
                      onClick={() => setHotelSettings((prev) => ({ ...prev, onlineBookingConfirmationMode: "instant" }))}
                    >
                      <input
                        type="radio"
                        name="onlineBookingConfirmationMode"
                        value="instant"
                        checked={hotelSettings.onlineBookingConfirmationMode === "instant"}
                        onChange={() => setHotelSettings((prev) => ({ ...prev, onlineBookingConfirmationMode: "instant" }))}
                        className="mt-1 accent-primary"
                      />
                      <div>
                        <p className="font-bold text-foreground text-sm">Instant Booking</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Guests can immediately pay and confirm rooms shown as available. Recommended when QuickServe manages your room inventory.</p>
                      </div>
                    </label>
                    <label
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                        hotelSettings.onlineBookingConfirmationMode === "confirmation_required"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/50 hover:border-border"
                      }`}
                      onClick={() => setHotelSettings((prev) => ({ ...prev, onlineBookingConfirmationMode: "confirmation_required" }))}
                    >
                      <input
                        type="radio"
                        name="onlineBookingConfirmationMode"
                        value="confirmation_required"
                        checked={hotelSettings.onlineBookingConfirmationMode === "confirmation_required"}
                        onChange={() => setHotelSettings((prev) => ({ ...prev, onlineBookingConfirmationMode: "confirmation_required" }))}
                        className="mt-1 accent-primary"
                      />
                      <div>
                        <p className="font-bold text-foreground text-sm">Require confirmation</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Guests send a booking request first. You confirm availability before they are asked to pay. Recommended if you also manage reservations in another system.</p>
                      </div>
                    </label>
                  </div>
                  </section>
                </>
              )}

            </>
          )}

          {activeTab === "preferences" && (
            <>
              {/* Section C — Ordering Preferences */}
              <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Ordering Preferences</h2>
                    <p className="text-xs text-muted-foreground font-medium">Configure customer ordering flows</p>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">Enable Dine-in Orders</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Allow ordering to specific tables</p>
                    </div>
                    <ToggleSwitch label="Enable dine-in orders" checked={ordering.dineIn ?? false} onChange={() => setOrdering({ ...ordering, dineIn: !ordering.dineIn })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">Enable Takeout Orders</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Allow pickup orders</p>
                    </div>
                    <ToggleSwitch label="Enable takeout orders" checked={ordering.takeout ?? false} onChange={() => setOrdering({ ...ordering, takeout: !ordering.takeout })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">Hide Out-of-Stock Items</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Remove unavailable items from the menu</p>
                    </div>
                    <ToggleSwitch label="Hide out-of-stock items" checked={ordering.hideOutOfStock ?? false} onChange={() => setOrdering({ ...ordering, hideOutOfStock: !ordering.hideOutOfStock })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">Enable Reservations</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Allow customers to book online</p>
                    </div>
                    <ToggleSwitch label="Enable reservations" checked={ordering.reservationsEnabled ?? true} onChange={() => setOrdering({ ...ordering, reservationsEnabled: !ordering.reservationsEnabled })} />
                  </div>

                </div>
              </section>

              {/* Section D — Payment Preferences */}
              <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Payment Preferences</h2>
                    <p className="text-xs text-muted-foreground font-medium">Manage how you accept money</p>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">Accept Online Payments</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Via Stripe/Credit Card on phone</p>
                    </div>
                    <ToggleSwitch label="Accept online payments" checked={payments.onlinePayments} onChange={() => setPayments({ ...payments, onlinePayments: !payments.onlinePayments })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">Accept Offline Payments</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Pay via Waiter</p>
                    </div>
                    <ToggleSwitch label="Accept offline payments" checked={payments.offlinePayments} onChange={() => setPayments({ ...payments, offlinePayments: !payments.offlinePayments })} />
                  </div>
                  <div className={`flex items-center justify-between p-4 rounded-xl border border-border/50 ml-6 transition-all duration-200 ${!payments.offlinePayments ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                    <div>
                      <p className="font-bold text-foreground">Accept Cash</p>
                    </div>
                    <ToggleSwitch label="Accept cash" checked={payments.acceptCash} onChange={() => setPayments({ ...payments, acceptCash: !payments.acceptCash })} />
                  </div>
                  <div className={`flex items-center justify-between p-4 rounded-xl border border-border/50 ml-6 transition-all duration-200 ${!payments.offlinePayments ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                    <div>
                      <p className="font-bold text-foreground">Accept POS Card</p>
                    </div>
                    <ToggleSwitch label="Accept POS card" checked={payments.acceptPosCard} onChange={() => setPayments({ ...payments, acceptPosCard: !payments.acceptPosCard })} />
                  </div>


                </div>
              </section>



              <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Tips</h2>
                    <p className="text-xs text-muted-foreground font-medium">Customer tipping at checkout</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="font-bold text-foreground">Enable Tips</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Allow customers to optionally leave a tip during checkout.</p>
                    </div>
                    <ToggleSwitch label="Enable tips" checked={tipsEnabled} onChange={() => setTipsEnabled(!tipsEnabled)} />
                  </div>
                </div>
              </section>

              {/* Section E — Table & QR Preferences */}
              <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Service Point & QR Preferences</h2>
                    <p className="text-xs text-muted-foreground font-medium">Security and session rules</p>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 md:col-span-2">
                    <div>
                      <p className="font-bold text-foreground">Enable QR Ordering</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Globally toggle QR code scanning</p>
                    </div>
                    <ToggleSwitch label="Enable QR ordering" checked={ordering.qrOrdering ?? true} onChange={() => setOrdering({ ...ordering, qrOrdering: !ordering.qrOrdering })} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 md:col-span-2">
                    <div>
                      <p className="font-bold text-foreground">Enable Waiter-Assisted Ordering</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Allow staff to create offline orders without QR scanning</p>
                    </div>
                    <ToggleSwitch label="Enable waiter-assisted ordering" checked={ordering.enableWaiterOrdering ?? true} onChange={() => setOrdering({ ...ordering, enableWaiterOrdering: !ordering.enableWaiterOrdering })} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Session Expiry (Minutes)</label>
                    <input type="number" value={tablePrefs.sessionExpiry} onChange={(e) => setTablePrefs({ ...tablePrefs, sessionExpiry: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Max Active Customers Per {term.singular}</label>
                    <input type="number" value={tablePrefs.maxSessions} onChange={(e) => setTablePrefs({ ...tablePrefs, maxSessions: e.target.value })} className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
                  </div>

                </div>
              </section>

            </>
          )}

          {!isManager && activeTab === "team" && (
            <>
              {/* Section: Team & Access */}
              {user?.role === "owner" && (
                <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-border bg-secondary/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-foreground">Team & Access</h2>
                        <p className="text-xs text-muted-foreground font-medium">Manage business ownership and access roles</p>
                      </div>
                    </div>
                    <Link href="/owner/settings/team-access">
                      <Button variant="outline" className="font-bold text-xs h-9">Manage Access</Button>
                    </Link>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-muted-foreground font-medium">
                      Invite Co-Owners to help manage your business, view your current access hierarchy, and see a summary of your operational staff.
                    </p>
                  </div>
                </section>
              )}

            </>
          )}

          {activeTab === "preferences" && (
            <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">Guest Experience</h2>
                  <p className="text-xs text-muted-foreground font-medium">Customer-facing service controls</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                  <div>
                    <p className="font-bold text-foreground">Enable Waiter Call</p>
                    <p className="text-xs text-muted-foreground mt-0.5">When customer requests assistance</p>
                  </div>
                  <ToggleSwitch label="Enable waiter call" checked={ordering.serviceRequest ?? false} onChange={() => setOrdering({ ...ordering, serviceRequest: !ordering.serviceRequest })} />
                </div>
                <div className="p-4 rounded-xl border border-border/50">
                  <label htmlFor="order-start-assistance-delay" className="font-bold text-foreground">
                    Delayed-order assistance
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                    Offer Call Waiter when prepared work has not started after this many minutes.
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      id="order-start-assistance-delay"
                      type="number"
                      min={1}
                      max={240}
                      step={1}
                      disabled={!ordering.serviceRequest}
                      value={ordering.orderStartAssistanceDelayMinutes}
                      onChange={(event) => setOrdering({
                        ...ordering,
                        orderStartAssistanceDelayMinutes: Number(event.target.value),
                      })}
                      className="w-24"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">minutes</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {!isManager && activeTab === "security" && (
            <div className="space-y-6">
              <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Update Login Email</h2>
                    <p className="text-xs text-muted-foreground font-medium">A verification link will be sent to your new address</p>
                  </div>
                </div>
                <div className="p-6">
                  {emailVerificationSent ? (
                    <div className="flex flex-col items-center text-center gap-4 py-6">
                      <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                      </div>
                      <div>
                        <p className="font-black text-foreground text-lg">Check your new inbox</p>
                        <p className="text-sm text-muted-foreground mt-1">We sent a verification link to your new email address. Click it to confirm the change — it expires in 30 minutes.</p>
                      </div>
                      <button
                        onClick={() => setEmailVerificationSent(false)}
                        className="text-xs text-primary font-bold underline"
                      >
                        Send to a different email
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleUpdateEmail} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">New Email Address</label>
                        <input
                          type="email"
                          required
                          value={securityData.newEmail}
                          onChange={(e) => setSecurityData({ ...securityData, newEmail: e.target.value })}
                          className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          placeholder="new@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Current Password</label>
                        <input
                          type="password"
                          required
                          value={securityData.currentPasswordForEmail}
                          onChange={(e) => setSecurityData({ ...securityData, currentPasswordForEmail: e.target.value })}
                          className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button type="submit" disabled={isUpdatingEmail} className="font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                          {isUpdatingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Send Verification Email
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </section>

              <section className="bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground">Change Password</h2>
                    <p className="text-xs text-muted-foreground font-medium">Update your account password</p>
                  </div>
                </div>
                <div className="p-6">
                  <form onSubmit={handleChangePassword} className="space-y-6 max-w-md">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Current Password</label>
                      <input
                        type="password"
                        required
                        value={securityData.currentPassword}
                        onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                        className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">New Password</label>
                      <input
                        type="password"
                        required
                        minLength={12}
                        value={securityData.newPassword}
                        onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                        className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                        placeholder="••••••••"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">{PASSWORD_POLICY_MESSAGE}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        minLength={12}
                        value={securityData.confirmPassword}
                        onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                        className="w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                    <Button type="submit" disabled={isUpdatingPassword} className="font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                      {isUpdatingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Change Password
                    </Button>
                  </form>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      <QrCodeModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        value={qrModalData?.value ?? ""}
        title={qrModalData?.title ?? ""}
        description={qrModalData?.description ?? ""}
        downloadFileName={qrModalData?.downloadFileName ?? "qr-code"}
        displayUrl={qrModalData?.displayUrl}
      />
    </div>
  )
}
