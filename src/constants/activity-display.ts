import { ActivityEventCode, ActivityEventCodes } from "./activity-events";

export interface ActivityDisplayInfo {
  label: string;
  description: string;
  icon: string;
  category: ActivityCategory;
}

export type ActivityCategory =
  | "BOOKING"
  | "ITINERARY"
  | "USER_MANAGEMENT"
  | "PAYMENT"
  | "SYSTEM"
  | "TRAVEL_PLAN"
  | "INQUIRY"
  | "FEEDBACK"
  | "ACCOUNT";

export const ActivityDisplayMap: Record<ActivityEventCode, ActivityDisplayInfo> = {
  // ============================================
  // ADMIN - BOOKING MANAGEMENT
  // ============================================
  [ActivityEventCodes.ADMIN_BOOKING_CREATED]: {
    label: "Created Booking",
    description: "Created a new booking for {destination}",
    icon: "calendar-plus",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_BOOKING_UPDATED]: {
    label: "Updated Booking",
    description: "Updated booking details for {bookingCode}",
    icon: "calendar-edit",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_BOOKING_CANCELLED]: {
    label: "Cancelled Booking",
    description: "Cancelled booking {bookingCode}",
    icon: "calendar-x",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_BOOKING_VIEWED]: {
    label: "Viewed Booking Details",
    description: "Viewed booking {bookingCode}",
    icon: "eye",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_BOOKING_COMPLETED]: {
    label: "Completed Booking",
    description: "Marked booking {bookingCode} as completed",
    icon: "calendar-check",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_BOOKING_REASSIGNED]: {
    label: "Reassigned Booking",
    description: "Reassigned booking {bookingCode}",
    icon: "users",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_BOOKING_APPROVED]: {
    label: "Approved Booking",
    description: "Approved booking {bookingCode}",
    icon: "check-circle",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_BOOKING_REJECTED]: {
    label: "Rejected Booking",
    description: "Rejected booking {bookingCode}",
    icon: "x-circle",
    category: "BOOKING",
  },
  [ActivityEventCodes.ADMIN_TRANSACTION_FLAGGED]: {
    label: "Flagged Transaction",
    description: "Flagged transaction for review",
    icon: "flag",
    category: "PAYMENT",
  },

  // ============================================
  // ADMIN - ITINERARY MANAGEMENT
  // ============================================
  [ActivityEventCodes.ADMIN_ITINERARY_STANDARD_CREATED]: {
    label: "Created Standard Itinerary",
    description: "Created a new standard itinerary for {destination}",
    icon: "map-plus",
    category: "ITINERARY",
  },
  [ActivityEventCodes.ADMIN_ITINERARY_UPDATED]: {
    label: "Edited Itinerary",
    description: "Updated itinerary for {destination}",
    icon: "map-edit",
    category: "ITINERARY",
  },
  [ActivityEventCodes.ADMIN_ITINERARY_DELETED]: {
    label: "Deleted Itinerary",
    description: "Deleted itinerary {title}",
    icon: "map-x",
    category: "ITINERARY",
  },
  [ActivityEventCodes.ADMIN_ITINERARY_DRAFT_SAVED]: {
    label: "Saved Draft",
    description: "Saved itinerary draft for {destination}",
    icon: "save",
    category: "ITINERARY",
  },
  [ActivityEventCodes.ADMIN_ITINERARY_SENT]: {
    label: "Sent Itinerary",
    description: "Sent itinerary to {targetUserName}",
    icon: "send",
    category: "ITINERARY",
  },
  [ActivityEventCodes.ADMIN_ITINERARY_DRAFT_DELETED]: {
    label: "Deleted Draft",
    description: "Deleted itinerary draft",
    icon: "trash",
    category: "ITINERARY",
  },

  // ============================================
  // ADMIN - USER MANAGEMENT
  // ============================================
  [ActivityEventCodes.ADMIN_USER_CREATED]: {
    label: "Created User",
    description: "Created new user account for {email}",
    icon: "user-plus",
    category: "USER_MANAGEMENT",
  },
  [ActivityEventCodes.ADMIN_USER_DELETED]: {
    label: "Deleted User",
    description: "Deleted user account {email}",
    icon: "user-x",
    category: "USER_MANAGEMENT",
  },
  [ActivityEventCodes.ADMIN_USER_ROLE_UPDATED]: {
    label: "Updated User Permissions",
    description: "Changed role for {email} to {newRole}",
    icon: "shield",
    category: "USER_MANAGEMENT",
  },
  [ActivityEventCodes.ADMIN_USER_PASSWORD_RESET]: {
    label: "Reset User Password",
    description: "Reset password for {email}",
    icon: "key",
    category: "USER_MANAGEMENT",
  },
  [ActivityEventCodes.ADMIN_USER_SUSPENDED]: {
    label: "Suspended User",
    description: "Suspended user account {email}",
    icon: "user-minus",
    category: "USER_MANAGEMENT",
  },
  [ActivityEventCodes.ADMIN_USER_BANNED]: {
    label: "Banned User",
    description: "Banned user account {email}",
    icon: "ban",
    category: "USER_MANAGEMENT",
  },

  // ============================================
  // ADMIN - SYSTEM & REPORTS
  // ============================================
  [ActivityEventCodes.ADMIN_LOGIN]: {
    label: "Login",
    description: "Admin logged in",
    icon: "log-in",
    category: "SYSTEM",
  },
  [ActivityEventCodes.ADMIN_REPORT_EXPORTED]: {
    label: "Exported Report",
    description: "Exported {reportType} report",
    icon: "download",
    category: "SYSTEM",
  },
  [ActivityEventCodes.ADMIN_REPORT_VIEWED]: {
    label: "Viewed Report",
    description: "Viewed {reportType} report",
    icon: "bar-chart",
    category: "SYSTEM",
  },
  [ActivityEventCodes.ADMIN_NOTIFICATION_SENT]: {
    label: "Sent Notification",
    description: "Sent notification to users",
    icon: "bell",
    category: "SYSTEM",
  },
  [ActivityEventCodes.ADMIN_PROFILE_UPDATED]: {
    label: "Updated Profile",
    description: "Updated admin profile",
    icon: "user-edit",
    category: "ACCOUNT",
  },
  [ActivityEventCodes.ADMIN_SYSTEM_CONFIG_UPDATED]: {
    label: "System Configuration Change",
    description: "Updated system configuration",
    icon: "settings",
    category: "SYSTEM",
  },

  // ============================================
  // USER - BOOKING & TRANSACTIONS
  // ============================================
  [ActivityEventCodes.USER_BOOKING_CREATED]: {
    label: "Booked Trip",
    description: "Created a booking to {destination}",
    icon: "calendar-plus",
    category: "BOOKING",
  },
  [ActivityEventCodes.USER_BOOKING_CANCELLED]: {
    label: "Cancelled Booking",
    description: "Cancelled booking to {destination}",
    icon: "calendar-x",
    category: "BOOKING",
  },
  [ActivityEventCodes.USER_PAYMENT_COMPLETED]: {
    label: "Completed Payment",
    description: "Completed payment of {amount}",
    icon: "credit-card",
    category: "PAYMENT",
  },
  [ActivityEventCodes.USER_INVOICE_DOWNLOADED]: {
    label: "Downloaded Invoice",
    description: "Downloaded invoice for booking {bookingCode}",
    icon: "file-text",
    category: "PAYMENT",
  },
  [ActivityEventCodes.USER_REFUND_REQUESTED]: {
    label: "Refund Requested",
    description: "Requested refund for booking {bookingCode}",
    icon: "rotate-ccw",
    category: "PAYMENT",
  },

  // ============================================
  // USER - TRAVEL PLANS
  // ============================================
  [ActivityEventCodes.USER_TRAVEL_PLAN_CREATED]: {
    label: "Created Travel Plan",
    description: "Created a new travel plan to {destination}",
    icon: "map-plus",
    category: "TRAVEL_PLAN",
  },
  [ActivityEventCodes.USER_TRAVEL_PLAN_UPDATED]: {
    label: "Updated Travel Plan",
    description: "Updated travel plan for {destination}",
    icon: "map-edit",
    category: "TRAVEL_PLAN",
  },
  [ActivityEventCodes.USER_TRAVEL_PLAN_DRAFT_SAVED]: {
    label: "Saved Itinerary Draft",
    description: "Saved draft for {destination}",
    icon: "save",
    category: "TRAVEL_PLAN",
  },
  [ActivityEventCodes.USER_TRAVEL_PLAN_COLLABORATOR_ADDED]: {
    label: "Added Collaborator",
    description: "Added {collaboratorName} as collaborator",
    icon: "user-plus",
    category: "TRAVEL_PLAN",
  },
  [ActivityEventCodes.USER_TRAVEL_PLAN_COLLABORATOR_REMOVED]: {
    label: "Removed Collaborator",
    description: "Removed collaborator from travel plan",
    icon: "user-minus",
    category: "TRAVEL_PLAN",
  },
  [ActivityEventCodes.USER_TRAVEL_PLAN_DELETED]: {
    label: "Deleted Travel Plan",
    description: "Deleted travel plan",
    icon: "trash",
    category: "TRAVEL_PLAN",
  },

  // ============================================
  // USER - INQUIRIES & SUPPORT
  // ============================================
  [ActivityEventCodes.USER_INQUIRY_SUBMITTED]: {
    label: "Submitted Inquiry",
    description: "Submitted inquiry: {subject}",
    icon: "help-circle",
    category: "INQUIRY",
  },
  [ActivityEventCodes.USER_INQUIRY_CREATED]: {
    label: "Created Inquiry",
    description: "Created inquiry: {subject}",
    icon: "message-circle",
    category: "INQUIRY",
  },
  [ActivityEventCodes.USER_SUPPORT_REPLIED]: {
    label: "Replied to Support",
    description: "Sent message in inquiry thread",
    icon: "message-square",
    category: "INQUIRY",
  },

  // ============================================
  // USER - ENGAGEMENT & FEEDBACK
  // ============================================
  [ActivityEventCodes.USER_TRIP_REVIEWED]: {
    label: "Reviewed Trip",
    description: "Submitted a review with {rating} stars",
    icon: "star",
    category: "FEEDBACK",
  },
  [ActivityEventCodes.USER_FEEDBACK_SUBMITTED]: {
    label: "Submitted Feedback",
    description: "Submitted feedback",
    icon: "message-circle",
    category: "FEEDBACK",
  },
  [ActivityEventCodes.USER_ITINERARY_VIEWED]: {
    label: "Viewed Itinerary",
    description: "Viewed itinerary for {destination}",
    icon: "eye",
    category: "ITINERARY",
  },
  [ActivityEventCodes.USER_ITINERARY_SHARED]: {
    label: "Shared Itinerary",
    description: "Shared itinerary with others",
    icon: "share",
    category: "ITINERARY",
  },

  // ============================================
  // USER - ACCOUNT & SECURITY
  // ============================================
  [ActivityEventCodes.USER_LOGIN]: {
    label: "Login",
    description: "Logged in",
    icon: "log-in",
    category: "ACCOUNT",
  },
  [ActivityEventCodes.USER_PROFILE_UPDATED]: {
    label: "Updated Profile",
    description: "Updated profile information",
    icon: "user-edit",
    category: "ACCOUNT",
  },
  [ActivityEventCodes.USER_PASSWORD_CHANGED]: {
    label: "Changed Password",
    description: "Changed account password",
    icon: "key",
    category: "ACCOUNT",
  },
  [ActivityEventCodes.USER_2FA_ENABLED]: {
    label: "Enabled 2FA",
    description: "Enabled two-factor authentication",
    icon: "shield-check",
    category: "ACCOUNT",
  },
  [ActivityEventCodes.USER_2FA_DISABLED]: {
    label: "Disabled 2FA",
    description: "Disabled two-factor authentication",
    icon: "shield-off",
    category: "ACCOUNT",
  },
};

/**
 * Default display info for unknown event codes
 */
const DEFAULT_DISPLAY: ActivityDisplayInfo = {
  label: "Activity",
  description: "{action}",
  icon: "activity",
  category: "SYSTEM",
};

/**
 * Get display information for an event code
 */
export function getDisplayInfo(eventCode: string): ActivityDisplayInfo {
  return ActivityDisplayMap[eventCode as ActivityEventCode] ?? DEFAULT_DISPLAY;
}

/**
 * Format a description by interpolating metadata values
 */
export function formatDescription(
  template: string,
  metadata?: Record<string, unknown>
): string {
  if (!metadata) return template.replace(/\{[^}]+\}/g, "").trim();

  let result = template;
  for (const [key, value] of Object.entries(metadata)) {
    const placeholder = `{${key}}`;
    if (result.includes(placeholder) && value != null) {
      result = result.replace(placeholder, String(value));
    }
  }

  // Clean up any remaining placeholders
  result = result.replace(/\{[^}]+\}/g, "").trim();

  return result;
}

/**
 * Get formatted display for an activity log entry
 */
export function getActivityDisplay(
  eventCode: string,
  metadata?: Record<string, unknown>
): { label: string; description: string; icon: string; category: ActivityCategory } {
  const displayInfo = getDisplayInfo(eventCode);

  return {
    label: displayInfo.label,
    description: formatDescription(displayInfo.description, metadata),
    icon: displayInfo.icon,
    category: displayInfo.category,
  };
}

/**
 * Category groupings for filtering
 */
export const CategoryGroups = {
  BOOKING: ["BOOKING"],
  ITINERARY: ["ITINERARY", "TRAVEL_PLAN"],
  USER: ["USER_MANAGEMENT", "ACCOUNT"],
  PAYMENT: ["PAYMENT"],
  INQUIRY: ["INQUIRY"],
  FEEDBACK: ["FEEDBACK"],
  SYSTEM: ["SYSTEM"],
} as const;

/**
 * Get all event codes for a category group
 */
export function getEventCodesForCategory(categoryGroup: keyof typeof CategoryGroups): string[] {
  const categories = CategoryGroups[categoryGroup] as readonly string[];
  return Object.entries(ActivityDisplayMap)
    .filter(([_, info]) => categories.includes(info.category))
    .map(([code]) => code);
}
