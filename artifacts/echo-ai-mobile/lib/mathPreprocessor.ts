/**
 * MathPreprocessor — cleans up math notation before sending to Groq.
 * Applied to EVERY user message and page context.
 */
export function preprocessMath(text: string): string {
  let t = text;

  // Remove LaTeX wrappers
  t = t.replace(/\\\[/g, "").replace(/\\\]/g, "");
  t = t.replace(/\\\(/g, "").replace(/\\\)/g, "");
  t = t.replace(/\$\$/g, "").replace(/\$/g, "");

  // Convert \frac{a}{b} → (a)/(b)
  t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");

  // Convert \sqrt[y]{x} → y_root(x)
  t = t.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, "$1_root($2)");

  // Convert \sqrt{x} → sqrt(x)
  t = t.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");

  // Convert Unicode radical √ → sqrt
  t = t.replace(/√([^\s+\-*/=()]+)/g, "sqrt($1)");
  t = t.replace(/√/g, "sqrt");

  // Remove stray backslashes
  t = t.replace(/\\/g, "");

  // Unicode fraction characters
  t = t.replace(/½/g, "1/2");
  t = t.replace(/⅓/g, "1/3");
  t = t.replace(/⅔/g, "2/3");
  t = t.replace(/¼/g, "1/4");
  t = t.replace(/¾/g, "3/4");
  t = t.replace(/⅛/g, "1/8");
  t = t.replace(/⅜/g, "3/8");
  t = t.replace(/⅝/g, "5/8");
  t = t.replace(/⅞/g, "7/8");

  // Ensure proper spacing around operators (x−1/x=3 → x - 1/x = 3)
  t = t.replace(/([a-zA-Z0-9)])([\-\+\=])/g, "$1 $2 ");
  t = t.replace(/([\-\+\=])([a-zA-Z0-9(])/g, "$1 $2");

  // Decimal comma → decimal point (e.g. 2,5 → 2.5)
  t = t.replace(/(\d),(\d)/g, "$1.$2");

  // Collapse multiple spaces
  t = t.replace(/ {2,}/g, " ").trim();

  return t;
}

/**
 * Clean text for TTS — remove all markdown formatting symbols.
 */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/>\s*/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
