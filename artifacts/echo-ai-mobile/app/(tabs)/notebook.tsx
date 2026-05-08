import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { getNotes, deleteNote, Note } from "@/lib/storage";

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotebookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const isWeb = Platform.OS === "web";

  useFocusEffect(
    useCallback(() => {
      getNotes().then(setNotes);
    }, [])
  );

  function handleDelete(id: string) {
    Alert.alert("Delete Note", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteNote(id);
          setNotes((prev) => prev.filter((n) => n.id !== id));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }

  const styles = makeStyles(colors, insets, isWeb);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notebook</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push({ pathname: "/note-detail", params: { id: "new" } })}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        scrollEnabled={!!notes.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="book-open" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyText}>Save AI responses or create notes manually.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.noteCard}
            onPress={() => router.push({ pathname: "/note-detail", params: { id: item.id } })}
            activeOpacity={0.7}
          >
            <View style={styles.noteCardContent}>
              <View style={styles.noteCardLeft}>
                <View style={styles.subjectBadge}>
                  <Text style={styles.subjectText}>{item.subject}</Text>
                </View>
                <Text style={styles.notePreview} numberOfLines={2}>
                  {item.content.replace(/[#*`>\-]/g, "").trim()}
                </Text>
                <Text style={styles.noteDate}>{timeAgo(item.updatedAt)}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="trash-2" size={15} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function makeStyles(colors: any, insets: any, isWeb: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingTop: isWeb ? 67 : insets.top + 8, paddingBottom: 12,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: colors.foreground },
    newBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
    list: { padding: 16, gap: 12, paddingBottom: 100 },
    empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
    emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.mutedForeground },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.mutedForeground, textAlign: "center" },
    noteCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      overflow: "hidden",
    },
    noteCardContent: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
    noteCardLeft: { flex: 1, gap: 6 },
    subjectBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.secondary, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    subjectText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.primary },
    notePreview: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground, lineHeight: 20 },
    noteDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground },
    deleteBtn: { padding: 4 },
  });
}
