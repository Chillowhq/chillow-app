import { describe, expect, it } from "vitest";

import {
  parsePublicReservationModes,
  resolvePublicReservationMode,
} from "@/lib/public-reservation-mode";

describe("parsePublicReservationModes", () => {
  it("keeps only supported modes and removes duplicates", () => {
    expect(parsePublicReservationModes(["stay", "spa", "timeslot", "stay"])).toEqual(["stay", "timeslot"]);
  });

  it("fails closed for an invalid response", () => {
    expect(parsePublicReservationModes({ modes: ["stay"] })).toEqual([]);
  });
});

describe("resolvePublicReservationMode", () => {
  it("selects an explicitly requested available stay", () => {
    expect(resolvePublicReservationMode({ requestedMode: "stay", availableModes: ["stay"] }))
      .toEqual({ mode: "stay", explicitlyUnavailable: false });
  });

  it("rejects an explicitly requested unavailable dining mode", () => {
    expect(resolvePublicReservationMode({ requestedMode: "timeslot", availableModes: ["stay"] }))
      .toEqual({ mode: null, explicitlyUnavailable: true });
  });

  it("selects an explicitly requested available dining mode", () => {
    expect(resolvePublicReservationMode({ requestedMode: "timeslot", availableModes: ["timeslot"] }))
      .toEqual({ mode: "timeslot", explicitlyUnavailable: false });
  });

  it("rejects an explicitly requested unavailable stay mode", () => {
    expect(resolvePublicReservationMode({ requestedMode: "stay", availableModes: ["timeslot"] }))
      .toEqual({ mode: null, explicitlyUnavailable: true });
  });

  it("accepts either explicitly requested hybrid mode", () => {
    expect(resolvePublicReservationMode({ requestedMode: "stay", availableModes: ["stay", "timeslot"] }))
      .toEqual({ mode: "stay", explicitlyUnavailable: false });
    expect(resolvePublicReservationMode({ requestedMode: "timeslot", availableModes: ["stay", "timeslot"] }))
      .toEqual({ mode: "timeslot", explicitlyUnavailable: false });
  });

  it("keeps navigation unselected when no public mode is enabled", () => {
    expect(resolvePublicReservationMode({ requestedMode: null, availableModes: [] }))
      .toEqual({ mode: null, explicitlyUnavailable: false });
  });

  it("rejects invalid explicit modes", () => {
    expect(resolvePublicReservationMode({ requestedMode: "spa", availableModes: ["stay"] }))
      .toEqual({ mode: null, explicitlyUnavailable: true });
  });

  it("preserves mode-less legacy navigation for one enabled mode", () => {
    expect(resolvePublicReservationMode({ requestedMode: null, availableModes: ["stay"] }))
      .toEqual({ mode: "stay", explicitlyUnavailable: false });
  });

  it("requires a guest selection for mode-less hybrid navigation", () => {
    expect(resolvePublicReservationMode({ requestedMode: null, availableModes: ["stay", "timeslot"] }))
      .toEqual({ mode: null, explicitlyUnavailable: false });
  });
});
