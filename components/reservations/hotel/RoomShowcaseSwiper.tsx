"use client";

import { useEffect, useRef, useState } from "react";
import { Bed, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/localization";
import type { StayServicePoint } from "@/types/service-point";

interface RoomShowcaseSwiperProps {
  rooms: StayServicePoint[];
  currency?: string;
  onOpenRoom: (room: StayServicePoint) => void;
}

export function RoomShowcaseSwiper({
  rooms,
  currency = "USD",
  onOpenRoom,
}: RoomShowcaseSwiperProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (
      !autoplay ||
      prefersReducedMotion ||
      rooms.length < 2
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentSlide((current) => {
        const safeCurrent = Math.min(current, rooms.length - 1);
        return (safeCurrent + 1) % rooms.length;
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [autoplay, prefersReducedMotion, rooms.length]);

  if (rooms.length === 0) return null;

  const activeSlide = Math.min(currentSlide, rooms.length - 1);

  const nextSlide = () => {
    setCurrentSlide((current) => {
      const safeCurrent = Math.min(current, rooms.length - 1);
      return (safeCurrent + 1) % rooms.length;
    });
    setAutoplay(false);
  };

  const previousSlide = () => {
    setCurrentSlide((current) => {
      const safeCurrent = Math.min(current, rooms.length - 1);
      return (safeCurrent - 1 + rooms.length) % rooms.length;
    });
    setAutoplay(false);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setAutoplay(false);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    didSwipe.current = false;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(distance) < 48) return;
    didSwipe.current = true;
    if (distance < 0) nextSlide();
    else previousSlide();
    window.setTimeout(() => {
      didSwipe.current = false;
    }, 0);
  };

  return (
    <section
      className="mb-6 w-full"
      aria-label="Room showcase"
      aria-roledescription="carousel"
    >
      <div
        className="relative h-64 touch-pan-y overflow-hidden rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.22)] sm:h-80"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setAutoplay(false)}
        onMouseLeave={() => {
          if (!prefersReducedMotion) setAutoplay(true);
        }}
        onFocusCapture={() => setAutoplay(false)}
        onBlurCapture={(event) => {
          if (
            !prefersReducedMotion &&
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            setAutoplay(true);
          }
        }}
      >
        {rooms.map((room, index) => {
          const isActive = index === activeSlide;
          const image = room.images?.[0];
          const roomCurrency = room.currency || currency;

          return (
            <button
              key={room.servicePointId}
              type="button"
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
              aria-label={"View details for " + room.label}
              onClick={() => {
                if (!didSwipe.current) onOpenRoom(room);
              }}
              className="absolute inset-0 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
              style={{
                opacity: isActive ? 1 : 0,
                zIndex: isActive ? 10 : 0,
                pointerEvents: isActive ? "auto" : "none",
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 700ms ease-out",
              }}
            >
              {image ? (
                <img
                  src={image}
                  alt={room.label + " room"}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  style={{
                    transform:
                      isActive && !prefersReducedMotion
                        ? "scale(1)"
                        : "scale(1.02)",
                    transition: prefersReducedMotion
                      ? "none"
                      : "transform 7000ms ease-out",
                  }}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              ) : (
                <div
                  role="img"
                  aria-label={"No image available for " + room.label}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 text-white/55"
                >
                  <Bed className="h-14 w-14" />
                  <span className="mt-2 text-xs font-bold uppercase tracking-widest">
                    Room image unavailable
                  </span>
                </div>
              )}

              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.52) 52%, rgba(0,0,0,0.16) 100%)",
                }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.58) 0%, transparent 58%)",
                }}
              />

              <span className="absolute left-5 top-4 z-20 block max-w-[76%] sm:left-14 sm:top-5 sm:max-w-[70%]">
                <span className="block space-y-1.5">
                  {room.roomType?.trim() && (
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white sm:text-xs"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--brand-gradient-from, #EA601A) 0%, var(--brand-gradient-to, #ff8c42) 100%)",
                        boxShadow:
                          "0 2px 12px var(--brand-shadow, rgba(234,96,26,0.45))",
                      }}
                    >
                      {room.roomType}
                    </span>
                  )}

                  <span
                    className="block break-words text-2xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl"
                    style={{ textShadow: "0 2px 16px rgba(0,0,0,0.35)" }}
                  >
                    {room.label}
                  </span>

                </span>
              </span>

              <span className="absolute bottom-12 left-5 z-20 inline-flex items-baseline rounded-full bg-white/95 px-4 py-2 shadow-lg sm:left-14">
                <span className="text-lg font-black text-primary sm:text-2xl">
                  {formatPrice(room.pricePerNight, roomCurrency)}
                </span>
                <span className="ml-1 text-[10px] font-bold text-slate-600 sm:text-xs">
                  / night
                </span>
              </span>
            </button>
          );
        })}

        {rooms.length > 1 && (
          <>
            <button
              type="button"
              onClick={previousSlide}
              aria-label="Previous room"
              className="absolute left-3 top-[54%] z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next room"
              className="absolute right-3 top-[54%] z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/30 px-3 py-2 backdrop-blur-md">
              {rooms.map((room, index) => (
                <button
                  key={room.servicePointId}
                  type="button"
                  onClick={() => goToSlide(index)}
                  aria-label={"Go to room " + String(index + 1)}
                  aria-current={index === activeSlide ? "true" : undefined}
                  className="h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{
                    width: index === activeSlide ? "24px" : "6px",
                    background:
                      index === activeSlide
                        ? "#ffffff"
                        : "rgba(255,255,255,0.45)",
                  }}
                />
              ))}
            </div>
          </>
        )}

        <p className="sr-only" aria-live="polite">
          Room {activeSlide + 1} of {rooms.length}: {rooms[activeSlide].label}
        </p>
      </div>
    </section>
  );
}