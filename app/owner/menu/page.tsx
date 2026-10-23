"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect, useRef } from "react"
import * as Select from "@radix-ui/react-select"
import { useForm } from "react-hook-form"
import { UtensilsCrossed, Plus, Search, Edit2, Trash2, Image as ImageIcon, X, Check, Upload, Loader2, Clock, ChevronDown, Package, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Field } from "@/components/forms/Field"
import { FormNotice } from "@/components/forms/FormNotice"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatPrice, pluralize } from "@/lib/localization"
import { formatInventoryQuantity, getInventoryDuplicateSignal } from "@/lib/inventory"
import { apiClient } from "@/lib/axios-config"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { getMenuImageSrc, setFallbackMenuImage } from "@/lib/menu-image"
import { useSetupProgress } from "@/contexts/SetupProgressContext"
import { useBusinessSettings } from "@/contexts/BusinessContext"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { classifyFormApiError, type FormApiError } from "@/lib/forms/api-error"
import type {
  InventoryDuplicateSignal,
  SimpleStockMenuRemovalPreview,
} from "@/types/inventory"
import {
  formatMenuCategoryName,
  getMenuCategoryDefaultValues,
  getMenuItemDefaultValues,
  menuCategorySchema,
  menuItemSchema,
  parseMenuItemPriceInput,
  toMenuCategoryPayload,
  type MenuCategoryFormValues,
  type MenuItemFormValues,
} from "./page.validation"

// API Base URL

export interface MenuItem {
  _id?: string
  id?: string
  businessId: string
  name: string
  description: string
  price: number
  prepTimeMinutes: number | null
  imageUrl: string
  category: string
  type: "food" | "drinks"
  fulfillmentStation?: "kitchen" | "bar" | null
  fulfillmentBehavior?: "prepared" | "direct" | null
  image?: string
  orderCategory?: string
  isAvailable: boolean
  availabilityStatus?: "available" | "sold_out" | "unavailable"
  manualIsAvailable?: boolean
  trackStock?: boolean
  stockQuantity?: number | null
  lowStockThreshold?: number
  inventory?: {
    trackingState: "untracked" | "legacy" | "canonical_simple" | "canonical_recipe"
    mode: "simple" | "recipe" | null
    mappingStatus: "active" | "disabled" | null
    inventoryItemId: string | null
    unit: "piece" | "bottle" | "can" | "pack" | "portion" | null
    availableQuantity: number | null
    lowStockThreshold: number | null
    isLowStock: boolean | null
    effectiveIsAvailable: boolean
    recipeComponentCount?: number | null
    ingredientAvailabilityEnforced?: boolean
    ingredientTracking?: {
      configured: boolean
      status: "active" | "disabled" | "orphaned" | null
      componentCount: number
      behavior: "sidecar" | "authoritative" | null
    }
    disabledReason?: "owner_disabled" | "legacy_rollback" | null
  }
}

type MenuItemFeatureState = {
  imageUrl: string
  trackStock: boolean
  stockQuantity: number | null
  lowStockThreshold: string
  stockUnit: "piece" | "bottle" | "can" | "pack" | "portion"
}

function getMenuItemFeatureDefaultValues(): MenuItemFeatureState {
  return {
    imageUrl: "",
    trackStock: false,
    stockQuantity: null,
    lowStockThreshold: "5",
    stockUnit: "piece",
  }
}

interface ModernSelectOption {
  value: string
  label: string
}

type AvailabilityFilter = "all" | "available" | "unavailable"
type StockFilter = "all" | "in_stock" | "low_stock" | "sold_out" | "unlimited" | "ingredient_tracked"
type FulfillmentFilter = "all" | "kitchen" | "bar"
type SortOption = "name" | "price" | "category" | "availability"

type StockPresentation = {
  key: Exclude<StockFilter, "all">
  label: string
  className: string
}

const MENU_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const MENU_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function getRequestErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { error?: unknown; message?: unknown } } })
    ?.response?.data
  if (typeof message?.error === "string") return message.error
  if (typeof message?.message === "string") return message.message
  return fallback
}

function validateMenuImage(file: File) {
  if (!MENU_IMAGE_MIME_TYPES.has(file.type)) {
    return "Choose a JPG, PNG, or WebP image."
  }
  if (file.size > MENU_IMAGE_MAX_BYTES) {
    return "Image must be 5MB or smaller."
  }
  return null
}

function getManualAvailability(item: MenuItem) {
  return item.manualIsAvailable ?? item.isAvailable
}

function getFulfillmentStation(item: MenuItem): Exclude<FulfillmentFilter, "all"> {
  return item.fulfillmentStation || (item.type === "drinks" ? "bar" : "kitchen")
}

function getStockPresentation(item: MenuItem): StockPresentation {
  const trackingState = item.inventory?.trackingState
  const quantity = item.inventory?.availableQuantity ?? item.stockQuantity
  const threshold = item.inventory?.lowStockThreshold ?? item.lowStockThreshold ?? 5
  const unit = item.inventory?.unit || "portion"

  if ((trackingState === "canonical_simple" || trackingState === "legacy") && typeof quantity === "number") {
    if (quantity <= 0) {
      return { key: "sold_out", label: "Sold out", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" }
    }
    if (quantity <= threshold) {
      return {
        key: "low_stock",
        label: `Low stock · ${formatInventoryQuantity(quantity, unit)} left`,
        className: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      }
    }
    return {
      key: "in_stock",
      label: `In stock · ${formatInventoryQuantity(quantity, unit)}`,
      className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    }
  }

  if (trackingState === "canonical_recipe") {
    if (getManualAvailability(item) && item.inventory?.effectiveIsAvailable === false) {
      return { key: "sold_out", label: "Sold out", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" }
    }
    return {
      key: "ingredient_tracked",
      label: item.inventory?.effectiveIsAvailable ? "In stock · Ingredient tracked" : "Ingredient tracked",
      className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    }
  }

  return {
    key: "unlimited",
    label: item.inventory?.mappingStatus === "disabled" ? "Simple Stock off" : "In stock · Unlimited",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  }
}

function ModernSelect({
  value,
  options,
  onValueChange,
  placeholder,
  ariaLabel,
  id,
  ariaInvalid,
  ariaDescribedBy,
  compact = false,
}: {
  value?: string
  options: ModernSelectOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  id?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  compact?: boolean
}) {
  return (
    <Select.Root value={value ?? ""} onValueChange={onValueChange}>
      <Select.Trigger
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={`group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left font-medium text-foreground shadow-sm transition-all outline-none hover:border-primary/40 focus:ring-2 focus:ring-primary/20 data-[state=open]:border-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary/20 ${compact ? "h-10 text-sm" : "h-[50px] capitalize"}`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-card p-1 text-foreground shadow-2xl"
        >
          <Select.Viewport className="max-h-64 overflow-y-auto">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center rounded-lg py-2.5 pl-9 pr-3 text-sm font-semibold capitalize outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:bg-secondary"
              >
                <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary">
                  <Check className="h-4 w-4" />
                </Select.ItemIndicator>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function MenuGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      role="status"
      aria-label="Loading menu items"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <Skeleton className="h-7 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function MenuPage() {
  const { user } = useAuthGuard()
  const { refreshSetupProgress } = useSetupProgress()
  const { currency } = useBusinessSettings()
  const canManageMenu = hasManagementPermission(user, MANAGER_PERMISSIONS.MENU_MANAGE)
  const canManageInventory = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_MANAGE)
  const canAdjustInventory = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_ADJUST)
  const canConfigureSimpleStock = canManageMenu && canManageInventory && canAdjustInventory
  const canRemoveSimpleStockInventory = canManageMenu && canManageInventory
  const canManageOperationalSettings = hasManagementPermission(user, MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE)
  const [items, setItems] = useState<MenuItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedMenuItems, setHasLoadedMenuItems] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all")
  const [stockFilter, setStockFilter] = useState<StockFilter>("all")
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>("all")
  const [sortOption, setSortOption] = useState<SortOption>("name")

  const [activeCategory, setActiveCategory] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [categories, setCategories] = useState<string[]>(["appetizers", "mains", "desserts", "beverages"])
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [categoryFormError, setCategoryFormError] = useState<FormApiError | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletionPreview, setDeletionPreview] = useState<SimpleStockMenuRemovalPreview | null>(null)
  const [deletionPreviewLoading, setDeletionPreviewLoading] = useState(false)
  const [deletionPreviewError, setDeletionPreviewError] = useState<string | null>(null)
  const [simpleStockSignal, setSimpleStockSignal] = useState<InventoryDuplicateSignal | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [availabilityUpdatingId, setAvailabilityUpdatingId] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const categorySubmissionInFlight = useRef(false)

  const {
    register: registerCategory,
    handleSubmit: handleCategorySubmit,
    reset: resetCategoryForm,
    formState: { errors: categoryErrors, isSubmitting: isCategorySubmitting },
  } = useForm<MenuCategoryFormValues>({
    resolver: zodResolver(menuCategorySchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getMenuCategoryDefaultValues(),
  })
  const categoryRegistration = registerCategory("category")

  const resetCategoryCreation = () => {
    resetCategoryForm(getMenuCategoryDefaultValues())
    setCategoryFormError(null)
  }

  const {
    register: registerMenuItem,
    handleSubmit: handleMenuItemSubmit,
    reset: resetMenuItemForm,
    setValue: setMenuItemValue,
    watch: watchMenuItem,
    formState: { errors: menuItemErrors, isSubmitting: isMenuItemSubmitting },
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: getMenuItemDefaultValues(),
  })
  const menuItemValues = watchMenuItem()
  const menuItemNameRegistration = registerMenuItem("name", {
    onChange: (event) => {
      event.target.value = event.target.value.replace(/^(\s*)(\S)/, (_: string, spaces: string, first: string) => `${spaces}${first.toUpperCase()}`)
    },
  })
  const [itemFeatureState, setItemFeatureState] = useState<MenuItemFeatureState>(getMenuItemFeatureDefaultValues)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveInFlight = useRef(false)

  // Load menu items once session user is available
  useEffect(() => {
    if (user) {
      fetchMenuItems()
      fetchCategories()
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCategories = async () => {
    try {
      const res = await apiClient.get("/business/categories", {
        params: { businessId: user?.businessId }
      })
      setCategories(res.data)
    } catch (err) {
      console.error("[fetchCategories]", err)
    }
  }


  const fetchMenuItems = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await apiClient.get("/menu-items", {
        params: { businessId: user?.businessId }
      })
      setItems(res.data)
    } catch (err) {
      console.error("[fetchMenuItems]", err)
      setLoadError("We couldn't load your menu items. Please try again.")
    } finally {
      setIsLoading(false)
      setHasLoadedMenuItems(true)
    }
  }

  // Handlers
  const handleOpenModal = (item?: MenuItem) => {
    setSimpleStockSignal(null)
    setImageUploadError(null)
    setSaveError(null)
    if (item) {
      setEditingItem(item)
      resetMenuItemForm({
        name: item.name,
        description: item.description,
        price: String(item.price),
        prepTimeMinutes: item.fulfillmentBehavior === "direct" ? "" : String(item.prepTimeMinutes ?? 10),
        category: item.category,
        type: item.type,
        fulfillmentStation: item.fulfillmentStation || (item.type === "drinks" ? "bar" : "kitchen"),
        fulfillmentBehavior: item.fulfillmentBehavior || (item.type === "drinks" ? "direct" : "prepared"),
        isAvailable: item.manualIsAvailable ?? item.isAvailable,
      })
      setItemFeatureState({
        imageUrl: item.imageUrl || "",
        trackStock: item.inventory?.mode === "simple"
          ? item.inventory.mappingStatus === "active"
          : item.trackStock || false,
        stockQuantity: item.stockQuantity ?? null,
        lowStockThreshold: String(item.lowStockThreshold ?? 5),
        stockUnit: item.inventory?.unit || "piece",
      })
    } else {
      setEditingItem(null)
      resetMenuItemForm(getMenuItemDefaultValues(
        activeCategory !== "all" ? activeCategory : (categories.length > 0 ? categories[0] : "mains"),
      ))
      setItemFeatureState(getMenuItemFeatureDefaultValues())
    }
    setIsAddingCategory(false)
    resetCategoryCreation()
    setIsModalOpen(true)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("create") === "1") {
      handleOpenModal()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setIsAddingCategory(false)
    resetCategoryCreation()
    setSimpleStockSignal(null)
    setImageUploadError(null)
    setSaveError(null)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  useEffect(() => {
    setDeletionPreview(null)
    setDeletionPreviewError(null)
    if (
      !itemToDelete?._id ||
      itemToDelete.inventory?.trackingState !== "canonical_simple" ||
      !canRemoveSimpleStockInventory
    ) {
      setDeletionPreviewLoading(false)
      return
    }

    const controller = new AbortController()
    setDeletionPreviewLoading(true)
    void apiClient.get<SimpleStockMenuRemovalPreview>(
      `/owner/inventory/simple-stock/menu-items/${encodeURIComponent(itemToDelete._id)}/removal-preview`,
      { signal: controller.signal },
    ).then((response) => {
      setDeletionPreview(response.data)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        const message = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error
        setDeletionPreviewError(typeof message === "string" ? message : "Inventory removal options could not be loaded")
      }
    }).finally(() => {
      if (!controller.signal.aborted) setDeletionPreviewLoading(false)
    })
    return () => controller.abort()
  }, [canRemoveSimpleStockInventory, itemToDelete])

  useEffect(() => {
    setSimpleStockSignal(null)
  }, [menuItemValues.category, menuItemValues.name, itemFeatureState.stockUnit, itemFeatureState.trackStock])

  const handleAddCategory = async (values: MenuCategoryFormValues) => {
    if (categorySubmissionInFlight.current) return

    categorySubmissionInFlight.current = true
    setCategoryFormError(null)
    try {
      const res = await apiClient.post("/business/categories", {
        businessId: user?.businessId,
        ...toMenuCategoryPayload(values),
      })
      setCategories(res.data)
      setMenuItemValue("category", values.category.trim().toLowerCase(), { shouldDirty: true, shouldValidate: true })
      setIsAddingCategory(false)
      resetCategoryCreation()
      toast.success("Category added.")
    } catch (err) {
      console.error("[handleAddCategory]", err)
      setCategoryFormError(classifyFormApiError(err, "Failed to add category. Please try again."))
    } finally {
      categorySubmissionInFlight.current = false
    }
  }

  const handleDeleteCategory = async (categoryToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the category "${categoryToDelete}"?`)) return
    
    try {
      const res = await apiClient.delete("/business/categories", {
        params: {
          businessId: user?.businessId,
          category: categoryToDelete
        }
      })
      
      setCategories(res.data)
      
      if (menuItemValues.category === categoryToDelete) {
        setMenuItemValue("category", "mains", { shouldDirty: true, shouldValidate: true })
      }
      toast.success("Category removed.")
    } catch (err) {
      console.error("[handleDeleteCategory]", err)
      toast.error(getRequestErrorMessage(err, "Failed to delete category. Please try again."))
    }
  }

  const handleSave = async (
    values: MenuItemFormValues,
    resolution?: {
      inventoryItemId?: string
      reactivateInventoryItem?: boolean
      allowCategoryVariant?: boolean
    },
  ) => {
    if (saveInFlight.current) return

    const price = parseMenuItemPriceInput(values.price)
    const requiresPreparation = values.fulfillmentBehavior !== "direct"
    const prepTimeMinutes = Number(values.prepTimeMinutes)
    if (price === null || price <= 0 || (requiresPreparation && (!Number.isInteger(prepTimeMinutes) || prepTimeMinutes < 1))) return

    const threshold = itemFeatureState.lowStockThreshold.trim()
      ? Number(itemFeatureState.lowStockThreshold)
      : 5
    const requestedQuantity = itemFeatureState.stockQuantity ?? 0
    if (itemFeatureState.trackStock && (!Number.isSafeInteger(threshold) || threshold < 0)) {
      toast.error("Low Stock Alert must be a whole number of zero or more.")
      return
    }
    if (itemFeatureState.trackStock && (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 0)) {
      toast.error("Available Quantity must be a whole number of zero or more.")
      return
    }

    saveInFlight.current = true
    setSimpleStockSignal(null)
    setSaveError(null)
    setIsSaving(true)
    try {
      const basePayload = {
        name: values.name,
        description: values.description,
        price,
        prepTimeMinutes: requiresPreparation ? prepTimeMinutes : null,
        category: values.category,
        type: values.type,
        fulfillmentStation: values.type === "drinks" ? "bar" : "kitchen",
        fulfillmentBehavior: values.type === "drinks"
          ? values.fulfillmentBehavior || "direct"
          : "prepared",
        imageUrl: itemFeatureState.imageUrl,
        businessId: user?.businessId,
      }
      if (editingItem && editingItem._id) {
        const mapped = Boolean(editingItem.inventory?.mappingStatus)
        const simpleMapped = editingItem.inventory?.mode === "simple"
        await apiClient.patch(`/menu-items/${editingItem._id}`, mapped
          ? basePayload
          : {
              ...basePayload,
              isAvailable: values.isAvailable,
              trackStock: itemFeatureState.trackStock,
              stockQuantity: itemFeatureState.stockQuantity,
              lowStockThreshold: threshold,
            })

        if (mapped) {
          if (simpleMapped) {
            const currentlyEnabled = editingItem.inventory?.mappingStatus === "active"
            if (Boolean(itemFeatureState.trackStock) !== currentlyEnabled) {
              await apiClient.patch(
                `/owner/inventory/simple-stock/menu-items/${editingItem._id}/settings`,
                { enabled: Boolean(itemFeatureState.trackStock) },
              )
            }
            if (itemFeatureState.trackStock && currentlyEnabled) {
              if (threshold !== (editingItem.lowStockThreshold ?? 5)) {
                await apiClient.patch(
                  `/owner/inventory/simple-stock/menu-items/${editingItem._id}/settings`,
                  { lowStockThreshold: threshold },
                )
              }
              const currentQuantity = editingItem.stockQuantity ?? 0
              const delta = requestedQuantity - currentQuantity
              if (delta !== 0) {
                await apiClient.post(
                  `/owner/inventory/simple-stock/menu-items/${editingItem._id}/adjust`,
                  {
                    quantity: Math.abs(delta),
                    unit: editingItem.inventory?.unit || itemFeatureState.stockUnit,
                    direction: delta > 0 ? "increase" : "decrease",
                    reason: "data_correction",
                    reference: `menu-item:${editingItem._id}`,
                    note: "Owner menu stock adjustment",
                  },
                  { headers: { "Idempotency-Key": crypto.randomUUID() } },
                )
              }
            }
          }
          if (values.isAvailable !== (editingItem.manualIsAvailable ?? editingItem.isAvailable)) {
            await apiClient.patch(`/menu-items/${editingItem._id}/availability`, {
              businessId: user?.businessId,
              isAvailable: values.isAvailable,
            })
          }
        }
      } else if (itemFeatureState.trackStock) {
        await apiClient.post(
          "/owner/inventory/simple-stock/menu-items",
          {
            ...basePayload,
            isAvailable: values.isAvailable,
            trackStock: true,
            openingQuantity: requestedQuantity,
            lowStockThreshold: threshold,
            stockUnit: itemFeatureState.stockUnit,
            ...resolution,
          },
          { headers: { "Idempotency-Key": crypto.randomUUID() } },
        )
      } else {
        await apiClient.post("/menu-items", {
          ...basePayload,
          isAvailable: values.isAvailable,
          trackStock: false,
        })
      }

      handleCloseModal()
      fetchMenuItems()
      await refreshSetupProgress()
      toast.success(editingItem ? "Menu item updated." : "Menu item added.")
    } catch (err) {
      console.error("[handleSave]", err)
      const duplicateSignal = getInventoryDuplicateSignal(err)
      if (!editingItem && itemFeatureState.trackStock && duplicateSignal) {
        setSimpleStockSignal(duplicateSignal)
        return
      }
      const message = getRequestErrorMessage(err, "Failed to save menu item. Please try again.")
      setSaveError(message)
      toast.error(message)
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  const submitMenuItemForm = (resolution?: {
    inventoryItemId?: string
    reactivateInventoryItem?: boolean
    allowCategoryVariant?: boolean
  }) => {
    void handleMenuItemSubmit((values) => handleSave(values, resolution))()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingItem?._id) return

    const validationError = validateMenuImage(file)
    if (validationError) {
      setImageUploadError(validationError)
      toast.error(validationError)
      e.target.value = ""
      return
    }

    const form = new FormData()
    form.append("image", file)
    form.append("menuItemId", editingItem._id)

    try {
      setIsUploadingImage(true)
      setImageUploadError(null)
      const res = await apiClient.post("/upload/menu-item", form, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      setItemFeatureState((current) => ({ ...current, imageUrl: res.data.imageUrl }))
      // Update the item in the list immediately
      setItems(prev => prev.map(i =>
        i._id === editingItem._id ? { ...i, imageUrl: res.data.imageUrl } : i
      ))
      toast.success("Menu item image updated.")
    } catch (err: unknown) {
      const message = getRequestErrorMessage(err, "Image upload failed. Please try again.")
      setImageUploadError(message)
      toast.error(message)
    } finally {
      setIsUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
    }
  }

  // New item: upload to get URL only, saved with record on submit
  const handleNewItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateMenuImage(file)
    if (validationError) {
      setImageUploadError(validationError)
      toast.error(validationError)
      e.target.value = ""
      return
    }

    const form = new FormData()
    form.append("image", file)
    form.append("folder", "quickserve/menu-items")

    try {
      setIsUploadingImage(true)
      setImageUploadError(null)
      const res = await apiClient.post("/upload/image", form, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      setItemFeatureState((current) => ({ ...current, imageUrl: res.data.url }))
      toast.success("Image uploaded. Save the item to finish.")
    } catch (err: unknown) {
      const message = getRequestErrorMessage(err, "Image upload failed. Please try again.")
      setImageUploadError(message)
      toast.error(message)
    } finally {
      setIsUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
    }
  }

  const handleDelete = (item: MenuItem) => {
    setItemToDelete(item)
  }

  const handleDeleteConfirm = async (item: MenuItem, removeInventory = false) => {
    setIsDeleting(true)
    setDeletionPreviewError(null)
    try {
      if (removeInventory) {
        await apiClient.delete(`/owner/inventory/simple-stock/menu-items/${item._id}`)
      } else {
        await apiClient.delete(`/menu-items/${item._id}`, {
          params: { businessId: user?.businessId }
        })
      }

      // Remove locally
      setItems((current) => current.filter((candidate) => candidate._id !== item._id))
      setItemToDelete(null)
      toast.success(removeInventory ? "Menu item and linked inventory removed." : "Menu item removed.")
    } catch (err) {
      console.error("[handleDelete]", err)
      const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error
      setDeletionPreviewError(typeof message === "string" ? message : "Failed to remove this item")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleAvailability = async (id: string, currentManualStatus: boolean) => {
    setAvailabilityUpdatingId(id)
    try {
      await apiClient.patch(`/menu-items/${id}/availability`, {
        businessId: user?.businessId,
        isAvailable: !currentManualStatus
      })
      await fetchMenuItems()
    } catch (err) {
      console.error("[handleToggleAvailability]", err)
      toast.error(getRequestErrorMessage(err, "Failed to update availability. Please try again."))
    } finally {
      setAvailabilityUpdatingId(null)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "all" || item.category === activeCategory
    const matchesAvailability = availabilityFilter === "all" ||
      (availabilityFilter === "available" ? item.isAvailable : !item.isAvailable)
    const matchesStock = stockFilter === "all" || getStockPresentation(item).key === stockFilter
    const matchesFulfillment = fulfillmentFilter === "all" ||
      getFulfillmentStation(item) === fulfillmentFilter
    return matchesSearch && matchesCategory && matchesAvailability && matchesStock && matchesFulfillment
  }).sort((left, right) => {
    if (sortOption === "price") return left.price - right.price
    if (sortOption === "category") {
      return left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
    }
    if (sortOption === "availability") {
      return Number(right.isAvailable) - Number(left.isAvailable) || left.name.localeCompare(right.name)
    }
    return left.name.localeCompare(right.name)
  })
  const isInitialLoading = isLoading && !hasLoadedMenuItems
  const hasToolbarFilters = Boolean(searchQuery) || availabilityFilter !== "all" ||
    stockFilter !== "all" || fulfillmentFilter !== "all" || sortOption !== "name"
  const hasAnyFilters = hasToolbarFilters || activeCategory !== "all"

  const clearFilters = () => {
    setSearchQuery("")
    setAvailabilityFilter("all")
    setStockFilter("all")
    setFulfillmentFilter("all")
    setSortOption("name")
    setActiveCategory("all")
  }

  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = items.filter(item => item.category === cat).length
    return acc
  }, {} as Record<string, number>)
  const descriptionWordCount = menuItemValues.description.trim().split(/\s+/).filter(Boolean).length || 0
  const stockQuantity = itemFeatureState.stockQuantity
  const stockQuantityInvalid = Boolean(itemFeatureState.trackStock && stockQuantity != null &&
    (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0))
  const lowStockThreshold = itemFeatureState.lowStockThreshold.trim() ? Number(itemFeatureState.lowStockThreshold) : 5
  const lowStockThresholdInvalid = Boolean(itemFeatureState.trackStock &&
    (!Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0))
  const isSaveDisabled = isSaving || isMenuItemSubmitting || isUploadingImage || stockQuantityInvalid || lowStockThresholdInvalid

  return (
    <div className="pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Menu</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage your menu items and categories</p>
          </div>
          {canManageMenu && (
            <Button
              onClick={() => handleOpenModal()}
              className="h-10 w-full gap-2 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>
      </header>

      <main className="space-y-4 p-4 sm:p-6">
        {isInitialLoading ? (
          <div className="flex gap-2 overflow-hidden" aria-label="Loading categories">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-28 shrink-0 rounded-full" />
            ))}
          </div>
        ) : (
          <nav className="flex snap-x gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" aria-label="Menu categories">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              aria-current={activeCategory === "all" ? "page" : undefined}
              className={`min-h-9 snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40 ${activeCategory === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
            >
              All ({items.length})
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                onClick={() => setActiveCategory(category)}
                aria-current={activeCategory === category ? "page" : undefined}
                className={`min-h-9 snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold capitalize outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40 ${activeCategory === category ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
              >
                {category} ({categoryCounts[category] || 0})
              </button>
            ))}
          </nav>
        )}

        {isInitialLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Skeleton className="h-10 sm:col-span-2 lg:col-span-1" />
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10" />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_repeat(4,minmax(130px,auto))]">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <label htmlFor="menu-search" className="sr-only">Search menu items</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="menu-search"
                  type="search"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <ModernSelect
                compact
                ariaLabel="Filter by availability"
                value={availabilityFilter}
                options={[
                  { value: "all", label: "Availability" },
                  { value: "available", label: "Available" },
                  { value: "unavailable", label: "Unavailable" },
                ]}
                onValueChange={(value) => setAvailabilityFilter(value as AvailabilityFilter)}
              />
              <ModernSelect
                compact
                ariaLabel="Filter by stock state"
                value={stockFilter}
                options={[
                  { value: "all", label: "Stock" },
                  { value: "in_stock", label: "In stock" },
                  { value: "low_stock", label: "Low stock" },
                  { value: "sold_out", label: "Sold out" },
                  { value: "unlimited", label: "Unlimited / stock off" },
                  { value: "ingredient_tracked", label: "Ingredient tracked" },
                ]}
                onValueChange={(value) => setStockFilter(value as StockFilter)}
              />
              <ModernSelect
                compact
                ariaLabel="Filter by fulfilment"
                value={fulfillmentFilter}
                options={[
                  { value: "all", label: "Fulfilment" },
                  { value: "kitchen", label: "Food — Kitchen" },
                  { value: "bar", label: "Drink — Bar" },
                ]}
                onValueChange={(value) => setFulfillmentFilter(value as FulfillmentFilter)}
              />
              <ModernSelect
                compact
                ariaLabel="Sort menu items"
                value={sortOption}
                options={[
                  { value: "name", label: "Sort: Name" },
                  { value: "price", label: "Sort: Price" },
                  { value: "category", label: "Sort: Category" },
                  { value: "availability", label: "Sort: Availability" },
                ]}
                onValueChange={(value) => setSortOption(value as SortOption)}
              />
            </div>
            {hasAnyFilters && (
              <div className="flex justify-end px-1 pt-2">
                <button type="button" onClick={clearFilters} className="min-h-8 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {loadError && items.length > 0 && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <span>{loadError} Existing menu items are still shown below.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void fetchMenuItems()} className="shrink-0 rounded-lg">Retry</Button>
          </div>
        )}

        {loadError && items.length === 0 ? (
          <div role="alert" className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <AlertCircle className="mb-3 h-9 w-9 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">Menu items couldn't be loaded</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => void fetchMenuItems()} className="mt-5 rounded-xl">Retry</Button>
          </div>
        ) : isInitialLoading ? (
          <MenuGridSkeleton />
        ) : items.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><UtensilsCrossed className="h-7 w-7 text-primary" /></div>
            <h2 className="text-xl font-bold text-foreground">No menu items yet.</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">Add your first item to start building your menu.</p>
            {canManageMenu && <Button onClick={() => handleOpenModal()} className="mt-5 gap-2 rounded-xl font-bold"><Plus className="h-4 w-4" />Add Item</Button>}
          </div>
        ) : filteredItems.length > 0 ? (
          <section aria-label="Menu items" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredItems.map((item) => {
              const stock = getStockPresentation(item)
              const manualAvailable = getManualAvailability(item)
              const station = getFulfillmentStation(item)
              const direct = (item.fulfillmentBehavior || (item.type === "drinks" ? "direct" : "prepared")) === "direct"
              return (
                <article key={item._id || item.id} className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                  <div className="h-36 shrink-0 bg-secondary sm:h-32 xl:h-36">
                    <img
                      src={getMenuImageSrc(item.imageUrl)}
                      alt={`${item.name} menu item`}
                      className="h-full w-full object-cover"
                      onError={(event) => setFallbackMenuImage(event.currentTarget)}
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <h2 className="min-w-0 truncate text-base font-extrabold text-foreground" title={item.name}>{item.name}</h2>
                      <span className="shrink-0 text-sm font-black text-foreground">{formatPrice(item.price, currency)}</span>
                    </div>
                    <span className="mt-2 w-fit max-w-full truncate rounded-md bg-secondary px-2 py-1 text-[11px] font-bold capitalize text-muted-foreground">{item.category}</span>
                    <p className="mt-2 min-h-10 flex-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description || "No description"}</p>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{direct ? `${station === "bar" ? "Bar" : "Kitchen"} · Ready to serve` : `${station === "bar" ? "Bar" : "Kitchen"} · ${item.prepTimeMinutes ?? 10} min`}</span>
                    </div>
                    <div className={`mt-2 flex w-fit max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold ${stock.className}`}>
                      <Package className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{stock.label}</span>
                    </div>
                    {canManageMenu && (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                        <label className="flex min-w-0 cursor-pointer items-center gap-2">
                          <Switch
                            checked={manualAvailable}
                            disabled={availabilityUpdatingId === item._id}
                            onCheckedChange={() => item._id && void handleToggleAvailability(item._id, manualAvailable)}
                            aria-label={`${manualAvailable ? "Make" : "Set"} ${item.name} ${manualAvailable ? "unavailable" : "available"}`}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                          <span className="truncate text-xs font-semibold text-muted-foreground">{manualAvailable ? "Available" : "Unavailable"}</span>
                        </label>
                        <div className="flex shrink-0 gap-1.5">
                          <button type="button" onClick={() => handleOpenModal(item)} aria-label={`Edit ${item.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-primary/30">
                            <Edit2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => handleDelete(item)} aria-label={`Delete ${item.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 outline-none transition-colors hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-400 dark:bg-red-950/30 dark:hover:bg-red-900/50">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        ) : activeCategory !== "all" && (categoryCounts[activeCategory] || 0) === 0 && !hasToolbarFilters ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <UtensilsCrossed className="mb-3 h-8 w-8 text-primary" />
            <h2 className="text-lg font-bold text-foreground">No items in this category.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add an item and it will appear here.</p>
            {canManageMenu && <Button onClick={() => handleOpenModal()} className="mt-5 gap-2 rounded-xl font-bold"><Plus className="h-4 w-4" />Add Item</Button>}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Search className="mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">No menu items match these filters.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Clear the filters to see all menu items.</p>
            <Button type="button" variant="outline" onClick={clearFilters} className="mt-5 rounded-xl font-bold">Clear filters</Button>
          </div>
        )}
      </main>

      {/* Add/Edit drawer */}
      <Sheet
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseModal()
        }}
      >
        <SheetContent
          side="right"
          className="h-dvh w-full max-w-none gap-0 overflow-hidden border-l bg-card p-0 sm:max-w-[500px]"
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 text-left">
            <SheetTitle className="text-xl font-black text-foreground">{editingItem ? "Edit Menu Item" : "Add Menu Item"}</SheetTitle>
            <SheetDescription>
              {editingItem ? `Update ${editingItem.name}'s menu details and operational settings.` : "Create a menu item and configure how it is prepared and stocked."}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6">
            <section aria-labelledby="item-details-heading" className="space-y-4">
              <div>
                <h2 id="item-details-heading" className="text-xs font-black uppercase tracking-[0.16em] text-[#00225B] dark:text-blue-200">Item Details</h2>
                <p className="mt-1 text-xs text-muted-foreground">What guests see on your menu.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">Item Image</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                    {isUploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Uploading image" />
                    ) : itemFeatureState.imageUrl ? (
                      <img src={getMenuImageSrc(itemFeatureState.imageUrl)} alt={`${menuItemValues.name || "Menu item"} preview`} className="h-full w-full object-cover" onError={(event) => setFallbackMenuImage(event.currentTarget)} />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      aria-label={`Upload an image for ${menuItemValues.name || "this menu item"}`}
                      onChange={editingItem?._id ? handleImageUpload : handleNewItemImageUpload}
                    />
                    <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage} className="h-10 gap-2 rounded-xl font-bold">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {isUploadingImage ? "Uploading..." : itemFeatureState.imageUrl ? "Change Image" : "Upload Image"}
                    </Button>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Max 5MB · JPG, PNG, WebP</p>
                    {imageUploadError && <p role="alert" className="mt-1.5 text-xs font-semibold text-destructive">{imageUploadError}</p>}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-end justify-between gap-3">
                  <label htmlFor="menu-item-name" className="text-xs font-bold text-foreground">Item Name *</label>
                  <span className={`text-[11px] font-semibold ${menuItemValues.name?.length === 30 ? "text-orange-600" : "text-muted-foreground"}`}>{menuItemValues.name?.length || 0} / 30</span>
                </div>
                <input
                  {...menuItemNameRegistration}
                  id="menu-item-name"
                  type="text"
                  maxLength={30}
                  aria-invalid={menuItemErrors.name ? true : undefined}
                  aria-describedby={menuItemErrors.name ? "menu-item-name-error" : menuItemValues.name.length === 30 ? "menu-item-name-help" : undefined}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive"
                  placeholder="e.g. Classic Cheeseburger"
                />
                {menuItemErrors.name ? <p id="menu-item-name-error" role="alert" className="mt-1 text-[11px] font-semibold text-destructive">{menuItemErrors.name.message}</p> : null}
                {menuItemValues.name.length === 30 && <p id="menu-item-name-help" className="mt-1 text-[11px] font-semibold text-orange-600">Item name must be 30 characters or less.</p>}
              </div>

              <div>
                <div className="mb-1.5 flex items-end justify-between gap-3">
                  <label htmlFor="menu-item-description" className="text-xs font-bold text-foreground">Description</label>
                  <span className={`text-[11px] font-semibold ${descriptionWordCount > 100 ? "text-destructive" : descriptionWordCount >= 90 ? "text-orange-600" : "text-muted-foreground"}`}>{descriptionWordCount} / 100 words</span>
                </div>
                <textarea
                  {...registerMenuItem("description")}
                  id="menu-item-description"
                  aria-invalid={menuItemErrors.description ? true : undefined}
                  aria-describedby={menuItemErrors.description ? "menu-item-description-error" : undefined}
                  className="h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive"
                  placeholder="Describe the item in detail..."
                />
                {menuItemErrors.description ? <p id="menu-item-description-error" role="alert" className="mt-1 text-[11px] font-semibold text-destructive">{menuItemErrors.description.message}</p> : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="menu-item-price" className="mb-1.5 block text-xs font-bold text-foreground">Price ({currency || "$"}) *</label>
                  <input
                    {...registerMenuItem("price")}
                    id="menu-item-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    aria-invalid={menuItemErrors.price ? true : undefined}
                    aria-describedby={menuItemErrors.price ? "menu-item-price-error" : undefined}
                    className="h-[50px] w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive"
                  />
                  {menuItemErrors.price ? <p id="menu-item-price-error" role="alert" className="mt-1 text-[11px] font-semibold text-destructive">{menuItemErrors.price.message}</p> : null}
                </div>
                <div>
                  <div className="mb-1.5 flex items-end justify-between gap-2">
                    <label className="text-xs font-bold text-foreground">Category *</label>
                    {canManageOperationalSettings && !isAddingCategory && (
                      <div className="flex items-center gap-2">
                        {menuItemValues.category && !["appetizers", "mains", "desserts", "beverages"].includes(menuItemValues.category.toLowerCase()) && (
                          <button type="button" onClick={() => handleDeleteCategory(menuItemValues.category!)} className="flex min-h-7 items-center gap-1 text-[11px] font-bold text-destructive hover:underline" aria-label={`Remove ${menuItemValues.category} category`}><Trash2 className="h-3 w-3" aria-hidden="true" />Remove</button>
                        )}
                        <button type="button" onClick={() => { resetCategoryCreation(); setIsAddingCategory(true) }} className="flex min-h-7 items-center gap-1 text-[11px] font-bold text-primary hover:underline"><Plus className="h-3 w-3" aria-hidden="true" />Add New</button>
                      </div>
                    )}
                  </div>
                  {!isAddingCategory ? (
                    <ModernSelect id="menu-item-category" ariaLabel="Menu item category" ariaInvalid={Boolean(menuItemErrors.category)} ariaDescribedBy={menuItemErrors.category ? "menu-item-category-error" : undefined} value={menuItemValues.category} options={categories.map((category) => ({ value: category, label: category }))} onValueChange={(value) => setMenuItemValue("category", value, { shouldDirty: true, shouldValidate: true })} placeholder="Select category" />
                  ) : (
                    <div className="space-y-2" aria-busy={isCategorySubmitting}>
                      <div className="flex items-center gap-1.5">
                        <Field id="new-menu-category" label={<span className="sr-only">New category name</span>} required className="min-w-0 flex-1 space-y-0" error={categoryErrors.category?.message}>
                          {(controlProps) => (
                            <input
                              {...categoryRegistration}
                              {...controlProps}
                              type="text"
                              onChange={(event) => {
                                event.target.value = formatMenuCategoryName(event.target.value)
                                categoryRegistration.onChange(event)
                                setCategoryFormError(null)
                              }}
                              placeholder="New category..."
                              className="h-[50px] min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive"
                              autoFocus
                            />
                          )}
                        </Field>
                        <Button type="button" onClick={() => void handleCategorySubmit(handleAddCategory)()} disabled={isCategorySubmitting} className="h-[50px] w-[50px] shrink-0 rounded-xl p-0" aria-label="Save category"><Check className="h-5 w-5" /></Button>
                        <Button type="button" variant="ghost" onClick={() => { setIsAddingCategory(false); resetCategoryCreation() }} disabled={isCategorySubmitting} className="h-[50px] w-[50px] shrink-0 rounded-xl p-0" aria-label="Cancel category creation"><X className="h-5 w-5" /></Button>
                      </div>
                      {categoryFormError ? (
                        <FormNotice tone={categoryFormError.kind === "rate_limit" ? "warning" : "error"}>
                          {categoryFormError.message}
                        </FormNotice>
                      ) : null}
                    </div>
                  )}
                  {menuItemErrors.category ? <p id="menu-item-category-error" role="alert" className="mt-1 text-[11px] font-semibold text-destructive">{menuItemErrors.category.message}</p> : null}
                </div>
              </div>
            </section>

            <section aria-labelledby="service-availability-heading" className="space-y-4 border-t border-border pt-6">
              <div>
                <h2 id="service-availability-heading" className="text-xs font-black uppercase tracking-[0.16em] text-[#00225B] dark:text-blue-200">Service &amp; Availability</h2>
                <p className="mt-1 text-xs text-muted-foreground">Control guest visibility and preparation routing.</p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 p-4">
                <div>
                  <label htmlFor="menu-form-availability" className="text-sm font-bold text-foreground">Availability</label>
                  <p className="mt-0.5 text-xs text-muted-foreground">When disabled, this item will not be visible to guests.</p>
                </div>
                <Switch id="menu-form-availability" checked={menuItemValues.isAvailable} onCheckedChange={(checked) => setMenuItemValue("isAvailable", checked, { shouldDirty: true })} aria-label="Menu item availability" className="data-[state=checked]:bg-emerald-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">Fulfilment *</label>
                <ModernSelect
                  ariaLabel="Menu item fulfilment"
                  value={menuItemValues.type}
                  options={[{ value: "food", label: "Food — Kitchen" }, { value: "drinks", label: "Drink — Bar" }]}
                  onValueChange={(value) => {
                    const type = value as MenuItemFormValues["type"]
                    setMenuItemValue("type", type, { shouldDirty: true, shouldValidate: true })
                    setMenuItemValue("fulfillmentStation", type === "drinks" ? "bar" : "kitchen", { shouldDirty: true, shouldValidate: true })
                    setMenuItemValue("fulfillmentBehavior", type === "drinks" ? "direct" : "prepared", { shouldDirty: true, shouldValidate: true })
                    setMenuItemValue("prepTimeMinutes", type === "drinks" ? "" : menuItemValues.prepTimeMinutes || "10", { shouldDirty: true, shouldValidate: true })
                  }}
                  placeholder="Select fulfilment"
                />
              </div>
              {menuItemValues.type === "drinks" && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-foreground">Drink handling *</label>
                  <ModernSelect ariaLabel="Drink handling" value={menuItemValues.fulfillmentBehavior} options={[{ value: "direct", label: "Ready to serve" }, { value: "prepared", label: "Requires preparation" }]} onValueChange={(value) => {
                    const fulfillmentBehavior = value as MenuItemFormValues["fulfillmentBehavior"]
                    setMenuItemValue("fulfillmentBehavior", fulfillmentBehavior, { shouldDirty: true, shouldValidate: true })
                    setMenuItemValue("prepTimeMinutes", fulfillmentBehavior === "prepared" ? menuItemValues.prepTimeMinutes || "10" : "", { shouldDirty: true, shouldValidate: true })
                  }} />
                </div>
              )}
              {menuItemValues.fulfillmentBehavior !== "direct" && (
                <div>
                  <label htmlFor="menu-item-prep-time" className="mb-1.5 block text-xs font-bold text-foreground">Average Preparation Time (minutes) *</label>
                  <input {...registerMenuItem("prepTimeMinutes")} id="menu-item-prep-time" type="number" min="1" step="1" aria-invalid={menuItemErrors.prepTimeMinutes ? true : undefined} aria-describedby={menuItemErrors.prepTimeMinutes ? "menu-item-prep-error" : "menu-item-prep-help"} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive" placeholder="e.g. 15" />
                  {menuItemErrors.prepTimeMinutes ? <p id="menu-item-prep-error" role="alert" className="mt-1 text-[11px] font-semibold text-destructive">{menuItemErrors.prepTimeMinutes.message}</p> : <p id="menu-item-prep-help" className="mt-1.5 text-xs text-muted-foreground">This helps estimate customer wait times.</p>}
                </div>
              )}
            </section>

            <section aria-labelledby="stock-ingredients-heading" className="space-y-4 border-t border-border pt-6">
              <div>
                <h2 id="stock-ingredients-heading" className="text-xs font-black uppercase tracking-[0.16em] text-[#00225B] dark:text-blue-200">Stock &amp; Ingredients</h2>
                <p className="mt-1 text-xs text-muted-foreground">Choose whether customers can order this item and review the ingredients used to make it.</p>
              </div>
              {editingItem?.inventory?.mode === "recipe" ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-bold text-foreground">Ingredients tracked</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{editingItem.inventory.recipeComponentCount ?? 0} {pluralize(editingItem.inventory.recipeComponentCount ?? 0, "ingredient")} are recorded when staff prepare this item. Low or missing ingredient stock will not stop customers from ordering it. Use the Available switch to pause sales.</p>
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
                  {editingItem?.inventory?.ingredientTracking?.configured && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-sm font-bold text-foreground">Sellable stock and ingredients</p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">Sellable stock: {formatInventoryQuantity(editingItem.inventory.availableQuantity ?? 0, editingItem.inventory.unit || "portion")}. {editingItem.inventory.ingredientTracking.componentCount} {pluralize(editingItem.inventory.ingredientTracking.componentCount, "ingredient")} are recorded when staff prepare this item. If Simple Stock is off, the Available switch decides whether customers can order it.</p>
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span>
                      <span className="block text-sm font-bold text-foreground">{editingItem?.inventory?.mappingStatus ? "Enable Simple Stock" : "Track with Simple Stock"}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Track sellable portions. Ingredient tracking remains separate.</span>
                    </span>
                    <Switch
                      checked={itemFeatureState.trackStock || false}
                      onCheckedChange={(checked) => setItemFeatureState((current) => ({ ...current, trackStock: checked }))}
                      disabled={editingItem?.inventory?.mappingStatus ? !canManageInventory : !editingItem && !canConfigureSimpleStock}
                      aria-label={editingItem?.inventory?.mappingStatus ? "Enable Simple Stock" : "Track with Simple Stock"}
                    />
                  </label>
                  {itemFeatureState.trackStock && (
                    <>
                      <div className="grid grid-cols-1 gap-4 border-t border-border/60 pt-4 sm:grid-cols-3">
                        <div>
                          <label htmlFor="menu-stock-quantity" className="mb-1.5 block text-xs font-bold text-foreground">Available Quantity</label>
                          <input id="menu-stock-quantity" type="number" value={itemFeatureState.stockQuantity === null ? "" : itemFeatureState.stockQuantity} min="0" step="1" placeholder="e.g. 20" aria-invalid={stockQuantityInvalid} aria-describedby={stockQuantityInvalid ? "menu-stock-quantity-error" : undefined} disabled={Boolean(editingItem?.inventory?.mappingStatus) && (editingItem?.inventory?.mappingStatus !== "active" || !canAdjustInventory)} onChange={(event) => setItemFeatureState((current) => ({ ...current, stockQuantity: event.target.value ? Number(event.target.value) : null }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-60" />
                          {stockQuantityInvalid && <p id="menu-stock-quantity-error" role="alert" className="mt-1 text-[11px] font-semibold text-destructive">Use a whole number of zero or more.</p>}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-foreground">Stock Unit</label>
                          {!editingItem ? (
                            <ModernSelect compact ariaLabel="Stock unit" value={itemFeatureState.stockUnit} options={[{ value: "piece", label: "Pieces" }, { value: "bottle", label: "Bottles" }, { value: "can", label: "Cans" }, { value: "pack", label: "Packs" }, { value: "portion", label: "Portions" }]} onValueChange={(value) => setItemFeatureState((current) => ({ ...current, stockUnit: value as MenuItemFeatureState["stockUnit"] }))} />
                          ) : (
                            <div className="flex h-11 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm font-semibold capitalize">{editingItem.inventory?.unit || "units"}</div>
                          )}
                        </div>
                        <div>
                          <label htmlFor="menu-low-stock" className="mb-1.5 block text-xs font-bold text-foreground">Low Stock Alert</label>
                          <input id="menu-low-stock" type="number" value={itemFeatureState.lowStockThreshold} min="0" step="1" placeholder="Default: 5" aria-invalid={lowStockThresholdInvalid} aria-describedby={lowStockThresholdInvalid ? "menu-low-stock-error" : undefined} disabled={Boolean(editingItem?.inventory?.mappingStatus) && !canManageInventory} onChange={(event) => setItemFeatureState((current) => ({ ...current, lowStockThreshold: event.target.value }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-60" />
                          {lowStockThresholdInvalid && <p id="menu-low-stock-error" role="alert" className="mt-1 text-[11px] font-semibold text-destructive">Use a whole number of zero or more.</p>}
                        </div>
                      </div>
                      {!editingItem && simpleStockSignal && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                          <p className="text-sm font-bold">{simpleStockSignal.conflictType === "strong" ? simpleStockSignal.candidate.isActive ? "An inventory item already matches this stock item" : "A matching inventory item is inactive" : "A similarly named inventory item uses another category"}</p>
                          <p className="mt-1 text-xs font-medium">{simpleStockSignal.candidate.name}{simpleStockSignal.candidate.category ? ` · ${simpleStockSignal.candidate.category}` : " · No category"}{` · ${formatInventoryQuantity(simpleStockSignal.candidate.availableQuantity, simpleStockSignal.candidate.trackingUnit)}`}</p>
                          <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-100/80">{simpleStockSignal.conflictType === "category_variant" ? "Create it separately only if the categories represent genuinely different stock items." : "Using the existing item keeps its current balance; the opening quantity above will not replace it."}</p>
                          <Button type="button" size="sm" variant="outline" disabled={isSaving || isMenuItemSubmitting} className="mt-3 border-amber-400 bg-background font-bold" onClick={() => submitMenuItemForm(simpleStockSignal.conflictType === "category_variant" ? { allowCategoryVariant: true } : { inventoryItemId: simpleStockSignal.candidate.inventoryItemId, reactivateInventoryItem: !simpleStockSignal.candidate.isActive })}>
                            {isSaving ? "Saving..." : simpleStockSignal.conflictType === "category_variant" ? "Create separate inventory item" : simpleStockSignal.candidate.isActive ? "Use existing inventory item" : "Reactivate and use existing item"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
          {saveError ? <div className="px-5 pb-3"><FormNotice>{saveError}</FormNotice></div> : null}

          <SheetFooter className="shrink-0 flex-row justify-end border-t border-border bg-card px-5 py-4">
            <Button type="button" onClick={handleCloseModal} variant="ghost" disabled={isSaving || isMenuItemSubmitting} className="min-h-10 rounded-xl font-bold">Cancel</Button>
            <Button type="button" onClick={() => submitMenuItemForm()} disabled={isSaveDisabled} className="min-h-10 rounded-xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save Item"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setItemToDelete(null)
            setDeletionPreview(null)
            setDeletionPreviewError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToDelete?.inventory?.trackingState === "canonical_simple"
                ? `Remove ${itemToDelete?.name}?`
                : `Delete ${itemToDelete?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.inventory?.trackingState === "canonical_simple"
                ? `Choose what should happen to ${itemToDelete?.name} and its linked inventory item.`
                : `Are you sure you want to delete ${itemToDelete?.name}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {itemToDelete?.inventory?.trackingState === "canonical_simple" && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              {deletionPreviewLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading inventory removal options…
                </div>
              )}
              {deletionPreview && (
                <>
                  <p className="font-semibold text-foreground">
                    Linked inventory: {deletionPreview.inventoryItem.name} · {formatInventoryQuantity(
                      deletionPreview.inventoryItem.availableQuantity,
                      deletionPreview.inventoryItem.trackingUnit,
                    )}
                  </p>
                  {deletionPreview.canRemoveInventory ? (
                    <p className="text-muted-foreground">
                      This will remove the menu item and its linked inventory item from operations. Historical stock and order records will still be preserved.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      The inventory item is still used by {deletionPreview.sharedActiveRelationshipCount} other active menu {deletionPreview.sharedActiveRelationshipCount === 1 ? "item" : "items"}, so only this menu item can be removed.
                    </p>
                  )}
                </>
              )}
              {!deletionPreviewLoading && !deletionPreview && !deletionPreviewError && (
                <p className="text-muted-foreground">
                  Removing this from the menu will keep its inventory item available in Inventory.
                </p>
              )}
            </div>
          )}

          {deletionPreviewError && (
            <p role="alert" className="text-sm font-medium text-destructive">{deletionPreviewError}</p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            {itemToDelete?.inventory?.trackingState === "canonical_simple" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => itemToDelete && void handleDeleteConfirm(itemToDelete)}
                >
                  {isDeleting ? "Removing…" : "Remove from Menu only"}
                </Button>
                {deletionPreview?.canRemoveInventory && canRemoveSimpleStockInventory && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => itemToDelete && void handleDeleteConfirm(itemToDelete, true)}
                  >
                    {isDeleting ? "Removing…" : "Remove from Menu and Inventory"}
                  </Button>
                )}
              </>
            ) : (
              <AlertDialogAction
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault()
                  if (itemToDelete) void handleDeleteConfirm(itemToDelete)
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
