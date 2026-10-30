export const PUBLIC_RESERVATION_MODES = ["stay", "timeslot"] as const;

export type PublicReservationMode = (typeof PUBLIC_RESERVATION_MODES)[number];

export type PublicReservationModeResolution = {
  mode: PublicReservationMode | null;
  explicitlyUnavailable: boolean;
};

function isPublicReservationMode(value: string): value is PublicReservationMode {
  return value === "stay" || value === "timeslot";
}

export function parsePublicReservationModes(value: unknown): PublicReservationMode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((mode): mode is PublicReservationMode => typeof mode === "string" && isPublicReservationMode(mode)))];
}

export function resolvePublicReservationMode(props: {
  requestedMode: string | null;
  availableModes: PublicReservationMode[];
}): PublicReservationModeResolution {
  if (props.requestedMode !== null) {
    if (!isPublicReservationMode(props.requestedMode) || !props.availableModes.includes(props.requestedMode)) {
      return { mode: null, explicitlyUnavailable: true };
    }

    return { mode: props.requestedMode, explicitlyUnavailable: false };
  }

  return {
    mode: props.availableModes.length === 1 ? props.availableModes[0] : null,
    explicitlyUnavailable: false,
  };
}
