import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type PrayerStatus = "completed" | "upcoming" | "scheduled";

interface PrayerCardProps {
  title: string;
  time: string;
  prayerText: string;
  status: PrayerStatus;
  onPress: () => void;
  loading?: boolean;
}

const C = {
  navy:   "#1B2E6B",
  yellow: "#F5C518",
  grey:   "#9CA3AF",
  dark:   "#374151",
  border: "#E5E7EB",
  white:  "#FFFFFF",
  light:  "#F9FAFB",
};

const STATUS_CONFIG: Record<PrayerStatus, { label: string; bg: string; text: string }> = {
  completed: { label: "COMPLETED",  bg: "#DCFCE7", text: "#16A34A" },
  upcoming:  { label: "UP NEXT",    bg: "#FEF9C3", text: "#92400E" },
  scheduled: { label: "SCHEDULED",  bg: "#F3F4F6", text: "#6B7280" },
};

export function PrayerCard({ title, time, prayerText, status, onPress, loading }: PrayerCardProps) {
  const cfg = STATUS_CONFIG[status];
  const isCompleted = status === "completed";
  const isScheduled = status === "scheduled";

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, isScheduled && styles.titleMuted]}>{title}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={[styles.prayerText, isScheduled && styles.textMuted]} numberOfLines={2}>
        {prayerText}
      </Text>
      <TouchableOpacity
        style={[
          styles.btn,
          isCompleted && styles.btnCompleted,
          isScheduled && styles.btnScheduled,
        ]}
        onPress={onPress}
        disabled={isCompleted || isScheduled || loading}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.btnText,
          isCompleted && styles.btnTextCompleted,
          isScheduled && styles.btnTextScheduled,
        ]}>
          {isCompleted ? "✓ Prayed" : "Mark as Prayed"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card:           { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardCompleted:  { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  header:         { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  title:          { fontSize: 14, fontWeight: "700", color: C.navy, marginBottom: 2 },
  titleMuted:     { color: C.grey },
  time:           { fontSize: 11, color: C.grey },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:      { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  prayerText:     { fontSize: 13, color: C.dark, lineHeight: 20, marginBottom: 14 },
  textMuted:      { color: C.grey },
  btn:            { backgroundColor: C.navy, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnCompleted:   { backgroundColor: "#D1FAE5" },
  btnScheduled:   { backgroundColor: C.light },
  btnText:        { color: C.white, fontSize: 13, fontWeight: "700" },
  btnTextCompleted: { color: "#16A34A" },
  btnTextScheduled: { color: C.grey },
});
