export const MAX_RESTAURANT_RESERVATION_PARTY_SIZE = 50;

type SearchParamsReader = Pick<URLSearchParams, "getAll">;

export type RestaurantReservationPrefill = {
  date: string | null;
  startTime: string | null;
  partySize: number | null;
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

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parsePartySize(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const partySize = Number(value);
  return Number.isSafeInteger(partySize) && partySize <= MAX_RESTAURANT_RESERVATION_PARTY_SIZE
    ? partySize
    : null;
}

/**
 * Parses Discovery's optional `date`, `startTime`, and `partySize` query
 * preferences. These values never establish availability or a booking; the
 * caller must still query and submit through the canonical reservation APIs.
 */
export function parseRestaurantReservationPrefill(
  searchParams: SearchParamsReader,
  props: { businessLocalToday: string },
): RestaurantReservationPrefill {
  const notices: string[] = [];
  const dateValue = singleOptionalValue(searchParams, "date");
  const startTimeValue = singleOptionalValue(searchParams, "startTime");
  const partySizeValue = singleOptionalValue(searchParams, "partySize");

  let date: string | null = null;
  if (dateValue.provided) {
    if (
      dateValue.duplicated ||
      !dateValue.value ||
      !isValidCalendarDate(dateValue.value) ||
      dateValue.value < props.businessLocalToday
    ) {
      notices.push("The requested reservation date could not be applied.");
    } else {
      date = dateValue.value;
    }
  }

  let startTime: string | null = null;
  if (startTimeValue.provided) {
    if (startTimeValue.duplicated || !startTimeValue.value || !isValidTime(startTimeValue.value)) {
      notices.push("The requested reservation time could not be applied.");
    } else if (!date) {
      notices.push("Choose a valid reservation date before selecting a preferred time.");
    } else {
      startTime = startTimeValue.value;
    }
  }

  let partySize: number | null = null;
  if (partySizeValue.provided) {
    const parsedPartySize = partySizeValue.value ? parsePartySize(partySizeValue.value) : null;
    if (partySizeValue.duplicated || parsedPartySize === null) {
      notices.push(`Choose a party size between 1 and ${MAX_RESTAURANT_RESERVATION_PARTY_SIZE}.`);
    } else {
      partySize = parsedPartySize;
    }
  }

  return {
    date,
    startTime,
    partySize,
    notice: notices.length > 0 ? notices.join(" ") : null,
  };
}
