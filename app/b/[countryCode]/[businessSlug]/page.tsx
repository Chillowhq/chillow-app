"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Truck, PartyPopper, UtensilsCrossed, Gift, MapPin, Clock } from "lucide-react";
import { PublicHubSkeleton } from "@/components/customer-loading-skeletons";
import apiClient from "@/lib/axios-config";
import { isRestaurantOpen, getNextOpening } from "@/lib/operating-hours";
import {
  parsePublicReservationModes,
  type PublicReservationMode,
} from "@/lib/public-reservation-mode";

export default function PublicHubPage() {
  const params = useParams();
  const router = useRouter();
  const countryCode = params.countryCode as string;
  const businessSlug = params.businessSlug as string;

  const [business, setBusiness] = useState<any>(null);
  const [publicReservationModes, setPublicReservationModes] = useState<PublicReservationMode[] | null>(null);
  const [reservationOptionsError, setReservationOptionsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessSlug || !countryCode) return;
    let isActive = true;
    setIsLoading(true);
    setBusiness(null);
    
    const fetchBusiness = async () => {
      try {
        setError(null);
        setPublicReservationModes(null);
        setReservationOptionsError(false);
        const res = await apiClient.get(`/public/business/${countryCode}/${businessSlug}`);
        if (!isActive) return;
        if (res.data.redirectUrl) {
          router.replace(res.data.redirectUrl);
          return;
        }
        setBusiness(res.data);

        try {
          const optionsResponse = await apiClient.get(`/public/reservation-options/${countryCode}/${businessSlug}`);
          if (!isActive) return;
          setPublicReservationModes(parsePublicReservationModes(optionsResponse.data?.modes));
        } catch {
          if (!isActive) return;
          setPublicReservationModes([]);
          setReservationOptionsError(true);
        }
      } catch (err: any) {
        if (!isActive) return;
        if (err.response?.status === 300) {
          setError(err.response.data.error || "Multiple businesses found. Please use the country-specific link.");
        } else {
          setError(err.response?.data?.error || "Failed to load business profile.");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    fetchBusiness();
    return () => {
      isActive = false;
    };
  }, [businessSlug, countryCode, router]);

  if (isLoading) {
    return <PublicHubSkeleton />;
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-sm">
          <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold mb-2 text-foreground">Business Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "Business not found or not currently available."}</p>
        </div>
      </div>
    );
  }

  const { branding, operatingHours, timezone, address } = business;
  const isOpen = isRestaurantOpen(operatingHours, timezone);

  const primaryColor = branding?.primaryColor || "#EA601A";
  const coverImage = branding?.coverImageUrl || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80";
  const hasPublicReservations = publicReservationModes !== null && publicReservationModes.length > 0;

  return (
    <main className="min-h-screen bg-background pb-12" style={{ "--theme-primary": primaryColor } as React.CSSProperties}>
      
      {/* Cover Image & Logo Header */}
      <div className="relative h-64 sm:h-80 w-full">
        <div className="absolute inset-0 bg-black/40 z-10" />
        <img 
          src={coverImage} 
          alt={`${business.displayName} cover`}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            {/* Could put a back button here if relevant, or just logo/spacer */}
          </div>
        </div>

        {/* Profile Content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 translate-y-1/2">
          <div className="max-w-3xl mx-auto px-4 flex flex-col items-center">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-background bg-card shadow-xl overflow-hidden flex items-center justify-center relative z-30">
              {business.logoUrl ? (
                <img src={business.logoUrl} alt={business.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-muted-foreground">{business.displayName.charAt(0)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-20 sm:pt-24 text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-2">
          {business.displayName}
        </h1>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm font-medium text-muted-foreground mb-8">
          {address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
              <span>{address}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" style={{ color: primaryColor }} />
            <span className="flex items-center gap-1.5">
              {isOpen ? (
                <span className="text-green-600 dark:text-green-500 font-bold">Open Now</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-500 font-bold">Closed</span>
              )}
              {isOpen ? null : (
                <span className="hidden sm:inline">• Opens {getNextOpening(operatingHours, timezone)}</span>
              )}
            </span>
          </div>
        </div>

        <p className="text-muted-foreground/80 max-w-lg mx-auto mb-10 text-base leading-relaxed">
          Welcome to our digital hub! Select an option below to engage with us.
        </p>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          
          {/* Reservation Card */}
          {hasPublicReservations ? (
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/reserve/${countryCode}/${businessSlug}`)}
              className="flex flex-col items-center justify-center p-6 bg-card border-2 shadow-sm rounded-2xl hover:shadow-md transition-all text-center group"
              style={{ borderColor: `${primaryColor}30` }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground text-lg mb-1">Reserve a Place</h3>
              <p className="text-xs text-muted-foreground font-medium">Book a place for your visit</p>
            </motion.button>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 bg-card/50 border border-border/50 rounded-2xl text-center opacity-60 grayscale cursor-not-allowed relative">
              <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-muted rounded-md text-muted-foreground uppercase tracking-wider">
                Disabled
              </div>
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-foreground text-lg mb-1">Reservations unavailable</h3>
              <p className="text-xs text-muted-foreground font-medium">
                {reservationOptionsError ? "Booking availability is temporarily unavailable" : "Online booking is currently unavailable"}
              </p>
            </div>
          )}

          {/* Muted: Order Delivery */}
          <div className="flex flex-col items-center justify-center p-6 bg-card/50 border border-border/50 rounded-2xl text-center opacity-60 grayscale cursor-not-allowed relative">
            <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-muted rounded-md text-muted-foreground uppercase tracking-wider">
              Coming Soon
            </div>
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Truck className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">Order Delivery</h3>
            <p className="text-xs text-muted-foreground font-medium">Delivered to your door</p>
          </div>

          {/* Muted: Events */}
          <div className="flex flex-col items-center justify-center p-6 bg-card/50 border border-border/50 rounded-2xl text-center opacity-60 grayscale cursor-not-allowed relative">
            <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-muted rounded-md text-muted-foreground uppercase tracking-wider">
              Coming Soon
            </div>
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <PartyPopper className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">Private Events</h3>
            <p className="text-xs text-muted-foreground font-medium">Host your next gathering</p>
          </div>

          {/* Muted: Loyalty */}
          <div className="flex flex-col items-center justify-center p-6 bg-card/50 border border-border/50 rounded-2xl text-center opacity-60 grayscale cursor-not-allowed relative">
            <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-muted rounded-md text-muted-foreground uppercase tracking-wider">
              Coming Soon
            </div>
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Gift className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">Loyalty Program</h3>
            <p className="text-xs text-muted-foreground font-medium">Earn rewards on every visit</p>
          </div>

        </div>
      </div>
    </main>
  );
}
