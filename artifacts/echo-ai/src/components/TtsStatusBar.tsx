import { Volume2, Pause, Play, X } from "lucide-react";
import { TtsState } from "@/lib/tts";

export default function TtsStatusBar({
  state,
  onPause,
  onResume,
  onStop,
}: {
  state: TtsState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-3 shrink-0">
      <Volume2 size={15} className="text-primary shrink-0" />
      <span className="text-xs font-medium text-primary flex-1">
        {state === "playing" ? "Reading aloud…" : "Paused"}
      </span>
      {state === "playing" ? (
        <button
          onClick={onPause}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Pause size={13} /> Pause
        </button>
      ) : (
        <button
          onClick={onResume}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Play size={13} /> Resume
        </button>
      )}
      <button
        onClick={onStop}
        className="text-xs text-destructive hover:underline flex items-center gap-1 ml-1"
      >
        <X size={13} /> Stop
      </button>
    </div>
  );
}
