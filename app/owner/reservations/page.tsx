"use client";

import { useBusinessSettings } from "@/contexts/BusinessContext";
import { RestaurantReservationsDashboard } from "@/components/reservations/RestaurantReservationsDashboard";
import { HotelReservationsDashboard } from "@/components/reservations/HotelReservationsDashboard";

export default function OwnerReservationsPage() {
  const { businessType, capabilities } = useBusinessSettings();
  const reservationMode = capabilities?.reservations.primaryMode;
  const isHotel = reservationMode === "stay" || (!reservationMode && businessType === "hotel");

  return isHotel ? <HotelReservationsDashboard /> : <RestaurantReservationsDashboard />;
}
