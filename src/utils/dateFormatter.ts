export const formatDisplayDate = (date?: Date | string | null): string | null => {
  if (!date) return null;
  const d = new Date(date);
  
  // Returns format: "Jan 2, 2026, 12:11 PM"
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(d);
};

export const parseBookingDate = (dateString: string | Date | undefined): Date | undefined => {
  if (!dateString) return undefined;
  
  if (dateString instanceof Date) return dateString;

  return new Date(dateString); 
};

/*

The Solution: Keep new Date(), but ensure you are ignoring the time component effectively. A common trick is to force the time to noon or explicitly treat the string as UTC to prevent it from shifting to the previous day.

Recommended Helper Function: Add this to your backend src/utils/dateFormatter.ts and use it in your services instead of raw new Date().

booking.service.ts

import { parseBookingDate } from "@/utils/dateFormatter";

// ... inside createBooking ...
startDate: parseBookingDate(data.itinerary?.startDate),
endDate: parseBookingDate(data.itinerary?.endDate),

*/