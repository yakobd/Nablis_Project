import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useAuth } from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/Avatar";
import { PrayerCard } from "../../components/PrayerCard";
import { SidebarDrawer } from "../../components/SidebarDrawer";

const C = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg: "#F9FAFB",
};

const PRAYERS = [
  { key: "morning",   title: "Morning Prayer",   time: "6:00 AM",  text: "Lord, guide my steps this day. Let your light shine through me in all my actions, words, and thoughts as I walk in your name." },
  { key: "afternoon", title: "Afternoon Prayer",  time: "12:00 PM", text: "Heavenly Father, thank you for your grace thus far today. Renew my strength and focus as I continue this day in your service." },
  { key: "evening",   title: "Evening Prayer",    time: "8:00 PM",  text: "Dear God, as the day comes to a close, I offer you all that I have done. Forgive my shortcomings and grant me peaceful rest." },
];

const VERSE = {
  text: "\"The Lord is my shepherd; I shall not want. He makes me lie down in green pastures.\"",
  reference: "Psalm 23:1-2",
};

type PrayerStatus = "completed" | "upcoming" | "scheduled";

function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function todayEnd()   { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

function fmtDate(ts?: Timestamp) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return ""; }
}

function ConsistencyGrid({ prayedDays }: { prayedDays: Set<string> }) {
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: d.toDateString(), label: dayNames[d.getDay()] };
  });
  return (
    <View style={styles.calRow}>
      {days.map(({ key, label }) => (
        <View key={key} style={styles.calCell}>
          <View style={[styles.calDot, prayedDays.has(key) && styles.calDotActive]} />
          <Text style={styles.calLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Admin Home ───────────────────────────────────────────────────────────────
function AdminHome() {
  const { user, role } = useAuth();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const isSuperAdmin = role === "super_admin";
  const [stats, setStats] = useState({ members: 0, pendingApts: 0, prayers: 0, pendingTest: 0 });
  const [pendingApts, setPendingApts]       = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId]   = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function load() {
    try {
      const [membersSnap, aptsSnap, prayersSnap, testSnap, pendingUsersSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "member"))),
        getDocs(query(collection(db, "appointments"), where("status", "==", "pending"))),
        getDocs(query(collection(db, "prayerLogs"),
          where("date", ">=", Timestamp.fromDate(todayStart())),
          where("date", "<=", Timestamp.fromDate(todayEnd())))),
        getDocs(query(collection(db, "testimonials"), where("status", "==", "pending"))),
        getDocs(query(collection(db, "users"), where("status", "==", "pending"))),
      ]);
      setStats({
        members:     membersSnap.size,
        pendingApts: aptsSnap.size,
        prayers:     prayersSnap.size,
        pendingTest: testSnap.size,
      });
      setPendingApts(aptsSnap.docs.slice(0, 5).map((d) => ({ id: d.id, ...d.data() })));
      setPendingMembers(pendingUsersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  async function handleApt(id: string, status: "confirmed" | "rejected") {
    setActionId(id);
    try {
      await updateDoc(doc(db, "appointments", id), { status, notified: true, updatedAt: serverTimestamp() });
      Alert.alert("Done", status === "confirmed" ? "Appointment confirmed." : "Appointment rejected.");
      await load();
    } catch {
      Alert.alert("Error", "Failed to update appointment.");
    } finally {
      setActionId(null);
    }
  }

  async function doApproveMember(id: string, newRole: "member" | "admin") {
    setActionId(id);
    try {
      await updateDoc(doc(db, "users", id), { status: "active", role: newRole });
      Alert.alert("Done", newRole === "admin" ? "Member approved as Admin." : "Member approved.");
      await load();
    } catch {
      Alert.alert("Error", "Failed to approve member.");
    } finally {
      setActionId(null);
    }
  }

  function approveMember(id: string) {
    if (isSuperAdmin) {
      Alert.alert("Approve Member", "Approve as:", [
        { text: "Member",    onPress: () => doApproveMember(id, "member") },
        { text: "Admin",     onPress: () => doApproveMember(id, "admin")  },
        { text: "Cancel",    style: "cancel" },
      ]);
    } else {
      doApproveMember(id, "member");
    }
  }

  async function rejectMember(id: string) {
    Alert.alert("Reject Member", "Reject this registration?", [
      {
        text: "Reject", style: "destructive",
        onPress: async () => {
          setActionId(id);
          try {
            await updateDoc(doc(db, "users", id), { status: "rejected" });
            Alert.alert("Done", "Member registration rejected.");
            await load();
          } catch {
            Alert.alert("Error", "Failed to reject member.");
          } finally {
            setActionId(null);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.navy} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setSidebarOpen(true)}>
            <Ionicons name="menu" size={22} color={C.navy} />
          </TouchableOpacity>
          <View style={styles.topCenter}>
            <Text style={styles.adminGreetLabel}>Admin Panel</Text>
            <Text style={styles.topTitle}>Nablis</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
            <Avatar uri={user?.photoURL} name={user?.displayName || user?.email} size={36} bgColor={C.navy} textColor={C.yellow} />
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.adminStatsGrid}>
          {[
            { icon: "people",              label: "Members",      value: stats.members,     color: C.navy    },
            { icon: "calendar",            label: "Pending Apts", value: stats.pendingApts, color: "#D97706" },
            { icon: "book",                label: "Prayers Today", value: stats.prayers,    color: "#16A34A" },
            { icon: "chatbubble-ellipses", label: "Testimonials", value: stats.pendingTest, color: "#7C3AED" },
          ].map((s) => (
            <View key={s.label} style={styles.adminStatCard}>
              <View style={[styles.adminStatIcon, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon as any} size={20} color={s.color} />
              </View>
              <Text style={[styles.adminStatNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.adminStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Pending member approvals */}
        {pendingMembers.length > 0 && (
          <View style={styles.adminSection}>
            <Text style={styles.adminSectionTitle}>
              Pending Member Approvals ({pendingMembers.length})
            </Text>
            {pendingMembers.map((m) => (
              <View key={m.id} style={styles.memberApprovalCard}>
                <View style={styles.memberApprovalTop}>
                  <Avatar name={m.displayName || m.email} size={40} />
                  <View style={styles.memberApprovalInfo}>
                    <Text style={styles.memberApprovalName}>{m.displayName || "Unnamed"}</Text>
                    <Text style={styles.memberApprovalEmail} numberOfLines={1}>{m.email}</Text>
                  </View>
                </View>
                {/* Registration details — visible to super_admin */}
                {isSuperAdmin && (
                  <View style={styles.memberRegDetails}>
                    {m.christianName       && <Text style={styles.memberRegRow}>✝  {m.christianName}</Text>}
                    {m.parishChurch        && <Text style={styles.memberRegRow}>⛪  {m.parishChurch}</Text>}
                    {m.phoneNumber         && <Text style={styles.memberRegRow}>📞  {m.phoneNumber}</Text>}
                    {(m.cityOfResidence || m.countryOfResidence) && (
                      <Text style={styles.memberRegRow}>
                        📍  {[m.neighborhood, m.cityOfResidence, m.countryOfResidence].filter(Boolean).join(", ")}
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.memberApprovalBtns}>
                  <TouchableOpacity
                    style={[styles.approveBtn, !!actionId && { opacity: 0.5 }]}
                    onPress={() => approveMember(m.id)}
                    disabled={!!actionId}
                  >
                    {actionId === m.id
                      ? <ActivityIndicator size="small" color={C.white} />
                      : <Text style={styles.approveBtnTxt}>✓ Approve</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectBtn, !!actionId && { opacity: 0.5 }]}
                    onPress={() => rejectMember(m.id)}
                    disabled={!!actionId}
                  >
                    <Text style={styles.rejectBtnTxt}>✕ Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent pending appointments */}
        <View style={styles.adminSection}>
          <View style={styles.adminSectionRow}>
            <Text style={styles.adminSectionTitle}>Pending Appointments</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/appointments" as any)}>
              <Text style={styles.seeAllTxt}>See All →</Text>
            </TouchableOpacity>
          </View>
          {pendingApts.length === 0 ? (
            <View style={styles.adminEmptyWrap}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#16A34A" style={{ opacity: 0.6 }} />
              <Text style={styles.adminEmptyTxt}>All caught up!</Text>
            </View>
          ) : (
            pendingApts.map((a) => (
              <View key={a.id} style={styles.adminAptCard}>
                <View style={styles.adminAptLeft}>
                  <Text style={styles.adminAptName}>{a.userName || "Member"}</Text>
                  <Text style={styles.adminAptType}>{a.serviceType}</Text>
                  {a.date && <Text style={styles.adminAptDate}>{fmtDate(a.date as Timestamp)}</Text>}
                </View>
                <View style={styles.adminAptBtns}>
                  <TouchableOpacity
                    style={[styles.aptConfirmBtn, !!actionId && { opacity: 0.5 }]}
                    onPress={() => handleApt(a.id, "confirmed")}
                    disabled={!!actionId}
                  >
                    <Ionicons name="checkmark" size={16} color={C.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.aptRejectBtn, !!actionId && { opacity: 0.5 }]}
                    onPress={() => handleApt(a.id, "rejected")}
                    disabled={!!actionId}
                  >
                    <Ionicons name="close" size={16} color={C.white} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} currentRoute="/(tabs)/home" />
    </View>
  );
}

// ─── Member Home ──────────────────────────────────────────────────────────────
function MemberHome() {
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const [prayedToday, setPrayedToday] = useState<Set<string>>(new Set());
  const [prayedDays,  setPrayedDays]  = useState<Set<string>>(new Set());
  const [streak,      setStreak]      = useState(0);
  const [totalPrayers, setTotalPrayers] = useState(0);
  const [refreshing,  setRefreshing]  = useState(false);
  const [marking,     setMarking]     = useState<string | null>(null);
  const [menuVisible, setMenuVisible]             = useState(false);
  const [reflectionVisible, setReflectionVisible] = useState(false);

  async function loadData() {
    if (!user) return;
    try {
      console.log('[Home] loading prayer data for user:', user.id);
      // Single query avoids the composite index required by (userId + date range)
      const allSnap = await getDocs(query(
        collection(db, "prayerLogs"),
        where("userId", "==", user.id),
      ));
      console.log('[Home] prayerLogs fetched:', allSnap.size);
      setTotalPrayers(allSnap.size);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const daySet = new Set<string>();
      const todayPrayers = new Set<string>();
      allSnap.docs.forEach((d) => {
        const ts = d.data().date as Timestamp | undefined;
        if (!ts) return;
        const dt = ts.toDate();
        daySet.add(dt.toDateString());
        if (dt >= today && dt < tomorrow) {
          todayPrayers.add(d.data().prayerType as string);
        }
      });
      setPrayedToday(todayPrayers);
      setPrayedDays(daySet);

      let s = 0;
      const check = new Date();
      while (daySet.has(check.toDateString())) { s++; check.setDate(check.getDate() - 1); }
      setStreak(s);
    } catch (err) {
      console.error('[Home] prayerLogs fetch error:', err);
    }
  }

  useEffect(() => { loadData(); }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [user]);

  async function markPrayed(prayerKey: string) {
    if (!user || prayedToday.has(prayerKey)) return;
    setMarking(prayerKey);
    try {
      await addDoc(collection(db, "prayerLogs"), {
        userId: user.id, prayerType: prayerKey,
        date: serverTimestamp(), createdAt: serverTimestamp(),
      });
      setPrayedToday((prev) => new Set([...prev, prayerKey]));
      setTotalPrayers((p) => p + 1);
    } finally {
      setMarking(null);
    }
  }

  function getPrayerStatus(key: string, idx: number): PrayerStatus {
    if (prayedToday.has(key)) return "completed";
    const hour = new Date().getHours();
    if (idx === 0 && hour >= 6)  return "upcoming";
    if (idx === 1 && hour >= 12) return "upcoming";
    if (idx === 2 && hour >= 18) return "upcoming";
    if (idx === 0) return "upcoming";
    return "scheduled";
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Nablis</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
            <Avatar uri={user?.photoURL} name={user?.displayName || user?.email} size={36} bgColor={C.navy} textColor={C.yellow} />
          </TouchableOpacity>
        </View>

        {/* Morning Reflection */}
        <View style={styles.reflectionCard}>
          <View style={styles.reflectionHeader}>
            <Ionicons name="sunny" size={16} color={C.yellow} />
            <Text style={styles.reflectionLabel}>Morning Reflection</Text>
          </View>
          <Text style={styles.reflectionQuote}>
            "Walk humbly before the Lord your God, in prayer and in service."
          </Text>
          <Text style={styles.reflectionVerse}>— Micah 6:8</Text>
          <View style={styles.reflectionFooter}>
            <Text style={styles.reflectionGreeting}>
              Good morning{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
            </Text>
            <TouchableOpacity style={styles.readMoreBtn} onPress={() => setReflectionVisible(true)}>
              <Text style={styles.readMoreText}>Read More</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Prayer Commitments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Prayer Commitments</Text>
          {PRAYERS.map((p, idx) => (
            <PrayerCard
              key={p.key}
              title={p.title}
              time={p.time}
              prayerText={p.text}
              status={getPrayerStatus(p.key, idx)}
              onPress={() => markPrayed(p.key)}
              loading={marking === p.key}
            />
          ))}
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Your Progress</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{totalPrayers}</Text>
              <Text style={styles.statLabel}>Total Prayers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{prayedToday.size}/3</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
          </View>
          <View style={styles.calSection}>
            <Text style={styles.calTitle}>This Week</Text>
            <ConsistencyGrid prayedDays={prayedDays} />
          </View>
        </View>

        {/* Verse of the Day */}
        <View style={styles.verseCard}>
          <View style={styles.verseHeader}>
            <View style={styles.verseBadge}>
              <Text style={styles.verseBadgeText}>VERSE OF THE DAY</Text>
            </View>
          </View>
          <Text style={styles.verseText}>{VERSE.text}</Text>
          <View style={styles.verseFooter}>
            <Text style={styles.verseRef}>{VERSE.reference}</Text>
            <TouchableOpacity style={styles.shareBtn}>
              <Ionicons name="share-outline" size={14} color={C.navy} />
              <Text style={styles.shareTxt}> Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Morning reflection modal */}
      <Modal visible={reflectionVisible} transparent animationType="slide" onRequestClose={() => setReflectionVisible(false)}>
        <View style={styles.reflModalOverlay}>
          <View style={styles.reflModalSheet}>
            <View style={styles.reflModalHandle} />
            <View style={styles.reflModalHeader}>
              <Ionicons name="sunny" size={18} color={C.yellow} />
              <Text style={styles.reflModalLabel}>Morning Reflection</Text>
              <TouchableOpacity onPress={() => setReflectionVisible(false)} style={styles.reflModalClose}>
                <Ionicons name="close" size={20} color={C.dark} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reflModalQuote}>
              "Walk humbly before the Lord your God, in prayer and in service."
            </Text>
            <Text style={styles.reflModalVerse}>— Micah 6:8</Text>
            <Text style={styles.reflModalBody}>
              This verse calls us to a life of justice, mercy, and humility. As you begin this day, let your heart be open to the needs of those around you. Serve not for recognition, but out of love for God and neighbor. Walk in quietness and confidence, knowing that the Lord goes before you in every step you take.
            </Text>
          </View>
        </View>
      </Modal>

      <SidebarDrawer visible={menuVisible} onClose={() => setMenuVisible(false)} currentRoute="/(tabs)/home" />
    </View>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { role } = useAuth();
  if (role === "admin" || role === "super_admin") return <AdminHome />;
  return <MemberHome />;
}

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.bg },
  fill:               { flex: 1 },
  content:            { paddingHorizontal: 16 },
  topBar:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  iconBtn:            { width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  hamburgerIcon:      { fontSize: 22, color: C.navy, lineHeight: 26 },
  topCenter:          { flex: 1, alignItems: "center" },
  topTitle:           { fontSize: 18, fontWeight: "800", color: C.navy },
  adminGreetLabel:    { fontSize: 11, color: C.grey, fontWeight: "600" },

  // Admin stats
  adminStatsGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  adminStatCard:      { width: "47%", backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, alignItems: "flex-start" },
  adminStatIcon:      { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  adminStatNum:       { fontSize: 24, fontWeight: "800", marginBottom: 2 },
  adminStatLabel:     { fontSize: 11, color: C.grey, fontWeight: "600" },

  // Admin sections
  adminSection:       { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  adminSectionRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  adminSectionTitle:  { fontSize: 14, fontWeight: "700", color: C.navy },
  seeAllTxt:          { fontSize: 12, color: C.navy, fontWeight: "600" },
  adminEmptyWrap:     { alignItems: "center", paddingVertical: 16, gap: 6 },
  adminEmptyTxt:      { fontSize: 13, color: C.grey },

  // Member approval
  memberApprovalCard:  { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  memberApprovalTop:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  memberApprovalInfo:  { flex: 1 },
  memberApprovalName:  { fontSize: 13, fontWeight: "700", color: C.dark },
  memberApprovalEmail: { fontSize: 11, color: C.grey },
  memberRegDetails:    { backgroundColor: C.light, borderRadius: 8, padding: 10, marginBottom: 10, gap: 4 },
  memberRegRow:        { fontSize: 12, color: C.navy },
  memberApprovalBtns:  { flexDirection: "row", gap: 8 },
  approveBtn:          { flex: 1, backgroundColor: "#16A34A", paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  approveBtnTxt:       { color: C.white, fontSize: 12, fontWeight: "700" },
  rejectBtn:           { flex: 1, backgroundColor: "#DC2626", paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  rejectBtnTxt:        { color: C.white, fontSize: 12, fontWeight: "700" },

  // Admin apt card
  adminAptCard:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  adminAptLeft:       { flex: 1 },
  adminAptName:       { fontSize: 13, fontWeight: "700", color: C.dark },
  adminAptType:       { fontSize: 11, color: C.grey },
  adminAptDate:       { fontSize: 11, color: C.navy, marginTop: 2 },
  adminAptBtns:       { flexDirection: "row", gap: 8 },
  aptConfirmBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" },
  aptRejectBtn:       { width: 32, height: 32, borderRadius: 8, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center" },

  // Member styles
  reflectionCard:     { backgroundColor: C.navy, borderRadius: 20, padding: 20, marginBottom: 20 },
  reflectionHeader:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  reflectionLabel:    { color: C.yellow, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  reflectionQuote:    { color: "#FFFFFF", fontSize: 15, lineHeight: 24, fontStyle: "italic", marginBottom: 6 },
  reflectionVerse:    { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 14 },
  reflectionFooter:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reflectionGreeting: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  readMoreBtn:        { backgroundColor: C.yellow, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  readMoreText:       { color: C.navy, fontSize: 12, fontWeight: "700" },
  section:            { marginBottom: 20 },
  sectionTitle:       { fontSize: 15, fontWeight: "700", color: C.navy, marginBottom: 12 },
  progressCard:       { backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  progressTitle:      { fontSize: 15, fontWeight: "700", color: C.navy, marginBottom: 16 },
  statsRow:           { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  statItem:           { flex: 1, alignItems: "center" },
  statNum:            { fontSize: 24, fontWeight: "800", color: C.navy },
  statLabel:          { fontSize: 10, color: C.grey, marginTop: 2, textAlign: "center" },
  statDivider:        { width: 1, height: 36, backgroundColor: C.border },
  calSection:         { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  calTitle:           { fontSize: 11, fontWeight: "600", color: C.grey, marginBottom: 10, textTransform: "uppercase" },
  calRow:             { flexDirection: "row", justifyContent: "space-between" },
  calCell:            { alignItems: "center", gap: 4 },
  calDot:             { width: 28, height: 28, borderRadius: 8, backgroundColor: C.border },
  calDotActive:       { backgroundColor: C.navy },
  calLabel:           { fontSize: 9, color: C.grey },
  verseCard:          { backgroundColor: C.yellow, borderRadius: 20, padding: 20, marginBottom: 20 },
  verseHeader:        { marginBottom: 12 },
  verseBadge:         { backgroundColor: "rgba(27,46,107,0.15)", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  verseBadgeText:     { fontSize: 9, fontWeight: "800", color: C.navy, letterSpacing: 0.5 },
  verseText:          { fontSize: 14, color: C.navy, lineHeight: 22, fontStyle: "italic", marginBottom: 14 },
  verseFooter:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  verseRef:           { fontSize: 13, fontWeight: "700", color: C.navy },
  shareBtn:           { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(27,46,107,0.15)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  shareTxt:           { fontSize: 12, fontWeight: "600", color: C.navy },
  reflModalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  reflModalSheet:     { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  reflModalHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  reflModalHeader:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  reflModalLabel:     { flex: 1, fontSize: 14, fontWeight: "700", color: C.navy },
  reflModalClose:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.light, alignItems: "center", justifyContent: "center" },
  reflModalQuote:     { fontSize: 16, fontStyle: "italic", color: C.navy, lineHeight: 26, marginBottom: 6 },
  reflModalVerse:     { fontSize: 12, color: C.grey, marginBottom: 16 },
  reflModalBody:      { fontSize: 14, color: C.dark, lineHeight: 24, paddingBottom: 16 },
});
