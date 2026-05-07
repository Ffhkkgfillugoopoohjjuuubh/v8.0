import { Moon, Sun, Trash2, Volume2, Mic, Globe, Type, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { clearAllNotes } from "@/lib/notes";
import { AI_RESPONSE_LANGUAGES } from "@/lib/groq";
import { VOICE_LANGUAGES } from "@/lib/settings";

function Section({ title }: { title: string }) {
  return (
    <p className="text-xs font-bold text-primary uppercase tracking-widest mt-6 mb-2 px-4">
      {title}
    </p>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border last:border-0">{children}</div>;
}

function SliderRow({ icon: Icon, label, value, min, max, step, display, onChange }: {
  icon: React.ElementType; label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  return (
    <div className="px-4 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className="text-muted-foreground" />
        <span className="text-sm">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{display}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings } = useApp();
  const { toast } = useToast();

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b border-border bg-card shrink-0">
        <h1 className="text-lg font-bold">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Language */}
        <Section title="Language" />
        <div className="bg-card border-y border-border">
          <Row>
            <div className="flex items-center gap-2">
              <Globe size={15} className="text-muted-foreground" />
              <Label className="text-sm">AI Response Language</Label>
            </div>
            <Select
              value={settings.aiResponseLanguage}
              onValueChange={(v) => updateSettings({ aiResponseLanguage: v })}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {AI_RESPONSE_LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row>
            <div className="flex items-center gap-2">
              <Mic size={15} className="text-muted-foreground" />
              <Label className="text-sm">Voice Language</Label>
            </div>
            <Select
              value={settings.voiceLanguage}
              onValueChange={(v) => updateSettings({ voiceLanguage: v })}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {VOICE_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code} className="text-xs">{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </div>

        {/* Appearance */}
        <Section title="Appearance" />
        <div className="bg-card border-y border-border">
          <Row>
            <div className="flex items-center gap-2">
              {settings.darkMode ? <Moon size={15} className="text-muted-foreground" /> : <Sun size={15} className="text-muted-foreground" />}
              <Label className="text-sm">Dark Mode</Label>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(v) => updateSettings({ darkMode: v })}
            />
          </Row>
          <SliderRow
            icon={Type}
            label="Font Size"
            value={settings.fontSize}
            min={12}
            max={28}
            step={1}
            display={`${settings.fontSize}px`}
            onChange={(v) => updateSettings({ fontSize: v })}
          />
        </div>

        {/* Text-to-Speech */}
        <Section title="Text-to-Speech" />
        <div className="bg-card border-y border-border">
          <SliderRow
            icon={Volume2}
            label="Volume"
            value={settings.volume}
            min={0}
            max={1}
            step={0.1}
            display={`${Math.round(settings.volume * 100)}%`}
            onChange={(v) => updateSettings({ volume: v })}
          />
          <SliderRow
            icon={Mic}
            label="Pitch"
            value={settings.pitch}
            min={0.5}
            max={2}
            step={0.1}
            display={settings.pitch.toFixed(1)}
            onChange={(v) => updateSettings({ pitch: v })}
          />
          <SliderRow
            icon={Volume2}
            label="Speech Rate"
            value={settings.rate}
            min={0.1}
            max={1.5}
            step={0.1}
            display={settings.rate.toFixed(1)}
            onChange={(v) => updateSettings({ rate: v })}
          />
        </div>

        {/* Data */}
        <Section title="Data" />
        <div className="bg-card border-y border-border">
          <div className="px-4 py-3">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1 w-full"
              onClick={() => {
                if (confirm("Delete all notes permanently?")) {
                  clearAllNotes();
                  toast({ title: "All notes deleted" });
                }
              }}
            >
              <Trash2 size={13} /> Clear All Notes
            </Button>
          </div>
        </div>

        {/* About */}
        <Section title="About" />
        <div className="bg-card border-y border-border">
          <Row>
            <div className="flex items-center gap-2">
              <Info size={15} className="text-muted-foreground" />
              <span className="text-sm">App Version</span>
            </div>
            <span className="text-xs text-muted-foreground">Echo AI v1.0.0</span>
          </Row>
          <Row>
            <span className="text-sm">Powered by</span>
            <span className="text-xs text-muted-foreground">Groq AI</span>
          </Row>
        </div>
      </div>
    </div>
  );
}
