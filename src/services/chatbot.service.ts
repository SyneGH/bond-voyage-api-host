import axios from "axios";
import { FaqEntry } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";

type GeminiContent = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

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

export const ChatbotService = {
  async roameo(question: string) {
    const faqs: FaqEntry[] = await prisma.faqEntry.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 5,
    });

    const sources: FaqEntry[] = faqs.filter((faq: FaqEntry) => {
      const q = question.toLowerCase();
      return (
        faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
      );
    });

    if (sources.length === 0) {
      return {
        answer: "I'm not sure based on our official FAQs yet. Please contact support for help.",
        confidence: "low" as const,
        sources: [],
      };
    }

    const context = (sources.length > 0 ? sources : faqs)
      .map(
        (entry: FaqEntry) =>
          `Q: ${entry.question}\nA: ${entry.answer}\nOrder: ${entry.order}`
      )
      .join("\n\n");

    const prompt = `You are Roameo, a strict FAQ bot. 
    Answer the user's question using ONLY the context provided below. 
    If the answer is not explicitly in the context, do not make it up.
    Context:\n${context}\n\nUser question: ${question}\nRespond concisely.`;

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
      })),
    };
  },

  async roaman(prompt: string, preferences?: any) {
    const contextLines: string[] = [
      "You are Roaman, a travel assistant. Provide a friendly message and a valid JSON draft for a SMART_TRIP itinerary.",
      "Return JSON with keys: message (string) and draft (object).",
      "Draft must include type='SMART_TRIP', destination, travelers, and days[].",
      "If unsure about dates, set them to null and keep dayNumber ordering starting at 1.",
    ];

    if (preferences) {
      contextLines.push(`User preferences: ${JSON.stringify(preferences)}`);
    }

    const fullPrompt = `
    ${contextLines.join("\n")}
    User prompt: ${prompt}
    Respond ONLY with a valid JSON object matching the format: {"message":"string", "draft":{...}}. 
    Do not wrap in markdown code blocks.`;
    
    const text = await callGemini(fullPrompt);

    const fallbackDraft = {
      message: "Here is a SMART_TRIP draft based on your request.",
      draft: {
        type: "SMART_TRIP",
        destination: preferences?.destination || "",
        startDate: preferences?.startDate || null,
        endDate: preferences?.endDate || null,
        travelers: preferences?.travelers || 1,
        tourType: preferences?.tourType,
        days: [
          {
            dayNumber: 1,
            date: preferences?.startDate || null,
            activities: [
              { time: "09:00", title: "Arrival & check-in", order: 1 },
            ],
          },
        ],
      },
    };

    return extractJson(text, fallbackDraft);
  },
};
