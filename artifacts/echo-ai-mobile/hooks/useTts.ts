import { useState, useRef, useCallback } from "react";
import { Platform } from "react-native";

type TtsState = "idle" | "playing" | "paused";

export function useTts() {
  const [ttsState, setTtsState] = useState<TtsState>("idle");
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);

  // Web: use SpeechSynthesis
  const webUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (msgId: string, text: string, langCode: string, volume: number, pitch: number, rate: number) => {
      if (Platform.OS === "web") {
        window.speechSynthesis?.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = langCode;
        utt.volume = volume;
        utt.pitch = pitch;
        utt.rate = rate;
        utt.onstart = () => { setTtsState("playing"); setActiveMsgId(msgId); };
        utt.onpause = () => setTtsState("paused");
        utt.onresume = () => setTtsState("playing");
        utt.onend = () => { setTtsState("idle"); setActiveMsgId(null); };
        utt.onerror = () => { setTtsState("idle"); setActiveMsgId(null); };
        webUtterance.current = utt;
        window.speechSynthesis.speak(utt);
        setTtsState("playing");
        setActiveMsgId(msgId);
      } else {
        // Native: dynamically import expo-speech
        import("expo-speech").then((Speech) => {
          Speech.stop();
          setActiveMsgId(msgId);
          setTtsState("playing");
          Speech.speak(text, {
            language: langCode,
            pitch,
            rate,
            volume,
            onDone: () => { setTtsState("idle"); setActiveMsgId(null); },
            onError: () => { setTtsState("idle"); setActiveMsgId(null); },
          });
        }).catch(() => {
          // expo-speech not available, silently fail
          setTtsState("idle");
        });
      }
    },
    []
  );

  const pause = useCallback(() => {
    if (Platform.OS === "web") {
      window.speechSynthesis?.pause();
    } else {
      // No pause support in expo-speech on all platforms; just stop
      import("expo-speech").then((Speech) => Speech.stop()).catch(() => {});
    }
    setTtsState("paused");
  }, []);

  const resume = useCallback(() => {
    if (Platform.OS === "web") {
      window.speechSynthesis?.resume();
      setTtsState("playing");
    }
  }, []);

  const stop = useCallback(() => {
    if (Platform.OS === "web") {
      window.speechSynthesis?.cancel();
    } else {
      import("expo-speech").then((Speech) => Speech.stop()).catch(() => {});
    }
    setTtsState("idle");
    setActiveMsgId(null);
  }, []);

  return { speak, pause, resume, stop, ttsState, activeMsgId };
}
