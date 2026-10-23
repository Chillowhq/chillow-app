"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, Clock, Flame, Search, UtensilsCrossed, X } from "lucide-react"
import type { MenuItem } from "@/app/owner/menu/page"
import CartBar from "@/components/cart-bar"
import CategoryTabs from "@/components/category-tabs"
import CustomerHeader from "@/components/customer-header"
import GuestWaitstaffRequestCard from "@/components/guest-waitstaff-request-card"
import { MenuPageSkeleton } from "@/components/customer-loading-skeletons"
import FeaturedSwiper from "@/components/featured-swiper"
import ItemDetailSheet from "@/components/item-detail-sheet"
import MenuCard from "@/components/menu-card"
import { useCustomerGuestRealtime } from "@/components/providers/customer-guest-realtime-provider"
import { useCustomerTheme } from "@/components/providers/customer-theme-provider"
import { BusinessProvider, getServicePointTerm } from "@/contexts/BusinessContext"
import { apiClient } from "@/lib/axios-config"
import {
  ensureSessionId,
  getServicePointLabel,
  saveBusinessId,
  saveTableToken,
} from "@/lib/guest-session"
import { getNextOpening, isRestaurantOpen } from "@/lib/operating-hours"
import { useCartStore } from "@/store/cart-store"

interface TableMenuViewProps {
  businessId: string
  servicePointId: string
  sessionToken?: string
  servicePointLabel?: string | null
  servicePointQrCode?: string | null
  isWaiterMode?: boolean
}

function normalizeMenuItem(item: MenuItem & { imageUrl?: string; _id?: string }): MenuItem {
  return {
    ...item,
    id: item.id || item._id,
    image: item.image || item.imageUrl,
    orderCategory: item.orderCategory || item.type,
  }
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function TableMenuView({
  businessId,
  servicePointId,
  sessionToken,
  servicePointLabel,
  isWaiterMode = false,
}: TableMenuViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [popularItems, setPopularItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<string[]>(["all"])
  const [restaurant, setRestaurant] = useState<any>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isQrOrderingDisabled, setIsQrOrderingDisabled] = useState(false)

  const cartItems = useCartStore((state) => state.items)
  const ensureCartContext = useCartStore((state) => state.ensureContext)
  const { useBranding, branding } = useCustomerTheme()
  const { refreshGuestVisit } = useCustomerGuestRealtime()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    setIsQrOrderingDisabled(false)

    try {
      const restaurantResponse = await apiClient.get(
        `/public/business-config?businessId=${businessId}`,
      )
      const restaurantData = restaurantResponse.data
      setRestaurant(restaurantData)

      if (restaurantData?.orderingPreferences?.qrOrderingEnabled === false) {
        setMenuItems([])
        setPopularItems([])
        setCategories(["all"])
        setIsQrOrderingDisabled(true)
        return
      }

      const menuResponse = await apiClient.get(`/menu-items?businessId=${businessId}`)
      const responseItems = Array.isArray(menuResponse.data) ? menuResponse.data : []
      const hideOutOfStock =
        restaurantData?.orderingPreferences?.hideOutOfStockItems ?? false
      const visibleItems = hideOutOfStock
        ? responseItems.filter((item: MenuItem) => item.isAvailable)
        : responseItems
      const normalizedItems = visibleItems.map(normalizeMenuItem)

      setMenuItems(normalizedItems)

      const discoveredCategories = Array.from(
        new Set(normalizedItems.map((item) => item.category).filter(Boolean)),
      )
      const configuredCategories = Array.isArray(restaurantData?.menuCategories)
        ? restaurantData.menuCategories.filter((category: string) =>
            discoveredCategories.includes(category),
          )
        : []
      const remainingCategories = discoveredCategories.filter(
        (category) => !configuredCategories.includes(category),
      )
      setCategories(["all", ...configuredCategories, ...remainingCategories])

      try {
        const popularResponse = await apiClient.get(
          `/menu-items/popular?businessId=${businessId}`,
        )
        const popularResponseItems = Array.isArray(popularResponse.data)
          ? popularResponse.data
          : []
        const visiblePopularItems = hideOutOfStock
          ? popularResponseItems.filter((item: MenuItem) => item.isAvailable)
          : popularResponseItems
        setPopularItems(visiblePopularItems.map(normalizeMenuItem))
      } catch (error) {
        console.error("[fetchPopularItems]", error)
        setPopularItems([])
      }
    } catch (error) {
      console.error("[fetchMenuData]", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    ensureCartContext({
      actor: isWaiterMode ? "waitstaff" : "customer",
      businessId,
      servicePointId,
    })
    if (!isWaiterMode && businessId) {
      saveBusinessId(businessId)
      refreshGuestVisit()
    }
    void fetchData()
  }, [
    businessId,
    ensureCartContext,
    fetchData,
    isWaiterMode,
    refreshGuestVisit,
    servicePointId,
  ])

  useEffect(() => {
    if (isWaiterMode) return
    ensureSessionId()
    if (sessionToken) {
      saveTableToken(servicePointId, sessionToken)
      refreshGuestVisit()
    }
  }, [isWaiterMode, refreshGuestVisit, servicePointId, sessionToken])

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredItems = useMemo(
    () =>
      menuItems.filter((item) => {
        const matchesSearch =
          !normalizedSearch ||
          item.name.toLowerCase().includes(normalizedSearch) ||
          (item.description || "").toLowerCase().includes(normalizedSearch) ||
          item.category.toLowerCase().includes(normalizedSearch)
        const matchesCategory =
          activeCategory === "all" || item.category === activeCategory
        return matchesSearch && matchesCategory
      }),
    [activeCategory, menuItems, normalizedSearch],
  )

  const itemsByCategory = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {}
    for (const item of menuItems) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return groups
  }, [menuItems])

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  )
  const isOpen = restaurant
    ? isRestaurantOpen(restaurant.operatingHours, restaurant.timezone)
    : true
  const callWaiterEnabled =
    restaurant?.orderingPreferences?.callWaiterEnabled ??
    restaurant?.settings?.callWaiterEnabled ??
    true
  const servicePointTerm = getServicePointTerm(restaurant?.capabilities)
  const displayServicePoint =
    servicePointLabel || getServicePointLabel() || servicePointTerm.singular
  const showDiscovery = activeCategory === "all" && !normalizedSearch

  const openItem = (item: MenuItem) => {
    setSelectedItem(item)
    setIsDetailOpen(true)
  }

  if (isLoading) return <MenuPageSkeleton />

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div role="alert" className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
            <UtensilsCrossed className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Menu couldn&apos;t be loaded</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Check your connection and try again. Your current order is still saved on this device.
          </p>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="mt-6 min-h-11 rounded-full bg-[var(--brand-primary,#EA601A)] px-6 font-bold text-[var(--brand-text-on-brand,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  return (
    <BusinessProvider
      businessType={restaurant?.businessType}
      modules={restaurant?.modules}
      capabilities={restaurant?.capabilities}
    >
      <main
        className={`min-h-screen overflow-x-hidden ${itemCount > 0 ? "pb-36" : "pb-24"}`}
        style={{ backgroundColor: "var(--brand-background, hsl(var(--background)))" }}
      >
        {!isQrOrderingDisabled && (
          <FeaturedSwiper
            items={menuItems}
            currency={restaurant?.currency}
            onItemClick={openItem}
          />
        )}

        <div
          className={`relative z-20 bg-background ${
            isQrOrderingDisabled
              ? "pt-[max(1rem,env(safe-area-inset-top))]"
              : "-mt-8 rounded-t-[2.75rem] pt-1 shadow-[0_-18px_42px_-30px_rgba(15,23,42,.5)]"
          }`}
        >
          <CustomerHeader
            useBranding={useBranding}
            branding={branding || {}}
            businessName={restaurant?.displayName || restaurant?.name || ""}
            businessLogoUrl={restaurant?.logoUrl}
            displayServicePoint={displayServicePoint}
            isOpen={isOpen}
          />

          {!isWaiterMode && callWaiterEnabled && isOpen && (
            <GuestWaitstaffRequestCard
              servicePointId={servicePointId}
              servicePointLabel={displayServicePoint}
            />
          )}

          {!isOpen && (
            <div
              className="mx-auto -mt-3 max-w-5xl pb-5"
              style={{
                paddingLeft: "max(1rem, env(safe-area-inset-left))",
                paddingRight: "max(1rem, env(safe-area-inset-right))",
              }}
            >
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                    <Clock className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-amber-900 dark:text-amber-200">Currently closed</p>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {getNextOpening(restaurant?.operatingHours, restaurant?.timezone)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  Viewing only
                </span>
              </div>
            </div>
          )}

          {!isQrOrderingDisabled && (
            <div
              className="mx-auto max-w-5xl pb-5"
              style={{
                paddingLeft: "max(1rem, env(safe-area-inset-left))",
                paddingRight: "max(1rem, env(safe-area-inset-right))",
              }}
            >
              <label htmlFor="guest-menu-search" className="sr-only">
                Search the menu
              </label>
              <div className="relative mx-auto max-w-4xl">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-foreground/75" strokeWidth={2.25} aria-hidden="true" />
                <input
                  id="guest-menu-search"
                  type="search"
                  placeholder="Search delicious dishes..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="min-h-16 w-full rounded-full border border-border bg-card pl-14 pr-14 text-base font-semibold text-foreground shadow-[0_14px_38px_-22px_rgba(15,23,42,.55)] outline-none transition placeholder:font-medium placeholder:text-muted-foreground focus:border-[var(--brand-primary,#EA601A)] focus:ring-4 focus:ring-[var(--brand-ring,rgba(234,96,26,.15))] motion-reduce:transition-none sm:text-lg"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear menu search"
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] motion-reduce:transition-none"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isQrOrderingDisabled ? (
          <section className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center sm:py-20">
            <div className="w-full rounded-[2rem] border border-border bg-card p-8 shadow-lg sm:p-14">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary">
                <UtensilsCrossed className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                QR ordering is currently disabled
              </h2>
              <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                Ordering is unavailable here right now. You can still use the menu button to request assistance when that service is enabled.
              </p>
            </div>
          </section>
        ) : (
          <>
            <nav
              aria-label="Menu categories"
              className="sticky z-30 border-b border-border/60 bg-background/95 shadow-[0_10px_32px_-28px_rgba(15,23,42,.65)] backdrop-blur-xl"
              style={{ top: "env(safe-area-inset-top)" }}
            >
              <div
                className="mx-auto max-w-5xl"
                style={{
                  paddingLeft: "max(1rem, env(safe-area-inset-left))",
                  paddingRight: "max(1rem, env(safe-area-inset-right))",
                }}
              >
                <CategoryTabs
                  categories={categories}
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                />
              </div>
            </nav>

            <div
              className="mx-auto max-w-5xl py-8 sm:py-12"
              style={{
                paddingLeft: "max(1rem, env(safe-area-inset-left))",
                paddingRight: "max(1rem, env(safe-area-inset-right))",
              }}
            >
              {menuItems.length === 0 ? (
                <section className="py-16 text-center" aria-labelledby="empty-menu-title">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                    <UtensilsCrossed className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h2 id="empty-menu-title" className="text-2xl font-black text-foreground">No menu items available</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    This business has not published any menu items yet.
                  </p>
                </section>
              ) : showDiscovery ? (
                <div className="space-y-12">
                  {popularItems.length > 0 && (
                    <section aria-labelledby="popular-menu-heading">
                      <div className="mb-5 flex items-end justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--brand-text-on-brand,white)] shadow-md"
                            style={{
                              background:
                                "linear-gradient(to bottom right, var(--brand-gradient-from, #f97316), var(--brand-gradient-to, #ef4444))",
                            }}
                          >
                            <Flame className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div>
                            <h2 id="popular-menu-heading" className="text-xl font-black leading-tight text-foreground sm:text-2xl">
                              Popular Right Now
                            </h2>
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground sm:text-sm">Most ordered this week</p>
                          </div>
                        </div>
                      </div>
                      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {popularItems.slice(0, 8).map((item) => (
                          <div key={`popular-${item.id}`} className="w-[54vw] min-w-[172px] max-w-[232px] shrink-0 snap-start">
                            <MenuCard
                              item={item}
                              currency={restaurant?.currency}
                              onClick={() => openItem(item)}
                              showCategory
                              isBusinessOpen={isOpen}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {categories
                    .filter((category) => category !== "all")
                    .map((category) => {
                      const categoryItems = itemsByCategory[category]
                      if (!categoryItems?.length) return null

                      return (
                        <section key={category} aria-labelledby={`category-${category}`}>
                          <div className="mb-5 flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-muted,hsl(var(--secondary)))] text-[var(--brand-primary,#EA601A)]">
                                <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <h2 id={`category-${category}`} className="truncate text-xl font-black text-foreground sm:text-2xl">
                                  {titleCase(category)}
                                </h2>
                              </div>
                            </div>
                            {categoryItems.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setActiveCategory(category)}
                                className="flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-bold text-[var(--brand-primary,#EA601A)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)]"
                                aria-label={`View all ${category} items`}
                              >
                                View all
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {categoryItems.slice(0, 4).map((item) => (
                              <div key={`preview-${item.id}`} className="w-[54vw] min-w-[172px] max-w-[232px] shrink-0 snap-start md:w-auto md:min-w-0 md:max-w-none">
                                <MenuCard
                                  item={item}
                                  currency={restaurant?.currency}
                                  onClick={() => openItem(item)}
                                  isBusinessOpen={isOpen}
                                />
                              </div>
                            ))}
                          </div>
                        </section>
                      )
                    })}
                </div>
              ) : filteredItems.length > 0 ? (
                <section aria-labelledby="filtered-menu-heading">
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <h2 id="filtered-menu-heading" className="text-2xl font-black text-foreground sm:text-3xl">
                        {normalizedSearch ? "Search results" : titleCase(activeCategory)}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {normalizedSearch
                          ? `${filteredItems.length} ${filteredItems.length === 1 ? "item" : "items"} matching “${searchQuery.trim()}”`
                          : `${filteredItems.length} ${filteredItems.length === 1 ? "item" : "items"}`}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                    {filteredItems.map((item) => (
                      <MenuCard
                        key={item.id}
                        item={item}
                        currency={restaurant?.currency}
                        onClick={() => openItem(item)}
                        showCategory={Boolean(normalizedSearch)}
                        isBusinessOpen={isOpen}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <section className="py-16 text-center" aria-labelledby="no-results-title">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                    <Search className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h2 id="no-results-title" className="text-2xl font-black text-foreground">
                    {normalizedSearch ? "No matching menu items" : `No ${activeCategory} available`}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {normalizedSearch
                      ? "Try another search term or clear the search to browse the full menu."
                      : "Browse another category to find something else."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("")
                      setActiveCategory("all")
                    }}
                    className="mt-6 min-h-11 rounded-full border border-border bg-background px-5 font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)]"
                  >
                    {normalizedSearch ? "Clear search" : "Browse all"}
                  </button>
                </section>
              )}
            </div>
          </>
        )}

        {(!useBranding || !branding?.removeQuickServeBranding) && (
          <footer className="mx-auto mt-8 max-w-5xl border-t border-border py-8 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Powered by QuickServe
          </footer>
        )}

        {itemCount > 0 && (
          <CartBar
            itemCount={itemCount}
            subtotal={subtotal}
            servicePointId={servicePointId}
            currency={restaurant?.currency}
            isOpen={isOpen}
            isWaiterMode={isWaiterMode}
          />
        )}

        <ItemDetailSheet
          item={selectedItem}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          currency={restaurant?.currency}
          isBusinessOpen={isOpen}
        />
      </main>
    </BusinessProvider>
  )
}
