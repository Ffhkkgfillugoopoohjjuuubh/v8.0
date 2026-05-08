export type TtsState = "playing" | "paused" | "stopped";

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

let _currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(
  text: string,
  opts: { lang: string; volume: number; pitch: number; rate: number },
  onStateChange: (s: TtsState) => void
): void {
  window.speechSynthesis.cancel();
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;
  const utt = new SpeechSynthesisUtterance(cleaned);
  utt.lang = opts.lang;
  utt.volume = opts.volume;
  utt.pitch = opts.pitch;
  utt.rate = opts.rate;
  utt.onstart = () => onStateChange("playing");
  utt.onpause = () => onStateChange("paused");
  utt.onresume = () => onStateChange("playing");
  utt.onend = () => { onStateChange("stopped"); _currentUtterance = null; };
  utt.onerror = () => { onStateChange("stopped"); _currentUtterance = null; };
  _currentUtterance = utt;
  window.speechSynthesis.speak(utt);
  onStateChange("playing");
}

export function pauseSpeech(): void { window.speechSynthesis.pause(); }
export function resumeSpeech(): void { window.speechSynthesis.resume(); }
export function stopSpeech(): void { window.speechSynthesis.cancel(); _currentUtterance = null; }
