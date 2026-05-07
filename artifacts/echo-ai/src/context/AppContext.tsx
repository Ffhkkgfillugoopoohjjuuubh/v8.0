import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { AppSettings, loadSettings, saveSettings } from "@/lib/settings";
import { speak, pauseSpeech, resumeSpeech, stopSpeech, TtsState } from "@/lib/tts";

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
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.darkMode]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const speakText = useCallback((text: string) => {
    speak(
      text,
      { lang: settings.voiceLanguage, volume: settings.volume, pitch: settings.pitch, rate: settings.rate },
      setTtsState
    );
  }, [settings.voiceLanguage, settings.volume, settings.pitch, settings.rate]);

  const pauseTts = useCallback(() => { pauseSpeech(); setTtsState("paused"); }, []);
  const resumeTts = useCallback(() => { resumeSpeech(); setTtsState("playing"); }, []);
  const stopTts = useCallback(() => { stopSpeech(); setTtsState("stopped"); }, []);

  return (
    <AppContext.Provider value={{ settings, updateSettings, ttsState, speakText, pauseTts, resumeTts, stopTts }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
