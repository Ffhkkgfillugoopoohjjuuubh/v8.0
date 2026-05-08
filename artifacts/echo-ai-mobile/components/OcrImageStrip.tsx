import React from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ActivityIndicator } from "react-native";
import type { OcrImage } from "@/app/(tabs)/index";

interface Props {
  images: OcrImage[];
  combinedContext: string;
  contextExpanded: boolean;
  onToggleContext: () => void;
  onRemove: (id: string) => void;
  onAddMore: () => void;
  onGenerateQuiz: () => void;
  maxImages: number;
  colors: any;
}

export default function OcrImageStrip({
  images, combinedContext, contextExpanded, onToggleContext,
  onRemove, onAddMore, onGenerateQuiz, maxImages, colors,
}: Props) {
  const anyDone = images.some((img) => img.status === "done");
  const anyRunning = images.some((img) => img.status === "reading");

  return (
    <View style={[styles.container, { borderBottomColor: colors.border, backgroundColor: colors.muted + "80" }]}>
      {/* Thumbnails */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {images.map((img) => (
          <View key={img.id} style={styles.thumbWrap}>
            <Image source={{ uri: img.uri }} style={[styles.thumb, { borderColor: colors.border }]} />
            {img.status === "reading" && (
              <View style={[styles.overlay, { borderRadius: 12 }]}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            {img.status === "error" && (
              <View style={[styles.overlay, { borderRadius: 12, backgroundColor: "rgba(239,68,68,0.6)" }]}>
                <Feather name="alert-circle" size={14} color="#fff" />
              </View>
            )}
            <TouchableOpacity
              style={[styles.removeBtn, { backgroundColor: colors.destructive }]}
              onPress={() => onRemove(img.id)}
            >
              <Feather name="x" size={9} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < maxImages && (
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.border }]}
            onPress={onAddMore}
          >
            <Feather name="plus" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Reading status */}
      {anyRunning && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Reading text from image…</Text>
        </View>
      )}

      {/* Extracted text toggle */}
      {anyDone && combinedContext ? (
        <View style={styles.contextSection}>
          <View style={styles.contextHeader}>
            <TouchableOpacity style={styles.toggleBtn} onPress={onToggleContext}>
              <Feather name={contextExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
              <Text style={[styles.toggleText, { color: colors.primary }]}>
                {contextExpanded ? "Hide" : "Show"} extracted text
              </Text>
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                ({combinedContext.length.toLocaleString()} chars)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onGenerateQuiz} style={[styles.quizBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="help-circle" size={13} color={colors.primary} />
              <Text style={[styles.quizBtnText, { color: colors.primary }]}>Quiz</Text>
            </TouchableOpacity>
          </View>
          {contextExpanded && (
            <View style={[styles.contextBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.contextText, { color: colors.foreground }]}>{combinedContext}</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: 1 },
  strip: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  thumbWrap: { position: "relative" },
  thumb: { width: 62, height: 62, borderRadius: 12, borderWidth: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  removeBtn: {
    position: "absolute", top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    width: 62, height: 62, borderRadius: 12, borderWidth: 2,
    borderStyle: "dashed", alignItems: "center", justifyContent: "center",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
  statusText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  contextSection: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  contextHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  toggleText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  charCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
  quizBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  quizBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  contextBox: { borderWidth: 1, borderRadius: 12, padding: 12, maxHeight: 130 },
  contextText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
});
