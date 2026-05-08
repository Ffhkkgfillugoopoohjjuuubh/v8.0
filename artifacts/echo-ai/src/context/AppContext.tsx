import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AppSettings, loadSettings, saveSettings } from "@/lib/settings";
import { speak, pauseSpeech, resumeSpeech, stopSpeech, TtsState } from "@/lib/tts";
import { LANGUAGE_VOICE_MAP } from "@/lib/groq";

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  ttsState: TtsState;
  speakText: (text: string) => void;
  pauseTts: () => void;
  resumeTts: () => void;
  stopTts: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [ttsState, setTtsState] = useState<TtsState>("stopped");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, [settings.darkMode]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const speakText = useCallback(
    (text: string) => {
      const voiceLang =
        LANGUAGE_VOICE_MAP[settings.aiResponseLanguage] ?? "en-US";
      speak(
        text,
        { lang: voiceLang, volume: settings.volume, pitch: settings.pitch, rate: settings.rate },
        setTtsState
      );
    },
    [settings.aiResponseLanguage, settings.volume, settings.pitch, settings.rate]
  );

  const pauseTts = useCallback(() => { pauseSpeech(); setTtsState("paused"); }, []);
  const resumeTts = useCallback(() => { resumeSpeech(); setTtsState("playing"); }, []);
  const stopTts = useCallback(() => { stopSpeech(); setTtsState("stopped"); }, []);

  return (
    <AppContext.Provider
      value={{ settings, updateSettings, ttsState, speakText, pauseTts, resumeTts, stopTts }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
