// Philippines timezone constant - ensures consistent timezone across all environments (local & production)
const TIMEZONE_PH = 'Asia/Manila';

export const formatDisplayDate = (date?: Date | string | null): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  
  // Returns format: "Jan 2, 2026, 12:11 PM" in Manila timezone
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIMEZONE_PH,
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

/**
 * Format date for display: "Jan 7, 2026" in Manila timezone
 */
export const formatDateOnly = (date?: Date | string | null): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIMEZONE_PH,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
};

/**
 * Format date and time for display: "Jan 7, 2026, 2:43 PM" in Manila timezone
 */
export const formatDateTime = (date?: Date | string | null): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIMEZONE_PH,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
};

/**
 * Format date range for display: "Jan 7 – Jan 10, 2026" in Manila timezone
 */
export const formatDateRange = (
  startDate?: Date | string | null,
  endDate?: Date | string | null
): string | null => {
  if (!startDate || !endDate) return null;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  
  // Use Manila timezone for date comparisons
  const startInPH = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(start);
  const endInPH = new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(end);
  
  const getPartValue = (parts: Intl.DateTimeFormatPart[], type: string) => parts.find(p => p.type === type)?.value || '';
  
  const startYear = getPartValue(startInPH, 'year');
  const startMonth = getPartValue(startInPH, 'month');
  const startDay = getPartValue(startInPH, 'day');
  const endYear = getPartValue(endInPH, 'year');
  const endMonth = getPartValue(endInPH, 'month');
  const endDay = getPartValue(endInPH, 'day');
  
  const sameYear = startYear === endYear;
  const sameMonth = sameYear && startMonth === endMonth;
  const sameDay = sameMonth && startDay === endDay;
  
  if (sameDay) {
    // Same day: "Jan 7, 2026"
    return new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, month: 'short', day: 'numeric', year: 'numeric' }).format(start);
  } else if (sameMonth) {
    // Same month: "Jan 7 – 10, 2026"
    return `${new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, month: 'short', day: 'numeric' }).format(start)} – ${endDay}, ${endYear}`;
  } else if (sameYear) {
    // Same year: "Jan 7 – Feb 10, 2026"
    return `${new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, month: 'short', day: 'numeric' }).format(end)}, ${endYear}`;
  } else {
    // Different years: "Dec 28, 2025 – Jan 3, 2026"
    return `${new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, month: 'short', day: 'numeric', year: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-PH', { timeZone: TIMEZONE_PH, month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`;
  }
};