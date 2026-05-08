const GROQ_API_KEY = "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";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export type Tone = "casual" | "formal";

export interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class GroqError extends Error {
  isAuthError: boolean;
  constructor(message: string, isAuthError = false) {
    super(message);
    this.isAuthError = isAuthError;
  }
}

export async function groqChat(messages: ApiMessage[]): Promise<string> {
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.3, max_tokens: 2048 }),
    });
    if (res.status === 200) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    if (res.status === 401 || res.status === 403) throw new GroqError("API key invalid or expired.", true);
    if (res.status === 429) throw new GroqError("Rate limit reached. Please wait and try again.");
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

BEFORE YOU SOLVE ANY PROBLEM, YOU MUST DO THIS:
Rewrite the given problem in a clean, unambiguous plain-text format.
Write all fractions as (numerator)/(denominator) with parentheses.
Write all square roots as sqrt(...).
Write all powers as x^2, x^3, etc.
Verify that this rewritten problem matches the original problem.

WHEN YOU SOLVE:
Give the direct answer or explanation.
Break the concept into clear, numbered steps.
Show every calculation step on its own line.
Never use LaTeX or special symbols. Write everything in plain text.
For radical equations: square both sides carefully, check for extraneous solutions.
For fraction equations: multiply both sides by the LCD first.
For decimals: always use a point (2.5), never a comma.
After solving, verify your answer by plugging it back into the original problem.

FORMAT:
Use bold for important words.
Use bullet points for lists.
Keep paragraphs short and readable.
End with a short summary and one encouraging question.`;
}

export const AI_LANGUAGES = [
  "English", "Hindi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Marathi", "Gujarati", "Punjabi", "Odia", "Assamese", "Urdu", "Arabic",
  "French", "Spanish", "German", "Japanese", "Korean", "Chinese",
  "Portuguese", "Russian", "Dutch", "Turkish", "Vietnamese", "Thai",
  "Indonesian", "Polish", "Swedish",
];

export const LANGUAGE_TTS_MAP: Record<string, string> = {
  English: "en-US", Hindi: "hi-IN", Bengali: "bn-IN", Tamil: "ta-IN",
  Telugu: "te-IN", Kannada: "kn-IN", Malayalam: "ml-IN", Marathi: "mr-IN",
  Gujarati: "gu-IN", Punjabi: "pa-IN", Odia: "or-IN", Assamese: "as-IN",
  Urdu: "ur-PK", Arabic: "ar-SA", French: "fr-FR", Spanish: "es-ES",
  German: "de-DE", Japanese: "ja-JP", Korean: "ko-KR", Chinese: "zh-CN",
  Portuguese: "pt-BR", Russian: "ru-RU", Dutch: "nl-NL", Turkish: "tr-TR",
  Vietnamese: "vi-VN", Thai: "th-TH", Indonesian: "id-ID", Polish: "pl-PL",
  Swedish: "sv-SE",
};
