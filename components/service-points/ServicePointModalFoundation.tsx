"use client"

import {
  type ReactNode,
  useEffect,
  useState,
} from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  ServicePoint,
  ServicePointFormPayload,
  ServicePointModalProps,
} from "@/types/service-point"

export interface ServicePointFormDraft {
  label: string
  code: string
  roomType: string
  capacity: string
  pricePerNight: string
  beds: string
  bedConfiguration: { bedType: string; count: number | "" }[]
  viewType: string
  maxGuests: string
  description: string
  amenities: string[]
  images: string[]
}

function createDraft(initialData: ServicePoint | null): ServicePointFormDraft {
  return {
    label: initialData?.label || "",
    code: initialData?.code || "",
    roomType: initialData?.roomType || "",
    capacity: initialData?.capacity ? String(initialData.capacity) : "",
    pricePerNight: initialData?.pricePerNight
      ? String(initialData.pricePerNight)
      : "",
    beds: initialData?.beds ? String(initialData.beds) : "",
    bedConfiguration: initialData?.bedConfiguration?.length
      ? initialData.bedConfiguration.map((bed) => ({ ...bed }))
      : [],
    viewType: initialData?.viewType || "",
    maxGuests: initialData?.maxGuests != null
      ? String(initialData.maxGuests)
      : initialData?.capacity != null ? String(initialData.capacity) : "",
    description: initialData?.fullDescription || initialData?.description || "",
    amenities: initialData?.amenities || [],
    images: initialData?.images || [],
  }
}

export function useServicePointModalForm({
  isOpen,
  initialData,
  onSave,
  onClose,
}: Pick<
  ServicePointModalProps,
  "isOpen" | "initialData" | "onSave" | "onClose"
>) {
  const [draft, setDraft] = useState<ServicePointFormDraft>(() =>
    createDraft(initialData)
  )
  const [formError, setFormError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft(createDraft(initialData))
    setFormError("")
  }, [initialData, isOpen])

  function setField<K extends keyof ServicePointFormDraft>(
    field: K,
    value: ServicePointFormDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function savePayload(
    payload: ServicePointFormPayload,
    fallbackError: string,
  ) {
    try {
      setIsSaving(true)
      await onSave(payload)
      onClose()
    } catch (error: any) {
      setFormError(error.response?.data?.error || fallbackError)
    } finally {
      setIsSaving(false)
    }
  }

  return {
    draft,
    setField,
    formError,
    setFormError,
    isSaving,
    savePayload,
  }
}

export function ServicePointModalFoundation({
  isOpen,
  onClose,
  isEditing,
  term,
  description,
  children,
  formError,
  errorVariant = "inline",
  isSaving,
  isBusy = isSaving,
  onSubmit,
  contentClassName = "sm:max-w-md",
  bodyClassName = "space-y-4 py-4",
  footerClassName,
  submitClassName,
}: Pick<
  ServicePointModalProps,
  "isOpen" | "onClose" | "isEditing" | "term"
> & {
  description: ReactNode
  children: ReactNode
  formError: string
  errorVariant?: "inline" | "panel"
  isSaving: boolean
  isBusy?: boolean
  onSubmit: () => void
  contentClassName?: string
  bodyClassName?: string
  footerClassName?: string
  submitClassName?: string
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit ${term.singular}` : `Add New ${term.singular}`}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className={bodyClassName}>
          {children}
          {formError && errorVariant === "inline" && (
            <p className="text-sm text-red-500 font-medium px-1 flex items-center gap-1.5 italic">
              <X className="w-3.5 h-3.5" />
              {formError}
            </p>
          )}
        </div>

        {formError && errorVariant === "panel" && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg flex items-center gap-2 text-sm font-medium mt-2">
            <X className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}

        <DialogFooter className={footerClassName}>
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isBusy}
            className={submitClassName}
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
