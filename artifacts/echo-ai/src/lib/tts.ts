export function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.+?\]\(.+?\)/g, "")
    .replace(/^>\s/gm, "")
    .trim();
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export type TtsState = "playing" | "paused" | "stopped";

export function speak(
  text: string,
  opts: { lang: string; volume: number; pitch: number; rate: number },
  onStateChange: (s: TtsState) => void
): void {
  window.speechSynthesis.cancel();
  const cleaned = cleanForSpeech(text);
  const utt = new SpeechSynthesisUtterance(cleaned);
  utt.lang = opts.lang;
  utt.volume = opts.volume;
  utt.pitch = opts.pitch;
  utt.rate = opts.rate;
  utt.onstart = () => onStateChange("playing");
  utt.onpause = () => onStateChange("paused");
  utt.onresume = () => onStateChange("playing");
  utt.onend = () => { onStateChange("stopped"); currentUtterance = null; };
  utt.onerror = () => { onStateChange("stopped"); currentUtterance = null; };
  currentUtterance = utt;
  window.speechSynthesis.speak(utt);
  onStateChange("playing");
}

export function pauseSpeech(): void { window.speechSynthesis.pause(); }
export function resumeSpeech(): void { window.speechSynthesis.resume(); }
export function stopSpeech(): void { window.speechSynthesis.cancel(); currentUtterance = null; }
