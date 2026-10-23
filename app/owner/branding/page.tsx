"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, type Control, useForm, useWatch } from "react-hook-form"
import {
  Palette,
  Image as ImageIcon,
  Loader2,
  Save,
  Upload,
  Lock,
  Search,
  Plus,
  Smartphone
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import CustomerHeader from "@/components/customer-header"
import { ErrorState } from "@/components/shared/ErrorState"
import { PageHeader } from "@/components/shared/PageHeader"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { apiClient } from "@/lib/axios-config"
import { useAuthContext } from "@/contexts/AuthContext"
import { classifyFormApiError, type FormApiError } from "@/lib/forms/api-error"
import { toast } from "sonner"
import ManagePlanModal from "@/components/owner/billing/ManagePlanModal"
import { formatPrice } from "@/lib/localization"
import {
  brandingFormSchema,
  getBrandingFormDefaultValues,
  toBrandingPayload,
  type BrandingFormValues,
} from "./page.validation"

type BrandingPreview = {
  businessName: string
  currency: string
  menuItem: {
    name: string
    description?: string
    category?: string
    price: number
    imageUrl?: string
  } | null
}

function BrandingControlsSkeleton() {
  return (
    <div role="status" aria-label="Loading branding settings" className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full max-w-sm" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 border-t border-border pt-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-10 flex-1 rounded-xl" />
            </div>
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
      <div className="flex items-start justify-between gap-4 border-t border-border pt-6">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full max-w-lg" />
        </div>
        <Skeleton className="h-6 w-11 rounded-full" />
      </div>
    </div>
  )
}

function CustomerMenuPreviewSkeleton({ hasError }: { hasError: boolean }) {
  return (
    <div
      className="relative flex h-[700px] flex-col overflow-hidden rounded-[2rem] border-[8px] border-secondary/50 bg-card shadow-2xl"
      role={hasError ? "alert" : "status"}
      aria-label={hasError ? "Branding preview unavailable" : "Loading branding preview"}
    >
      <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-xl bg-secondary/50" />
      {hasError ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <Smartphone className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-bold text-foreground">Preview unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">Reload the saved branding settings to restore the preview.</p>
        </div>
      ) : (
        <div className="space-y-6 px-4 pb-20 pt-12">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-20 rounded-xl" />
            <Skeleton className="h-11 w-24 rounded-xl" />
            <Skeleton className="h-11 w-20 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      )}
    </div>
  )
}

type BrandingColorFieldProps = {
  control: Control<BrandingFormValues>
  name: "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor"
  label: string
  pickerLabel: string
  inputLabel: string
  description: string
  error?: string
}

function BrandingColorField({
  control,
  name,
  label,
  pickerLabel,
  inputLabel,
  description,
  error,
}: BrandingColorFieldProps) {
  const value = useWatch({ control, name })

  return (
    <Field
      id={name}
      label={<span className="text-sm font-bold text-foreground">{label}</span>}
      error={error}
      className="space-y-0"
    >
      {(controlProps) => (
        <>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border shadow-sm"
              style={{ backgroundColor: value }}
            >
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <input
                    type="color"
                    aria-label={pickerLabel}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.value)}
                    className="absolute inset-[-10px] h-20 w-20 cursor-pointer opacity-0"
                  />
                )}
              />
            </div>
            <Controller
              control={control}
              name={name}
              render={({ field }) => (
                <input
                  {...field}
                  {...controlProps}
                  type="text"
                  aria-label={inputLabel}
                  className="flex-1 rounded-xl border border-border bg-background p-2.5 font-mono text-sm uppercase"
                  maxLength={7}
                />
              )}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">{description}</p>
        </>
      )}
    </Field>
  )
}

export default function BrandingPage() {
  const [showManagePlan, setShowManagePlan] = useState(false)
  const { user } = useAuthContext()
  const businessId = user?.businessId
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [formError, setFormError] = useState<FormApiError | null>(null)
  
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getBrandingFormDefaultValues(),
  })
  const branding = useWatch({ control })
  
  const [preview, setPreview] = useState<BrandingPreview>({
    businessName: "Your business",
    currency: "EUR",
    menuItem: null,
  })

  const fetchBranding = useCallback(async () => {
    try {
      if (!businessId) return
      setIsLoading(true)
      setLoadError(false)
      const res = await apiClient.get(`/owner/branding`)
      const data = res.data as {
        preview?: BrandingPreview
        branding?: Partial<BrandingFormValues>
      }
      
      if (data.preview) setPreview(data.preview)
      if (data.branding) {
        reset(getBrandingFormDefaultValues(data.branding))
      }
    } catch (err: any) {
      console.error("Failed to fetch branding", err)
      setLoadError(true)
      toast.error("Failed to load branding settings")
    } finally {
      setIsLoading(false)
    }
  }, [businessId, reset])

  useEffect(() => {
    if (businessId) {
      fetchBranding()
    }
  }, [businessId, fetchBranding])

  const handleSave = async (values: BrandingFormValues) => {
    setFormError(null)
    try {
      await apiClient.patch("/owner/branding", toBrandingPayload(values))
      toast.success("Branding saved successfully!")
    } catch (err: any) {
      console.error("Save error:", err)
      const apiError = classifyFormApiError(err, "Failed to save branding")
      setFormError(apiError)
      toast.error(apiError.message)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "cover") => {
    const file = e.target.files?.[0]
    if (!file || !businessId) return

    const form = new FormData()
    form.append("image", file)
    form.append("businessId", businessId)

    try {
      if (type === "logo") setIsUploadingLogo(true)
      else setIsUploadingCover(true)
      
      const res = await apiClient.post("/upload/business-logo", form, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      
      if (type === "logo") {
        setValue("logoUrl", res.data.logoUrl, { shouldDirty: true })
        toast.success("Logo uploaded successfully!")
      } else {
        setValue("coverImageUrl", res.data.logoUrl, { shouldDirty: true }) // endpoint returns logoUrl for any image uploaded
        toast.success("Cover image uploaded successfully!")
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Upload failed")
    } finally {
      if (type === "logo") {
        setIsUploadingLogo(false)
        if (logoInputRef.current) logoInputRef.current.value = ""
      } else {
        setIsUploadingCover(false)
        if (coverInputRef.current) coverInputRef.current.value = ""
      }
    }
  }

  const hasAdvancedBranding = !!user?.entitlements?.advancedBranding;
  const isBasicPlan = !hasAdvancedBranding;
  const isPro = hasAdvancedBranding;

  return (
    <form onSubmit={handleSubmit(handleSave)} className="pb-20" aria-busy={isSubmitting}>
      <header className="sticky top-0 lg:top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <PageHeader
          className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
          title="Customer Menu Branding"
          titleClassName="flex items-center gap-2"
          description="Customize the look and feel of your customer-facing QR menu."
          action={
            <Button
              type="submit"
              disabled={isLoading || loadError || isSubmitting || isBasicPlan}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </Button>
          }
        />
      </header>

      <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500 flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: Controls */}
        <div className="flex-1 space-y-8">
          
          {/* Locked State Warning for Basic Plan */}
          {isBasicPlan && (
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-[1.5rem] flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-2">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-black text-foreground">Premium Branding is Locked</h2>
              <p className="text-muted-foreground font-medium text-sm max-w-md">
                Customizing your customer menu is available on the Growth plan. Upgrade to unlock custom logos, covers, and brand colors.
              </p>
              <Button type="button" className="mt-2 font-bold rounded-xl" size="lg" onClick={() => setShowManagePlan(true)}>Upgrade to Growth</Button>
            </div>
          )}

          <section className={`bg-card rounded-[1.5rem] border border-border overflow-hidden shadow-sm ${isBasicPlan ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="p-5 border-b border-border bg-secondary/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">Brand Assets</h2>
                  <p className="text-xs text-muted-foreground font-medium">Upload your logo and cover image</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Enable Custom Branding</span>
                {isLoading ? (
                  <Skeleton className="h-6 w-11 rounded-full" />
                ) : loadError ? (
                  <span className="text-xs font-bold text-destructive">Unavailable</span>
                ) : (
                  <Controller
                    control={control}
                    name="enabled"
                    render={({ field }) => (
                      <Switch
                        aria-label="Enable custom branding"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="h-6 w-11 border-0 data-[state=unchecked]:bg-muted data-[state=unchecked]:[&>[data-slot=switch-thumb]]:translate-x-1 data-[state=checked]:[&>[data-slot=switch-thumb]]:translate-x-6"
                      />
                    )}
                  />
                )}
              </div>
            </div>
            
            <div className="p-6 space-y-8">
              {isLoading ? (
                <BrandingControlsSkeleton />
              ) : loadError ? (
                <ErrorState
                  className="min-h-64 rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-8"
                  title="Branding settings could not be loaded"
                  description="Your saved values have not been changed. Try loading them again."
                  descriptionClassName="max-w-sm"
                  action={
                    <Button type="button" variant="outline" className="mt-4 rounded-xl font-bold" onClick={fetchBranding}>
                      Try Again
                    </Button>
                  }
                />
                ) : (
                <>
                {formError ? (
                  <FormNotice tone={formError.kind === "rate_limit" ? "warning" : "error"}>
                    {formError.message}
                  </FormNotice>
                ) : null}
                {/* Cover Upload */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground">Menu Cover Image</label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "cover")}
                />
                <div
                  onClick={() => !isUploadingCover && coverInputRef.current?.click()}
                  className="w-full h-40 rounded-2xl bg-secondary border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground overflow-hidden relative group cursor-pointer"
                >
                  {isUploadingCover ? (
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  ) : branding.coverImageUrl ? (
                      <img src={branding.coverImageUrl} alt="Current menu cover" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 opacity-50 mb-2" />
                      <span className="text-xs font-bold uppercase">Upload Cover</span>
                      <span className="text-[10px] opacity-70 mt-1">Recommended: 1200x400px</span>
                    </>
                  )}
                  {!isUploadingCover && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <Upload className="w-5 h-5 text-white" />
                      <span className="text-white text-xs font-bold">{branding.coverImageUrl ? "Change Cover" : "Upload Cover"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Logo Upload */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground">Business Logo</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "logo")}
                />
                <div className="flex items-center gap-6">
                  <div
                    onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
                    className="w-24 h-24 rounded-2xl bg-secondary border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground overflow-hidden relative group cursor-pointer shrink-0"
                  >
                    {isUploadingLogo ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : branding.logoUrl ? (
                      <img src={branding.logoUrl} alt="Current business logo" className="w-full h-full object-contain bg-white" />
                    ) : (
                      <>
                        <ImageIcon className="w-6 h-6 opacity-50 mb-1" />
                        <span className="text-[10px] font-bold uppercase">Upload</span>
                      </>
                    )}
                    {!isUploadingLogo && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                        <Upload className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Upload a square or circular logo with a transparent background for best results.</p>
                    <p className="opacity-70">Max size: 5MB (PNG, JPG, WebP)</p>
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                <BrandingColorField
                  control={control}
                  name="primaryColor"
                  label="Primary Color"
                  pickerLabel="Choose primary color"
                  inputLabel="Primary color hex value"
                  description="Used for primary buttons, active states, and highlights."
                  error={errors.primaryColor?.message}
                />
                <BrandingColorField
                  control={control}
                  name="secondaryColor"
                  label="Secondary Color"
                  pickerLabel="Choose secondary color"
                  inputLabel="Secondary color hex value"
                  description="Used for dark elements, badges, and secondary buttons."
                  error={errors.secondaryColor?.message}
                />
                <BrandingColorField
                  control={control}
                  name="accentColor"
                  label="Accent Color"
                  pickerLabel="Choose accent color"
                  inputLabel="Accent color hex value"
                  description="Used for subtle highlights and secondary elements."
                  error={errors.accentColor?.message}
                />
                <BrandingColorField
                  control={control}
                  name="backgroundColor"
                  label="Background Color"
                  pickerLabel="Choose background color"
                  inputLabel="Background color hex value"
                  description="Main background color of the menu interface."
                  error={errors.backgroundColor?.message}
                />
              </div>

              {/* Remove Chillow Branding */}
              <div className={`pt-6 border-t border-border ${!isPro ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Remove Chillow Branding
                      {!isPro && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] uppercase tracking-wider font-black">Growth</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Hide the "Powered by Chillow" footer and watermarks from the customer menu.</p>
                  </div>
                  <Controller
                    control={control}
                    name="removeQuickServeBranding"
                    render={({ field }) => (
                      <Switch
                        aria-label="Remove Chillow branding"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isPro}
                        className="h-6 w-11 border-0 data-[state=unchecked]:bg-muted data-[state=unchecked]:[&>[data-slot=switch-thumb]]:translate-x-1 data-[state=checked]:[&>[data-slot=switch-thumb]]:translate-x-6"
                      />
                    )}
                  />
                </div>
              </div>
                </>
              )}
              
            </div>
          </section>
        </div>

        {/* Right Side: Preview */}
        <div className="w-full lg:w-[350px] shrink-0 sticky top-[100px]">
          {isLoading || loadError ? <CustomerMenuPreviewSkeleton hasError={loadError} /> : <CustomerMenuPreview branding={branding} preview={preview} />}
        </div>
        
      </div>
      <ManagePlanModal open={showManagePlan} onOpenChange={setShowManagePlan} onSuccess={() => window.location.reload()} />
    </form>
  )
}

function CustomerMenuPreview({ branding, preview }: { branding: any; preview: BrandingPreview }) {
  const useBranding = branding.enabled
  
  const themeVars = useBranding ? {
    '--brand-primary': branding.primaryColor || '#EA601A',
    '--brand-secondary': branding.secondaryColor || '#2B304C',
    '--brand-accent': branding.accentColor || '#FB923C',
    '--brand-background': branding.backgroundColor || '#F8F9FA',
    '--brand-gradient-from': branding.primaryColor || '#EA601A',
    '--brand-gradient-to': branding.accentColor || '#ff8c42',
    '--brand-text-on-brand': '#FFFFFF',
    '--brand-muted-bg': `${branding.primaryColor || '#EA601A'}15`,
    '--brand-ring': `${branding.primaryColor || '#EA601A'}33`,
    '--brand-shadow': `${branding.primaryColor || '#EA601A'}33`,
  } as React.CSSProperties : {}

  return (
    <div className="bg-card rounded-[2rem] border-[8px] border-secondary/50 shadow-2xl overflow-hidden flex flex-col h-[700px] relative customer-menu-theme" style={themeVars}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-secondary/50 rounded-b-xl z-20"></div>
      
      <div 
        className="flex-1 overflow-y-auto relative pb-20"
        style={{ backgroundColor: 'var(--brand-background, hsl(var(--background)))' }}
      >
        <CustomerHeader 
          useBranding={useBranding}
          branding={branding}
          businessName={preview.businessName}
          displayServicePoint="Service Point"
        />

        <div className="px-4 py-6 space-y-6">
          {/* Fake Search */}
          <div 
            className="w-full pl-6 pr-16 py-4 rounded-full bg-background border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative flex items-center"
          >
            <span className="text-muted-foreground/70 text-sm ml-2">Search delicious dishes...</span>
            <div 
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 text-[var(--brand-text-on-brand,white)] rounded-full flex items-center justify-center shadow-md"
              style={{
                background: useBranding ? `linear-gradient(to bottom right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))` : 'linear-gradient(to bottom right, #EA601A, #ff8c42)'
              }}
            >
              <Search className="w-5 h-5" />
            </div>
          </div>

          {/* Fake Categories */}
          <div className="flex gap-2 overflow-hidden">
            <div className="px-5 py-3 rounded-xl font-bold text-sm text-[var(--brand-text-on-brand,white)] shadow-lg"
                 style={useBranding ? {
                   background: "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))",
                 } : { background: "linear-gradient(to right, #EA601A, #ff8c42)" }}>
              All
            </div>
            <div className="px-5 py-3 rounded-xl font-bold text-sm bg-secondary/60 text-foreground border border-border/40">
              Mains
            </div>
            <div className="px-5 py-3 rounded-xl font-bold text-sm bg-secondary/60 text-foreground border border-border/40">
              Drinks
            </div>
          </div>

          {/* Saved menu item preview */}
          <div className="space-y-4">
            {preview.menuItem ? (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col relative h-64">
              <div className="h-40 bg-secondary/50 w-full relative">
                 {preview.menuItem.imageUrl ? (
                   <img src={preview.menuItem.imageUrl} alt="" className="h-full w-full object-cover" />
                 ) : null}
                 <div className="absolute top-2 left-2 px-2 py-0.5 bg-background/60 backdrop-blur-md rounded-md text-[10px] font-bold uppercase tracking-wider border border-white/10">
                   {preview.menuItem.category || "Menu item"}
                 </div>
                 <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center text-[var(--brand-text-on-brand,white)] shadow-lg ring-4 ring-background/20"
                      style={{ backgroundColor: useBranding ? 'var(--brand-primary, #EA601A)' : '#EA601A' }}>
                   <Plus className="w-5 h-5" />
                 </div>
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-foreground text-sm">{preview.menuItem.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{preview.menuItem.description || "No description added."}</div>
                </div>
                <div 
                  className="font-black text-lg bg-clip-text text-transparent w-max" 
                  style={{ backgroundImage: useBranding ? "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))" : "linear-gradient(to right, #EA601A, #ff8c42)" }}
                >
                  {formatPrice(preview.menuItem.price, preview.currency)}
                </div>
              </div>
            </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center text-sm text-muted-foreground">
                No available menu items to preview.
              </div>
            )}
          </div>
        </div>

        {/* Fake Footer */}
        {!(useBranding && branding.removeQuickServeBranding) && (
          <div className="py-8 text-center text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest border-t border-border mt-8 max-w-5xl mx-auto">
            Powered by Chillow
          </div>
        )}
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur text-white text-[10px] font-bold rounded-full z-20 flex items-center gap-1.5 shadow-lg">
        <Smartphone className="w-3 h-3" />
        Live Preview
      </div>
    </div>
  )
}
