import { describe, expect, it } from "vitest";
import { parseHotelReservationPrefill } from "./hotel-reservation-prefill";

describe("hotel reservation handoff prefill", () => {
  it("accepts documented stay dates and guest count", () => {
    expect(
      parseHotelReservationPrefill(
        new URLSearchParams(
          "checkInDate=2026-10-13&checkOutDate=2026-10-16&guestCount=4",
        ),
        { businessLocalToday: "2026-10-12" },
      ),
    ).toStrictEqual({
      checkInDate: "2026-10-13",
      checkOutDate: "2026-10-16",
      guestCount: 4,
      notice: null,
    });
  });

  it("leaves the existing hotel flow unchanged when no preferences exist", () => {
    expect(
      parseHotelReservationPrefill(new URLSearchParams(), {
        businessLocalToday: "2026-10-12",
      }),
    ).toStrictEqual({
      checkInDate: null,
      checkOutDate: null,
      guestCount: null,
      notice: null,
    });
  });

  it("discards malformed, reversed, and out-of-range preferences", () => {
    const result = parseHotelReservationPrefill(
      new URLSearchParams(
        "checkInDate=2026-02-30&checkOutDate=2026-02-30&guestCount=51",
      ),
      { businessLocalToday: "2026-10-12" },
    );

    expect(result.checkInDate).toBeNull();
    expect(result.checkOutDate).toBeNull();
    expect(result.guestCount).toBeNull();
    expect(result.notice).toContain("stay dates");
    expect(result.notice).toContain("guest count");
  });

  it("uses the resolved business-local date and requires both stay dates", () => {
    const result = parseHotelReservationPrefill(
      new URLSearchParams("checkInDate=2026-10-11&guestCount=2"),
      { businessLocalToday: "2026-10-12" },
    );

    expect(result.checkInDate).toBeNull();
    expect(result.checkOutDate).toBeNull();
    expect(result.guestCount).toBe(2);
    expect(result.notice).toContain("stay dates");
  });

  it("discards duplicated stay fields and guest count", () => {
    const result = parseHotelReservationPrefill(
      new URLSearchParams(
        "checkInDate=2026-10-13&checkInDate=2026-10-14&checkOutDate=2026-10-16&guestCount=2&guestCount=3",
      ),
      { businessLocalToday: "2026-10-12" },
    );

    expect(result.checkInDate).toBeNull();
    expect(result.checkOutDate).toBeNull();
    expect(result.guestCount).toBeNull();
    expect(result.notice).toContain("stay dates");
    expect(result.notice).toContain("guest count");
  });
});
