/**
 * Utility to check if restaurant is open based on operating hours and timezone
 */
export const isRestaurantOpen = (hours: any, timezone: string = 'UTC'): boolean => {
    if (!hours) return true;

    try {
        const now = new Date();

        // Get day name in restaurant timezone
        const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone });
        const dayName = dayFormat.format(now);

        // Get current time in HH:mm format in restaurant timezone
        const timeFormat = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: timezone
        });
        const currentTime = timeFormat.format(now);

        const todayHours = hours[dayName];
        if (!todayHours || !todayHours.enabled) return false;

        // Simple string comparison works for HH:mm format
        return currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
    } catch (err) {
        console.error("isRestaurantOpen error:", err);
        return true; // Fallback to open on error
    }
};

/**
 * Gets next opening time if closed (Simplified)
 */
export const getNextOpening = (hours: any, timezone: string = 'UTC'): string => {
    // This could be more complex, but for now just show today's hours if closed
    try {
        const now = new Date();
        const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone });
        const dayName = dayFormat.format(now);
        const todayHours = hours?.[dayName];

        if (todayHours?.enabled) {
            return `Opens at ${todayHours.openTime}`;
        }
        return "Closed today";
    } catch {
        return "Closed";
    }
};
