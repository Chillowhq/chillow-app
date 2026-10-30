"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBusinessSettings } from "@/contexts/BusinessContext";
import { RestaurantReservationsDashboard } from "@/components/reservations/RestaurantReservationsDashboard";
import { HotelReservationsDashboard } from "@/components/reservations/HotelReservationsDashboard";

export default function OwnerReservationsPage() {
  const { businessType, capabilities } = useBusinessSettings();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modes = capabilities?.reservations.modes || [];
  const primaryMode = capabilities?.reservations.primaryMode ||
    (businessType === "hotel" ? "stay" : "timeslot");
  const isHybrid = modes.includes("stay") && modes.includes("timeslot");
  const requestedMode = searchParams.get("mode");
  const selectedMode = isHybrid && (requestedMode === "stay" || requestedMode === "timeslot")
    ? requestedMode
    : primaryMode;

  useEffect(() => {
    if (!isHybrid || requestedMode === selectedMode) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", selectedMode);
    router.replace(`${pathname}?${params.toString()}`);
  }, [isHybrid, pathname, requestedMode, router, searchParams, selectedMode]);

  const selectMode = (mode: "stay" | "timeslot") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    router.push(`${pathname}?${params.toString()}`);
  };

  const dashboard = selectedMode === "stay"
    ? <HotelReservationsDashboard key="stay" />
    : <RestaurantReservationsDashboard key="timeslot" />;

  if (!isHybrid) return dashboard;

  return (
    <div>
      <div className="mb-5 flex gap-2 border-b border-border" role="tablist" aria-label="Reservation mode">
        <button
          type="button"
          role="tab"
          aria-selected={selectedMode === "stay"}
          onClick={() => selectMode("stay")}
          className={`border-b-2 px-4 py-3 text-sm font-bold ${selectedMode === "stay" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Stays
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedMode === "timeslot"}
          onClick={() => selectMode("timeslot")}
          className={`border-b-2 px-4 py-3 text-sm font-bold ${selectedMode === "timeslot" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Dining
        </button>
      </div>
      {dashboard}
    </div>
  );
}
