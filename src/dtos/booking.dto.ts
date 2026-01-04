import { BookingStatus, BookingType, PaymentStatus, TourType } from "@prisma/client";
import { ItineraryDTO } from "./itinerary.dto";

export type BookingOwnership = "OWNED" | "COLLABORATED" | "REQUESTED";

export interface BookingDTO {
  id: string;
  bookingCode: string;
  itineraryId: string;
  userId: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  travelers: number | null;
  totalPrice: number | null;
  type: BookingType;
  status: BookingStatus;
  tourType: TourType;
  paymentStatus: PaymentStatus;
  paymentReceiptUrl?: string | null;
  rejectionReason?: string | null;
  rejectionResolution?: string | null;
  isResolved?: boolean;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  bookedDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  itinerary?: ItineraryDTO | null;
  ownership?: BookingOwnership;
}
