import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Tone } from "@/lib/groq";

interface Props {
  message: { id: string; role: "user" | "assistant"; content: string };
  colors: any;
  activeMsgId: string | null;
  ttsState: "idle" | "playing" | "paused";
  onReadAloud: () => void;
  onStopTts: () => void;
  onCopy: () => void;
  onSave: () => void;
  fontSize: number;
  language: string;
  tone: Tone;
}

export default function MessageBubble({
  message, colors, activeMsgId, ttsState,
  onReadAloud, onStopTts, onCopy, onSave, fontSize, language, tone,
}: Props) {
  const isUser = message.role === "user";
  const isActive = activeMsgId === message.id;

  if (isUser) {
    return (
      <View style={[styles.userWrapper]}>
        <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
          <Text style={[styles.userText, { fontSize }]}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const isSpeaking = isActive && ttsState === "playing";
  const isPaused = isActive && ttsState === "paused";

  return (
    <View style={styles.assistantWrapper}>
      <View style={[styles.avatarBadge, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.avatarLetter, { color: colors.primary }]}>E</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[styles.aiLabel, { color: colors.primary }]}>Echo AI</Text>
          <Text style={[styles.aiMeta, { color: colors.mutedForeground }]}>{language} · {tone}</Text>
        </View>
        <View style={[styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.assistantText, { fontSize, color: colors.foreground }]}>
            {message.content}
          </Text>
        </View>
        {/* Action row */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: isActive && ttsState !== "idle" ? colors.primary : colors.border }]} onPress={onReadAloud}>
            <Feather name={isSpeaking ? "pause" : isPaused ? "play" : "volume-2"} size={13} color={isActive && ttsState !== "idle" ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.actionText, { color: isActive && ttsState !== "idle" ? colors.primary : colors.mutedForeground }]}>
              {isSpeaking ? "Pause" : isPaused ? "Resume" : "Read Aloud"}
            </Text>
          </TouchableOpacity>
          {isActive && ttsState !== "idle" && (
            <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.destructive }]} onPress={onStopTts}>
              <Feather name="square" size={13} color={colors.destructive} />
              <Text style={[styles.actionText, { color: colors.destructive }]}>Stop</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={onCopy}>
            <Feather name="copy" size={13} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={onSave}>
            <Feather name="bookmark" size={13} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userWrapper: { alignItems: "flex-end", marginBottom: 4 },
  userBubble: { maxWidth: "82%", borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 12 },
  userText: { fontFamily: "Inter_400Regular", color: "#fff", lineHeight: 22 },
  assistantWrapper: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 4 },
  avatarBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2 },
  avatarLetter: { fontFamily: "Inter_700Bold", fontSize: 13 },
  aiLabel: { fontFamily: "Inter_700Bold", fontSize: 12 },
  aiMeta: { fontFamily: "Inter_400Regular", fontSize: 11 },
  assistantBubble: { borderWidth: 1, borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  assistantText: { fontFamily: "Inter_400Regular", lineHeight: 24 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderRadius: 20,
  },
  actionText: { fontFamily: "Inter_500Medium", fontSize: 11 },
});
