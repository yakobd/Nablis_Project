import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Timestamp } from "firebase/firestore";
import { serviceLabel } from "@nablis/shared/firebase";
import { FadeInView } from "./FadeInView";
import { themedStyles, themedColors } from "../theme";

interface Appointment {
  id: string;
  serviceType: string;
  status: string;
  date?: Timestamp | null;
  time?: string;
  note?: string;
}

interface AppointmentCardProps {
  appointment: Appointment;
  onReschedule?: () => void;
  onCancel?: () => void;
  isPast?: boolean;
}

const L = {
  navy:   "#1B2E6B",
  yellow: "#F5C518",
  light:  "#EEF1F8",
  grey:   "#9CA3AF",
  dark:   "#374151",
  border: "#E5E7EB",
  white:  "#FFFFFF",
  red:    "#FEF2F2",
  redText:"#DC2626",
};
const C = themedColors(L);

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: "#FEF9C3", text: "#92400E" },
  confirmed: { bg: "#DCFCE7", text: "#16A34A" },
  rejected:  { bg: "#FEF2F2", text: "#DC2626" },
  completed: { bg: "#F3F4F6", text: "#6B7280" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
};

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return "Date TBD";
  try {
    const d = ts.toDate();
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}
function fmtTime(ts?: Timestamp | null) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

export function AppointmentCard({ appointment, onReschedule, onCancel, isPast }: AppointmentCardProps) {
  const st = STATUS_STYLE[appointment.status] ?? STATUS_STYLE.pending;
  const time = appointment.time || fmtTime(appointment.date);

  return (
    <FadeInView style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-circle-outline" size={28} color={C.navy} />
        </View>
        <View style={styles.info}>
          <Text style={styles.service}>{serviceLabel(appointment.serviceType)}</Text>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={12} color={C.grey} />
            <Text style={styles.date}> {fmtDate(appointment.date)}</Text>
            {time ? (
              <>
                <Text style={styles.dot}> · </Text>
                <Ionicons name="time-outline" size={12} color={C.grey} />
                <Text style={styles.date}> {time}</Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.text }]}>
            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
          </Text>
        </View>
      </View>

      {appointment.note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Private Note</Text>
          <Text style={styles.noteText} numberOfLines={2}>{appointment.note}</Text>
        </View>
      ) : null}

      {!isPast && (
        <View style={styles.actions}>
          {onReschedule && (
            <TouchableOpacity style={styles.rescheduleBtn} onPress={onReschedule} activeOpacity={0.8}>
              <Text style={styles.rescheduleTxt}>Reschedule</Text>
            </TouchableOpacity>
          )}
          {onCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelTxt}>Cancel Session</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </FadeInView>
  );
}

const styles = themedStyles({
  card:         { backgroundColor: L.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: L.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  header:       { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  iconWrap:     { width: 44, height: 44, borderRadius: 12, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  info:         { flex: 1 },
  service:      { fontSize: 14, fontWeight: "700", color: L.navy, marginBottom: 4 },
  row:          { flexDirection: "row", alignItems: "center" },
  date:         { fontSize: 11, color: L.grey },
  dot:          { fontSize: 11, color: L.grey },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:    { fontSize: 10, fontWeight: "700" },
  noteBox:      { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, marginBottom: 12 },
  noteLabel:    { fontSize: 10, fontWeight: "700", color: L.grey, marginBottom: 3, textTransform: "uppercase" },
  noteText:     { fontSize: 12, color: L.dark },
  actions:      { flexDirection: "row", gap: 8 },
  rescheduleBtn:{ flex: 1, borderWidth: 1, borderColor: L.border, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  rescheduleTxt:{ fontSize: 12, fontWeight: "600", color: L.dark },
  cancelBtn:    { flex: 1, backgroundColor: L.red, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  cancelTxt:    { fontSize: 12, fontWeight: "600", color: L.redText },
});
