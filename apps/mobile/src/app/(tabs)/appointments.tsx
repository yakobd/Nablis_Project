import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, where, getDocs, documentId, Timestamp } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { decideAppointment } from '../../lib/appointments';
import {
  useAuth, useAvailability, notify, bookAppointment, closeAppointment, formatTime12,
  slotsForDate, isDayClosed, SERVICE_TYPES, SLOT_TIMES, serviceLabel, type ServiceType,
} from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { AppointmentCard } from "../../components/AppointmentCard";
import { BottomSheet } from "../../components/BottomSheet";
import { Avatar } from "../../components/Avatar";
import { SidebarDrawer } from "../../components/SidebarDrawer";
import { themedStyles, themedColors } from "../../theme";

const L = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg: "#F9FAFB",
};
const C = themedColors(L);

interface AppointmentDoc {
  id: string;
  serviceType: string;
  status: string;
  date?: Timestamp | null;
  time?: string;
  slotId?: string | null;
  privateNote?: string;
  note?: string;
  userId: string;
  memberId?: string;
  userName?: string;
  memberName?: string;
  createdAt?: Timestamp;
}

type MemberTab = "upcoming" | "past";
type AdminTab  = "pending" | "all" | "confirmed" | "rejected";

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    pending:   { bg: "#FEF9C3", text: "#92400E" },
    confirmed: { bg: "#DCFCE7", text: "#16A34A" },
    rejected:  { bg: "#FEF2F2", text: "#DC2626" },
    cancelled: { bg: "#F3F4F6", text: "#6B7280" },
  };
  const s = map[status] ?? { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeTxt, { color: s.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

// ─── Admin Appointments ───────────────────────────────────────────────────────
function AdminAppointments() {
  const insets = useSafeAreaInsets();
  const [appointments, setApts] = useState<AppointmentDoc[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<AdminTab>("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "appointments"));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppointmentDoc));
      all.sort((a, b) => {
        const at = a.createdAt?.toDate?.()?.getTime() ?? 0;
        const bt = b.createdAt?.toDate?.()?.getTime() ?? 0;
        return bt - at;
      });
      setApts(all);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const displayed = tab === "all"
    ? appointments
    : appointments.filter((a) => a.status === tab);

  const pendingCount = appointments.filter((a) => a.status === "pending").length;

  async function handleAction(id: string, status: "confirmed" | "rejected") {
    const apt = appointments.find((a) => a.id === id);
    if (!apt) return;
    setActionId(id);
    try {
      await decideAppointment(apt, status);
      Alert.alert("Done", status === "confirmed" ? "Appointment confirmed." : "Appointment rejected.");
      await load();
    } catch {
      Alert.alert("Error", "Failed to update appointment.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={22} color={C.navy} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.titleBold}>All Appointments</Text>
        </View>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={C.navy} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {(["pending", "all", "confirmed", "rejected"] as AdminTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChip, tab === t && styles.filterChipActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.filterChipTxt, tab === t && styles.filterChipTxtActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={40} color={C.grey} style={{ opacity: 0.4 }} />
          <Text style={styles.emptyText}>No {tab} appointments</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {displayed.map((a) => (
            <View key={a.id} style={styles.adminCard}>
              <View style={styles.adminCardTop}>
                <Avatar name={a.memberName || a.userName || "M"} size={32} />
                <View style={styles.adminCardInfo}>
                  <Text style={styles.adminCardName}>{a.memberName || a.userName || "Member"}</Text>
                  <Text style={styles.adminCardType}>{serviceLabel(a.serviceType)}</Text>
                </View>
                <StatusBadge status={a.status} />
              </View>
              {a.date && (
                <Text style={styles.adminCardDate}>
                  {fmtDate(a.date)}{a.time ? ` · ${a.time}` : ""}
                </Text>
              )}
              {(a.privateNote || a.note) ? (
                <Text style={styles.adminCardNote} numberOfLines={2}>{a.privateNote || a.note}</Text>
              ) : null}
              {a.status === "pending" && (
                <View style={styles.adminCardActions}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, !!actionId && { opacity: 0.6 }]}
                    onPress={() => handleAction(a.id, "confirmed")}
                    disabled={!!actionId}
                  >
                    {actionId === a.id
                      ? <ActivityIndicator size="small" color={C.white} />
                      : (
                        <>
                          <Ionicons name="checkmark" size={14} color={C.white} />
                          <Text style={styles.confirmBtnTxt}> Approve</Text>
                        </>
                      )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectBtn, !!actionId && { opacity: 0.6 }]}
                    onPress={() => handleAction(a.id, "rejected")}
                    disabled={!!actionId}
                  >
                    <Ionicons name="close" size={14} color="#DC2626" />
                    <Text style={styles.rejectBtnTxt}> Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} currentRoute="/(tabs)/appointments" />
    </View>
  );
}

// ─── Member Appointments ──────────────────────────────────────────────────────
function MemberAppointments() {
  const { user }    = useAuth();
  const insets      = useSafeAreaInsets();
  const [tab, setTab]               = useState<MemberTab>("upcoming");
  const [appointments, setApts]     = useState<AppointmentDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showBook, setShowBook]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [service,    setService]    = useState<ServiceType>(SERVICE_TYPES[0].value);
  const [dateStr,    setDateStr]    = useState("");
  const [timeStr,    setTimeStr]    = useState("");
  const [noteText,   setNoteText]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const { availability } = useAvailability();

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim()) && !isNaN(new Date(`${dateStr.trim()}T00:00`).getTime());
  const daySlots = validDate ? slotsForDate(availability, dateStr.trim()) : [...SLOT_TIMES];
  const dayClosed = validDate && isDayClosed(availability, dateStr.trim());
  const customAllowed = availability.allowCustomTimes && !dayClosed;

  // Slots already booked on the chosen date (appointmentSlots ids are {date}_{HHMM}), shown as taken.
  const [taken, setTaken] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!validDate) { setTaken(new Set()); return; }
    const iso = dateStr.trim();
    getDocs(query(collection(db, "appointmentSlots"), where(documentId(), ">=", `${iso}_`), where(documentId(), "<=", `${iso}_~`)))
      .then((snap) => setTaken(new Set(snap.docs.map((d) => d.id))))
      .catch(() => setTaken(new Set()));
  }, [dateStr, validDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const isTaken = (t: string) => taken.has(`${dateStr.trim()}_${t.replace(":", "")}`);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      // memberId is set by both web and mobile bookings (userId only by mobile).
      const q = query(collection(db, "appointments"), where("memberId", "==", user.id));
      const snap = await getDocs(q);
      const apts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppointmentDoc));
      apts.sort((a, b) => {
        const at = a.date?.toDate?.()?.getTime() ?? 0;
        const bt = b.date?.toDate?.()?.getTime() ?? 0;
        return bt - at;
      });
      setApts(apts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user]);

  const now = new Date();
  const upcoming = appointments.filter((a) => {
    if (!a.date) return a.status !== "completed" && a.status !== "cancelled";
    return a.date.toDate() >= now && a.status !== "cancelled";
  });
  const past = appointments.filter((a) => {
    if (!a.date) return a.status === "completed" || a.status === "cancelled";
    return a.date.toDate() < now || a.status === "cancelled";
  });

  async function handleBook() {
    if (!user || !service) return;
    const isoDate = dateStr.trim();
    const when = new Date(`${isoDate}T${timeStr || "00:00"}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || isNaN(when.getTime())) {
      Alert.alert("Invalid date", "Please enter the date as YYYY-MM-DD.");
      return;
    }
    if (dayClosed) {
      Alert.alert("Not available", "The Father is not available on this day. Please choose another date.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      Alert.alert("Choose a time", customMode ? "Enter the time as HH:MM (e.g. 14:30)." : "Please pick one of the available times.");
      return;
    }
    if (when <= new Date()) {
      Alert.alert("Invalid time", "Please choose a time in the future.");
      return;
    }
    setSubmitting(true);
    try {
      await bookAppointment({
        memberId:    user.id,
        memberName:  user.displayName || user.email,
        serviceType: service,
        isoDate,
        time:        timeStr,
        privateNote: noteText,
        customTime:  customMode,
      });
      const fathers = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
      await notify(fathers.docs.map((d) => ({
        userId: d.id, type: "appointment_request", link: "/appointment",
        title: "New appointment request",
        description: `${user.displayName || "A member"} requested a ${serviceLabel(service)} session on ${isoDate} at ${formatTime12(timeStr)}.`,
      })));
      setShowBook(false);
      setService(SERVICE_TYPES[0].value);
      setDateStr(""); setTimeStr(""); setNoteText("");
      Alert.alert("Booking Request Sent!", "Please wait for confirmation. Peace be with you.");
      load();
    } catch {
      Alert.alert("Time not available", "That time was just taken. Please choose another time.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(apt: AppointmentDoc) {
    await closeAppointment(apt, "cancelled");
    load();
  }

  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={22} color={C.navy} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>My Spiritual</Text>
          <Text style={styles.titleBold}>Appointments</Text>
        </View>
        <TouchableOpacity style={styles.bookBtn} onPress={() => setShowBook(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={C.navy} />
          <Text style={styles.bookTxt}>Book Session</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(["upcoming", "past"] as MemberTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t === "upcoming" ? "Upcoming" : "Past Sessions"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={40} color={C.grey} style={{ opacity: 0.4 }} />
          <Text style={styles.emptyText}>
            {tab === "upcoming" ? "No upcoming appointments." : "No past sessions."}
          </Text>
          {tab === "upcoming" && (
            <TouchableOpacity style={styles.emptyBookBtn} onPress={() => setShowBook(true)}>
              <Text style={styles.emptyBookTxt}>Book New Session</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {displayed.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              isPast={tab === "past"}
              onCancel={tab === "upcoming" ? () => handleCancel(a) : undefined}
              onReschedule={tab === "upcoming" ? () => setShowBook(true) : undefined}
            />
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} currentRoute="/(tabs)/appointments" />
      <BottomSheet visible={showBook} onClose={() => setShowBook(false)} height={560}>
        <Text style={styles.sheetTitle}>Book New Session</Text>
        <Text style={styles.sheetSub}>Schedule a spiritual appointment</Text>

        <Text style={styles.fieldLabel}>Service Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.serviceRow}>
          {SERVICE_TYPES.map((s) => (
            <TouchableOpacity
              key={s.value}
              style={[styles.serviceChip, service === s.value && styles.serviceChipActive]}
              onPress={() => setService(s.value)}
            >
              <Text style={[styles.serviceChipTxt, service === s.value && styles.serviceChipTxtActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Date</Text>
        <TextInput
          style={styles.input}
          value={dateStr}
          onChangeText={setDateStr}
          placeholder="YYYY-MM-DD  (e.g. 2025-06-15)"
          placeholderTextColor={C.grey}
        />

        <Text style={styles.fieldLabel}>Time</Text>
        {dayClosed ? (
          <Text style={styles.closedTxt}>The Father is not available on this day. Please choose another date.</Text>
        ) : (
          <View style={styles.slotGrid}>
            {daySlots.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.serviceChip, styles.slotChip, !customMode && timeStr === t && styles.serviceChipActive, isTaken(t) && styles.slotTaken]}
                onPress={() => { setCustomMode(false); setTimeStr(t); }}
                disabled={isTaken(t)}
              >
                <Text style={[styles.serviceChipTxt, !customMode && timeStr === t && styles.serviceChipTxtActive, isTaken(t) && styles.slotTakenTxt]}>{formatTime12(t)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {customAllowed && (
          <>
            <TouchableOpacity onPress={() => { setCustomMode((v) => !v); setTimeStr(""); }}>
              <Text style={styles.customToggle}>{customMode ? "Use the listed times" : "Need a different time?"}</Text>
            </TouchableOpacity>
            {customMode && (
              <>
                <TextInput
                  style={styles.input}
                  value={timeStr}
                  onChangeText={setTimeStr}
                  placeholder="HH:MM  (e.g. 14:30)"
                  placeholderTextColor={C.grey}
                />
                <Text style={styles.customHint}>{"Sent as a request — the Father will confirm if he's available."}</Text>
              </>
            )}
          </>
        )}

        <Text style={styles.fieldLabel}>Private Note (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Add any relevant details…"
          placeholderTextColor={C.grey}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitDisabled]}
          onPress={handleBook}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={C.navy} size="small" />
            : <Text style={styles.submitTxt}>Request Appointment</Text>}
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function AppointmentsScreen() {
  const { role } = useAuth();
  if (role === "admin" || role === "super_admin") return <AdminAppointments />;
  return <MemberAppointments />;
}

const styles = themedStyles({
  root:           { flex: 1, backgroundColor: "#F9FAFB" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  hamburgerBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: L.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border },
  hamburgerIcon:  { fontSize: 22, color: L.navy, lineHeight: 26 },
  title:          { fontSize: 14, color: L.grey, fontWeight: "500" },
  titleBold:      { fontSize: 20, fontWeight: "800", color: L.navy },
  bookBtn:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: L.yellow, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  bookTxt:        { fontSize: 13, fontWeight: "700", color: L.navy },
  refreshIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: L.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border },

  // Admin filter
  filterScroll:   { maxHeight: 48, marginBottom: 8 },
  filterContent:  { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterChip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: L.white, borderWidth: 1, borderColor: L.border },
  filterChipActive:{ backgroundColor: L.navy, borderColor: L.navy },
  filterChipTxt:  { fontSize: 12, fontWeight: "600", color: L.grey },
  filterChipTxtActive:{ color: L.white },

  // Admin card
  adminCard:       { backgroundColor: L.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: L.border },
  adminCardTop:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  adminCardInfo:   { flex: 1 },
  adminCardName:   { fontSize: 13, fontWeight: "700", color: L.dark },
  adminCardType:   { fontSize: 11, color: L.grey },
  adminCardDate:   { fontSize: 12, color: L.navy, marginBottom: 4 },
  adminCardNote:   { fontSize: 12, color: L.grey, fontStyle: "italic", marginBottom: 8 },
  adminCardActions:{ flexDirection: "row", gap: 10 },
  confirmBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#16A34A", borderRadius: 10, paddingVertical: 8 },
  confirmBtnTxt:   { color: L.white, fontSize: 13, fontWeight: "700" },
  rejectBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FEF2F2", borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#FECACA" },
  rejectBtnTxt:    { color: "#DC2626", fontSize: 13, fontWeight: "700" },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTxt:        { fontSize: 10, fontWeight: "700" },

  // Shared
  tabs:            { flexDirection: "row", marginHorizontal: 16, backgroundColor: L.white, borderRadius: 12, borderWidth: 1, borderColor: L.border, padding: 4, marginBottom: 16 },
  tabBtn:          { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9 },
  tabActive:       { backgroundColor: L.navy },
  tabTxt:          { fontSize: 13, fontWeight: "600", color: L.grey },
  tabTxtActive:    { color: L.white },
  list:            { paddingHorizontal: 16 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText:       { fontSize: 14, color: L.grey, textAlign: "center" },
  emptyBookBtn:    { backgroundColor: L.navy, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBookTxt:    { color: L.white, fontSize: 13, fontWeight: "700" },
  sheetTitle:      { fontSize: 18, fontWeight: "800", color: L.navy, marginBottom: 4 },
  sheetSub:        { fontSize: 13, color: L.grey, marginBottom: 20 },
  fieldLabel:      { fontSize: 12, fontWeight: "700", color: L.dark, marginBottom: 8, marginTop: 4 },
  serviceRow:      { marginBottom: 16 },
  serviceChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: L.border, marginRight: 8, backgroundColor: L.white },
  serviceChipActive:{ backgroundColor: L.navy, borderColor: L.navy },
  serviceChipTxt:  { fontSize: 12, fontWeight: "600", color: L.dark },
  serviceChipTxtActive:{ color: L.white },
  slotGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  slotTaken:       { opacity: 0.4 },
  slotTakenTxt:    { textDecorationLine: "line-through" },
  slotChip:        { marginRight: 0, width: "31%", alignItems: "center" },
  closedTxt:       { fontSize: 13, color: "#B45309", marginBottom: 12 },
  customToggle:    { fontSize: 13, fontWeight: "600", color: L.navy, marginBottom: 8 },
  customHint:      { fontSize: 11, color: L.grey, marginTop: -6, marginBottom: 12 },
  input:           { borderWidth: 1, borderColor: L.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: L.dark, backgroundColor: L.white, marginBottom: 14 },
  textarea:        { height: 80, textAlignVertical: "top" },
  submitBtn:       { backgroundColor: L.yellow, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitDisabled:  { opacity: 0.6 },
  submitTxt:       { fontSize: 15, fontWeight: "700", color: L.navy },
});
