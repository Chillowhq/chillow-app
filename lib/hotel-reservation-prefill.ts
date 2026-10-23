export const MAX_HOTEL_RESERVATION_GUEST_COUNT = 50;

type SearchParamsReader = Pick<URLSearchParams, "getAll">;

export type HotelReservationPrefill = {
  checkInDate: string | null;
  checkOutDate: string | null;
  guestCount: number | null;
  notice: string | null;
};

function singleOptionalValue(
  searchParams: SearchParamsReader,
  key: string,
): {
  value: string | null;
  provided: boolean;
  duplicated: boolean;
} {
  const values = searchParams.getAll(key);
  if (values.length === 0 || values.every((value) => value.trim() === "")) {
    return { value: null, provided: false, duplicated: false };
  }
  if (values.length !== 1) {
    return { value: null, provided: true, duplicated: true };
  }
  return { value: values[0].trim(), provided: true, duplicated: false };
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const candidate = new Date(0);
  candidate.setUTCFullYear(year, month - 1, day);
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function parseGuestCount(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const guestCount = Number(value);
  return Number.isSafeInteger(guestCount) && guestCount <= MAX_HOTEL_RESERVATION_GUEST_COUNT
    ? guestCount
    : null;
}

/**
 * Parses Discovery stay preferences only. The canonical hotel availability and
 * creation APIs still validate business timezone, capacity, pricing, and holds.
 */
export function parseHotelReservationPrefill(
  searchParams: SearchParamsReader,
  props: { businessLocalToday: string },
): HotelReservationPrefill {
  const notices: string[] = [];
  const checkInValue = singleOptionalValue(searchParams, "checkInDate");
  const checkOutValue = singleOptionalValue(searchParams, "checkOutDate");
  const guestCountValue = singleOptionalValue(searchParams, "guestCount");

  let checkInDate: string | null = null;
  let checkOutDate: string | null = null;
  if (checkInValue.provided || checkOutValue.provided) {
    if (
      checkInValue.duplicated ||
      checkOutValue.duplicated ||
      !checkInValue.value ||
      !checkOutValue.value ||
      !isValidCalendarDate(checkInValue.value) ||
      !isValidCalendarDate(checkOutValue.value) ||
      checkInValue.value < props.businessLocalToday ||
      checkOutValue.value < props.businessLocalToday ||
      checkOutValue.value <= checkInValue.value
    ) {
      notices.push("The requested stay dates could not be applied.");
    } else {
      checkInDate = checkInValue.value;
      checkOutDate = checkOutValue.value;
    }
  }

  let guestCount: number | null = null;
  if (guestCountValue.provided) {
    const parsedGuestCount = guestCountValue.value
      ? parseGuestCount(guestCountValue.value)
      : null;
    if (guestCountValue.duplicated || parsedGuestCount === null) {
      notices.push(`Choose a guest count between 1 and ${MAX_HOTEL_RESERVATION_GUEST_COUNT}.`);
    } else {
      guestCount = parsedGuestCount;
    }
  }

  return {
    checkInDate,
    checkOutDate,
    guestCount,
    notice: notices.length > 0 ? notices.join(" ") : null,
  };
}
