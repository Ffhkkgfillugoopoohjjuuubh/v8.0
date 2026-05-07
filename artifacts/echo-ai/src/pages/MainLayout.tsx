import { useLocation } from "wouter";
import { BookOpen, ScanLine, Settings } from "lucide-react";
import { useApp } from "@/context/AppContext";
import TtsStatusBar from "@/components/TtsStatusBar";

const tabs = [
  { id: "scanner", label: "Scanner", icon: ScanLine, path: "/" },
  { id: "notebook", label: "Notebook", icon: BookOpen, path: "/notebook" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
] as const;

export default function MainLayout({
  children,
  tab,
}: {
  children: React.ReactNode;
  tab: string;
}) {
  const [, navigate] = useLocation();
  const { ttsState, pauseTts, resumeTts, stopTts } = useApp();

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* TTS Status Bar */}
      {(ttsState === "playing" || ttsState === "paused") && (
        <TtsStatusBar
          state={ttsState}
          onPause={pauseTts}
          onResume={resumeTts}
          onStop={stopTts}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Bottom nav */}
      <nav className="border-t border-border bg-card shrink-0">
        <div className="flex">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => navigate(t.path)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  size={22}
                  className={active ? "text-primary" : "text-muted-foreground"}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
