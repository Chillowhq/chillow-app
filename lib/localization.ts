
/**
 * Localization utilities for Chillow
 */

/**
 * Formats a numeric price into a currency string based on restaurant settings
 * @param amount - The price amount
 * @param currencyCode - The ISO currency code (e.g., 'USD', 'EUR', 'GBP')
 * @returns Formatted string (e.g., '$22.50', '€22,50', '£22.50')
 */
export const formatPrice = (amount: number, currencyCode: string = 'USD'): string => {
    // Force specific symbols for Naira and Cedi if browser Intl is inconsistent
    if (currencyCode === 'NGN') return `₦${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (currencyCode === 'GHS') return `₵${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
        }).format(amount);
    } catch {
        // Fallback if currency code is invalid
        const symbols: Record<string, string> = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'NGN': '₦',
            'GHS': '₵'
        };
        const symbol = symbols[currencyCode] || '$';
        return `${symbol}${amount.toFixed(2)}`;
    }
};

/** Formats an integer amount received in a currency's minor unit (for example
 * cents for EUR/USD and whole units for zero-decimal currencies such as JPY).
 */
export const formatMinorCurrency = (
    amountMinor: number,
    currencyCode: string,
    locale: string = 'en-US'
): string => {
    const currency = String(currencyCode || '').trim().toUpperCase();
    const amount = Number(amountMinor);
    if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(currency)) return '-';

    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
        });
        const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
        return formatter.format(amount / (10 ** exponent));
    } catch {
        return `${currency} ${amount}`;
    }
};

/**
 * Formats a date/time string or object into the restaurant's local time
 * @param date - Date object or ISO string
 * @param timezone - IANA timezone string (e.g., 'America/New_York', 'Europe/Paris')
 * @returns Formatted time string (e.g., '19:42')
 */
export const formatTime = (date: Date | string, timezone: string = 'UTC'): string => {
    const d = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
    }).format(d);
};

/**
 * Formats a full date/time string
 * @param date - Date object or ISO string
 * @param timezone - IANA timezone string
 * @returns Formatted date/time string
 */
export const formatDateTime = (date: Date | string, timezone: string = 'UTC'): string => {
    const d = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
    }).format(d);
};

export const pluralize = (
    count: number,
    singular: string,
    plural: string = `${singular}s`,
): string => count === 1 ? singular : plural;
