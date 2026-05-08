import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { clearAllNotes } from "@/lib/storage";
import { AI_LANGUAGES } from "@/lib/groq";
import LanguageSheet from "@/components/LanguageSheet";
import { useState } from "react";

function Row({ label, children, colors, hint }: any) {
  return (
    <View style={{ backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: colors.foreground }}>{label}</Text>
          {hint && <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{hint}</Text>}
        </View>
        {children}
      </View>
    </View>
  );
}

function SectionHeader({ title, colors }: any) {
  return (
    <Text style={{
      fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.2,
      color: colors.primary, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
      textTransform: "uppercase",
    }}>{title}</Text>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, updateSettings } = useApp();
  const insets = useSafeAreaInsets();
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const isWeb = Platform.OS === "web";

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20, paddingTop: isWeb ? 67 : insets.top + 8, paddingBottom: 12,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: colors.foreground },
    sliderRow: { backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    sliderLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: colors.foreground, marginBottom: 6 },
    sliderValue: { fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground },
    clearBtn: {
      marginHorizontal: 20, marginTop: 8, backgroundColor: colors.destructive,
      borderRadius: 14, paddingVertical: 13, alignItems: "center",
    },
    clearBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
    aboutRow: { backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between" },
    aboutLabel: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground },
    aboutValue: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.mutedForeground },
  });

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <SectionHeader title="Language & Tone" colors={colors} />
        <Row label="AI Response & Voice Language" hint="Controls AI language and Read Aloud voice" colors={colors}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            onPress={() => setLangSheetOpen(true)}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.primary }}>{settings.aiLanguage}</Text>
            <Feather name="chevron-down" size={14} color={colors.primary} />
          </TouchableOpacity>
        </Row>
        <Row label="Response Style" hint="Casual keeps scientific terms in English. Formal translates everything." colors={colors}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: settings.tone === "casual" ? colors.primary : colors.mutedForeground }}>Casual</Text>
            <Switch
              value={settings.tone === "formal"}
              onValueChange={(v) => updateSettings({ tone: v ? "formal" : "casual" })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: settings.tone === "formal" ? colors.primary : colors.mutedForeground }}>Formal</Text>
          </View>
        </Row>

        <SectionHeader title="Appearance" colors={colors} />
        <Row label="Dark Mode" colors={colors}>
          <Switch
            value={settings.darkMode}
            onValueChange={(v) => updateSettings({ darkMode: v })}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </Row>

        <View style={s.sliderRow}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.sliderLabel}>Font Size</Text>
            <Text style={s.sliderValue}>{settings.fontSize}pt</Text>
          </View>
          <Slider
            minimumValue={13} maximumValue={24} step={1}
            value={settings.fontSize}
            onValueChange={(v) => updateSettings({ fontSize: Math.round(v) })}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
        </View>

        <SectionHeader title="Read Aloud (TTS)" colors={colors} />
        <View style={s.sliderRow}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.sliderLabel}>Volume</Text>
            <Text style={s.sliderValue}>{Math.round(settings.ttsVolume * 100)}%</Text>
          </View>
          <Slider minimumValue={0} maximumValue={1} step={0.05} value={settings.ttsVolume}
            onValueChange={(v) => updateSettings({ ttsVolume: v })}
            minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />
        </View>
        <View style={s.sliderRow}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.sliderLabel}>Pitch</Text>
            <Text style={s.sliderValue}>{settings.ttsPitch.toFixed(1)}×</Text>
          </View>
          <Slider minimumValue={0.5} maximumValue={2} step={0.1} value={settings.ttsPitch}
            onValueChange={(v) => updateSettings({ ttsPitch: parseFloat(v.toFixed(1)) })}
            minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />
        </View>
        <View style={s.sliderRow}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.sliderLabel}>Speech Rate</Text>
            <Text style={s.sliderValue}>{settings.ttsRate.toFixed(2)}×</Text>
          </View>
          <Slider minimumValue={0.5} maximumValue={1.5} step={0.05} value={settings.ttsRate}
            onValueChange={(v) => updateSettings({ ttsRate: parseFloat(v.toFixed(2)) })}
            minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />
        </View>

        <SectionHeader title="Data" colors={colors} />
        <TouchableOpacity
          style={s.clearBtn}
          onPress={() => Alert.alert("Clear All Notes", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", style: "destructive", onPress: async () => { await clearAllNotes(); Alert.alert("Done", "All notes deleted."); } },
          ])}
        >
          <Text style={s.clearBtnText}>Clear All Notes</Text>
        </TouchableOpacity>

        <SectionHeader title="About" colors={colors} />
        <View style={s.aboutRow}><Text style={s.aboutLabel}>App Version</Text><Text style={s.aboutValue}>Echo AI v2.1.0</Text></View>
        <View style={s.aboutRow}><Text style={s.aboutLabel}>AI Model</Text><Text style={s.aboutValue}>Llama 4 Scout (Groq)</Text></View>
        <View style={s.aboutRow}><Text style={s.aboutLabel}>OCR Engine</Text><Text style={s.aboutValue}>Tesseract.js (Browser)</Text></View>
      </ScrollView>

      <LanguageSheet
        visible={langSheetOpen}
        selected={settings.aiLanguage}
        languages={AI_LANGUAGES}
        onSelect={(lang) => { updateSettings({ aiLanguage: lang }); setLangSheetOpen(false); }}
        onClose={() => setLangSheetOpen(false)}
        colors={colors}
      />
    </View>
  );
}
