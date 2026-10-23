import { describe, expect, it } from "vitest";
import { parseRestaurantReservationPrefill } from "./restaurant-reservation-prefill";

describe("restaurant reservation handoff prefill", () => {
  it("accepts the documented date, time, and party-size preferences", () => {
    expect(
      parseRestaurantReservationPrefill(
        new URLSearchParams("date=2026-10-13&startTime=19%3A30&partySize=4"),
        { businessLocalToday: "2026-10-12" },
      ),
    ).toStrictEqual({
      date: "2026-10-13",
      startTime: "19:30",
      partySize: 4,
      notice: null,
    });
  });

  it("leaves the existing guest reservation flow unchanged when no preferences exist", () => {
    expect(
      parseRestaurantReservationPrefill(new URLSearchParams(), {
        businessLocalToday: "2026-10-12",
      }),
    ).toStrictEqual({ date: null, startTime: null, partySize: null, notice: null });
  });

  it("discards invalid dates, times, and bounded party sizes", () => {
    const result = parseRestaurantReservationPrefill(
      new URLSearchParams("date=2026-02-30&startTime=25%3A61&partySize=51"),
      { businessLocalToday: "2026-10-12" },
    );

    expect(result.date).toBeNull();
    expect(result.startTime).toBeNull();
    expect(result.partySize).toBeNull();
    expect(result.notice).toContain("date");
    expect(result.notice).toContain("time");
    expect(result.notice).toContain("party size");
  });

  it("uses the resolved business-local date rather than the browser date", () => {
    const result = parseRestaurantReservationPrefill(
      new URLSearchParams("date=2026-10-11&partySize=2"),
      { businessLocalToday: "2026-10-12" },
    );

    expect(result.date).toBeNull();
    expect(result.partySize).toBe(2);
    expect(result.notice).toContain("date");
  });

  it("does not apply a preferred time without a valid requested date", () => {
    const result = parseRestaurantReservationPrefill(new URLSearchParams("startTime=19%3A30"), {
      businessLocalToday: "2026-10-12",
    });

    expect(result.startTime).toBeNull();
    expect(result.notice).toContain("valid reservation date");
  });
});
