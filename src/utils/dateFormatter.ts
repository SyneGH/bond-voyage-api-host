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