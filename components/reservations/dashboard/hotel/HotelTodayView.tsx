"use client";

import { useMemo, useState } from "react";
import { Users, Phone, AlertCircle, LogIn, LogOut, Home } from "lucide-react";
import type { ReservationDashboardRecord } from "@/components/reservations/dashboard/useReservationDashboard";
import { ReservationStatusBadge } from "@/components/reservations/dashboard/ReservationStatusBadge";
import { ReservationPaymentStatusBadge } from "@/components/reservations/dashboard/ReservationPaymentStatusBadge";

interface HotelTodayViewProps {
  operations: {
    arrivals: ReservationDashboardRecord[];
    departures: ReservationDashboardRecord[];
    inHouse: ReservationDashboardRecord[];
  };
  businessDate: string;
  onReservationClick: (reservation: ReservationDashboardRecord) => void;
  renderActionsMenu: (reservation: ReservationDashboardRecord) => React.ReactNode;
}

export function HotelTodayView({
  operations,
  businessDate,
  onReservationClick,
  renderActionsMenu,
}: HotelTodayViewProps) {
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures" | "inHouse">("arrivals");

  // Derived arrays
  const arrivalsToday = operations?.arrivals || [];
  const departuresToday = operations?.departures || [];
  const inHouse = operations?.inHouse || [];

  const allRelevantReservations = useMemo(() => {
    const map = new Map<string, ReservationDashboardRecord>();
    const addAll = (list: ReservationDashboardRecord[]) => list.forEach(r => map.set(r._id, r));
    addAll(arrivalsToday);
    addAll(departuresToday);
    addAll(inHouse);
    return Array.from(map.values());
  }, [arrivalsToday, departuresToday, inHouse]);

  // Needs attention logic
  const needsAttention = useMemo(() => {
    return allRelevantReservations.filter((r) => {
      if (r.status === "pending") return true; // Awaiting Confirmation
      if (r.paymentStatus === "pending" && !["cancelled", "declined", "expired", "no_show", "checked_out"].includes(r.status)) return true; // Payment Required
      if (r.status === "confirmed" && r.checkInDate && r.checkInDate < businessDate) return true; // Overdue Arrival
      if (r.status === "checked_in" && r.checkOutDate && r.checkOutDate < businessDate) return true; // Overdue Departure
      return false;
    });
  }, [allRelevantReservations, businessDate]);

  const renderExceptionLabel = (r: ReservationDashboardRecord) => {
    if (r.status === "pending") return "Awaiting Confirmation";
    if (r.paymentStatus === "pending" && !["cancelled", "declined", "expired", "no_show"].includes(r.status)) return "Payment Required";
    if (r.status === "confirmed" && r.checkInDate && r.checkInDate < businessDate) return "Overdue Arrival";
    if (r.status === "checked_in" && r.checkOutDate && r.checkOutDate < businessDate) return "Overdue Departure";
    return "Needs Attention";
  };

  const getActiveList = () => {
    if (activeTab === "arrivals") return arrivalsToday;
    if (activeTab === "departures") return departuresToday;
    return inHouse;
  };

  const renderList = (list: ReservationDashboardRecord[]) => {
    if (list.length === 0) {
      return (
        <div className="py-12 text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
          <p className="text-muted-foreground font-medium text-sm">No reservations in this category right now.</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-border/50 border border-border rounded-2xl bg-card shadow-sm overflow-hidden">
        {list.map((r) => (
          <div key={r._id} className="transition-colors hover:bg-muted/20 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4">
            <div className="flex-1 cursor-pointer" onClick={() => onReservationClick(r)}>
              <div className="flex items-center gap-3">
                <p className="font-bold text-foreground text-base">{r.customerName}</p>
                <div className="flex items-center gap-2">
                   <ReservationStatusBadge status={r.status} mode="stay" />
                   {r.paymentStatus && <ReservationPaymentStatusBadge paymentStatus={r.paymentStatus} reservationStatus={r.status} />}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium"><Home className="w-3.5 h-3.5" /> {r.servicePointLabel || "Unassigned"}</p>
                <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {r.guestCount}</p>
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {r.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
               {/* Primary actions */}
               {activeTab === "arrivals" && r.status === "confirmed" && r.checkInDate === businessDate && (
                  <div className="hidden lg:block text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Due to Arrive</div>
               )}
               {activeTab === "departures" && r.status === "checked_in" && r.checkOutDate === businessDate && (
                  <div className="hidden lg:block text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">Due to Depart</div>
               )}
               {renderActionsMenu(r)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Needs Attention Queue */}
      {needsAttention.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Needs Attention ({needsAttention.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {needsAttention.map((r) => (
              <div key={r._id} className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex justify-between items-center shadow-sm">
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                        {renderExceptionLabel(r)}
                      </span>
                    </div>
                    <p className="font-bold text-foreground text-sm cursor-pointer hover:underline" onClick={() => onReservationClick(r)}>{r.customerName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.servicePointLabel || "TBD"} • {r.checkInDate} to {r.checkOutDate}</p>
                 </div>
                 <div>
                   {renderActionsMenu(r)}
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Operations Tabs */}
      <div className="space-y-4">
        <h2 className="text-lg font-black tracking-tight text-foreground">Today&apos;s Operations</h2>
        
        <div className="inline-flex bg-muted rounded-xl p-1 gap-1 w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("arrivals")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === "arrivals" ? "bg-card shadow-sm text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="w-4 h-4" />
            Arrivals ({arrivalsToday.length})
          </button>
          <button
            onClick={() => setActiveTab("departures")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === "departures" ? "bg-card shadow-sm text-orange-600 dark:text-orange-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogOut className="w-4 h-4" />
            Departures ({departuresToday.length})
          </button>
          <button
            onClick={() => setActiveTab("inHouse")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === "inHouse" ? "bg-card shadow-sm text-green-600 dark:text-green-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="w-4 h-4" />
            In-House ({inHouse.length})
          </button>
        </div>

        {/* Active List */}
        <div>
          {renderList(getActiveList())}
        </div>
      </div>

    </div>
  );
}
