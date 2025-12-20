const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface ItineraryInput {
  destination: string;
  startDate: Date;
  endDate: Date;
}

const activityTemplates = [
  {
    title: "Arrival & orientation",
    activities: [
      "Check in and settle into your accommodation",
      "Take a short neighborhood walk",
      "Enjoy a relaxed local dinner",
    ],
  },
  {
    title: "City highlights",
    activities: [
      "Visit a signature landmark",
      "Explore a local market or shopping street",
      "Sample regional cuisine",
    ],
  },
  {
    title: "Culture & nature",
    activities: [
      "Tour a museum or cultural site",
      "Spend time at a nearby park or viewpoint",
      "End the day with a scenic stroll",
    ],
  },
];

const formatDate = (date: Date) => date.toISOString().split("T")[0];

export const AiService = {
  buildTemplateItinerary(input: ItineraryInput) {
    const totalDays =
      Math.floor((input.endDate.getTime() - input.startDate.getTime()) / MS_PER_DAY) +
      1;

    return Array.from({ length: totalDays }).map((_, index) => {
      const template = activityTemplates[index % activityTemplates.length];
      const dayDate = new Date(input.startDate.getTime() + index * MS_PER_DAY);

      return {
        day: index + 1,
        date: formatDate(dayDate),
        title: `${input.destination}: ${template.title}`,
        activities: template.activities.map((activity) =>
          activity.replace(/local/gi, `local ${input.destination}`)
        ),
      };
    });
  },
};
