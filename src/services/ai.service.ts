import { SMART_TRIP_ICON_KEYS, SmartTripIconKey } from "@/constants/smartTrip";
import { SmartTripRequest } from "@/validators/ai.dto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const activityLibrary: Record<SmartTripIconKey, string[]> = {
  sightseeing: [
    "Explore the city's iconic landmarks",
    "Join a guided walking tour of historic sites",
    "Capture skyline views from a popular lookout",
  ],
  museum: [
    "Visit the flagship museum for regional art",
    "Discover a science or innovation center",
    "Stop by a boutique gallery featuring local artists",
  ],
  food: [
    "Sample street food at a bustling market",
    "Book a chef-led tasting menu",
    "Try a beloved neighborhood eatery",
  ],
  cafe: [
    "Cozy up in a specialty coffee shop",
    "Enjoy brunch at a local cafe",
    "Try a dessert spot known to locals",
  ],
  nightlife: [
    "Listen to live music at an intimate bar",
    "Experience a rooftop lounge",
    "Stroll through a vibrant nightlife district",
  ],
  shopping: [
    "Browse artisan goods in a weekend market",
    "Visit a design district for unique finds",
    "Pick up souvenirs at a local craft store",
  ],
  nature: [
    "Relax at a nearby park or botanical garden",
    "Take a scenic ferry or riverside walk",
    "Enjoy a lakeside picnic",
  ],
  beach: [
    "Spend the afternoon on the shoreline",
    "Try a coastal bike ride",
    "Watch sunset from a beachside cafe",
  ],
  hiking: [
    "Hike an accessible trail with viewpoints",
    "Join a guided nature walk",
    "Visit a waterfall or canyon lookout",
  ],
  relax: [
    "Schedule downtime at a spa or sauna",
    "Enjoy a slow morning near your stay",
    "Take a leisurely neighborhood stroll",
  ],
  culture: [
    "Attend a cultural performance or show",
    "Explore a heritage district",
    "Visit a local temple or cathedral",
  ],
  activity: [
    "Book a hands-on workshop",
    "Try a cooking or pottery class",
    "Join a small-group experience",
  ],
};

const travelPaceToActivities: Record<SmartTripRequest["travelPace"], number> = {
  relaxed: 3,
  moderate: 4,
  packed: 5,
  own_pace: 3,
};

const pickIconsForPreferences = (preferences: string[]): SmartTripIconKey[] => {
  const prioritized: SmartTripIconKey[] = [];

  for (const pref of preferences) {
    const key = SMART_TRIP_ICON_KEYS.find((icon) => pref.toLowerCase().includes(icon));
    if (key && !prioritized.includes(key)) {
      prioritized.push(key);
    }
  }

  return prioritized.length > 0
    ? prioritized
    : (["sightseeing", "food", "culture"] as SmartTripIconKey[]);
};

const buildActivity = (
  iconKey: SmartTripIconKey,
  title: string,
  destination: string,
  offset: number
) => {
  const timeSlots = ["08:00", "10:30", "13:00", "16:00", "19:00", "21:00"];
  const time = timeSlots[offset % timeSlots.length];

  return {
    time,
    title: title.replace("city", destination),
    iconKey,
    description: undefined as string | undefined,
  };
};

export const AiService = {
  buildSmartTripItinerary(input: SmartTripRequest) {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const totalDays =
      Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

    const preferredIcons = pickIconsForPreferences(input.preferences ?? []);
    const activitiesPerDay = travelPaceToActivities[input.travelPace] ?? 3;

    return Array.from({ length: totalDays }).map((_, index) => {
      const iconRotation = preferredIcons[index % preferredIcons.length];
      const library = activityLibrary[iconRotation];

      const activityTitles = Array.from({ length: activitiesPerDay }).map(
        (_, idx) => library[idx % library.length]
      );

      return {
        day: index + 1,
        title: `Day ${index + 1}: ${input.destination} highlights`,
        activities: activityTitles.map((title, idx) =>
          buildActivity(iconRotation, title, input.destination, idx)
        ),
      };
    });
  },
};
