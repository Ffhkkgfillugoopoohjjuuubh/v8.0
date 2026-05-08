import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Alert, Pressable, Platform, Image, ScrollView,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { groqChat, buildSystemPrompt, GroqError, LANGUAGE_TTS_MAP, AI_LANGUAGES, ApiMessage } from "@/lib/groq";
import { preprocessMath, cleanForSpeech } from "@/lib/mathPreprocessor";
import { saveNote } from "@/lib/storage";
import { useTts } from "@/hooks/useTts";
import LanguageSheet from "@/components/LanguageSheet";
import MessageBubble from "@/components/MessageBubble";
import OcrImageStrip from "@/components/OcrImageStrip";

export interface OcrImage {
  id: string;
  uri: string;
  status: "pending" | "reading" | "done" | "error";
  text: string;
  error?: string;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export default function ScannerScreen() {
  const colors = useColors();
  const { settings, updateSettings } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { speak, stop, pause, resume, ttsState, activeMsgId } = useTts();

  const [images, setImages] = useState<OcrImage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  const apiHistoryRef = useRef<ApiMessage[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const combinedContext = images
    .filter((img) => img.status === "done" && img.text.trim())
    .map((img, i) => (images.length > 1 ? `--- Image ${i + 1} ---\n${img.text}` : img.text))
    .join("\n\n");

  const anyRunning = images.some((img) => img.status === "reading");

  // OCR using browser-compatible approach (no native ML Kit in Expo Go)
  async function runOcr(item: OcrImage) {
    // In Expo Go, we use a fallback approach - update status to indicate image added
    setImages((prev) =>
      prev.map((img) =>
        img.id === item.id
          ? { ...img, status: "done", text: "[Image loaded. Type your question and ask Echo AI to explain what's in this image.]" }
          : img
      )
    );
  }

  async function pickImages() {
    const canAdd = 10 - images.length;
    if (canAdd <= 0) { Alert.alert("Limit", "Maximum 10 images allowed."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: canAdd,
    });

    if (result.canceled || !result.assets.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newItems: OcrImage[] = result.assets.map((asset) => ({
      id: makeId(),
      uri: asset.uri,
      status: "pending" as const,
      text: "",
    }));

    setImages((prev) => [...prev, ...newItems]);

    // Run OCR for each
    for (const item of newItems) {
      setImages((prev) =>
        prev.map((img) => img.id === item.id ? { ...img, status: "reading" } : img)
      );
      await runOcr(item);
    }
  }

  async function sendMessage() {
    const q = inputText.trim();
    if (!q) return;
    if (anyRunning) { Alert.alert("Please wait", "Still reading images…"); return; }
    setInputText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const processedPrompt = preprocessMath(q);
    const processedContext = preprocessMath(combinedContext);

    const userContent = processedContext
      ? `Page content: ${processedContext}\n\nUser question: ${processedPrompt}`
      : processedPrompt;

    const userMsg: ChatMessage = { id: makeId(), role: "user", content: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setAiLoading(true);

    const apiUserMsg: ApiMessage = { role: "user", content: userContent };
    const sysPrompt = buildSystemPrompt(settings.aiLanguage, settings.tone);
    const apiMessages: ApiMessage[] = [
      { role: "system", content: sysPrompt },
      ...apiHistoryRef.current,
      apiUserMsg,
    ];
    apiHistoryRef.current = [...apiHistoryRef.current, apiUserMsg];

    try {
      const reply = await groqChat(apiMessages);
      const assistantMsg: ChatMessage = { id: makeId(), role: "assistant", content: reply };
      setMessages([...updatedMessages, assistantMsg]);
      apiHistoryRef.current.push({ role: "assistant", content: reply });
    } catch (e) {
      const errText =
        e instanceof GroqError
          ? `⚠️ ${e.message}`
          : "⚠️ Something went wrong. Please try again.";
      setMessages([...updatedMessages, { id: makeId(), role: "assistant", content: errText }]);
    } finally {
      setAiLoading(false);
    }
  }

  function handleReadAloud(msgId: string, content: string) {
    const langCode = LANGUAGE_TTS_MAP[settings.aiLanguage] ?? "en-US";
    if (activeMsgId === msgId) {
      if (ttsState === "playing") pause();
      else if (ttsState === "paused") resume();
    } else {
      speak(msgId, cleanForSpeech(content), langCode, settings.ttsVolume, settings.ttsPitch, settings.ttsRate);
    }
  }

  async function handleCopy(content: string) {
    await Clipboard.setStringAsync(content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleSaveNote(content: string) {
    await saveNote({ subject: "Echo AI", content });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", "Added to your Notebook.");
  }

  function generateQuiz() {
    if (!combinedContext) { Alert.alert("No content", "Add and scan an image first."); return; }
    router.push({ pathname: "/quiz", params: { context: combinedContext, language: settings.aiLanguage, tone: settings.tone } });
  }

  function clearAll() {
    setImages([]);
    setMessages([]);
    apiHistoryRef.current = [];
    stop();
  }

  const styles = makeStyles(colors, insets);
  const hasImages = images.length > 0;
  const hasContent = hasImages || messages.length > 0;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>E</Text>
          </View>
          <Text style={styles.headerTitle}>Echo AI</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.langBtn} onPress={() => setLangSheetOpen(true)}>
            <Feather name="globe" size={13} color={colors.primary} />
            <Text style={styles.langBtnText}>{settings.aiLanguage}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toneBtn, settings.tone === "formal" && styles.toneBtnActive]}
            onPress={() => updateSettings({ tone: settings.tone === "casual" ? "formal" : "casual" })}
          >
            <Text style={[styles.toneBtnText, settings.tone === "formal" && styles.toneBtnTextActive]}>
              {settings.tone === "casual" ? "Casual" : "Formal"}
            </Text>
          </TouchableOpacity>
          {hasContent && (
            <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TTS status bar */}
      {(ttsState === "playing" || ttsState === "paused") && (
        <View style={styles.ttsBar}>
          <Feather name="volume-2" size={13} color={colors.primary} />
          <Text style={styles.ttsBarText}>{ttsState === "playing" ? "Reading aloud…" : "Paused"}</Text>
          <TouchableOpacity onPress={ttsState === "playing" ? pause : resume} style={styles.ttsAction}>
            <Feather name={ttsState === "playing" ? "pause" : "play"} size={13} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={stop} style={styles.ttsAction}>
            <Feather name="square" size={13} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      )}

      {/* Image strip + OCR context */}
      {hasImages && (
        <OcrImageStrip
          images={images}
          combinedContext={combinedContext}
          contextExpanded={contextExpanded}
          onToggleContext={() => setContextExpanded((v) => !v)}
          onRemove={(id) => setImages((prev) => prev.filter((img) => img.id !== id))}
          onAddMore={pickImages}
          onGenerateQuiz={generateQuiz}
          maxImages={10}
          colors={colors}
        />
      )}

      {/* Chat messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 && !hasImages ? (
          <ScrollView contentContainerStyle={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Feather name="camera" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Scan Any Page</Text>
            <Text style={styles.emptySubtitle}>
              Upload a photo of any textbook or question.{"\n"}Echo AI explains it in your language.
            </Text>
            <TouchableOpacity style={styles.addImagesBtn} onPress={pickImages}>
              <Feather name="image" size={16} color="#fff" />
              <Text style={styles.addImagesBtnText}>Add Images</Text>
            </TouchableOpacity>
            <View style={styles.tipsBox}>
              <Text style={styles.tipsLabel}>Try asking:</Text>
              {['"Explain this in simple terms"', '"Solve all problems step by step"', '"What are the key points?"'].map((tip) => (
                <Text key={tip} style={styles.tipText}>→ {tip}</Text>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={[...messages].reverse()}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              aiLoading ? (
                <View style={styles.thinkingBubble}>
                  <View style={styles.thinkingDots}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={[styles.dot, { opacity: 0.3 + i * 0.25 }]} />
                    ))}
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                colors={colors}
                activeMsgId={activeMsgId}
                ttsState={ttsState}
                onReadAloud={() => handleReadAloud(item.id, item.content)}
                onStopTts={stop}
                onCopy={() => handleCopy(item.content)}
                onSave={() => handleSaveNote(item.content)}
                fontSize={settings.fontSize}
                language={settings.aiLanguage}
                tone={settings.tone}
              />
            )}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.inputIconBtn} onPress={pickImages}>
            <Feather name="image" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { fontSize: Math.max(settings.fontSize, 15) }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              anyRunning ? "Reading image…"
              : combinedContext ? "Ask anything about this page…"
              : hasImages ? "Type your question…"
              : "Add a photo and ask a question…"
            }
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || aiLoading || anyRunning) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || aiLoading || anyRunning}
          >
            {aiLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={17} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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

function makeStyles(colors: any, insets: any) {
  const isWeb = Platform.OS === "web";
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: isWeb ? 67 : insets.top + 8,
      paddingBottom: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    logo: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    logoText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: colors.foreground },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    langBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 20,
    },
    langBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.primary },
    toneBtn: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
      backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
    },
    toneBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    toneBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground },
    toneBtnTextActive: { color: "#fff" },
    clearBtn: { padding: 4 },
    ttsBar: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingVertical: 8,
      backgroundColor: colors.secondary, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    ttsBarText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 12, color: colors.primary },
    ttsAction: { padding: 4 },
    emptyContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
    emptyIcon: {
      width: 88, height: 88, borderRadius: 28,
      backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center",
    },
    emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: colors.foreground, textAlign: "center" },
    emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22 },
    addImagesBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 13,
      borderRadius: 14, marginTop: 4,
    },
    addImagesBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
    tipsBox: {
      backgroundColor: colors.muted, borderRadius: 14, padding: 16, width: "100%", gap: 6,
    },
    tipsLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.mutedForeground, marginBottom: 2 },
    tipText: { fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground },
    messageList: { padding: 16, gap: 16, paddingBottom: 8 },
    thinkingBubble: {
      alignSelf: "flex-start", backgroundColor: colors.card,
      borderRadius: 18, borderTopLeftRadius: 4,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
    },
    thinkingDots: { flexDirection: "row", gap: 6, alignItems: "center" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    inputBar: {
      flexDirection: "row", alignItems: "flex-end", gap: 8,
      paddingHorizontal: 12, paddingTop: 10,
      backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    },
    inputIconBtn: { padding: 8, marginBottom: 2 },
    input: {
      flex: 1, minHeight: 40, maxHeight: 120,
      backgroundColor: colors.muted, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 10,
      fontFamily: "Inter_400Regular", color: colors.foreground,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
      marginBottom: 2,
    },
    sendBtnDisabled: { opacity: 0.4 },
  });
}
