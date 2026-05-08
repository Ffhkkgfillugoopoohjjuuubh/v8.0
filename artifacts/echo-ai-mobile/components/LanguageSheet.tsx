import React from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, TouchableWithoutFeedback, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  selected: string;
  languages: string[];
  onSelect: (lang: string) => void;
  onClose: () => void;
  colors: any;
}

export default function LanguageSheet({ visible, selected, languages, onSelect, onClose, colors }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.title, { color: colors.foreground }]}>AI Response & Voice Language</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        <FlatList
          data={languages}
          keyExtractor={(item) => item}
          numColumns={2}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          columnWrapperStyle={{ gap: 8 }}
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <TouchableOpacity
                style={[
                  styles.langItem,
                  { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.secondary : colors.background },
                  { flex: 1 },
                ]}
                onPress={() => onSelect(item)}
              >
                {isSelected && <Feather name="check" size={12} color={colors.primary} />}
                <Text style={[styles.langText, { color: isSelected ? colors.primary : colors.foreground }]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: "75%" },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 16 },
  langItem: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  langText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
