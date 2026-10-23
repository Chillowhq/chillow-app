"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ArrowLeft, CalendarDays, Users, User, Phone, Mail,
  ChevronLeft, ChevronRight, CheckCircle2, Minus, Plus,
  Bed, MessageSquare, CreditCard,
  Shield, Info, Wind, Wifi, Tv, Coffee, Utensils, Car, Bath, X, Check
} from "lucide-react";
import apiClient from "@/lib/axios-config";
import HotelPricingBreakdown from "./HotelPricingBreakdown";
import { HotelRoomPriceDisplay } from "./HotelRoomPriceDisplay";
import { formatBookingCurrency } from "./HotelPricingBreakdown";
import { RoomShowcaseSwiper } from "./RoomShowcaseSwiper";
import {
  formatOptionalReservationDate as formatDate,
  getBusinessLocalReservationDate,
  getReservationNights as nightsBetween,
} from "@/lib/reservation-date";
import { getConfiguredServicePointCapacity } from "@/lib/reservation-capacity";
import { getServicePointTerm } from "@/contexts/BusinessContext";
import { parseHotelReservationPrefill } from "@/lib/hotel-reservation-prefill";
import type { ServicePoint, StayServicePoint } from "@/types/service-point";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { RoomAvailabilitySkeleton } from "@/components/customer-loading-skeletons";
import {
  HotelStayDatePicker,
  type HotelStayDateRange,
} from "./HotelStayDatePicker";

const STEPS = ["Dates", "Choose Room", "Details", "Confirm"] as const;
const ALL_ROOM_TYPES = "__all_room_types__";
const ROOM_TYPE_PREVIEW_LIMIT = 4;

function normalizeRoomType(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return mounted ? matches : false;
}

function ServicePointCard({ servicePoint, isSelected, onSelect, currency }: {
  servicePoint: StayServicePoint; isSelected: boolean; onSelect: () => void; currency: string;
}) {
  const images = servicePoint.images || [];
  const mainImage = images[0];
  const capacity = getConfiguredServicePointCapacity(servicePoint);

  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -2 }}
      onClick={onSelect}
      aria-label={`View details for ${servicePoint.label}`}
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border-2 bg-card text-left shadow-sm transition-all duration-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        isSelected
          ? "border-primary ring-4 ring-primary/10 bg-primary/5"
          : "border-border hover:border-border/85"
      }`}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
        {mainImage ? (
          <img
            src={mainImage}
            alt={servicePoint.label}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Bed className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Selected check overlay */}
        {isSelected && (
          <div className="absolute top-2.5 right-2.5 bg-primary text-primary-foreground p-1 rounded-full shadow-md z-10 animate-in fade-in zoom-in-75 duration-200">
            <Check className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-3.5">
        <h3 className="truncate text-xs font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-sm">
          {servicePoint.label}
        </h3>

        <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground sm:text-xs">
          <Users className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
          <span>{capacity === null ? "Guest capacity available in details" : `${capacity} guest${capacity !== 1 ? "s" : ""}`}</span>
        </div>

        <div className="mt-auto pt-2.5">
          <HotelRoomPriceDisplay
            pricePerNight={servicePoint.pricePerNight}
            currency={currency}
            pricingSummary={servicePoint.pricingSummary}
            size="sm"
          />
        </div>
      </div>
    </motion.button>
  );
}

function RoomDetailContent({
  servicePoint,
  nights,
  checkInDate,
  checkOutDate,
  onSelect,
  isSelected,
  primaryColor,
  isAvailable,
  onViewAvailableRooms,
  onClose,
  isDesktop,
  currency,
}: {
  servicePoint: StayServicePoint;
  nights: number;
  checkInDate: string;
  checkOutDate: string;
  onSelect: () => void;
  isSelected: boolean;
  primaryColor: string;
  isAvailable: boolean;
  onViewAvailableRooms: () => void;
  onClose: () => void;
  isDesktop: boolean;
  currency: string;
}) {
  const images = servicePoint.images || [];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  useEffect(() => {
    setActiveImageIndex(0);
  }, [servicePoint.servicePointId]);

  const capacity = getConfiguredServicePointCapacity(servicePoint);
  const mainImage = images[activeImageIndex] || "";
  const amenities = servicePoint.amenities || [];
  const description = servicePoint.fullDescription?.trim() || servicePoint.description?.trim();
  // Use canonical pricing total if available; do NOT calculate from frontend math.
  const canonicalTotal = servicePoint.pricingSummary?.total ?? null;
  const roomCurrency = currency;

  const formatStayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getAmenityIcon = (name: string) => {
    const term = name.toLowerCase();
    if (term.includes("wifi") || term.includes("internet") || term.includes("wi-fi")) return Wifi;
    if (term.includes("tv") || term.includes("television")) return Tv;
    if (term.includes("coffee") || term.includes("breakfast") || term.includes("tea")) return Coffee;
    if (term.includes("kitchen") || term.includes("cook") || term.includes("dining")) return Utensils;
    if (term.includes("parking") || term.includes("car")) return Car;
    if (term.includes("air cond") || term.includes("ac") || term.includes("climate")) return Wind;
    if (term.includes("bath") || term.includes("shower") || term.includes("tub")) return Bath;
    if (term.includes("safe") || term.includes("security")) return Shield;
    return Check;
  };

  const selectButton = (
    <Button
      onClick={onSelect}
      className="w-full h-12 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
      style={{
        backgroundColor: isSelected ? "transparent" : primaryColor,
        color: isSelected ? primaryColor : "#fff",
        border: isSelected ? `2px solid ${primaryColor}` : "none",
      }}
    >
      {isSelected ? (
        <>
          <Check className="w-4 h-4" />
          Room Selected
        </>
      ) : (
        "Select this room"
      )}
    </Button>
  );


  const ctaButton = isAvailable ? selectButton : (
    <div className="space-y-2 text-center">
      <p role="status" className="text-xs font-bold text-amber-700 dark:text-amber-300">
        Not available for your selected dates
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onViewAvailableRooms}
        className="h-11 w-full rounded-xl font-bold"
      >
        View available rooms
      </Button>
    </div>
  );
  if (isDesktop) {
    return (
      <div className="grid h-[min(46rem,calc(100dvh-3rem))] w-full grid-cols-12 overflow-hidden">
        {/* Left Column: Image Gallery */}
        <div className="relative col-span-7 flex h-full min-h-0 flex-col border-r border-border bg-muted/20">
          <button
            onClick={onClose}
            aria-label="Close details"
            className="absolute top-4 left-4 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors active:scale-95 shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex-1 relative bg-black/5 overflow-hidden flex items-center justify-center">
            {mainImage ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImageIndex}
                  src={mainImage}
                  alt={servicePoint.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                <Bed className="w-16 h-16" />
                <span className="text-xs font-semibold mt-2">No images available</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="p-4 bg-background border-t border-border shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative aspect-[4/3] w-16 sm:w-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      idx === activeImageIndex
                        ? "border-primary scale-95 shadow-md"
                        : "border-transparent opacity-65 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="Thumbnail view" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Details & Pricing */}
        <div className="col-span-5 flex h-full min-h-0 flex-col justify-between bg-background">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                {servicePoint.label}
              </h2>
              <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                {capacity !== null && (
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-primary" /> Up to {capacity} guests</span>
                )}
                {servicePoint.beds && (
                  <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5 text-primary" /> {servicePoint.beds} bed{servicePoint.beds !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-3 opacity-55">
                Your stay
              </h3>
              <div className="flex items-center gap-3 bg-muted/30 border border-border/80 rounded-xl p-3 text-sm">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground">
                  {formatStayDate(checkInDate)} → {formatStayDate(checkOutDate)}
                </span>
                <span className="ml-auto bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0">
                  {nights || 1} night{(nights || 1) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {description && (
              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-2.5 opacity-55">
                  About this room
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            )}

            {amenities.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-3 opacity-55">
                  Amenities
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {amenities.map((a) => {
                    const Icon = getAmenityIcon(a);
                    return (
                      <div key={a} className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <div className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="truncate">{a}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          <div className="border-t border-border pt-4">
              <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-3 opacity-55">
                Pricing Details
              </h3>
              <div className="bg-muted/30 border border-border/80 rounded-2xl p-4">
                <HotelRoomPriceDisplay
                  pricePerNight={servicePoint.pricePerNight}
                  currency={roomCurrency}
                  pricingSummary={servicePoint.pricingSummary}
                  size="md"
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-background p-4">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {canonicalTotal != null ? "Stay total" : "From"}
              </p>
              <p className="text-lg font-black text-primary truncate">
                {canonicalTotal != null
                  ? formatBookingCurrency(canonicalTotal, roomCurrency)
                  : formatBookingCurrency(servicePoint.pricePerNight, roomCurrency)}
              </p>
              {servicePoint.pricingSummary?.hasAdditionalCharges && (
                <p className="text-[10px] text-muted-foreground">Incl. taxes &amp; fees</p>
              )}
            </div>
            <div className="w-40 shrink-0">
              {ctaButton}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="relative w-full h-56 min-h-[14rem] sm:h-64 shrink-0 bg-muted/40">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/40 rounded-full pointer-events-none z-10" />

          <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
            {mainImage ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImageIndex}
                  src={mainImage}
                  alt={servicePoint.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                <Bed className="w-12 h-12" />
                <span className="text-[10px] font-semibold mt-1">No images available</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {images.length > 1 && (
            <div className="px-5 py-3 border-b border-border/50 bg-background/50">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative aspect-[4/3] w-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      idx === activeImageIndex
                        ? "border-primary scale-95 shadow-sm"
                        : "border-transparent opacity-70"
                    }`}
                  >
                    <img src={img} alt="Thumbnail view" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-5 space-y-6">
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight leading-tight">
                {servicePoint.label}
              </h2>
              <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                {capacity !== null && (
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-primary" /> Up to {capacity} guests</span>
                )}
                {servicePoint.beds && (
                  <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5 text-primary" /> {servicePoint.beds} bed{servicePoint.beds !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-3 opacity-55">
                Your stay
              </h3>
              <div className="flex items-center gap-3 bg-muted/30 border border-border/80 rounded-xl p-3 text-sm">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground">
                  {formatStayDate(checkInDate)} → {formatStayDate(checkOutDate)}
                </span>
                <span className="ml-auto bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0">
                  {nights || 1} night{(nights || 1) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {description && (
              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-2.5 opacity-55">
                  About this room
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            )}

            {amenities.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-3 opacity-55">
                  Amenities
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {amenities.map((a) => {
                    const Icon = getAmenityIcon(a);
                    return (
                      <div key={a} className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <div className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="truncate">{a}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-3 opacity-55">
                Pricing Details
              </h3>
              <div className="bg-muted/30 border border-border/80 rounded-2xl p-4">
                <HotelRoomPriceDisplay
                  pricePerNight={servicePoint.pricePerNight}
                  currency={roomCurrency}
                  pricingSummary={servicePoint.pricingSummary}
                  size="md"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 px-5 pt-4 pb-5 bg-background border-t border-border flex items-center justify-between gap-4 shadow-lg z-10"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                {canonicalTotal != null ? "Stay total" : "From"}
              </p>
              <p className="text-base font-black text-primary truncate">
                {canonicalTotal != null
                  ? formatBookingCurrency(canonicalTotal, roomCurrency)
                  : formatBookingCurrency(servicePoint.pricePerNight, roomCurrency)}
              </p>
              {servicePoint.pricingSummary?.hasAdditionalCharges && (
                <p className="text-[10px] text-muted-foreground">Incl. taxes &amp; fees</p>
              )}
            </div>
          <div className="w-36 shrink-0">
            {ctaButton}
          </div>
        </div>
      </div>
    );
  }
}

interface HotelReservationFlowProps {
  business: any;
  countryCode: string;
  businessSlug: string;
}

export function HotelReservationFlow({ business, countryCode, businessSlug }: HotelReservationFlowProps) {
  const router = useRouter();
  const servicePointTerm = getServicePointTerm(business?.capabilities);
  const searchParams = useSearchParams();
  const availabilitySectionRef = useRef<HTMLDivElement>(null);
  const reservationAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const prefillAppliedRef = useRef(false);
  const [isLoadingServicePoints, setIsLoadingServicePoints] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [submittedPricing, setSubmittedPricing] = useState<any>(null);
  const [step, setStep] = useState(0);
  // Instant booking retry safety: retain reservation hold so we never create duplicates
  const [instantHold, setInstantHold] = useState<{ reservationId: string; secureToken: string } | null>(null);

  const bookingMode = business?.hotelSettings?.onlineBookingConfirmationMode ?? "instant";

  const [detailOpen, setDetailOpen] = useState(false);
  const [viewedServicePoint, setViewedServicePoint] = useState<StayServicePoint | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Form state
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [availableServicePoints, setAvailableServicePoints] = useState<StayServicePoint[]>([]);
  const [selectedServicePoint, setSelectedServicePoint] = useState<StayServicePoint | null>(null);
  const [activeRoomType, setActiveRoomType] = useState(ALL_ROOM_TYPES);
  const [guestCount, setGuestCount] = useState(2);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");

  const today = getBusinessLocalReservationDate(business?.timezone || "UTC");

  useEffect(() => {
    if (prefillAppliedRef.current) return;

    prefillAppliedRef.current = true;
    const prefill = parseHotelReservationPrefill(searchParams, {
      businessLocalToday: today,
    });
    if (prefill.notice) {
      setHandoffNotice(prefill.notice);
    }
    if (prefill.checkInDate && prefill.checkOutDate) {
      setCheckInDate(prefill.checkInDate);
      setCheckOutDate(prefill.checkOutDate);
      setSelectedServicePoint(null);
      setAvailableServicePoints([]);
    }
    if (prefill.guestCount) {
      setGuestCount(prefill.guestCount);
    }
  }, [searchParams, today]);

  const nights = nightsBetween(checkInDate, checkOutDate);

  const selectedGuestCapacity =
    getConfiguredServicePointCapacity(selectedServicePoint);
  const catalogueServicePoints = useMemo<StayServicePoint[]>(() => {
    const servicePoints: ServicePoint[] = Array.isArray(business?.servicePoints)
      ? business.servicePoints
      : [];
    const catalogue: StayServicePoint[] = [];

    servicePoints.forEach((servicePoint) => {
      const isRoom =
        servicePoint.servicePointType === "room" ||
        (!servicePoint.servicePointType && servicePoint.pricePerNight != null);
      const pricePerNight = Number(servicePoint.pricePerNight);
      if (!isRoom || !Number.isFinite(pricePerNight) || pricePerNight < 0) {
        return;
      }

      catalogue.push({
        ...servicePoint,
        pricePerNight,
      });
    });

    return catalogue;
  }, [business?.servicePoints]);
  const availableServicePointIds = useMemo(
    () => new Set(
      availableServicePoints.map((servicePoint) => servicePoint.servicePointId),
    ),
    [availableServicePoints],
  );
  const isViewedServicePointAvailable = viewedServicePoint
    ? availableServicePointIds.has(viewedServicePoint.servicePointId)
    : false;
  const roomTypeTabs = useMemo(() => {
    const configuredTypes = Array.isArray(business?.hotelRoomTypes)
      ? business.hotelRoomTypes
      : [];
    const configuredOrder = new Map<string, number>();

    configuredTypes.forEach((roomType: { name?: string; sortOrder?: number }, index: number) => {
      const key = normalizeRoomType(roomType?.name);
      if (!key) return;
      configuredOrder.set(
        key,
        Number.isFinite(roomType.sortOrder) ? Number(roomType.sortOrder) : index,
      );
    });

    const availableTypes = new Map<string, { label: string; firstSeen: number }>();
    availableServicePoints.forEach((room, index) => {
      const key = normalizeRoomType(room.roomType);
      if (!key || availableTypes.has(key)) return;
      availableTypes.set(key, {
        label: room.roomType!.trim().replace(/\s+/g, " "),
        firstSeen: index,
      });
    });

    return Array.from(availableTypes.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        firstSeen: value.firstSeen,
        configuredSortOrder: configuredOrder.get(key),
      }))
      .sort((first, second) => {
        const firstKnown = first.configuredSortOrder !== undefined;
        const secondKnown = second.configuredSortOrder !== undefined;
        if (firstKnown && secondKnown) {
          return first.configuredSortOrder! - second.configuredSortOrder! || first.firstSeen - second.firstSeen;
        }
        if (firstKnown) return -1;
        if (secondKnown) return 1;
        return first.firstSeen - second.firstSeen;
      });
  }, [availableServicePoints, business?.hotelRoomTypes]);
  const roomTypeSections = useMemo(() => {
    const groupedRooms = new Map<string, StayServicePoint[]>();
    const untypedRooms: StayServicePoint[] = [];

    availableServicePoints.forEach((room) => {
      const key = normalizeRoomType(room.roomType);
      if (!key) {
        untypedRooms.push(room);
        return;
      }

      const rooms = groupedRooms.get(key) || [];
      rooms.push(room);
      groupedRooms.set(key, rooms);
    });

    const sections: Array<{
      key: string;
      label: string;
      rooms: StayServicePoint[];
      tabKey: string | null;
    }> = roomTypeTabs.map((roomType) => ({
      key: roomType.key,
      label: roomType.label,
      rooms: groupedRooms.get(roomType.key) || [],
      tabKey: roomType.key,
    }));

    if (untypedRooms.length > 0) {
      sections.push({
        key: "other-rooms",
        label: "Other rooms",
        rooms: untypedRooms,
        tabKey: null,
      });
    }

    return sections;
  }, [availableServicePoints, roomTypeTabs]);
  const filteredServicePoints = useMemo(() => {
    if (activeRoomType === ALL_ROOM_TYPES) return availableServicePoints;
    return availableServicePoints.filter(
      (room) => normalizeRoomType(room.roomType) === activeRoomType,
    );
  }, [activeRoomType, availableServicePoints]);

  const openRoomDetails = (servicePoint: StayServicePoint) => {
    setViewedServicePoint(servicePoint);
    setDetailOpen(true);
  };

  const handleViewAvailableRooms = () => {
    setDetailOpen(false);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      availabilitySectionRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const handleStayDateChange = (range: HotelStayDateRange) => {
    setFormError(null);
    setHandoffNotice(null);
    setCheckInDate(range.checkInDate);
    setCheckOutDate(range.checkOutDate);
    setSelectedServicePoint(null);
    setAvailableServicePoints([]);
  };

  const searchServicePoints = async () => {
    if (!checkInDate || !checkOutDate) {
      setFormError("Please select check-in and check-out dates.");
      return;
    }
    setIsLoadingServicePoints(true);
    setFormError(null);
    setSelectedServicePoint(null);
    try {
      const res = await apiClient.get("/public/reservations/available-rooms", {
        params: { countryCode, businessSlug, checkInDate, checkOutDate, guestCount }
      });
      setAvailableServicePoints(res.data);
      setActiveRoomType(ALL_ROOM_TYPES);
      setStep(1);
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Failed to check availability.");
    } finally {
      setIsLoadingServicePoints(false);
    }
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) { setFormError("Name is required."); return; }
    if (!phone.trim()) { setFormError("Phone number is required."); return; }
    if (!email.trim() || !email.includes("@")) { setFormError("Valid email is required."); return; }

    setFormError(null);
    setIsSubmitting(true);
    try {
      // Instant mode with an existing hold — skip reservation creation, retry checkout only
      let secureToken = instantHold?.secureToken;

      if (!secureToken) {
        const fingerprint = JSON.stringify({ countryCode, businessSlug, customerName, phone, email, checkInDate, checkOutDate, guestCount, servicePointId: selectedServicePoint?.servicePointId });
        if (reservationAttemptRef.current?.fingerprint !== fingerprint) {
          reservationAttemptRef.current = {
            fingerprint,
            key: `hotel:${crypto.randomUUID()}`,
          };
        }

        // Create the reservation
        const response = await apiClient.post("/public/reservations", {
          countryCode,
          businessSlug,
          customerName: customerName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          checkInDate,
          checkOutDate,
          guestCount,
          servicePointId: selectedServicePoint?.servicePointId,
          servicePointLabel: selectedServicePoint?.label,
          specialRequest: specialRequest.trim(),
          isHotelBooking: true,
        }, {
          headers: { "Idempotency-Key": reservationAttemptRef.current.key },
        });
        setSubmittedPricing(response.data?.pricing || null);

        if (response.data?.bookingMode === "instant" && response.data?.secureToken) {
          secureToken = response.data.secureToken;
          setInstantHold({
            reservationId: response.data.reservationId,
            secureToken: response.data.secureToken,
          });
        }
      }

      if (bookingMode === "instant" && secureToken) {
        // Redirect to Stripe Checkout via the existing payment endpoint
        const checkoutRes = await apiClient.post("/payments/checkout-reservation", {
          secureToken,
        });
        if (checkoutRes.data?.sessionUrl) {
          window.location.href = checkoutRes.data.sessionUrl;
          return; // Don't setIsSubmitting(false) — page is redirecting
        } else {
          setFormError("Payment session could not be created. Please try again.");
        }
      } else {
        // Confirmation-required mode — show success screen
        setSuccess(true);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.response?.data?.message || "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryColor = business?.branding?.primaryColor || "#6366F1";
  const displayName = business?.displayName || "Hotel";
  const businessCurrency = business?.currency || "USD";

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-xl"
        >
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2">Booking Request Sent!</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Your request for <strong className="text-foreground">{selectedServicePoint?.label}</strong> at <strong className="text-foreground">{displayName}</strong> has been received.
          </p>
          <div className="bg-muted/30 rounded-xl p-4 text-sm text-left space-y-2 mb-6 border border-border">
            <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span><span className="font-bold text-foreground">{formatDate(checkInDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span><span className="font-bold text-foreground">{formatDate(checkOutDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nights</span><span className="font-bold text-foreground">{nights}</span></div>
            {submittedPricing ? (
              <HotelPricingBreakdown
                pricing={submittedPricing}
                pricePerNight={selectedServicePoint?.pricePerNight}
                numberOfNights={nights}
                currency={business?.currency || selectedServicePoint?.currency || "USD"}
              />
            ) : (
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Accommodation subtotal</span>
                <span className="font-black text-primary text-base">
                  {selectedServicePoint?.pricingSummary
                    ? formatBookingCurrency(selectedServicePoint.pricingSummary.total, businessCurrency)
                    : formatBookingCurrency((selectedServicePoint?.pricePerNight ?? 0) * nights, businessCurrency)}
                </span>
              </div>
            )}
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 text-left mb-6">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">What happens next?</p>
                <p>The property will review your request. If accepted, you'll receive a payment link by email. Payment confirms your booking.</p>
              </div>
            </div>
          </div>
          <button onClick={() => router.push(`/b/${countryCode}/${businessSlug}`)}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all"
            style={{ backgroundColor: primaryColor, color: "#fff" }}>
            Return to Property
          </button>
        </motion.div>
      </div>
    );
  }

  const stepTitles = ["Select Dates", "Choose your room", "Your Details", "Confirm Booking"];

  return (
    <main className="min-h-screen bg-background pb-20" style={{ "--theme-primary": primaryColor } as React.CSSProperties}>
      <div className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back to property"
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        {/* Step Indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  i < step ? "bg-primary text-primary-foreground" :
                  i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] font-bold mt-1.5 whitespace-nowrap ${i === step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Dates */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h2 className="text-xl font-black text-foreground mb-1">{stepTitles[0]}</h2>
              <HotelStayDatePicker
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                minDate={today}
                onChange={handleStayDateChange}
                onError={setFormError}
                className="mt-5"
              />

              {handoffNotice && (
                <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{handoffNotice}</p>
              )}
              {formError && (
                <p className="mt-4 text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-200 dark:border-red-800">{formError}</p>
              )}

              <button
                onClick={searchServicePoints}
                disabled={!checkInDate || !checkOutDate || isLoadingServicePoints}
                className="w-full mt-6 py-4 rounded-2xl font-black text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor, color: "#fff" }}
              >
                {isLoadingServicePoints ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}
                {isLoadingServicePoints ? "Checking availability..." : "Check Availability"}
              </button>
              {isLoadingServicePoints && <RoomAvailabilitySkeleton />}
            </motion.div>
          )}

          {/* Step 1: Choose Room */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep(0)} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black text-foreground">{stepTitles[1]}</h2>
              </div>

              {/* Date summary banner */}
              <div className="flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold rounded-xl px-4 py-2.5 mb-6 border border-primary/20">
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span>{formatDate(checkInDate)} → {formatDate(checkOutDate)}</span>
                <span className="ml-auto bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{nights} nights</span>
              </div>

              {catalogueServicePoints.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Explore our rooms
                  </p>
                  <RoomShowcaseSwiper
                    rooms={catalogueServicePoints}
                    currency={business?.currency || "USD"}
                    onOpenRoom={openRoomDetails}
                  />
                </div>
              )}

              <div ref={availabilitySectionRef} className="scroll-mt-6" />

              {availableServicePoints.length > 0 && (
                <ScrollArea className="mb-6 w-full border-b border-border/50 bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-md shadow-sm">
                  <div
                    role="tablist"
                    aria-label="Filter available rooms by room type"
                    className="flex gap-2 px-1 py-4"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeRoomType === ALL_ROOM_TYPES}
                      onClick={() => setActiveRoomType(ALL_ROOM_TYPES)}
                      className={`group relative flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        activeRoomType === ALL_ROOM_TYPES
                          ? "scale-105 text-[var(--brand-text-on-brand,white)] shadow-lg"
                          : "border border-border/40 bg-secondary/60 text-foreground hover:scale-105 hover:border-primary/30 hover:bg-secondary active:scale-95"
                      }`}
                      style={activeRoomType === ALL_ROOM_TYPES ? {
                        background: "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))",
                        boxShadow: "0 10px 15px -3px var(--brand-shadow, rgba(234,96,26,0.3)), 0 4px 6px -4px var(--brand-shadow, rgba(234,96,26,0.3))",
                      } : undefined}
                    >
                      {activeRoomType === ALL_ROOM_TYPES && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-xl opacity-50 blur-md"
                          style={{ background: "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))" }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        <Bed className="h-4 w-4" /> All
                      </span>
                    </button>
                    {roomTypeTabs.map((roomType) => {
                      const isActive = activeRoomType === roomType.key;
                      return (
                        <button
                          key={roomType.key}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveRoomType(roomType.key)}
                          className={`group relative flex min-h-11 items-center whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            isActive
                              ? "scale-105 text-[var(--brand-text-on-brand,white)] shadow-lg"
                              : "border border-border/40 bg-secondary/60 text-foreground hover:scale-105 hover:border-primary/30 hover:bg-secondary active:scale-95"
                          }`}
                          style={isActive ? {
                            background: "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))",
                            boxShadow: "0 10px 15px -3px var(--brand-shadow, rgba(234,96,26,0.3)), 0 4px 6px -4px var(--brand-shadow, rgba(234,96,26,0.3))",
                          } : undefined}
                        >
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 rounded-xl opacity-50 blur-md"
                              style={{ background: "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))" }}
                            />
                          )}
                          <span className="relative z-10">{roomType.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}

              {availableServicePoints.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
                  <Bed className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="font-bold text-foreground">No {servicePointTerm.lowerPlural} available</p>
                  <p className="text-sm text-muted-foreground mt-1">No available {servicePointTerm.lowerPlural} for the selected dates. Try different dates.</p>
                  <button onClick={() => setStep(0)} className="mt-4 text-sm font-bold text-primary hover:underline">Change Dates</button>
                </div>
              ) : activeRoomType === ALL_ROOM_TYPES ? (
                <div className="space-y-8 sm:space-y-10">
                  {roomTypeSections.map((section) => {
                    const previewRooms = section.tabKey
                      ? section.rooms.slice(0, ROOM_TYPE_PREVIEW_LIMIT)
                      : section.rooms;

                    return (
                      <section key={section.key}>
                        <div className="mb-4 flex items-end justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-foreground sm:text-base">
                              {section.label}
                            </h3>
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              {section.rooms.length} room{section.rooms.length === 1 ? "" : "s"} available
                            </p>
                          </div>
                          {section.tabKey && (
                            <button
                              type="button"
                              onClick={() => setActiveRoomType(section.tabKey!)}
                              className="group flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            >
                              View all
                              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3">
                          {previewRooms.map((servicePoint) => (
                          <ServicePointCard
                              key={servicePoint.servicePointId}
                              servicePoint={servicePoint}
                              isSelected={selectedServicePoint?.servicePointId === servicePoint.servicePointId}
                              currency={businessCurrency}
                              onSelect={() => {
                                setViewedServicePoint(servicePoint);
                                setDetailOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : filteredServicePoints.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                  <Bed className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="font-bold text-foreground">No available rooms in this type.</p>
                  <button
                    type="button"
                    onClick={() => setActiveRoomType(ALL_ROOM_TYPES)}
                    className="mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    View all rooms
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3">
                  {filteredServicePoints.map((servicePoint) => (
                    <ServicePointCard
                      key={servicePoint.servicePointId}
                      servicePoint={servicePoint}
                      isSelected={selectedServicePoint?.servicePointId === servicePoint.servicePointId}
                      currency={businessCurrency}
                      onSelect={() => {
                        setViewedServicePoint(servicePoint);
                        setDetailOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}

              {formError && (
                <p className="mt-4 text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-200 dark:border-red-800">{formError}</p>
              )}

              {selectedServicePoint && (
                <button
                  onClick={() => {
                    setFormError(null);
                    setStep(2);
                  }}
                  className="w-full mt-6 py-4 rounded-2xl font-black text-base transition-all shadow-lg active:scale-95"
                  style={{ backgroundColor: primaryColor, color: "#fff" }}
                >
                  Continue with {selectedServicePoint.label}
                </button>
              )}
            </motion.div>
          )}

          {/* Room Details Modal/Sheet */}
          {isDesktop ? (
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
              <DialogContent
                showCloseButton={false}
                className="w-[calc(100vw-3rem)] overflow-hidden rounded-3xl border-border bg-background p-0 sm:max-w-6xl"
                aria-describedby={undefined}
              >
                <DialogTitle className="sr-only">Room Details</DialogTitle>
                <DialogDescription className="sr-only">Detailed view of the selected accommodation.</DialogDescription>
                {viewedServicePoint && (
                  <RoomDetailContent
                    servicePoint={viewedServicePoint}
                    nights={nights}
                    checkInDate={checkInDate}
                    checkOutDate={checkOutDate}
                    isSelected={selectedServicePoint?.servicePointId === viewedServicePoint.servicePointId}
                    isAvailable={isViewedServicePointAvailable}
                    onViewAvailableRooms={handleViewAvailableRooms}
                    onSelect={() => {
                      if (!isViewedServicePointAvailable) return;
                      setSelectedServicePoint(viewedServicePoint);
                      const capacity = getConfiguredServicePointCapacity(viewedServicePoint);
                      if (capacity !== null) setGuestCount((c) => Math.min(c, capacity));
                      setDetailOpen(false);
                      setStep(2);
                    }}
                    primaryColor={primaryColor}
                    onClose={() => setDetailOpen(false)}
                    isDesktop={true}
                    currency={businessCurrency}
                  />
                )}
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
              <SheetContent side="bottom" className="p-0 h-[85vh] rounded-t-3xl border-t border-border bg-background flex flex-col overflow-hidden" aria-describedby={undefined}>
                <SheetHeader className="sr-only">
                  <SheetTitle>Room Details</SheetTitle>
                  <SheetDescription>Detailed view of the selected accommodation.</SheetDescription>
                </SheetHeader>
                {viewedServicePoint && (
                  <RoomDetailContent
                    servicePoint={viewedServicePoint}
                    nights={nights}
                    checkInDate={checkInDate}
                    checkOutDate={checkOutDate}
                    isSelected={selectedServicePoint?.servicePointId === viewedServicePoint.servicePointId}
                    isAvailable={isViewedServicePointAvailable}
                    onViewAvailableRooms={handleViewAvailableRooms}
                    onSelect={() => {
                      if (!isViewedServicePointAvailable) return;
                      setSelectedServicePoint(viewedServicePoint);
                      const capacity = getConfiguredServicePointCapacity(viewedServicePoint);
                      if (capacity !== null) setGuestCount((c) => Math.min(c, capacity));
                      setDetailOpen(false);
                      setStep(2);
                    }}
                    primaryColor={primaryColor}
                    onClose={() => setDetailOpen(false)}
                    isDesktop={false}
                    currency={businessCurrency}
                  />
                )}
              </SheetContent>
            </Sheet>
          )}

          {/* Step 2: Guest Details */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep(1)} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black text-foreground">{stepTitles[2]}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6 ml-10">Tell us about yourself.</p>

              <div className="space-y-4">
                {/* Guest Count */}
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <label className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" /> Number of Guests
                  </label>
                  <div className="flex items-center gap-4 mt-2">
                    <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                      className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-2xl font-black text-foreground w-8 text-center">{guestCount}</span>
                    <button
                      disabled={selectedGuestCapacity !== null && guestCount >= selectedGuestCapacity}
                      onClick={() => setGuestCount(
                        selectedGuestCapacity === null
                          ? guestCount + 1
                          : Math.min(selectedGuestCapacity, guestCount + 1)
                      )}
                      className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                    {selectedGuestCapacity !== null && (
                      <span className="text-xs text-muted-foreground ml-2">Max: {selectedGuestCapacity}</span>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-muted-foreground" /> Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => {
                      setCustomerName(e.target.value.replace(/^(\s*)(\S)/, (_, spaces, first) => `${spaces}${first.toUpperCase()}`));
                      setFormError(null);
                    }}
                    placeholder="John Smith"
                    className="w-full bg-transparent text-foreground focus:outline-none text-sm font-medium placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Phone */}
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-muted-foreground" /> Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setFormError(null); }}
                    placeholder="+1 555 000 0000"
                    className="w-full bg-transparent text-foreground focus:outline-none text-sm font-medium placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Email */}
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-muted-foreground" /> Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setFormError(null); }}
                    placeholder="john@example.com"
                    className="w-full bg-transparent text-foreground focus:outline-none text-sm font-medium placeholder:text-muted-foreground/60"
                  />
                  <p className="text-[11px] text-muted-foreground mt-2">The payment link will be sent to this address.</p>
                </div>

                {/* Special Request */}
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" /> Special Requests (optional)
                  </label>
                  <textarea
                    value={specialRequest}
                    onChange={e => setSpecialRequest(e.target.value)}
                    placeholder={`Early check-in, late check-out, accessibility needs for this ${servicePointTerm.lower}, etc.`}
                    rows={3}
                    className="w-full bg-transparent text-foreground focus:outline-none text-sm font-medium placeholder:text-muted-foreground/60 resize-none"
                  />
                </div>
              </div>

              {formError && (
                <p className="mt-4 text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-200 dark:border-red-800">{formError}</p>
              )}

              <button
                onClick={() => {
                  if (!customerName.trim()) { setFormError("Name is required."); return; }
                  if (!phone.trim()) { setFormError("Phone number is required."); return; }
                  if (!email.trim() || !email.includes("@")) { setFormError("Valid email is required."); return; }
                  setFormError(null);
                  setStep(3);
                }}
                className="w-full mt-6 py-4 rounded-2xl font-black text-base transition-all"
                style={{ backgroundColor: primaryColor, color: "#fff" }}
              >
                Review Booking
              </button>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep(2)} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black text-foreground">{stepTitles[3]}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6 ml-10">Review the details before submitting.</p>

              {/* ServicePoint preview */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-4">
                {selectedServicePoint?.images?.[0] && (
                  <div className="aspect-video w-full overflow-hidden">
                    <img src={selectedServicePoint.images[0]} alt={selectedServicePoint.label} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-black text-foreground text-lg">{selectedServicePoint?.label}</h3>
                  {(selectedServicePoint?.fullDescription || selectedServicePoint?.description) && <p className="text-sm text-muted-foreground mt-1">{selectedServicePoint.fullDescription || selectedServicePoint.description}</p>}
                  <div className="mt-4 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-in</span>
                      <span className="font-bold text-foreground">{formatDate(checkInDate)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-out</span>
                      <span className="font-bold text-foreground">{formatDate(checkOutDate)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Guests</span>
                      <span className="font-bold text-foreground">{guestCount}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-border pt-2.5 mt-2.5">
                      <span className="text-muted-foreground">
                        {formatBookingCurrency(selectedServicePoint?.pricePerNight ?? 0, businessCurrency)} × {nights} night{nights !== 1 ? "s" : ""}
                      </span>
                      <div className="text-right">
                        <span className="font-black text-primary text-lg">
                          {selectedServicePoint?.pricingSummary
                            ? formatBookingCurrency(selectedServicePoint.pricingSummary.total, businessCurrency)
                            : formatBookingCurrency((selectedServicePoint?.pricePerNight ?? 0) * nights, businessCurrency)}
                        </span>
                        {selectedServicePoint?.pricingSummary?.hasAdditionalCharges && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Incl. taxes &amp; fees</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guest details */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Guest Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-bold text-foreground">{customerName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-bold text-foreground">{phone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-bold text-foreground truncate max-w-[200px]">{email}</span></div>
                  {specialRequest && <div className="pt-2 border-t border-border"><p className="text-muted-foreground mb-1">Special Request</p><p className="font-medium text-foreground italic">{specialRequest}</p></div>}
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-200 mb-6">
                <div className="flex items-start gap-2">
                  <CreditCard className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    {bookingMode === "instant" ? (
                      <>
                        <p className="font-bold mb-0.5">Secure Payment</p>
                        <p className="text-xs opacity-80">You will be redirected to a secure checkout to complete your payment. Your room will be held for 30 minutes while you pay.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold mb-0.5">No payment now</p>
                        <p className="text-xs opacity-80">Your request will be reviewed. If accepted, a secure payment link will be emailed to you. Payment confirms your booking.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {formError && (
                <p className="mb-4 text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-200 dark:border-red-800">{formError}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-black text-base transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor, color: "#fff" }}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : bookingMode === "instant" ? <CreditCard className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                {isSubmitting
                  ? bookingMode === "instant" ? "Redirecting to payment..." : "Submitting Request..."
                  : bookingMode === "instant" ? "Pay Now" : "Submit Booking Request"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
