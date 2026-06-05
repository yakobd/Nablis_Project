import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useAuth } from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { AppointmentCard } from "../../components/AppointmentCard";
import { BottomSheet } from "../../components/BottomSheet";
import { Avatar } from "../../components/Avatar";
import { SidebarDrawer } from "../../components/SidebarDrawer";

const C = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg: "#F9FAFB",
};

const SERVICE_TYPES = [
  "Confession", "Spiritual Counseling", "Group Bible Study",
  "Youth Guidance", "Prayer Session", "Other",
];

interface AppointmentDoc {
  id: string;
  serviceType: string;
  status: string;
  date?: Timestamp | null;
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
    setActionId(id);
    try {
      await updateDoc(doc(db, "appointments", id), {
        status,
        notified:  true,
        updatedAt: serverTimestamp(),
      });
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
                  <Text style={styles.adminCardType}>{a.serviceType}</Text>
                </View>
                <StatusBadge status={a.status} />
              </View>
              {a.date && (
                <Text style={styles.adminCardDate}>
                  {fmtDate(a.date)}
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

  const [service,    setService]    = useState(SERVICE_TYPES[0]);
  const [dateStr,    setDateStr]    = useState("");
  const [timeStr,    setTimeStr]    = useState("");
  const [noteText,   setNoteText]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, "appointments"), where("userId", "==", user.id));
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
    setSubmitting(true);
    try {
      let dateTs: Timestamp | null = null;
      if (dateStr && timeStr) {
        const combined = new Date(`${dateStr}T${timeStr}`);
        if (!isNaN(combined.getTime())) dateTs = Timestamp.fromDate(combined);
      } else if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) dateTs = Timestamp.fromDate(d);
      }
      await addDoc(collection(db, "appointments"), {
        userId:      user.id,
        memberId:    user.id,
        userName:    user.displayName || user.email,
        memberName:  user.displayName || user.email,
        serviceType: service,
        date:        dateTs,
        privateNote: noteText.trim() || null,
        status:      "pending",
        createdAt:   serverTimestamp(),
      });
      setShowBook(false);
      setService(SERVICE_TYPES[0]);
      setDateStr(""); setTimeStr(""); setNoteText("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    await updateDoc(doc(db, "appointments", id), { status: "cancelled" });
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
              onCancel={tab === "upcoming" ? () => handleCancel(a.id) : undefined}
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
              key={s}
              style={[styles.serviceChip, service === s && styles.serviceChipActive]}
              onPress={() => setService(s)}
            >
              <Text style={[styles.serviceChipTxt, service === s && styles.serviceChipTxtActive]}>{s}</Text>
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
        <TextInput
          style={styles.input}
          value={timeStr}
          onChangeText={setTimeStr}
          placeholder="HH:MM  (e.g. 10:00)"
          placeholderTextColor={C.grey}
        />

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

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: "#F9FAFB" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  hamburgerBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  hamburgerIcon:  { fontSize: 22, color: C.navy, lineHeight: 26 },
  title:          { fontSize: 14, color: C.grey, fontWeight: "500" },
  titleBold:      { fontSize: 20, fontWeight: "800", color: C.navy },
  bookBtn:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.yellow, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  bookTxt:        { fontSize: 13, fontWeight: "700", color: C.navy },
  refreshIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },

  // Admin filter
  filterScroll:   { maxHeight: 48, marginBottom: 8 },
  filterContent:  { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterChip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  filterChipActive:{ backgroundColor: C.navy, borderColor: C.navy },
  filterChipTxt:  { fontSize: 12, fontWeight: "600", color: C.grey },
  filterChipTxtActive:{ color: C.white },

  // Admin card
  adminCard:       { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  adminCardTop:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  adminCardInfo:   { flex: 1 },
  adminCardName:   { fontSize: 13, fontWeight: "700", color: C.dark },
  adminCardType:   { fontSize: 11, color: C.grey },
  adminCardDate:   { fontSize: 12, color: C.navy, marginBottom: 4 },
  adminCardNote:   { fontSize: 12, color: C.grey, fontStyle: "italic", marginBottom: 8 },
  adminCardActions:{ flexDirection: "row", gap: 10 },
  confirmBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#16A34A", borderRadius: 10, paddingVertical: 8 },
  confirmBtnTxt:   { color: C.white, fontSize: 13, fontWeight: "700" },
  rejectBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FEF2F2", borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#FECACA" },
  rejectBtnTxt:    { color: "#DC2626", fontSize: 13, fontWeight: "700" },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTxt:        { fontSize: 10, fontWeight: "700" },

  // Shared
  tabs:            { flexDirection: "row", marginHorizontal: 16, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 4, marginBottom: 16 },
  tabBtn:          { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9 },
  tabActive:       { backgroundColor: C.navy },
  tabTxt:          { fontSize: 13, fontWeight: "600", color: C.grey },
  tabTxtActive:    { color: C.white },
  list:            { paddingHorizontal: 16 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText:       { fontSize: 14, color: C.grey, textAlign: "center" },
  emptyBookBtn:    { backgroundColor: C.navy, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBookTxt:    { color: C.white, fontSize: 13, fontWeight: "700" },
  sheetTitle:      { fontSize: 18, fontWeight: "800", color: C.navy, marginBottom: 4 },
  sheetSub:        { fontSize: 13, color: C.grey, marginBottom: 20 },
  fieldLabel:      { fontSize: 12, fontWeight: "700", color: C.dark, marginBottom: 8, marginTop: 4 },
  serviceRow:      { marginBottom: 16 },
  serviceChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, marginRight: 8, backgroundColor: C.white },
  serviceChipActive:{ backgroundColor: C.navy, borderColor: C.navy },
  serviceChipTxt:  { fontSize: 12, fontWeight: "600", color: C.dark },
  serviceChipTxtActive:{ color: C.white },
  input:           { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.dark, backgroundColor: C.white, marginBottom: 14 },
  textarea:        { height: 80, textAlignVertical: "top" },
  submitBtn:       { backgroundColor: C.yellow, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitDisabled:  { opacity: 0.6 },
  submitTxt:       { fontSize: 15, fontWeight: "700", color: C.navy },
});
