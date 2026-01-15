# 🔗 Frontend API Integration Guide

> **Generated:** January 15, 2026  
> **Scope:** Complete frontend-to-backend integration patterns for Bond Voyage  
> **Reference:** See [BACKEND_API_REVIEW.md](./BACKEND_API_REVIEW.md) for endpoint specifications

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Setup & Configuration](#2-core-setup--configuration)
3. [Hook-to-Endpoint Mapping](#3-hook-to-endpoint-mapping)
4. [Itinerary Type Integrations](#4-itinerary-type-integrations)
   - [4.1 Standard Itinerary](#41-standard-itinerary-tour-package)
   - [4.2 Customized Itinerary](#42-customized-itinerary-user-built)
   - [4.3 Requested Itinerary](#43-requested-itinerary-admin-created)
   - [4.4 Smart Trip Itinerary](#44-smart-trip-ai-generated)
   - [4.5 Roaman Chat Integration](#45-roaman-ai-chat-assistant)
5. [Collaboration System](#5-collaboration-system)
6. [Version Control](#6-version-control)
7. [Payment System](#7-payment-system)
8. [Query Key Management](#8-query-key-management)
9. [Type Definitions](#9-type-definitions)
10. [Error Handling Patterns](#10-error-handling-patterns)
11. [Optimistic Updates](#11-optimistic-updates)
12. [Component-Hook Integration Matrix](#12-component-hook-integration-matrix)
13. [Critical Nuances & Gotchas](#13-critical-nuances--gotchas)

---

## 1. Architecture Overview

### Frontend Stack
```
React + TypeScript + Vite
├── TanStack Query (React Query v5) - Data fetching & caching
├── Axios - HTTP client with interceptors
├── React Router v6 - Navigation
├── Shadcn/UI - Component library
├── Sonner - Toast notifications
└── Framer Motion - Animations
```

### Data Flow Pattern
```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND DATA FLOW                          │
└─────────────────────────────────────────────────────────────────┘

  Component                    Hook                     API
     │                          │                        │
     │  const { data } =        │                        │
     │  useMyBookings()         │                        │
     │─────────────────────────►│                        │
     │                          │  apiClient.get(        │
     │                          │    '/bookings/my'      │
     │                          │  )                     │
     │                          │───────────────────────►│
     │                          │                        │
     │                          │◄───────────────────────│
     │                          │  { success, data, meta }
     │                          │                        │
     │  return {                │                        │
     │    data: ApiResponse<T>, │                        │
     │    isLoading,            │                        │
     │    error                 │                        │
     │  }                       │                        │
     │◄─────────────────────────│                        │
     │                          │                        │
     │  {data?.data?.map(...)}  │                        │
```

---

## 2. Core Setup & Configuration

### 2.1 Axios Client Configuration

**File:** `src/utils/axios/userAxios.ts`

```typescript
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Attach access token
apiClient.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
```

### 2.2 Token Refresh Mechanism

The frontend implements a **queue-based refresh strategy** to handle concurrent 401 responses:

```typescript
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${baseURL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefresh } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### 2.3 Environment Variables

```env
# .env.local
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 3. Hook-to-Endpoint Mapping

### 3.1 Bookings

| Hook | HTTP Method | Endpoint | Description |
|------|-------------|----------|-------------|
| `useMyBookings(params)` | GET | `/bookings/my` | Current user's owned bookings |
| `useSharedBookings(params)` | GET | `/bookings/shared` | Bookings user collaborates on |
| `useAdminBookings(params)` | GET | `/bookings` | All bookings (admin only) |
| `useBookingDetail(id)` | GET | `/bookings/:id` | Single booking with itinerary |
| `useCreateBooking()` | POST | `/bookings` | Create new booking |
| `useUpdateBooking(id)` | PUT | `/bookings/:id` | Update booking details |
| `useSubmitBooking(id)` | PATCH | `/bookings/:id/submit` | Submit draft for approval |
| `useCancelBooking(id)` | PATCH | `/bookings/:id/cancel` | Cancel booking |
| `useDeleteBooking(id)` | DELETE | `/bookings/:id` | Permanently delete |
| `useUpdateBookingStatus(id)` | PATCH | `/bookings/:id/status` | Admin status update |
| `useBookingVersionHistory(id)` | GET | `/bookings/:id/versions` | Version history |
| `useBookingPayments(id)` | GET | `/bookings/:id/payments` | Payment list |

### 3.2 Payments

| Hook | HTTP Method | Endpoint | Description |
|------|-------------|----------|-------------|
| `useSubmitPayment(bookingId)` | POST | `/bookings/:id/payments` | Submit payment proof |
| `useUpdatePaymentStatus(paymentId)` | PATCH | `/payments/:id/status` | Verify/reject payment |

### 3.3 AI Features

| Hook | HTTP Method | Endpoint | Description |
|------|-------------|----------|-------------|
| `useSmartTrip()` | POST | `/ai/itinerary` | Generate AI itinerary |
| `useRoamanChatbot()` | POST | `/chatbot/roaman` | Itinerary chat assistant |
| `useRoameoChatbot()` | POST | `/chatbot/roameo` | FAQ/navigation assistant |

### 3.4 Collaboration

| Hook | HTTP Method | Endpoint | Description |
|------|-------------|----------|-------------|
| `useBookingCollaborators(id)` | GET | `/bookings/:id/collaborators` | List collaborators |
| `useAddCollaborator(id)` | POST | `/bookings/:id/collaborators` | Add by userId/email |
| `useRemoveCollaborator(id)` | DELETE | `/bookings/:id/collaborators/:collaboratorId` | Remove collaborator |
| `useCreateItineraryShare()` | POST | `/itineraries/:id/shares` | Generate share token |
| `useAcceptItineraryShare()` | POST | `/itineraries/shares/:token/accept` | Accept invitation |

### 3.5 Tour Packages

| Hook | HTTP Method | Endpoint | Description |
|------|-------------|----------|-------------|
| `useTourPackages(params)` | GET | `/tour-packages` | List packages |
| `useTourPackageDetail(id)` | GET | `/tour-packages/:id` | Package with days |
| `useCreateTourPackage()` | POST | `/tour-packages` | Admin create |
| `useUpdateTourPackage(id)` | PUT | `/tour-packages/:id` | Admin update |
| `useDeleteTourPackage()` | DELETE | `/tour-packages/:id` | Admin delete |

### 3.6 Auth

| Hook | HTTP Method | Endpoint | Description |
|------|-------------|----------|-------------|
| `useRegister()` | POST | `/auth/register` | Create account |
| `useLogin()` | POST | `/auth/login` | Get tokens |
| `useLogout()` | POST | `/auth/logout` | Invalidate session |
| `useProfile()` | GET | `/users/me` | Current user profile |
| `useUpdateProfile()` | PUT | `/users/me` | Update profile |
| `useChangePassword()` | POST | `/users/me/change-password` | Change password |

---

## 4. Itinerary Type Integrations

### 4.1 Standard Itinerary (Tour Package)

**User Flow:** Browse packages → Select → Fill customer info → Create booking

**Page:** `src/pages/user/UserStandardItinerary.tsx`

#### Step 1: Fetch Available Packages
```typescript
import { useTourPackages, useTourPackageDetail } from '../../hooks/useTourPackages';

function StandardItineraryPage() {
  // List all active packages
  const { data: packagesResponse, isLoading } = useTourPackages({
    isActive: true,
    limit: 20,
  });

  const packages = packagesResponse?.data || [];
}
```

#### Step 2: Display Package Details
```typescript
function PackageDetail({ packageId }: { packageId: string }) {
  const { data: detailResponse } = useTourPackageDetail(packageId);
  
  const pkg = detailResponse?.data;
  
  return (
    <div>
      <h1>{pkg?.title}</h1>
      <p>₱{pkg?.price?.toLocaleString()}</p>
      <p>{pkg?.duration} Days</p>
      
      {pkg?.days?.map((day) => (
        <div key={day.dayNumber}>
          <h3>Day {day.dayNumber}: {day.title}</h3>
          {day.activities?.map((activity) => (
            <div key={activity.id}>
              <span>{activity.time}</span>
              <span>{activity.title}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

#### Step 3: Create Booking from Package
```typescript
import { useCreateBooking } from '../../hooks/useBookings';
import { useProfile } from '../../hooks/useAuth';

function BookPackage({ packageId, pkg }) {
  const { data: profileResponse } = useProfile();
  const user = profileResponse?.data?.user;

  const createBooking = useCreateBooking({
    onSuccess: (response) => {
      toast.success('Booking created!');
      navigate(`/user/travels?tab=draft`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create booking');
    },
  });

  const handleBook = () => {
    createBooking.mutate({
      // ⚠️ CRITICAL: tourPackageId triggers STANDARD type
      tourPackageId: packageId,
      
      // ⚠️ REQUIRED for STANDARD type
      customerName: `${user?.firstName} ${user?.lastName}`.trim(),
      customerEmail: user?.email,
      customerMobile: user?.mobile,
      
      totalPrice: pkg.price,
      startDate: selectedDate,
      travelers: travelerCount,
      tourType: 'PRIVATE', // or 'JOINER'
    });
  };
}
```

#### Payload Transformation Nuances

| Frontend Field | Backend Expects | Notes |
|----------------|-----------------|-------|
| `tourPackageId` | `string (UUID)` | Triggers STANDARD flow |
| `totalPrice` | `number` | Not string |
| `travelers` | `number` | Parse from string input |
| `startDate` | `YYYY-MM-DD` | ISO date string |

---

### 4.2 Customized Itinerary (User-Built)

**User Flow:** Create from scratch → Add days/activities → Save as draft → Edit → Submit

**Pages:** 
- `src/pages/user/CreateNewTravel.tsx` (Create)
- `src/pages/user/EditCustomizedBooking.tsx` (Edit)

#### Create New Customized Booking
```typescript
import { useCreateBooking } from '../../hooks/useBookings';
import { useProfile } from '../../hooks/useAuth';

function CreateNewTravel() {
  const { data: profileResponse } = useProfile();
  const user = profileResponse?.data?.user;

  const [formData, setFormData] = useState({
    destination: '',
    travelDateFrom: '',
    travelDateTo: '',
    travelers: '1',
    totalAmount: '',
  });

  const [itineraryDays, setItineraryDays] = useState<Day[]>([
    { id: 'day-1', day: 1, title: '', activities: [] }
  ]);

  const createBooking = useCreateBooking({
    onSuccess: (response) => {
      const bookingId = response.data?.id;
      toast.success('Travel Plan Created!');
      navigate('/user/travels', { state: { scrollToId: bookingId, tab: 'draft' } });
    },
  });

  const handleSave = () => {
    // Transform days to API format
    const apiDays = itineraryDays.map((day, index) => {
      const dayDate = new Date(formData.travelDateFrom);
      dayDate.setDate(dayDate.getDate() + index);
      
      return {
        dayNumber: day.day,
        date: dayDate.toISOString().split('T')[0],
        activities: day.activities.map((activity, actIndex) => ({
          time: activity.time || '00:00',
          title: activity.title,
          description: activity.description || null,
          location: activity.location || null,
          icon: activity.icon || null,
          order: actIndex + 1,
        })),
      };
    });

    createBooking.mutate({
      // ⚠️ NO tourPackageId = CUSTOMIZED type
      destination: formData.destination,
      startDate: formData.travelDateFrom,
      endDate: formData.travelDateTo,
      travelers: parseInt(formData.travelers),
      totalPrice: parseFloat(formData.totalAmount),
      
      // ⚠️ These are inferred from profile, not strictly required
      customerName: `${user?.firstName} ${user?.lastName}`.trim(),
      customerEmail: user?.email || '',
      customerMobile: user?.mobile || '',
      
      // ⚠️ Set type explicitly
      type: 'CUSTOMIZED',
      tourType: 'PRIVATE',
      
      // ⚠️ Nested itinerary object
      itinerary: {
        title: `My Trip to ${formData.destination}`,
        destination: formData.destination,
        startDate: formData.travelDateFrom,
        endDate: formData.travelDateTo,
        travelers: parseInt(formData.travelers),
        estimatedCost: parseFloat(formData.totalAmount),
        type: 'CUSTOMIZED',
        tourType: 'PRIVATE',
        days: apiDays,
      },
    });
  };
}
```

#### Edit Existing Booking
```typescript
import { useBookingDetail, useUpdateBooking } from '../../hooks/useBookings';
import { useParams } from 'react-router-dom';

function EditCustomizedBooking() {
  const { id } = useParams<{ id: string }>();
  
  const { data: bookingResponse, isLoading } = useBookingDetail(id!, {
    enabled: !!id,
  });

  const updateBooking = useUpdateBooking(id!);

  // Transform API response to local state on load
  useEffect(() => {
    if (bookingResponse?.data) {
      const booking = bookingResponse.data;
      
      setBookingData({
        destination: booking.destination,
        travelDateFrom: booking.startDate?.split('T')[0] || '',
        travelDateTo: booking.endDate?.split('T')[0] || '',
        travelers: booking.travelers?.toString() || '1',
        totalPrice: booking.totalPrice?.toString() || '',
      });

      // Transform itinerary days
      const days = booking.itinerary?.days?.map((day) => ({
        id: `day-${day.dayNumber}`,
        dayNumber: day.dayNumber,
        title: day.title || '',
        activities: day.activities?.map((act) => ({
          id: act.id || generateId(),
          time: act.time || '',
          title: act.title,
          description: act.description || '',
          location: act.location || '',
          icon: act.icon || 'Clock',
          order: act.order,
          locationData: act.locationData,
        })) || [],
      })) || [];

      setItineraryDays(days);
    }
  }, [bookingResponse?.data]);

  const handleSave = () => {
    updateBooking.mutate({
      destination: bookingData.destination,
      startDate: bookingData.travelDateFrom,
      endDate: bookingData.travelDateTo,
      travelers: parseInt(bookingData.travelers),
      totalPrice: parseFloat(bookingData.totalPrice),
      itinerary: {
        days: itineraryDays.map((day) => ({
          dayNumber: day.dayNumber,
          title: day.title,
          activities: day.activities.map((act, idx) => ({
            time: act.time,
            title: act.title,
            description: act.description,
            location: act.location,
            icon: act.icon,
            order: idx + 1,
          })),
        })),
      },
    });
  };
}
```

---

### 4.3 Requested Itinerary (Admin-Created)

**Admin Flow:** Select user → Build itinerary → Save → Send to user

**Page:** `src/pages/CreateRequestedItinerary.tsx`

```typescript
import { useCreateBooking } from '../hooks/useBookings';
import { useUsers } from '../hooks/useUsers';

function CreateRequestedItinerary() {
  const [formData, setFormData] = useState({
    customerName: '',
    customerId: '',  // ⚠️ Must be set for REQUESTED type
    email: '',
    mobile: '',
    destination: '',
    travelDateFrom: '',
    travelDateTo: '',
    travelers: '1',
    totalAmount: '',
  });

  // Search users for autocomplete
  const { data: usersData, isLoading: isSearchingUsers } = useUsers(
    { q: searchQuery, limit: 5 },
    { enabled: searchQuery.length >= 2 }
  );

  const createBooking = useCreateBooking({
    onSuccess: () => {
      toast.success('Requested Itinerary Created!');
      navigate('/itinerary', { state: { tab: 'requested' } });
    },
  });

  const handleSave = () => {
    createBooking.mutate({
      // ⚠️ CRITICAL: userId triggers REQUESTED type
      userId: formData.customerId,
      
      destination: formData.destination,
      startDate: formData.travelDateFrom,
      endDate: formData.travelDateTo,
      travelers: parseInt(formData.travelers),
      totalPrice: parseFloat(formData.totalAmount),
      
      customerName: formData.customerName,
      customerEmail: formData.email,
      customerMobile: formData.mobile,
      
      type: 'REQUESTED',
      tourType: 'PRIVATE',
      
      itinerary: {
        title: `Custom Trip to ${formData.destination}`,
        destination: formData.destination,
        startDate: formData.travelDateFrom,
        endDate: formData.travelDateTo,
        travelers: parseInt(formData.travelers),
        estimatedCost: parseFloat(formData.totalAmount),
        type: 'REQUESTED',
        tourType: 'PRIVATE',
        days: apiDays,
      },
    });
  };
}
```

#### Sending to User (Admin)
```typescript
import { useSubmitBooking } from '../hooks/useBookings';

function RequestedItineraryActions({ bookingId }) {
  const submitBooking = useSubmitBooking(bookingId, {
    onSuccess: () => {
      toast.success('Itinerary sent to customer!');
    },
  });

  const handleSendToUser = () => {
    submitBooking.mutate();
    // ⚠️ This changes:
    // - booking.status: DRAFT → PENDING
    // - itinerary.sentStatus: null → 'SENT'
    // - Creates notification for user
  };
}
```

#### User Confirmation Flow
```typescript
import { useUpdateBooking } from '../../hooks/useBookings';

function ConfirmRequestedItinerary({ bookingId }) {
  const updateBooking = useUpdateBooking(bookingId);

  const handleConfirm = () => {
    updateBooking.mutate({
      confirmStatus: 'CONFIRMED',
    });
    // ⚠️ Sets itinerary.confirmedAt and confirmStatus
  };

  const handleReject = (reason: string) => {
    updateBooking.mutate({
      confirmStatus: 'REJECTED',
      rejectionReason: reason,
    });
  };
}
```

---

### 4.4 Smart Trip (AI-Generated)

**User Flow:** Fill preferences form → AI generates itinerary → Review → Save as booking

**Page:** `src/pages/user/SmartTrip.tsx`

```typescript
import { useSmartTrip } from '../../hooks/useSmartTrip';
import { useCreateBooking } from '../../hooks/useBookings';
import { useProfile } from '../../hooks/useAuth';

function SmartTrip() {
  const { data: profileResponse } = useProfile();
  const user = profileResponse?.data?.user;
  
  const [formData, setFormData] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    travelers: '1',
    budget: '',
    preferences: [] as string[],
    accommodationType: 'hotel',
    travelPace: 'moderate',
  });

  const [generatedTrip, setGeneratedTrip] = useState<any>(null);

  // AI Generation
  const { mutate: generateSmartTrip, isPending: isGenerating } = useSmartTrip({
    onSuccess: (response) => {
      if (response.data) {
        setGeneratedTrip(response.data);
        setStep(2); // Move to review step
        toast.success('Trip generated successfully!');
      }
    },
    onError: () => {
      toast.error('Failed to generate trip');
    },
  });

  const handleGenerate = () => {
    // ⚠️ Payload structure for Smart Trip AI
    generateSmartTrip({
      destination: formData.destination,
      startDate: formData.startDate,
      endDate: formData.endDate,
      travelers: parseInt(formData.travelers),
      budget: parseInt(formData.budget) || 0,
      preference: formData.preferences,  // ⚠️ Array of strings
      accomodationType: formData.accommodationType, // ⚠️ Note: typo in API
      travelPace: formData.travelPace as 'drive' | 'walk',
    });
  };

  // Save generated trip as booking
  const createBooking = useCreateBooking();

  const handleSaveToTravels = () => {
    // Transform AI response to booking format
    const apiDays = generatedTrip.itinerary.map((day: any) => ({
      dayNumber: day.day,
      date: day.date,
      activities: day.activities.map((activity: any, idx: number) => ({
        time: activity.time || '00:00',
        title: activity.title,
        description: activity.description || null,
        location: activity.locationName || null,
        icon: activity.iconKey || null,
        order: activity.order || idx + 1,
      })),
    }));

    createBooking.mutate({
      destination: formData.destination,
      startDate: formData.startDate,
      endDate: formData.endDate,
      travelers: parseInt(formData.travelers),
      totalPrice: parseFloat(formData.budget) || 0,
      type: 'CUSTOMIZED', // ⚠️ AI trips become CUSTOMIZED
      tourType: 'PRIVATE',
      customerName: `${user?.firstName} ${user?.lastName}`.trim(),
      customerEmail: user?.email || '',
      customerMobile: user?.mobile || '',
      itinerary: {
        title: `AI Generated Trip to ${formData.destination}`,
        destination: formData.destination,
        startDate: formData.startDate,
        endDate: formData.endDate,
        travelers: parseInt(formData.travelers),
        estimatedCost: parseFloat(formData.budget) || 0,
        type: 'CUSTOMIZED',
        tourType: 'PRIVATE',
        days: apiDays,
      },
    });
  };
}
```

#### Smart Trip API Response Structure
```typescript
interface SmartTripResponse {
  success: boolean;
  message: string;
  data: {
    destination: string;
    startDate: string;
    endDate: string;
    budget: number;
    itinerary: Array<{
      day: number;
      date: string;
      activities: Array<{
        time: string;
        title: string;
        description: string;
        locationName: string;
        iconKey: string;
        order: number;
      }>;
    }>;
  };
}
```

---

### 4.5 Roaman AI Chat Assistant

**Component:** `src/components/AITravelAssistant.tsx`

Roaman provides conversational AI assistance for editing itineraries.

```typescript
import { useRoamanChatbot } from '../hooks/useChatBot';

function AITravelAssistant({ itineraryDays, destination, onItineraryUpdate }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);

  const { mutate: sendChatMessage, isPending } = useRoamanChatbot({
    onSuccess: (response) => {
      const aiMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: response.data.message,
        timestamp: new Date(),
        suggestions: response.data.suggestions,
      };
      
      setMessages(prev => [...prev, aiMessage]);

      // Handle draft itinerary from AI
      if (response.data.draft) {
        setPendingDraft(response.data.draft);
        setShowDraftPreview(true);
      }
    },
  });

  const handleSendMessage = (message: string) => {
    // ⚠️ Roaman payload structure
    sendChatMessage({
      prompt: message,
      preferences: {
        destination,
        selectedDay,
        currentItinerary: itineraryDays,
      },
    });
  };

  // Apply AI-generated draft to parent component
  const applyDraftItinerary = () => {
    if (!pendingDraft || !onItineraryUpdate) return;

    const updatedDays = pendingDraft.days.map((day) => ({
      id: `day-${day.dayNumber}`,
      dayNumber: day.dayNumber,
      date: null,
      activities: day.activities.map((act, idx) => ({
        id: `activity-${day.dayNumber}-${idx}`,
        time: act.time,
        title: act.title,
        description: act.description || null,
        location: act.location || null,
        icon: null,
        order: act.order ?? idx,
      })),
    }));

    onItineraryUpdate(updatedDays);
    toast.success('Itinerary updated successfully!');
  };
}
```

---

## 5. Collaboration System

### 5.1 Share Token Flow

**Generate → Share → Accept**

```typescript
import { 
  useCreateItineraryShare, 
  useAcceptItineraryShare 
} from '../../hooks/useItineraryShares';

function ShareBooking({ itineraryId }) {
  const [shareToken, setShareToken] = useState<string | null>(null);

  // Generate share token
  const { mutate: createShare } = useCreateItineraryShare({
    onSuccess: (data) => {
      const token = data.data?.token;
      setShareToken(token);
      // Show QR code or copy link
    },
  });

  const handleShare = () => {
    createShare({ itineraryId });
  };

  // Generate share URL
  const shareUrl = shareToken 
    ? `${window.location.origin}/join/${shareToken}` 
    : null;
}

function JoinTravel() {
  const [tokenInput, setTokenInput] = useState('');

  const { mutate: acceptShare, isPending } = useAcceptItineraryShare({
    onSuccess: (data) => {
      toast.success('Successfully joined!', {
        description: data.message || 'You are now a collaborator',
      });
    },
    onError: (error) => {
      toast.error('Failed to join', {
        description: error.response?.data?.message,
      });
    },
  });

  const handleJoin = () => {
    acceptShare(tokenInput); // Pass token string directly
  };
}
```

### 5.2 Collaborator Management

```typescript
import { 
  useBookingCollaborators,
  useAddCollaborator,
  useRemoveCollaborator,
} from '../../hooks/useCollaborators';

function CollaboratorsPanel({ bookingId }) {
  const { data: collaboratorsResponse } = useBookingCollaborators(bookingId);
  const collaborators = collaboratorsResponse?.data || [];

  const addCollaborator = useAddCollaborator(bookingId, {
    onSuccess: () => toast.success('Collaborator added'),
  });

  const removeCollaborator = useRemoveCollaborator(bookingId, {
    onSuccess: () => toast.success('Collaborator removed'),
  });

  const handleAdd = (email: string) => {
    addCollaborator.mutate({ email }); // or { userId: 'uuid' }
  };

  const handleRemove = (collaboratorId: string) => {
    removeCollaborator.mutate(collaboratorId);
  };
}
```

---

## 6. Version Control

### 6.1 Fetching Version History

```typescript
import { useBookingVersionHistory } from '../../hooks/useBookings';

function VersionHistoryModal({ bookingId }) {
  const { data: versionResponse, refetch } = useBookingVersionHistory(bookingId);
  const versions = versionResponse?.data || [];

  // Transform API versions to display format
  const displayVersions = versions.map((v) => ({
    id: v.id,
    timestamp: v.timestamp,
    author: v.author,
    label: v.label,
    bookingData: {
      destination: v.bookingData.destination,
      travelDateFrom: v.bookingData.travelDateFrom,
      travelDateTo: v.bookingData.travelDateTo,
      travelers: v.bookingData.travelers,
      totalPrice: v.bookingData.totalPrice,
    },
    itineraryDays: v.itineraryDays,
  }));
}
```

### 6.2 Version Auto-Creation

Versions are **automatically created server-side** when booking is updated via `PUT /bookings/:id`. No explicit client action needed.

### 6.3 Restore Version

```typescript
const handleRestoreVersion = (version: Version) => {
  updateBooking.mutate({
    destination: version.bookingData.destination,
    startDate: version.bookingData.travelDateFrom,
    endDate: version.bookingData.travelDateTo,
    travelers: parseInt(version.bookingData.travelers),
    totalPrice: parseFloat(version.bookingData.totalPrice),
    itinerary: {
      days: version.itineraryDays.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        activities: day.activities,
      })),
    },
  });
  
  // This creates a NEW version, not overwriting history
};
```

---

## 7. Payment System

### 7.1 User Payment Submission

**Page:** `src/pages/user/UserPaymentSection.tsx`

```typescript
import { useSubmitPayment } from '../../hooks/usePayments';
import { useBookingPayments } from '../../hooks/useBookings';

function UserPaymentSection({ booking }) {
  const { data: paymentsResponse } = useBookingPayments(booking.id);
  const payments = paymentsResponse?.data || [];

  const submitPayment = useSubmitPayment(booking.id, {
    onSuccess: () => {
      toast.success('Payment submitted for verification');
    },
  });

  const handleSubmit = (formData: FormData) => {
    // ⚠️ Payment submission uses FormData for file upload
    submitPayment.mutate({
      amount: parseFloat(paymentAmount),
      type: paymentType, // 'FULL' | 'PARTIAL'
      method: paymentMethod, // 'GCASH' | 'CASH'
      transactionId: transactionId, // Optional for GCash
      proofImage: proofFile, // File object
    });
  };

  // Calculate verified payments
  const verifiedTotal = payments
    .filter(p => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const balance = booking.totalAmount - verifiedTotal;
}
```

### 7.2 Admin Payment Verification

**Component:** `src/components/PaymentSection.tsx`

```typescript
import { useUpdatePaymentStatus } from '../hooks/usePayments';
import { useBookingPayments } from '../hooks/useBookings';

function PaymentSection({ booking }) {
  const { data: paymentsResponse, refetch } = useBookingPayments(booking.id);
  const payments = paymentsResponse?.data || [];

  const [selectedPayment, setSelectedPayment] = useState(null);

  const updateStatus = useUpdatePaymentStatus(selectedPayment?.id || '');

  const handleVerify = async () => {
    await updateStatus.mutateAsync({ status: 'VERIFIED' });
    toast.success('Payment verified');
    refetch();
  };

  const handleReject = async (reason: string) => {
    await updateStatus.mutateAsync({ 
      status: 'REJECTED',
      rejectionReason: reason,
    });
    toast.success('Payment rejected');
    refetch();
  };
}
```

### 7.3 Payment Proof Image

```typescript
// Get payment proof image URL
const getProofImageUrl = (payment: Payment) => {
  if (payment.proofImage?.startsWith('data:')) {
    return payment.proofImage; // Base64
  }
  return `${import.meta.env.VITE_API_BASE_URL}/payments/${payment.id}/proof`;
};
```

---

## 8. Query Key Management

**File:** `src/utils/lib/queryKeys.ts`

```typescript
export const queryKeys = {
  bookings: {
    all: ['bookings'] as const,
    myBookings: (params?: any) => ['bookings', 'my', params] as const,
    sharedBookings: (params?: any) => ['bookings', 'shared', params] as const,
    detail: (id?: string) => ['bookings', 'detail', id] as const,
    versions: (id: string) => ['bookings', id, 'versions'] as const,
    payments: (id: string) => ['bookings', id, 'payments'] as const,
    collaborators: (id: string) => ['bookings', id, 'collaborators'] as const,
  },
  tourPackages: {
    all: ['tourPackages'] as const,
    list: (params?: any) => ['tourPackages', 'list', params] as const,
    detail: (id: string) => ['tourPackages', 'detail', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    detail: (id: string) => ['payments', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params?: any) => ['notifications', 'list', params] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params?: any) => ['users', 'list', params] as const,
    me: ['users', 'me'] as const,
  },
  places: {
    search: (query: any) => ['places', 'search', query] as const,
  },
};
```

### Cache Invalidation Patterns

```typescript
// After creating booking
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.bookings.myBookings() });
};

// After accepting share
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.bookings.myBookings() });
  queryClient.invalidateQueries({ queryKey: queryKeys.bookings.sharedBookings() });
};

// After updating booking
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.bookings.versions(id) });
};
```

---

## 9. Type Definitions

**File:** `src/types/types.ts`

### Core Types

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface Booking {
  id: string;
  bookingCode: string;
  itineraryId: string;
  userId: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  totalPrice: number;
  ownership: string;
  type: 'STANDARD' | 'CUSTOMIZED' | 'REQUESTED';
  status: 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  tourType: 'PRIVATE' | 'GROUP' | string;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | string;
  customerName: string | null;
  customerEmail: string | null;
  customerMobile: string | null;
  itinerary: Itinerary;
}

export interface Itinerary {
  id: string;
  title: string | null;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  estimatedCost: number | null;
  type: 'STANDARD' | 'CUSTOMIZED' | 'REQUESTED';
  status: string;
  tourType: 'PRIVATE' | 'GROUP' | string;
  sentStatus: string | null;
  collaborators: Collaborator[];
  days: Day[];
}

export interface Day {
  id: string;
  dayNumber: number;
  date?: string;
  title?: string;
  activities: IActivity[];
}

export interface IActivity {
  id: string;
  time: string;
  title: string;
  description: string;
  location: string;
  icon: string;
  order: number;
  locationData?: {
    source: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: string;
  type: 'PARTIAL' | 'FULL';
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  transactionId?: string;
}
```

---

## 10. Error Handling Patterns

### Standard Error Handler

```typescript
const mutation = useMutation({
  mutationFn: async (data) => { /* ... */ },
  onError: (error: AxiosError<ApiResponse>) => {
    const message = error.response?.data?.message 
      || error.message 
      || 'An unexpected error occurred';
    
    toast.error(message);
    
    // Log for debugging
    console.error('Mutation error:', {
      status: error.response?.status,
      message,
      data: error.response?.data,
    });
  },
});
```

### Network Error Detection

```typescript
useEffect(() => {
  const handleOffline = () => {
    toast.error('No internet connection. Please check your network.');
  };
  
  window.addEventListener('offline', handleOffline);
  return () => window.removeEventListener('offline', handleOffline);
}, []);
```

### 401 Handling

Handled automatically by axios interceptor - redirects to `/login` after failed refresh.

---

## 11. Optimistic Updates

### Example: Mark Notification as Read

```typescript
const markRead = useMutation({
  mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });
    
    const previous = queryClient.getQueryData(queryKeys.notifications.list());
    
    queryClient.setQueryData(queryKeys.notifications.list(), (old: any) => ({
      ...old,
      data: old?.data?.map((n: any) => 
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
    
    return { previous };
  },
  
  onError: (err, id, context) => {
    queryClient.setQueryData(
      queryKeys.notifications.list(), 
      context?.previous
    );
    toast.error('Failed to mark notification as read');
  },
  
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  },
});
```

---

## 12. Component-Hook Integration Matrix

| Component/Page | Primary Hooks | Secondary Hooks |
|----------------|---------------|-----------------|
| `UserTravels.tsx` | `useMyBookings`, `useSharedBookings` | `useSubmitBooking`, `useDeleteBooking`, `useCreateItineraryShare`, `useAcceptItineraryShare` |
| `UserBookings.tsx` | `useMyBookings`, `useBookingDetail` | `useBookingPayments` |
| `CreateNewTravel.tsx` | `useCreateBooking`, `useProfile` | `usePlacesSearch` |
| `EditCustomizedBooking.tsx` | `useBookingDetail`, `useUpdateBooking`, `useBookingVersionHistory` | `usePlacesSearch`, `useProfile` |
| `SmartTrip.tsx` | `useSmartTrip`, `useCreateBooking`, `useProfile` | `usePlacesSearch` |
| `CreateRequestedItinerary.tsx` | `useCreateBooking`, `useUsers` | `usePlacesSearch` |
| `Bookings.tsx` (Admin) | `useAdminBookings`, `useBookingDetail` | `useUpdateBookingStatus`, `useCancelBooking`, `useUpdatePaymentStatus` |
| `UserPaymentSection.tsx` | `useBookingPayments`, `useSubmitPayment` | - |
| `PaymentSection.tsx` (Admin) | `useBookingPayments`, `useUpdatePaymentStatus` | - |
| `AITravelAssistant.tsx` | `useRoamanChatbot` | - |
| `FAQAssistant.tsx` | `useRoameoChatbot` | - |
| `VersionHistoryModal.tsx` | (receives versions as props) | - |

---

## 13. Critical Nuances & Gotchas

### 13.1 Booking Type Determination

The backend determines booking `type` based on payload:

| Condition | Resulting Type |
|-----------|----------------|
| `tourPackageId` is provided | `STANDARD` |
| `userId` is provided (and is different from requester) | `REQUESTED` |
| Neither `tourPackageId` nor foreign `userId` | `CUSTOMIZED` |

### 13.2 Customer Fields Validation

```typescript
// ⚠️ STANDARD bookings REQUIRE these fields
if (type === 'STANDARD' || tourPackageId) {
  // customerName, customerEmail, customerMobile are REQUIRED
}

// ⚠️ CUSTOMIZED/REQUESTED can infer from user profile
```

### 13.3 Itinerary Nested Object

When creating/updating bookings with itinerary data:

```typescript
// ✅ CORRECT: Nest itinerary data
{
  destination: 'Cebu',
  itinerary: {
    title: 'Trip to Cebu',
    days: [...]
  }
}

// ❌ WRONG: Flat structure
{
  destination: 'Cebu',
  days: [...]  // Won't work
}
```

### 13.4 API Response Unwrapping

All hooks return `ApiResponse<T>`. Always access `.data`:

```typescript
const { data: bookingsResponse } = useMyBookings();

// ✅ CORRECT
const bookings = bookingsResponse?.data || [];

// ❌ WRONG
const bookings = bookingsResponse || []; // Contains { success, message, data }
```

### 13.5 Date Formatting

```typescript
// API expects ISO date strings
startDate: '2026-02-15'  // YYYY-MM-DD

// ❌ Don't send Date objects
startDate: new Date()  // Won't work

// ✅ Convert properly
startDate: new Date().toISOString().split('T')[0]
```

### 13.6 Payment File Upload

```typescript
// ⚠️ Payment submission should use FormData for file
const formData = new FormData();
formData.append('amount', amount.toString());
formData.append('type', 'FULL');
formData.append('method', 'GCASH');
formData.append('proofImage', fileObject);

// The hook handles this conversion internally
submitPayment.mutate({
  amount: 5000,
  type: 'FULL',
  method: 'GCASH',
  proofImage: file,  // File object
});
```

### 13.7 Smart Trip API Typo

```typescript
// ⚠️ Backend has a typo: "accomodationType" (one 'm')
generateSmartTrip({
  accomodationType: 'hotel',  // Not "accommodationType"
});
```

### 13.8 Query Key Dependencies

```typescript
// ⚠️ Include params in query key for proper caching
useMyBookings({ status: 'DRAFT' });
// Uses queryKey: ['bookings', 'my', { status: 'DRAFT' }]

// Changing status creates new cache entry
useMyBookings({ status: 'PENDING' });
// Uses queryKey: ['bookings', 'my', { status: 'PENDING' }]
```

### 13.9 Ownership Field

The `ownership` field in booking response indicates relationship:

| Value | Meaning |
|-------|---------|
| `'owned'` | Current user created this booking |
| `'collaborated'` | Current user is a collaborator |
| `'requested'` | Admin created this for current user |

### 13.10 Share Token Lifecycle

- Tokens are **single-use** (consumed on accept)
- Tokens have **expiration** (check `expiresAt`)
- Re-generate for new shares

---

## Quick Reference Card

### Creating Bookings by Type

```typescript
// STANDARD (from tour package)
createBooking.mutate({
  tourPackageId: 'uuid',
  customerName: 'required',
  customerEmail: 'required',
  customerMobile: 'required',
  totalPrice: 15000,
});

// CUSTOMIZED (user builds)
createBooking.mutate({
  destination: 'Cebu',
  type: 'CUSTOMIZED',
  itinerary: { title: '...', days: [...] },
  // customer fields optional
});

// REQUESTED (admin for user)
createBooking.mutate({
  userId: 'target-user-uuid',  // Critical
  type: 'REQUESTED',
  itinerary: { title: '...', days: [...] },
});

// SMART TRIP (AI generated, saved as CUSTOMIZED)
generateSmartTrip({ destination, budget, preferences, ... });
// Then save result:
createBooking.mutate({ ...aiResult, type: 'CUSTOMIZED' });
```

---

*End of Frontend API Integration Guide*
