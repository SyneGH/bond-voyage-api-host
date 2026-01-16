import axios from "axios";
import { FaqEntry } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";

// Define the Action interface for type safety
interface ChatAction {
  label: string;
  action: string; // The URL path or action key
  type: "NAVIGATION" | "QUERY"; // NAVIGATION = Redirect, QUERY = Pre-fill chat
}

type GeminiContent = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite-preview-09-2025";

function requireGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      HTTP_STATUS.NOT_IMPLEMENTED,
      "Gemini API key is not configured"
    );
  }
  return apiKey;
}

async function callGemini(prompt: string) {
  const apiKey = requireGeminiKey();

  const response = await axios.post<GeminiContent>(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }
  );

  const text =
    response.data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";

  return text.trim();
}

function extractJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch (err) {
        return fallback;
      }
    }
  }
  return fallback;
}

// === ROAMAN TYPES & HELPERS ===

interface RoamanPreferences {
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  tourType?: "JOINER" | "PRIVATE";
  budget?: number;
  pace?: string;
  travelPace?: string;
  preferences?: string[];
  selectedDay?: number;
  currentDayActivities?: any[];
  totalDays?: number;

  roamanMode?: "FULL_ITINERARY" | "ADD_TO_DAY";
  targetDay?: number;
  requestedActivitiesCount?: number;
}

interface RoamanActivityOutput {
  order: number;
  time: string;
  title: string;
  locationName: string;
  coordinates: { lat: number; lng: number };
  description: string;
  iconKey: string;
}

interface RoamanDayOutput {
  dayNumber: number;
  date: string | null;
  title: string;
  activities: RoamanActivityOutput[];
}

interface RoamanDraftOutput {
  type: "SMART_TRIP";
  destination: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  days: RoamanDayOutput[];
}

interface RoamanResponseData {
  message: string;
  draft: RoamanDraftOutput;
}

function buildRoamanSystemPrompt(
  officialDestinations: string[],
  preferences?: RoamanPreferences
): string {
  const pace = preferences?.pace || preferences?.travelPace || "moderate";
  const destination = preferences?.destination || "the Philippines";
  const travelers = preferences?.travelers || 1;
  const startDate = preferences?.startDate || null;
  const endDate = preferences?.endDate || null;
  const userPrefs = preferences?.preferences || [];

  const roamanMode = preferences?.roamanMode || "FULL_ITINERARY";
  const targetDay = preferences?.targetDay || preferences?.selectedDay || 1;
  const requestedActivitiesCount = Math.max(
    1,
    Math.min(20, preferences?.requestedActivitiesCount || 1)
  );

  const minActivitiesPerDay = 10;

  return `You are **Roaman**, the itinerary generator for the BondVoyage backend.

### Goal
Generate a **SMART_TRIP itinerary draft** compatible with the booking flow structure. Return ONLY valid JSON—no markdown, explanations, or trailing text.

### Hard Requirements
1. **Return valid JSON only.**
2. The response must have this exact shape:
   { "message": "friendly assistant message", "draft": { ... } }

3. \`draft.type\` MUST be \`"SMART_TRIP"\`.
4. \`draft.days\` MUST contain **at least 1 day**.
5. Each day MUST include:
   - \`dayNumber\` (integer, starting at 1 - NOT "day", use "dayNumber")
   - \`date\` (string YYYY-MM-DD or null)
   - \`title\` (string, catchy day title like "Island Hopping Adventure")
  - \`activities\` (array)
6. **Full itinerary mode:** Each day MUST contain at least ${minActivitiesPerDay} activities.
7. **Add-to-day mode:** Draft MUST contain exactly 1 day (dayNumber = ${targetDay}) and its activities MUST contain exactly ${requestedActivitiesCount} NEW activities.
7. Each activity MUST include ALL fields:
   - \`order\` (integer, sequential starting at 1, resets each day)
   - \`time\` (string \`HH:MM\` 24-hour)
   - \`title\` (string, descriptive activity name)
   - \`locationName\` (string, Geoapify-style: "Place Name, Street, City, Province, Philippines")
   - \`coordinates\` (object with \`lat\` and \`lng\` as realistic numbers)
   - \`description\` (string, 1-2 sentences)
   - \`iconKey\` (one of: sightseeing, food, beach, nature, culture, adventure, shopping, relaxation, transport, museum, cafe, nightlife, hiking)

8. If startDate provided, compute each day's date as startDate + (dayNumber - 1).
9. If startDate is null, set date: null for each day.
10. Avoid placeholders like "Airport" or "Hotel" unless explicitly requested.
11. Activities must be destination-relevant, varied, and time-ordered.

### Mode
- roamanMode: ${roamanMode}
- If roamanMode is "ADD_TO_DAY":
  - ONLY generate additions for Day ${targetDay}
  - Do NOT regenerate other days
  - Do NOT include existing activities in the JSON
  - Return exactly ${requestedActivitiesCount} activities

### CRITICAL TRAVEL MODE RESTRICTIONS
12. **LAND TRAVEL ONLY** - Do NOT include:
    - Air travel (flights, airplanes, airports as activities)
    - Water travel across seas (ferries, boats between islands, sea crossings)
    - Inter-island travel requiring sea or air transport
13. **AREA-BASED ITINERARIES** - Plan activities within a single landmass/region:
    - Keep all activities within the same island or connected land area
    - If destination is "Cebu", stay within Cebu island only
    - If destination is "Palawan", stay within Palawan island only
    - Use land transportation only (car, van, bus, tricycle, jeepney)
14. **REAL PLACES ONLY** - Use ONLY authentic, verifiable Philippine locations:
    - Real street addresses, landmarks, restaurants, tourist spots
    - Accurate GPS coordinates matching actual Philippine geography
    - NO fictional, generic, or hallucinated place names
    - If uncertain, use well-known tourist destinations for that area

### SCOPE
You ONLY provide travel advice for: [${officialDestinations.join(", ")}], and any point in the Philippines.
If asked about destinations outside the Philippines, explain BondVoyage only covers Philippine destinations.

### TONE
Be warm and enthusiastic. Use phrases like "I've curated a special route!", "This looks incredible!", "I've handpicked my favorite spots."

### Pace Guidelines
| Pace | Activities/Day |
|------|----------------|
| relaxed | 10 |
| moderate | 10-12 |
| packed | 12-14 |
| own_pace | 10-12 |

### Current Context
- Destination: ${destination}
- Start Date: ${startDate || "Not specified"}
- End Date: ${endDate || "Not specified"}
- Travelers: ${travelers}
- Pace: ${pace}
- Preferences: ${userPrefs.length > 0 ? userPrefs.join(", ") : "General sightseeing"}

### Output Rules By Mode
${roamanMode === "ADD_TO_DAY" ? `
- Return draft.days as an array with EXACTLY ONE object.
- That object MUST have dayNumber = ${targetDay}.
- That object's activities array MUST contain EXACTLY ${requestedActivitiesCount} items.
- These activities are NEW additions only (do not repeat existing items).
- Keep the message concise and list only the new activities.
` : `
- Return a complete itinerary draft.
- Each day MUST contain at least ${minActivitiesPerDay} activities (minimum).
`}

### Example Output Structure
{
  "message": "I've curated a special route for your Cebu adventure!",
  "draft": {
    "type": "SMART_TRIP",
    "destination": "Cebu",
    "startDate": "2025-03-01",
    "endDate": "2025-03-03",
    "travelers": 2,
    "days": [
      {
        "dayNumber": 1,
        "date": "2025-03-01",
        "title": "Cebu City Historical Tour",
        "activities": [
          {
            "order": 1,
            "time": "09:00",
            "title": "Visit Magellan's Cross",
            "locationName": "Magellan's Cross, P. Burgos St, Cebu City, Cebu, Philippines",
            "coordinates": { "lat": 10.2934, "lng": 123.9021 },
            "description": "Start your day at this historic landmark marking Magellan's arrival in 1521.",
            "iconKey": "culture"
          }
        ]
      }
    ]
  }
}`;
}

function buildRoamanFallback(preferences?: RoamanPreferences): RoamanResponseData {
  const destination = preferences?.destination || "Cebu";
  const travelers = preferences?.travelers || 1;
  const startDate = preferences?.startDate || null;

  const roamanMode = preferences?.roamanMode || "FULL_ITINERARY";
  const targetDay = preferences?.targetDay || preferences?.selectedDay || 1;
  const requestedActivitiesCount = Math.max(
    1,
    Math.min(20, preferences?.requestedActivitiesCount || 1)
  );
  
  const endDate = startDate || null;

  // Base coordinates for Cebu (default)
  const baseCoords = { lat: 10.3157, lng: 123.8854 };

  const buildFallbackActivities = (count: number): RoamanActivityOutput[] => {
    const times = [
      "08:00",
      "09:00",
      "10:30",
      "12:00",
      "13:30",
      "15:00",
      "16:30",
      "18:00",
      "19:30",
      "21:00",
      "22:00",
    ];
    const templates = [
      {
        title: "Morning City Exploration",
        locationName: `City Center, ${destination}, Philippines`,
        description: "Start your day exploring the heart of the city and its local attractions.",
        iconKey: "sightseeing",
        offset: { lat: 0.001, lng: 0.001 },
      },
      {
        title: "Coffee & Local Cafe Stop",
        locationName: `Local Cafe, ${destination}, Philippines`,
        description: "Recharge with a coffee break and sample local pastries.",
        iconKey: "cafe",
        offset: { lat: 0.0015, lng: -0.0008 },
      },
      {
        title: "Cultural Heritage Visit",
        locationName: `Heritage Site, ${destination}, Philippines`,
        description: "Discover the rich cultural heritage and history of the area.",
        iconKey: "culture",
        offset: { lat: -0.001, lng: 0.002 },
      },
      {
        title: "Local Cuisine Experience",
        locationName: `Local Restaurant, ${destination}, Philippines`,
        description: "Enjoy authentic local dishes and experience the regional flavors.",
        iconKey: "food",
        offset: { lat: 0.002, lng: -0.001 },
      },
      {
        title: "Nature Walk / Viewpoint",
        locationName: `Viewpoint Area, ${destination}, Philippines`,
        description: "Take a relaxed walk and enjoy scenic views within the area.",
        iconKey: "nature",
        offset: { lat: 0.0006, lng: 0.0022 },
      },
      {
        title: "Shopping & Souvenir Hunt",
        locationName: `Public Market, ${destination}, Philippines`,
        description: "Browse local products and pick up souvenirs.",
        iconKey: "shopping",
        offset: { lat: -0.0007, lng: 0.0012 },
      },
      {
        title: "Relaxation Break",
        locationName: `Park Area, ${destination}, Philippines`,
        description: "Slow down and enjoy some downtime at a nearby park.",
        iconKey: "relaxation",
        offset: { lat: 0.0018, lng: 0.0017 },
      },
      {
        title: "Sunset Spot",
        locationName: `Waterfront Area, ${destination}, Philippines`,
        description: "Catch the sunset and enjoy a golden-hour stroll.",
        iconKey: "sightseeing",
        offset: { lat: 0.003, lng: 0.003 },
      },
      {
        title: "Dinner Recommendation",
        locationName: `Dinner Spot, ${destination}, Philippines`,
        description: "Wrap up with a satisfying dinner featuring regional favorites.",
        iconKey: "food",
        offset: { lat: 0.0026, lng: 0.0019 },
      },
      {
        title: "Evening Leisure",
        locationName: `Central Area, ${destination}, Philippines`,
        description: "Enjoy a laid-back evening stroll and local ambiance.",
        iconKey: "nightlife",
        offset: { lat: 0.0029, lng: 0.0024 },
      },
    ];

    return Array.from({ length: count }, (_, idx) => {
      const template = templates[idx % templates.length];
      const time = times[idx] || times[times.length - 1];
      return {
        order: idx + 1,
        time,
        title: template.title,
        locationName: template.locationName,
        coordinates: {
          lat: baseCoords.lat + template.offset.lat + idx * 0.0001,
          lng: baseCoords.lng + template.offset.lng + idx * 0.0001,
        },
        description: template.description,
        iconKey: template.iconKey,
      };
    });
  };

  const minActivitiesPerDay = 10;
  const activitiesCount =
    roamanMode === "ADD_TO_DAY" ? requestedActivitiesCount : minActivitiesPerDay;

  const dayNumber = roamanMode === "ADD_TO_DAY" ? targetDay : 1;
  let dayDate: string | null = null;
  if (startDate) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (dayNumber - 1));
    dayDate = d.toISOString().split("T")[0];
  }

  return {
    message:
      roamanMode === "ADD_TO_DAY"
        ? `Here are ${activitiesCount} new activity suggestion(s) for Day ${dayNumber} in ${destination}!`
        : "I've put together a starter draft for your BondVoyage adventure! Feel free to customize it to your liking.",
    draft: {
      type: "SMART_TRIP",
      destination,
      startDate,
      endDate,
      travelers,
      days: [
        {
          dayNumber,
          date: dayDate,
          title: `${destination} Highlights`,
          activities: buildFallbackActivities(activitiesCount),
        },
      ],
    },
  };
}

// === POST-PROCESSING FOR ROAMAN ===

function normalizeRoamanResponse(
  raw: any,
  preferences?: RoamanPreferences
): RoamanResponseData {
  const destination = preferences?.destination || raw?.draft?.destination || "Philippines";
  const travelers = preferences?.travelers || raw?.draft?.travelers || 1;
  const startDate = preferences?.startDate || raw?.draft?.startDate || null;
  const endDate = preferences?.endDate || raw?.draft?.endDate || null;

  const roamanMode = preferences?.roamanMode || "FULL_ITINERARY";
  const targetDay = preferences?.targetDay || preferences?.selectedDay;
  const requestedActivitiesCount = Math.max(
    1,
    Math.min(20, preferences?.requestedActivitiesCount || 1)
  );
  const minActivitiesPerDay = 10;

  // Default message if missing
  const message = raw?.message || "I've put together an itinerary for your adventure!";

  // Normalize days array
  const rawDays = raw?.draft?.days || [];
  const normalizedDays: RoamanDayOutput[] = rawDays.map((day: any, dayIndex: number) => {
    // Handle both 'day' and 'dayNumber' field names
    const dayNumber = day.dayNumber || day.day || dayIndex + 1;
    
    // Calculate date if startDate is provided
    let date: string | null = null;
    if (startDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + (Number(dayNumber) - 1));
      date = d.toISOString().split("T")[0];
    } else {
      date = day.date || null;
    }

    // Generate day title if missing
    const title = day.title || `Day ${dayNumber}: ${destination} Adventure`;

    // Normalize activities
    let activities: RoamanActivityOutput[] = (day.activities || []).map((act: any, actIndex: number) => {
      // Fix malformed coordinates (Gemini sometimes outputs wrong keys)
      let lat = act.coordinates?.lat ?? act.lat ?? 10.3157;
      let lng = act.coordinates?.lng ?? act.lng ?? 123.8854;

      // Handle case where Gemini outputs numeric keys like "2" instead of "lng"
      if (act.coordinates && typeof act.coordinates === "object") {
        const coordKeys = Object.keys(act.coordinates);
        for (const key of coordKeys) {
          if (key === "lat") lat = act.coordinates[key];
          else if (key === "lng") lng = act.coordinates[key];
          else if (!isNaN(Number(key)) || key === "lon" || key === "long") {
            // Numeric key or alternate lng name - assume it's longitude
            lng = act.coordinates[key];
          }
        }
      }

      return {
        order: act.order || actIndex + 1,
        time: act.time || "09:00",
        title: act.title || "Activity",
        locationName: act.locationName || act.location || `${destination}, Philippines`,
        coordinates: { lat: Number(lat), lng: Number(lng) },
        description: act.description || "Explore this location.",
        iconKey: act.iconKey || "sightseeing",
      };
    });

    // Enforce activity counts by mode
    if (roamanMode === "ADD_TO_DAY") {
      // Only keep the requested number of NEW activities
      activities = activities.slice(0, requestedActivitiesCount);
      // Re-sequence order
      activities = activities.map((a, idx) => ({ ...a, order: idx + 1 }));
    } else {
      // Pad to minimum activities per day if needed
      if (activities.length < minActivitiesPerDay) {
        const missing = minActivitiesPerDay - activities.length;
        const baseLat = activities[0]?.coordinates?.lat ?? 10.3157;
        const baseLng = activities[0]?.coordinates?.lng ?? 123.8854;
        for (let i = 0; i < missing; i++) {
          const idx = activities.length + 1;
          activities.push({
            order: idx,
            time: "20:00",
            title: "Free Time / Explore Nearby",
            locationName: `${destination}, Philippines`,
            coordinates: { lat: baseLat + 0.0002 * idx, lng: baseLng + 0.0002 * idx },
            description: "Use this slot for a flexible stop nearby based on your mood and energy.",
            iconKey: "relaxation",
          });
        }
      }
    }

    return {
      dayNumber,
      date,
      title,
      activities,
    };
  });

  // In ADD_TO_DAY mode, prefer returning exactly one day (targetDay) if provided.
  const finalDays =
    roamanMode === "ADD_TO_DAY" && targetDay
      ? normalizedDays
          .filter((d) => d.dayNumber === targetDay)
          .slice(0, 1)
      : normalizedDays;

  return {
    message,
    draft: {
      type: "SMART_TRIP",
      destination,
      startDate,
      endDate,
      travelers,
      days: finalDays,
    },
  };
}

const pageLabelMap: Record<string, string> = {
  "/user/travels": "My Travels",
  "/user/bookings": "My Bookings",
  "/user/history": "Travel History",
  "/user/profile/edit": "Edit Profile",
  "/user/feedback": "Give Feedback",
  "/user/notifications": "Notifications",
  "/user/weather": "Check Weather",
  "/user/standard-itinerary": "Standard Itinerary",
  "/user/requested-itinerary": "Request Itinerary",
  "/user/customized-itinerary": "Custom Itinerary",
  "/user/smart-trip": "Smart Trip AI",
  "/user/create-new-travel": "Create Travel",
  "/user/home": "Dashboard",
  "/user/payments": "My Payments",
  "/user/inquiry": "Inquiry",
};

/**
 * Builds navigation actions from FAQ targetPages.
 * Dynamically generates a label even if path is not in pageLabelMap (future-proofing).
 */
function buildTargetPageActions(targetPages: string[]): ChatAction[] {
  const uniquePages = Array.from(new Set(targetPages.filter(Boolean)));
  return uniquePages.map((path) => {
    // Use map if exists, otherwise generate a readable label from the path
    let label = pageLabelMap[path];
    if (!label) {
      // e.g., "/user/my-bookings" -> "My Bookings"
      const pathPart = path.split("/").pop() || "";
      label = pathPart
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || "Open Page";
    }
    return {
      label,
      action: path,
      type: "NAVIGATION" as const,
    };
  });
}

// NEW: Helper function to determine actions based on FAQ target pages or user query
function determineActions(question: string, sources: FaqEntry[] = []): ChatAction[] {
  const targetActions = buildTargetPageActions(
    sources.flatMap((faq) => faq.targetPages || [])
  );
  if (targetActions.length > 0) return targetActions;

  const lowerQ = question.toLowerCase();
  const actions: ChatAction[] = [];

  // Weather Logic
  if (lowerQ.includes("weather") || lowerQ.includes("forecast") || lowerQ.includes("rain") || lowerQ.includes("sunny")) {
    actions.push({
      label: "Check Weather",
      action: "/user/weather",
      type: "NAVIGATION",
    });
  }

  // Booking Logic
  if (lowerQ.includes("book") || lowerQ.includes("reservation") || lowerQ.includes("ticket")) {
    actions.push({
      label: "My Bookings",
      action: "/user/bookings",
      type: "NAVIGATION",
    });
    actions.push({
      label: "New Booking",
      action: "/user/standard-itinerary",
      type: "NAVIGATION",
    });
  }

  // Feedback Logic
  if (lowerQ.includes("feedback") || lowerQ.includes("review") || lowerQ.includes("rate") || lowerQ.includes("complain")) {
    actions.push({
      label: "Give Feedback",
      action: "/user/feedback",
      type: "NAVIGATION",
    });
    actions.push({
      label: "My Feedback",
      action: "view my feedback", // Frontend can intercept this specific string if needed
      type: "QUERY",
    });
  }

  // Profile/Account Logic
  if (lowerQ.includes("profile") || lowerQ.includes("account") || lowerQ.includes("password") || lowerQ.includes("email")) {
    actions.push({
      label: "Edit Profile",
      action: "/user/profile/edit",
      type: "NAVIGATION",
    });
  }

  // Creation/Planning Logic
  if (lowerQ.includes("create") || lowerQ.includes("plan") || lowerQ.includes("build") || lowerQ.includes("itinerary")) {
    actions.push({
      label: "Create New Travel",
      action: "/user/create-new-travel",
      type: "NAVIGATION",
    });
    actions.push({
      label: "Use Smart Trip AI",
      action: "/user/smart-trip",
      type: "NAVIGATION",
    });
  }

  return actions;
}

export const ChatbotService = {
  async roameo(question: string) {
    // Fetch all active FAQs (not limited to 5 for better matching)
    const faqs: FaqEntry[] = await prisma.faqEntry.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    const queryWords = question.toLowerCase().replace(/[?!.,]/g, '').split(' ').filter(w => w.length > 2);
    
    // Enhanced filter logic: check question, answer, tags, and pageKeywords
    const sources: FaqEntry[] = faqs.filter((faq: FaqEntry) => {
      // Combine all searchable text: question, answer, tags, pageKeywords
      const faqQuestion = faq.question.toLowerCase();
      const faqAnswer = faq.answer.toLowerCase();
      const faqTags = (faq.tags || []).join(' ').toLowerCase();
      const faqKeywords = (faq.pageKeywords || []).join(' ').toLowerCase();
      const combinedText = `${faqQuestion} ${faqAnswer} ${faqTags} ${faqKeywords}`;
      
      // Count how many query words match in the combined text
      const matches = queryWords.filter(word => combinedText.includes(word));
      
      // Also check if any tag or keyword exactly matches a query word (stronger signal)
      const exactTagMatch = (faq.tags || []).some(tag => 
        queryWords.includes(tag.toLowerCase())
      );
      const exactKeywordMatch = (faq.pageKeywords || []).some(keyword => 
        queryWords.includes(keyword.toLowerCase())
      );
      
      // Match if 2+ words found OR an exact tag/keyword match
      return matches.length >= 2 || exactTagMatch || exactKeywordMatch; 
    }).slice(0, 5); // Limit to top 5 matches after filtering

    // NEW: Calculate actions before returning
    const suggestedActions = determineActions(question, sources);

    if (sources.length === 0) {
      // No FAQ match found - use AI's own knowledge to provide a helpful response
      const fallbackPrompt = `You are Roameo, the friendly and professional travel assistant for Bond Voyage, a Philippine travel agency.

Guidelines:
1. Use a warm, welcoming tone (e.g., "Certainly!", "Sure", "I'd be happy to help with that.").
2. Refer to the company as "we" or "us" (e.g., "We can help you with...").
3. Provide a helpful, informative answer based on your general knowledge about travel, tourism, and common travel agency services.
4. If the question is about specific BondVoyage policies or internal systems you don't know about, politely suggest they contact our support team for detailed information and attempt to answer using your own knowledge.
5. Keep responses concise but helpful (2-4 sentences).
6. Focus on being genuinely useful rather than just saying you don't know. 
7. Ensure the response is natural, within context (even if a keyword matches the question but the answer is not relevant to the question), and conversational.

User question: ${question}

Provide a helpful response:`;

      try {
        const fallbackAnswer = await callGemini(fallbackPrompt);
        return {
          answer: fallbackAnswer || "I don't have specific information about that in our FAQs, but I'd be happy to help! Please feel free to contact our support team for detailed assistance.",
          confidence: "medium" as const,
          sources: [],
          actions: suggestedActions,
        };
      } catch (error) {
        console.error("Fallback AI response failed:", error);
        return {
          answer: "I don't have specific information about that in our FAQs, but I'd be happy to help! Please feel free to contact our support team for detailed assistance.",
          confidence: "low" as const,
          sources: [],
          actions: suggestedActions,
        };
      }
    }

    const context = (sources.length > 0 ? sources : faqs)
      .map(
        (entry: FaqEntry) =>
          `Q: ${entry.question}\nA: ${entry.answer}\nOrder: ${entry.order}`
      )
      .join("\n\n");

      const prompt = `You are Roameo, the friendly and professional travel assistant for Bond Voyage. 
      Your goal is to provide helpful, conversational support using the context provided below.

      Guidelines:
      1. Use a warm, welcoming tone (e.g., "Certainly!", "I'd be happy to help with that.").
      2. Refer to the company as "we" or "us" (e.g., "We can help you with...").
      3. Rephrase the answer naturally in your own words - do NOT copy-paste or quote directly.
      4. DO NOT mention "FAQ", "context", "sources", or reference numbers in your response.
      5. If the context helps answer the question, use it. If additional general knowledge helps, include it.
      6. Keep the response helpful, natural, and conversational (2-4 sentences).
      7. Never say things like "According to our FAQ..." or "Based on source #1...".

      Context (for your reference only - don't mention these):
      ${context}

      User question: ${question}

      Provide a natural, helpful response:`;

    const text = await callGemini(prompt);

    const normalizedAnswer = text || "I don't have that info in our official FAQs yet.";
    const confidence = sources.length > 0 ? "high" : "medium";

    return {
      answer: normalizedAnswer,
      confidence,
      sources: (sources.length > 0 ? sources : []).map((faq: FaqEntry) => ({
        id: faq.id,
        question: faq.question,
        order: faq.order,
        targetPages: faq.targetPages,
        tags: faq.tags,
        pageKeywords: faq.pageKeywords,
      })),
      actions: suggestedActions, // Include the actions in the final response
    };
  },

  async roaman(prompt: string, preferences?: RoamanPreferences): Promise<RoamanResponseData> {
    const officialDestinations = [
      "Cebu", "Palawan", "Bohol", "Siargao", "Bicol",
      "Baguio", "Ilocos", "Boracay", "Davao", "Manila"
    ];

    const systemPrompt = buildRoamanSystemPrompt(officialDestinations, preferences);
    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}\n\nReturn JSON only.`;

    try {
      const text = await callGemini(fullPrompt);
      const rawResponse = extractJson<any>(text, {});
      
      if (!rawResponse || !rawResponse.draft?.days?.length) {
        // Fallback if Gemini returns invalid/empty response
        return buildRoamanFallback(preferences);
      }

      // Normalize the response to fix Gemini inconsistencies
      return normalizeRoamanResponse(rawResponse, preferences);
    } catch (error) {
      console.error("Roaman generation failed:", error);
      return buildRoamanFallback(preferences);
    }
  },
};
