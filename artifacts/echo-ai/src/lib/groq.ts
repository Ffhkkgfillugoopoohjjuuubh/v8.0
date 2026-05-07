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

export async function groqChat(
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
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
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.maxTokens ?? 2048,
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

export function detectsMath(text: string): boolean {
  return /(\d+[\+\-\*\/\=\^\%]\d+|sqrt|sin|cos|tan|log|dx|dy|integral|equation|formula|solve|velocity|acceleration|force|energy|\bx\b|\by\b)/i.test(text);
}

export function buildSystemPrompt(language: string, hasMath: boolean): string {
  const mathBlock = hasMath
    ? `MATH/PHYSICS: Solve every problem step-by-step. Show formula, substitution, and each step. Bold the final answer (**answer**). Write fractions as (a)/(b), square roots as sqrt(x). No LaTeX.`
    : "";
  return `You are Echo AI, an expert educational assistant.

RESPONSE LANGUAGE: Always respond in ${language}. Use casual everyday form. For Indian languages, keep scientific terms and equations in English.

FORMAT: Use markdown (bold, lists, headers). No LaTeX. Math in plain text only.
${mathBlock}

Be helpful, encouraging, and accurate.`;
}

export const AI_RESPONSE_LANGUAGES = [
  "English","Hindi","Bengali","Tamil","Telugu","Kannada","Malayalam",
  "Marathi","Gujarati","Punjabi","Odia","Assamese","Urdu","Arabic",
  "French","Spanish","German","Japanese","Korean","Chinese",
  "Portuguese","Russian","Dutch","Turkish","Vietnamese","Thai",
  "Indonesian","Polish","Swedish",
];
