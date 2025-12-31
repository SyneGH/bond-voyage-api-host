import {
  PrismaClient,
  UserRole,
  ItineraryType,
  ItineraryStatus,
  BookingType,
  BookingStatus,
  TourType,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  CollaboratorRole,
  NotificationType,
  InquiryStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const userPassword = await bcrypt.hash("User@123", 12);

  // --- USERS ---
  const [admin, user, collaborator] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        firstName: "Admin",
        lastName: "BondVoyage",
        email: "admin@example.com",
        mobile: "09123456789",
        password: adminPassword,
        role: UserRole.ADMIN,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "user@example.com" },
      update: {},
      create: {
        firstName: "John",
        lastName: "Traveler",
        email: "user@example.com",
        mobile: "09876543210",
        password: userPassword,
        role: UserRole.USER,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "collab@example.com" },
      update: {},
      create: {
        firstName: "Maria",
        lastName: "Collaborator",
        email: "collab@example.com",
        mobile: "09012345678",
        password: userPassword,
        role: UserRole.USER,
        isActive: true,
      },
    }),
  ]);

  // --- LOCATIONS ---
  await prisma.location.createMany({
    skipDuplicates: true,
    data: [
      { name: "Boracay", latitude: 11.9674, longitude: 121.9248, isActive: true },
      { name: "El Nido", latitude: 11.2026, longitude: 119.4168, isActive: true },
    ],
  });

  // --- TOUR PACKAGES (Standard Templates) ---
  const tourPackage = await prisma.tourPackage.create({
    data: {
      title: "Standard Boracay Package",
      destination: "Boracay",
      price: 15000.0,
      duration: 3,
      isActive: true,
    },
  });

  // --- NEW: ITINERARY (Collaborative) ---
  const itinerary = await prisma.itinerary.create({
    data: {
      userId: user.id,
      title: "Family Palawan Trip",
      destination: "Palawan",
      type: ItineraryType.CUSTOMIZED,
      status: ItineraryStatus.APPROVED,
      travelers: 4,
      collaborators: {
        create: { userId: collaborator.id, role: CollaboratorRole.COLLABORATOR }
      },
      days: {
        create: {
          dayNumber: 1,
          activities: { create: { time: "10:00 AM", title: "Island Hopping", order: 1 } }
        }
      }
    }
  });

  // --- NEW: BOOKING (With BV-ID and Customer Data) ---
  const booking = await prisma.booking.create({
    data: {
      itineraryId: itinerary.id,
      userId: user.id,
      bookingCode: "BV-2025-0001", // Required format
      customerName: "John Traveler", // Capturing modal input
      customerEmail: "user@example.com",
      customerMobile: "09876543210", // Addressing missing mobile
      totalPrice: 45000.0,
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING, // Quick-look status
    }
  });

  // --- PAYMENTS ---
  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      submittedById: user.id,
      amount: 22500.0,
      method: PaymentMethod.GCASH,
      status: PaymentStatus.PENDING,
      type: PaymentType.PARTIAL,
    }
  });

  // --- NOTIFICATIONS ---
  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: NotificationType.BOOKING,
      message: `${user.firstName} submits a customized itinerary for approval`, // Dynamic string
    }
  });

  console.log("🎉 Seeding completed!");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());