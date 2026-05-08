import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { groqChat, GroqError, ApiMessage } from "@/lib/groq";
import { preprocessMath } from "@/lib/mathPreprocessor";
import { Tone } from "@/lib/groq";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

type Phase = "loading" | "quiz" | "results";

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ context: string; language: string; tone: Tone }>();
  const isWeb = Platform.OS === "web";

  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    generateQuiz();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function generateQuiz() {
    try {
      const context = preprocessMath(params.context ?? "");
      const msgs: ApiMessage[] = [
        { role: "system", content: "You are a quiz generator. Return only valid JSON." },
        {
          role: "user",
          content: `Generate 5 multiple-choice questions from this content. Language: ${params.language ?? "English"}.\n\nContent:\n${context}\n\nReturn ONLY a JSON array:\n[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]`,
        },
      ];
      const res = await groqChat(msgs);
      const match = res.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON");
      const parsed: QuizQuestion[] = JSON.parse(match[0]);
      setQuestions(parsed);
      setAnswers(new Array(parsed.length).fill(null));
      setPhase("quiz");
      // Start timer
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setPhase("results");
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch (e) {
      Alert.alert("Quiz Error", e instanceof GroqError ? e.message : "Failed to generate quiz.", [
        { text: "Go Back", onPress: () => router.back() },
      ]);
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function handleSelect(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    const newAnswers = [...answers];
    newAnswers[current] = idx;
    setAnswers(newAnswers);
  }

  function handleNext() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("results");
    }
  }

  const score = answers.filter((a, i) => a === questions[i]?.correctIndex).length;

  const styles = makeStyles(colors, insets, isWeb);

  if (phase === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Generating quiz…</Text>
      </View>
    );
  }

  if (phase === "results") {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quiz Results</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 80 }}>
          <View style={[styles.scoreCard, { backgroundColor: score >= Math.ceil(questions.length / 2) ? colors.success : colors.destructive }]}>
            <Text style={styles.scoreText}>{score}/{questions.length}</Text>
            <Text style={styles.scoreLabel}>{score >= Math.ceil(questions.length / 2) ? "Great job! 🎉" : "Keep practising!"}</Text>
          </View>
          {questions.map((q, i) => (
            <View key={i} style={styles.resultCard}>
              <Text style={styles.resultQ}>{i + 1}. {q.question}</Text>
              {q.options.map((opt, j) => (
                <View key={j} style={[
                  styles.resultOption,
                  j === q.correctIndex && { backgroundColor: colors.success + "22", borderColor: colors.success },
                  answers[i] === j && j !== q.correctIndex && { backgroundColor: colors.destructive + "22", borderColor: colors.destructive },
                ]}>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground }}>{opt}</Text>
                  {j === q.correctIndex && <Feather name="check-circle" size={15} color={colors.success} />}
                  {answers[i] === j && j !== q.correctIndex && <Feather name="x-circle" size={15} color={colors.destructive} />}
                </View>
              ))}
              <Text style={styles.explanation}>{q.explanation}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const q = questions[current];
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); router.back(); }} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Question {current + 1}/{questions.length}</Text>
        <View style={styles.timer}>
          <Feather name="clock" size={14} color={timeLeft < 60 ? colors.destructive : colors.primary} />
          <Text style={[styles.timerText, timeLeft < 60 && { color: colors.destructive }]}>{formatTime(timeLeft)}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((current + 1) / questions.length) * 100}%` as any }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={styles.question}>{q.question}</Text>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isChosen = selected === i;
          let bg = colors.card;
          let border = colors.border;
          if (selected !== null) {
            if (isCorrect) { bg = colors.success + "22"; border = colors.success; }
            else if (isChosen) { bg = colors.destructive + "22"; border = colors.destructive; }
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleSelect(i)}
              disabled={selected !== null}
            >
              <Text style={styles.optionLetter}>{String.fromCharCode(65 + i)}</Text>
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
        {selected !== null && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationLabel}>Explanation</Text>
            <Text style={styles.explanationText}>{q.explanation}</Text>
          </View>
        )}
      </ScrollView>

      {selected !== null && (
        <View style={[styles.nextBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>{current < questions.length - 1 ? "Next Question" : "See Results"}</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: any, insets: any, isWeb: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    loadingText: { fontFamily: "Inter_500Medium", fontSize: 16, color: colors.mutedForeground },
    header: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 16, paddingTop: isWeb ? 67 : insets.top + 8, paddingBottom: 12,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 17, color: colors.foreground },
    timer: { flexDirection: "row", alignItems: "center", gap: 4 },
    timerText: { fontFamily: "Inter_700Bold", fontSize: 16, color: colors.primary },
    progressBar: { height: 4, backgroundColor: colors.border },
    progressFill: { height: 4, backgroundColor: colors.primary },
    question: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: colors.foreground, lineHeight: 26 },
    option: {
      flexDirection: "row", alignItems: "center", gap: 12,
      borderWidth: 1.5, borderRadius: 14,
      padding: 14,
    },
    optionLetter: {
      fontFamily: "Inter_700Bold", fontSize: 14, color: colors.primary,
      width: 24, textAlign: "center",
    },
    optionText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: colors.foreground },
    explanationBox: {
      backgroundColor: colors.secondary, borderRadius: 14, padding: 14, gap: 6,
    },
    explanationLabel: { fontFamily: "Inter_700Bold", fontSize: 12, color: colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
    explanationText: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground, lineHeight: 20 },
    nextBar: {
      paddingHorizontal: 20, paddingTop: 12,
      backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    },
    nextBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
    },
    nextBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
    scoreCard: { borderRadius: 20, padding: 28, alignItems: "center", gap: 8 },
    scoreText: { fontFamily: "Inter_700Bold", fontSize: 48, color: "#fff" },
    scoreLabel: { fontFamily: "Inter_500Medium", fontSize: 18, color: "#fff" },
    resultCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },
    resultQ: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: colors.foreground, lineHeight: 22 },
    resultOption: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    explanation: { fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, lineHeight: 19, fontStyle: "italic" },
  });
}
