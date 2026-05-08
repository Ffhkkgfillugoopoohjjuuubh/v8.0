const GROQ_API_KEY = "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";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export class GroqError extends Error {
  isAuthError: boolean;
  constructor(message: string, isAuthError = false) {
    super(message);
    this.isAuthError = isAuthError;
  }
}

export type Tone = "casual" | "formal";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ApiMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export async function groqChat(messages: ApiMessage[]): Promise<string> {
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (res.status === 200) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    if (res.status === 401 || res.status === 403) {
      throw new GroqError("API key is invalid or expired.", true);
    }
    if (res.status === 429) {
      throw new GroqError("Rate limit reached. Please wait a moment and try again.");
    }
    const body = await res.json().catch(() => ({}));
    throw new GroqError(body?.error?.message ?? `API error ${res.status}`);
  } catch (e) {
    if (e instanceof GroqError) throw e;
    throw new GroqError("Cannot connect to AI. Check your internet connection.");
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function buildSystemPrompt(language: string, tone: Tone): string {
  const isIndian = [
    "Hindi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam",
    "Marathi", "Gujarati", "Punjabi", "Odia", "Assamese", "Urdu",
  ].includes(language);

  const toneInstructions = (() => {
    if (language === "English") {
      return tone === "casual"
        ? "Use a casual, friendly, conversational tone. Avoid stiff academic language."
        : "Use a formal, academic, precise tone.";
    }
    if (isIndian) {
      return tone === "casual"
        ? `Use everyday casual ${language}. IMPORTANT for scientific/technical terms (like acceleration, velocity, photosynthesis, mitochondria, Newton, force, energy, etc.): keep them in their original English word — you may write them in ${language} script as a transliteration (e.g. Bengali: অ্যাক্সিলারেশন, হিন্দি: एक्सेलेरेशन) but do NOT translate the concept to a ${language} word. The rest of the explanation must be in casual everyday ${language}. Use informal pronouns (তুমি/তোমার for Bengali, तुम/तुम्हारा for Hindi, etc.).`
        : `Use formal, academic ${language}. Translate ALL scientific and technical terms completely into ${language} (e.g. Bengali: acceleration → ত্বরণ, velocity → বেগ, force → বল, photosynthesis → সালোকসংশ্লেষণ). Use formal pronouns (আপনি for Bengali, आप for Hindi, etc.). Write like a textbook.`;
    }
    return tone === "casual"
      ? `Use a casual, friendly ${language} tone.`
      : `Use a formal, academic ${language} tone.`;
  })();

  return `You are Echo AI, an expert educational explainer.

RESPONSE LANGUAGE: Always respond entirely in ${language}. Never switch to another language unless quoting a term as instructed below.

TONE & SCIENTIFIC TERMS:
${toneInstructions}

FORMAT:
- Use clear markdown (bold key terms, use bullet lists, headers for sections).
- When solving math/physics: show every step clearly, bold the final answer.
- Write math in plain text (no LaTeX). Fractions as (a)/(b), square root as sqrt(x).

STYLE:
- You are an encouraging teacher — supportive, clear, and student-focused.
- Always check if your explanation would be understandable to a student who is new to the topic.`;
}

export function autoExplainPrompt(language: string, tone: Tone): string {
  if (tone === "casual") {
    return `Look at this image carefully. Explain everything you see in it — what it shows, what it means, and why it matters — in ${language}. Make it simple and easy to understand like you are explaining to a friend. If it has text, formulas, diagrams, or graphs, explain all of them.`;
  }
  return `Examine this image carefully. Provide a comprehensive educational explanation of its contents in ${language} — identify the topic, explain all concepts, formulas, diagrams, or text present. Be thorough and systematic.`;
}

export const AI_RESPONSE_LANGUAGES = [
  "English", "Hindi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Marathi", "Gujarati", "Punjabi", "Odia", "Assamese", "Urdu", "Arabic",
  "French", "Spanish", "German", "Japanese", "Korean", "Chinese",
  "Portuguese", "Russian", "Dutch", "Turkish", "Vietnamese", "Thai",
  "Indonesian", "Polish", "Swedish",
];

export const LANGUAGE_VOICE_MAP: Record<string, string> = {
  English: "en-US",
  Hindi: "hi-IN",
  Bengali: "bn-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
  Punjabi: "pa-IN",
  Odia: "or-IN",
  Assamese: "as-IN",
  Urdu: "ur-PK",
  Arabic: "ar-SA",
  French: "fr-FR",
  Spanish: "es-ES",
  German: "de-DE",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Chinese: "zh-CN",
  Portuguese: "pt-BR",
  Russian: "ru-RU",
  Dutch: "nl-NL",
  Turkish: "tr-TR",
  Vietnamese: "vi-VN",
  Thai: "th-TH",
  Indonesian: "id-ID",
  Polish: "pl-PL",
  Swedish: "sv-SE",
};
