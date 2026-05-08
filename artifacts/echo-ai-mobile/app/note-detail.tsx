import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { getNotes, saveNote, updateNote } from "@/lib/storage";
import { groqChat, buildSystemPrompt, GroqError, ApiMessage } from "@/lib/groq";
import { preprocessMath } from "@/lib/mathPreprocessor";

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export default function NoteDetailScreen() {
  const colors = useColors();
  const { settings } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const isWeb = Platform.OS === "web";

  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("General");
  const [editing, setEditing] = useState(isNew);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      getNotes().then((notes) => {
        const found = notes.find((n) => n.id === id);
        if (found) { setContent(found.content); setSubject(found.subject); }
      });
    }
  }, [id, isNew]);

  async function handleSave() {
    if (!content.trim()) { Alert.alert("Error", "Note cannot be empty."); return; }
    if (isNew) {
      await saveNote({ subject: subject || "General", content });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      await updateNote(id!, { content, subject });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    }
  }

  async function runAiAssist() {
    if (!aiPrompt.trim() || !content.trim()) return;
    setAiLoading(true);
    try {
      const sysPrompt = buildSystemPrompt(settings.aiLanguage, settings.tone);
      const msgs: ApiMessage[] = [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Note content:\n\n${content}\n\nInstruction: ${preprocessMath(aiPrompt)}` },
      ];
      const res = await groqChat(msgs);
      setContent(res);
      setEditing(true);
      setAiPrompt("");
    } catch (e) {
      Alert.alert("AI Error", e instanceof GroqError ? e.message : "Something went wrong.");
    } finally {
      setAiLoading(false);
    }
  }

  const styles = makeStyles(colors, insets, isWeb);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <TextInput
          style={styles.subjectInput}
          value={subject}
          onChangeText={setSubject}
          placeholder="Subject"
          placeholderTextColor={colors.mutedForeground}
        />
        <View style={styles.headerActions}>
          {!editing && (
            <>
              <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(content); Alert.alert("Copied!"); }} style={styles.iconBtn}>
                <Feather name="copy" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn}>
                <Feather name="edit-2" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
          {editing && (
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <TextInput
            style={[styles.editor, { fontSize: settings.fontSize }]}
            value={content}
            onChangeText={setContent}
            placeholder="Write your note here… (Markdown supported)"
            placeholderTextColor={colors.mutedForeground}
            multiline
            autoFocus={isNew}
            textAlignVertical="top"
          />
        ) : (
          <Text style={[styles.readContent, { fontSize: settings.fontSize }]}>{content || "Empty note."}</Text>
        )}
      </KeyboardAwareScrollView>

      {/* AI Assistant bar */}
      <View style={[styles.aiBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.aiBarInner}>
          <Feather name="zap" size={14} color={colors.primary} />
          <TextInput
            style={styles.aiInput}
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder='"Simplify", "Translate", "Add examples"…'
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="send"
            onSubmitEditing={runAiAssist}
          />
          <TouchableOpacity
            style={[styles.aiBtn, (!aiPrompt.trim() || aiLoading) && { opacity: 0.4 }]}
            onPress={runAiAssist}
            disabled={!aiPrompt.trim() || aiLoading}
          >
            {aiLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={15} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: any, insets: any, isWeb: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingTop: isWeb ? 67 : insets.top + 8, paddingBottom: 12,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    subjectInput: {
      flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 17,
      color: colors.foreground, padding: 0,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
    iconBtn: { padding: 6 },
    saveBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.primary, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
    editor: {
      fontFamily: "Inter_400Regular", color: colors.foreground,
      minHeight: 300, lineHeight: 26, textAlignVertical: "top",
    },
    readContent: {
      fontFamily: "Inter_400Regular", color: colors.foreground,
      lineHeight: 26,
    },
    aiBar: {
      backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
      paddingHorizontal: 12, paddingTop: 10,
    },
    aiBarInner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.muted, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
    },
    aiInput: {
      flex: 1, fontFamily: "Inter_400Regular", fontSize: 14,
      color: colors.foreground, padding: 0,
    },
    aiBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
  });
}
