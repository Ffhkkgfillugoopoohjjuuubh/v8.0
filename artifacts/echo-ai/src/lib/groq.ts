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

export type ApiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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
        temperature: 0.3,
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

export function buildSystemPrompt(language: string, tone: Tone): string {
  const style =
    tone === "casual"
      ? "Use casual, everyday spoken words. Keep ALL scientific and technical terms in English."
      : "Use formal, academic language. Translate all terms, including scientific ones, into this language.";

  return `You are Echo AI, a brilliant, patient teacher.
You MUST write your entire answer in ${language}.
${style}
Your answer must be beautifully structured, like this:

First, give the direct answer or explanation.

Then, break the concept into clear, numbered steps.

For any math, physics, or grammar problem on the page, solve it step-by-step with full reasoning.

End with a short summary and one encouraging question.
Use bold for important words.
Use bullet points for lists.
Keep paragraphs short and readable.
Never use LaTeX or special symbols. Write fractions as (a)/(b). Write square roots as sqrt(x).
If the user's question refers to the textbook page you have seen, use the page context to answer.`;
}

export const AI_RESPONSE_LANGUAGES = [
  "English", "Hindi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Marathi", "Gujarati", "Punjabi", "Odia", "Assamese", "Urdu", "Arabic",
  "French", "Spanish", "German", "Japanese", "Korean", "Chinese",
  "Portuguese", "Russian", "Dutch", "Turkish", "Vietnamese", "Thai",
  "Indonesian", "Polish", "Swedish",
];

export const LANGUAGE_VOICE_MAP: Record<string, string> = {
  English: "en-US", Hindi: "hi-IN", Bengali: "bn-IN", Tamil: "ta-IN",
  Telugu: "te-IN", Kannada: "kn-IN", Malayalam: "ml-IN", Marathi: "mr-IN",
  Gujarati: "gu-IN", Punjabi: "pa-IN", Odia: "or-IN", Assamese: "as-IN",
  Urdu: "ur-PK", Arabic: "ar-SA", French: "fr-FR", Spanish: "es-ES",
  German: "de-DE", Japanese: "ja-JP", Korean: "ko-KR", Chinese: "zh-CN",
  Portuguese: "pt-BR", Russian: "ru-RU", Dutch: "nl-NL", Turkish: "tr-TR",
  Vietnamese: "vi-VN", Thai: "th-TH", Indonesian: "id-ID", Polish: "pl-PL",
  Swedish: "sv-SE",
};
