import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from '../../lib/firebase';
import { decideAppointment } from '../../lib/appointments';
import {
  useAuth, serviceLabel, activePrayers, prayerKey, prayerName, formatTime12, DEFAULT_PRAYERS, isoToday,
  planProgress, readingProgressId, useVerseOfDay, notify, setReadingDone, challengeStatus, challengeTotals, attendanceSummary,
  type DailyPrayer, type ReadingPlan, type ChallengeDoc, type ChallengeProgress, type Attendance,
} from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/Avatar";
import { PrayerCard } from "../../components/PrayerCard";
import { SidebarDrawer } from "../../components/SidebarDrawer";
import { NotificationBell } from "../../components/NotificationBell";
import { themedStyles, themedColors, tc } from "../../theme";
import i18n, { useTranslation } from "@nablis/i18n";

const L = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg: "#F9FAFB",
};
const C = themedColors(L);



// One line of a new member's registration details (icon + value).
function RegRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.memberRegRow}>
      <Ionicons name={icon} size={13} color={C.navy} />
      <Text style={styles.memberRegText}>{text}</Text>
    </View>
  );
}

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
          where("prayedAt", ">=", Timestamp.fromDate(todayStart())),
          where("prayedAt", "<=", Timestamp.fromDate(todayEnd())))),
        getDocs(query(collection(db, "testimonies"), where("status", "==", "pending"))),
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
    const apt = pendingApts.find((a) => a.id === id);
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

  // Tells the member the outcome (same message as the web portal).
  function notifyDecision(id: string, approved: boolean) {
    return notify({
      userId: id,
      type: approved ? "member_approved" : "member_rejected",
      link: approved ? "/dashboard" : undefined,
      title: approved ? "Welcome to Nablis Ministry!" : "Registration update",
      description: approved
        ? "Your account has been approved. You now have full access to the app."
        : "Your registration was not approved. Please contact the ministry for details.",
    }).catch(() => {});
  }

  async function doApproveMember(id: string, newRole: "member" | "admin") {
    setActionId(id);
    try {
      await updateDoc(doc(db, "users", id), { status: "active", role: newRole, updatedAt: serverTimestamp() });
      await notifyDecision(id, true);
      Alert.alert("Done", newRole === "admin" ? "Member approved as Admin." : "Member approved.");
      await load();
    } catch {
      Alert.alert("Error", "Failed to approve member.");
    } finally {
      setActionId(null);
    }
  }

  // Only the Spiritual Father may change a member's status (firestore.rules).
  function approveMember(id: string) {
    Alert.alert("Approve Member", "Approve as:", [
      { text: "Member",    onPress: () => doApproveMember(id, "member") },
      { text: "Admin",     onPress: () => doApproveMember(id, "admin")  },
      { text: "Cancel",    style: "cancel" },
    ]);
  }

  async function rejectMember(id: string) {
    Alert.alert("Reject Member", "Reject this registration?", [
      {
        text: "Reject", style: "destructive",
        onPress: async () => {
          setActionId(id);
          try {
            await updateDoc(doc(db, "users", id), { status: "rejected", updatedAt: serverTimestamp() });
            await notifyDecision(id, false);
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
          <View style={styles.topRight}>
            <NotificationBell />
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
              <Avatar uri={user?.photoURL} name={user?.displayName || user?.email} size={36} bgColor={C.navy} textColor={C.yellow} />
            </TouchableOpacity>
          </View>
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
                    {!!m.christianName     && <RegRow icon="person-outline" text={m.christianName} />}
                    {!!m.parishChurch      && <RegRow icon="business-outline" text={m.parishChurch} />}
                    {!!m.phoneNumber       && <RegRow icon="call-outline" text={m.phoneNumber} />}
                    {(m.cityOfResidence || m.countryOfResidence) && (
                      <RegRow icon="location-outline" text={[m.neighborhood, m.cityOfResidence, m.countryOfResidence].filter(Boolean).join(", ")} />
                    )}
                  </View>
                )}
                {!isSuperAdmin ? (
                  <Text style={styles.approvalNote}>{i18n.t("members.onlyFatherDecides")}</Text>
                ) : (
                <View style={styles.memberApprovalBtns}>
                  <TouchableOpacity
                    style={[styles.approveBtn, !!actionId && { opacity: 0.5 }]}
                    onPress={() => approveMember(m.id)}
                    disabled={!!actionId}
                  >
                    {actionId === m.id
                      ? <ActivityIndicator size="small" color={C.white} />
                      : <View style={styles.btnInner}><Ionicons name="checkmark" size={14} color={C.white} /><Text style={styles.approveBtnTxt}>Approve</Text></View>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectBtn, !!actionId && { opacity: 0.5 }]}
                    onPress={() => rejectMember(m.id)}
                    disabled={!!actionId}
                  >
                    <View style={styles.btnInner}><Ionicons name="close" size={14} color={C.white} /><Text style={styles.rejectBtnTxt}>Reject</Text></View>
                  </TouchableOpacity>
                </View>
                )}
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
                  <Text style={styles.adminAptName}>{a.memberName || a.userName || "Member"}</Text>
                  <Text style={styles.adminAptType}>{serviceLabel(a.serviceType)}</Text>
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
  const { verse }  = useVerseOfDay();
  const { t }      = useTranslation();
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
  const [prayerDocs, setPrayerDocs] = useState<DailyPrayer[] | null>(null);
  const [plan, setPlan] = useState<ReadingPlan | null>(null);
  const [readDays, setReadDays] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<ChallengeDoc[]>([]);
  const [cProgress, setCProgress] = useState<ChallengeProgress[]>([]);
  const [sessions, setSessions] = useState<Attendance[]>([]);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const todayIso = isoToday();

  useEffect(() => {
    if (!user) return;
    const subs = [
      onSnapshot(collection(db, "dailyPrayers"), (s) => setPrayerDocs(s.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer))), () => setPrayerDocs([])),
      onSnapshot(query(collection(db, "readingPlans"), where("active", "==", true)), (s) => {
        const d = s.docs[0];
        setPlan(d ? ({ id: d.id, entries: [], ...d.data() } as unknown as ReadingPlan) : null);
      }, () => {}),
      onSnapshot(collection(db, "challenges"), (s) => setChallenges(s.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeDoc))), () => {}),
      onSnapshot(query(collection(db, "challengeProgress"), where("userId", "==", user.id)), (s) => setCProgress(s.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeProgress))), () => {}),
      onSnapshot(collection(db, "attendance"), (s) => setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance))), () => {}),
      onSnapshot(query(collection(db, "checkIns"), where("userId", "==", user.id)), (s) => setCheckedIn(new Set(s.docs.map((d) => d.data().sessionId as string))), () => {}),
    ];
    return () => subs.forEach((u) => u());
  }, [user]);

  useEffect(() => {
    if (!user || !plan) return;
    return onSnapshot(doc(db, "readingProgress", readingProgressId(plan.id, user.id)), (s) => setReadDays((s.data()?.completed as string[]) ?? []), () => {});
  }, [user, plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The ministry's configured prayers; the three standard ones until it adds its own.
  const prayerList: DailyPrayer[] = (() => {
    const configured = activePrayers(prayerDocs ?? []);
    if (prayerDocs && configured.length) return configured;
    return DEFAULT_PRAYERS.map((p) => ({ ...p, id: p.type!, enabled: true } as DailyPrayer));
  })();
  const nowHm = new Date().toTimeString().slice(0, 5);
  const upNext = prayerList.find((p) => !prayedToday.has(prayerKey(p)) && p.time <= nowHm) ?? prayerList.find((p) => !prayedToday.has(prayerKey(p)));
  const todayReading = plan?.entries.find((e) => e.date === todayIso)?.reading;
  const reading = plan ? planProgress(plan, readDays, todayIso) : null;
  const myChallenges = challenges.filter((c) => challengeStatus(c) === "active" && cProgress.some((p) => p.challengeId === c.id));
  const openChallenges = challenges.filter((c) => challengeStatus(c) !== "ended" && !cProgress.some((p) => p.challengeId === c.id));
  const attendance = user ? attendanceSummary(sessions, user.id, checkedIn, user.createdAt) : null;

  async function toggleReading() {
    if (!user || !plan) return;
    const on = !readDays.includes(todayIso);
    setReadDays((c) => (on ? [...c, todayIso] : c.filter((d) => d !== todayIso)));
    try { await setReadingDone(plan, user, todayIso, on); }
    catch { setReadDays((c) => (on ? c.filter((d) => d !== todayIso) : [...c, todayIso])); }
  }

  async function loadData() {
    if (!user) return;
    try {
      // Single query avoids the composite index required by (userId + date range)
      const allSnap = await getDocs(query(
        collection(db, "prayerLogs"),
        where("userId", "==", user.id),
      ));
      setTotalPrayers(allSnap.size);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const daySet = new Set<string>();
      const todayPrayers = new Set<string>();
      allSnap.docs.forEach((d) => {
        const ts = (d.data().prayedAt ?? d.data().date) as Timestamp | undefined;
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
        prayedAt: serverTimestamp(), createdAt: serverTimestamp(),
      });
      setPrayedToday((prev) => new Set([...prev, prayerKey]));
      setTotalPrayers((p) => p + 1);
    } finally {
      setMarking(null);
    }
  }

  function getPrayerStatus(p: DailyPrayer): PrayerStatus {
    if (prayedToday.has(prayerKey(p))) return "completed";
    return upNext && prayerKey(upNext) === prayerKey(p) ? "upcoming" : "scheduled";
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
          <View style={styles.topRight}>
            <NotificationBell />
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
              <Avatar uri={user?.photoURL} name={user?.displayName || user?.email} size={36} bgColor={C.navy} textColor={C.yellow} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Morning Reflection */}
        <View style={styles.reflectionCard}>
          <View style={styles.reflectionHeader}>
            <Ionicons name="sunny" size={16} color={C.yellow} />
            <Text style={styles.reflectionLabel}>{t("mobile.morningReflection")}</Text>
          </View>
          <Text style={styles.reflectionQuote}>
            "Walk humbly before the Lord your God, in prayer and in service."
          </Text>
          <Text style={styles.reflectionVerse}>— Micah 6:8</Text>
          <View style={styles.reflectionFooter}>
            <Text style={styles.reflectionGreeting}>
              {t("mobile.goodMorning")}{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
            </Text>
            <TouchableOpacity style={styles.readMoreBtn} onPress={() => setReflectionVisible(true)}>
              <Text style={styles.readMoreText}>{t("mobile.readMore")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Prayer Commitments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mobile.prayerCommitments")}</Text>
          {prayerList.map((p) => (
            <PrayerCard
              key={p.id}
              title={prayerName(p)}
              time={formatTime12(p.time)}
              prayerText={p.message}
              status={getPrayerStatus(p)}
              onPress={() => markPrayed(prayerKey(p))}
              loading={marking === prayerKey(p)}
            />
          ))}
        </View>

        {/* Today at a glance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("mobile.todayGlance")}</Text>
          <TouchableOpacity style={styles.glanceCard} activeOpacity={0.85} onPress={() => router.push("/reading-plan" as any)}>
            <View style={[styles.glanceIcon, { backgroundColor: tc("#DCFCE7", "bg") }]}><Ionicons name="book" size={18} color={tc("#15803D")} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.glanceLabel}>{t("mobile.dailyReading")}</Text>
              <Text style={styles.glanceTitle} numberOfLines={2}>{!plan ? t("mobile.noPlan") : todayReading ?? t("mobile.noReadingToday")}</Text>
              {reading && <Text style={styles.glanceSub}>{t("mobile.onTrack", { pct: reading.onTrackPct })}{reading.behind ? t("mobile.toCatchUp", { count: reading.behind }) : ""}</Text>}
            </View>
            {todayReading && (
              <TouchableOpacity onPress={toggleReading} style={[styles.glanceBtn, readDays.includes(todayIso) && { backgroundColor: "#22C55E" }]}>
                <Ionicons name="checkmark" size={18} color={readDays.includes(todayIso) ? C.white : C.navy} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.glanceCard} activeOpacity={0.85} onPress={() => router.push("/challenges" as any)}>
            <View style={[styles.glanceIcon, { backgroundColor: tc("#FEF9C3", "bg") }]}><Ionicons name="trophy" size={18} color={tc("#CA8A04")} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.glanceLabel}>{t("mobile.challenges")}</Text>
              {myChallenges.length ? myChallenges.slice(0, 2).map((c) => {
                const t = challengeTotals(c, cProgress.find((p) => p.challengeId === c.id));
                return <Text key={c.id} style={styles.glanceTitle} numberOfLines={1}>{c.title} · {t.pct}%</Text>;
              }) : <Text style={styles.glanceTitle}>{openChallenges.length ? t("mobile.openToJoin", { count: openChallenges.length }) : t("mobile.noActiveChallenges")}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.grey} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.glanceCard} activeOpacity={0.85} onPress={() => router.push("/attendance" as any)}>
            <View style={[styles.glanceIcon, { backgroundColor: tc("#F3E8FF", "bg") }]}><Ionicons name="checkmark-done" size={18} color={tc("#7E22CE")} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.glanceLabel}>{t("mobile.attendance")}</Text>
              <Text style={styles.glanceTitle}>{attendance?.percent == null ? t("mobile.noGatherings") : t("mobile.attended", { pct: attendance.percent })}</Text>
              {!!attendance?.total && <Text style={styles.glanceSub}>{t("mobile.gatheringsOf", { attended: attendance.attended, total: attendance.total })}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.grey} />
          </TouchableOpacity>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>{t("mobile.yourProgress")}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{streak}</Text>
              <Text style={styles.statLabel}>{t("mobile.dayStreak")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{totalPrayers}</Text>
              <Text style={styles.statLabel}>{t("mobile.totalPrayers")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{prayerList.filter((p) => prayedToday.has(prayerKey(p))).length}/{prayerList.length}</Text>
              <Text style={styles.statLabel}>{t("mobile.today")}</Text>
            </View>
          </View>
          <View style={styles.calSection}>
            <Text style={styles.calTitle}>{t("mobile.thisWeek")}</Text>
            <ConsistencyGrid prayedDays={prayedDays} />
          </View>
        </View>

        {/* Verse of the Day */}
        <View style={styles.verseCard}>
          <View style={styles.verseHeader}>
            <View style={styles.verseBadge}>
              <Text style={styles.verseBadgeText}>{t("mobile.verseOfDay")}</Text>
            </View>
          </View>
          <Text style={styles.verseText}>“{verse.text}”</Text>
          <View style={styles.verseFooter}>
            <Text style={styles.verseRef}>{verse.ref}</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: `“${verse.text}” — ${verse.ref}` }).catch(() => {})}>
              <Ionicons name="share-outline" size={14} color={C.navy} />
              <Text style={styles.shareTxt}> {t("mobile.share")}</Text>
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

const styles = themedStyles({
  glanceCard:   { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, marginBottom: 10 },
  glanceIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  glanceLabel:  { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8 },
  glanceTitle:  { fontSize: 15, fontWeight: "700", color: "#111827", marginTop: 2 },
  glanceSub:    { fontSize: 12, color: "#6B7280", marginTop: 2 },
  glanceBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5C518", alignItems: "center", justifyContent: "center" },
  root:               { flex: 1, backgroundColor: L.bg },
  fill:               { flex: 1 },
  content:            { paddingHorizontal: 16 },
  topBar:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  iconBtn:            { width: 36, height: 36, borderRadius: 10, backgroundColor: L.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border },
  hamburgerIcon:      { fontSize: 22, color: L.navy, lineHeight: 26 },
  topCenter:          { flex: 1, alignItems: "center" },
  topRight:           { flexDirection: "row", alignItems: "center", gap: 10 },
  topTitle:           { fontSize: 18, fontWeight: "800", color: L.navy },
  adminGreetLabel:    { fontSize: 11, color: L.grey, fontWeight: "600" },

  // Admin stats
  adminStatsGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  adminStatCard:      { width: "47%", backgroundColor: L.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: L.border, alignItems: "flex-start" },
  adminStatIcon:      { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  adminStatNum:       { fontSize: 24, fontWeight: "800", marginBottom: 2 },
  adminStatLabel:     { fontSize: 11, color: L.grey, fontWeight: "600" },

  // Admin sections
  adminSection:       { backgroundColor: L.white, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: L.border },
  adminSectionRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  adminSectionTitle:  { fontSize: 14, fontWeight: "700", color: L.navy },
  seeAllTxt:          { fontSize: 12, color: L.navy, fontWeight: "600" },
  adminEmptyWrap:     { alignItems: "center", paddingVertical: 16, gap: 6 },
  adminEmptyTxt:      { fontSize: 13, color: L.grey },

  // Member approval
  memberApprovalCard:  { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: L.border },
  memberApprovalTop:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  memberApprovalInfo:  { flex: 1 },
  memberApprovalName:  { fontSize: 13, fontWeight: "700", color: L.dark },
  memberApprovalEmail: { fontSize: 11, color: L.grey },
  memberRegDetails:    { backgroundColor: L.light, borderRadius: 8, padding: 10, marginBottom: 10, gap: 4 },
  memberRegRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  memberRegText:       { flex: 1, fontSize: 12, color: L.navy },
  btnInner:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  approvalNote:        { fontSize: 12, color: L.grey, backgroundColor: L.bg, padding: 10, borderRadius: 10 },
  memberApprovalBtns:  { flexDirection: "row", gap: 8 },
  approveBtn:          { flex: 1, backgroundColor: "#16A34A", paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  approveBtnTxt:       { color: L.white, fontSize: 12, fontWeight: "700" },
  rejectBtn:           { flex: 1, backgroundColor: "#DC2626", paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  rejectBtnTxt:        { color: L.white, fontSize: 12, fontWeight: "700" },

  // Admin apt card
  adminAptCard:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: L.border },
  adminAptLeft:       { flex: 1 },
  adminAptName:       { fontSize: 13, fontWeight: "700", color: L.dark },
  adminAptType:       { fontSize: 11, color: L.grey },
  adminAptDate:       { fontSize: 11, color: L.navy, marginTop: 2 },
  adminAptBtns:       { flexDirection: "row", gap: 8 },
  aptConfirmBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" },
  aptRejectBtn:       { width: 32, height: 32, borderRadius: 8, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center" },

  // Member styles
  reflectionCard:     { backgroundColor: L.navy, borderRadius: 20, padding: 20, marginBottom: 20 },
  reflectionHeader:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  reflectionLabel:    { color: L.yellow, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  reflectionQuote:    { color: "#FFFFFF", fontSize: 15, lineHeight: 24, fontStyle: "italic", marginBottom: 6 },
  reflectionVerse:    { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 14 },
  reflectionFooter:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reflectionGreeting: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  readMoreBtn:        { backgroundColor: L.yellow, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  readMoreText:       { color: L.navy, fontSize: 12, fontWeight: "700" },
  section:            { marginBottom: 20 },
  sectionTitle:       { fontSize: 15, fontWeight: "700", color: L.navy, marginBottom: 12 },
  progressCard:       { backgroundColor: L.white, borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: L.border },
  progressTitle:      { fontSize: 15, fontWeight: "700", color: L.navy, marginBottom: 16 },
  statsRow:           { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  statItem:           { flex: 1, alignItems: "center" },
  statNum:            { fontSize: 24, fontWeight: "800", color: L.navy },
  statLabel:          { fontSize: 10, color: L.grey, marginTop: 2, textAlign: "center" },
  statDivider:        { width: 1, height: 36, backgroundColor: L.border },
  calSection:         { borderTopWidth: 1, borderTopColor: L.border, paddingTop: 14 },
  calTitle:           { fontSize: 11, fontWeight: "600", color: L.grey, marginBottom: 10, textTransform: "uppercase" },
  calRow:             { flexDirection: "row", justifyContent: "space-between" },
  calCell:            { alignItems: "center", gap: 4 },
  calDot:             { width: 28, height: 28, borderRadius: 8, backgroundColor: L.border },
  calDotActive:       { backgroundColor: L.navy },
  calLabel:           { fontSize: 9, color: L.grey },
  verseCard:          { backgroundColor: L.yellow, borderRadius: 20, padding: 20, marginBottom: 20 },
  verseHeader:        { marginBottom: 12 },
  verseBadge:         { backgroundColor: "rgba(27,46,107,0.15)", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  verseBadgeText:     { fontSize: 9, fontWeight: "800", color: L.navy, letterSpacing: 0.5 },
  verseText:          { fontSize: 14, color: L.navy, lineHeight: 22, fontStyle: "italic", marginBottom: 14 },
  verseFooter:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  verseRef:           { fontSize: 13, fontWeight: "700", color: L.navy },
  shareBtn:           { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(27,46,107,0.15)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  shareTxt:           { fontSize: 12, fontWeight: "600", color: L.navy },
  reflModalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  reflModalSheet:     { backgroundColor: L.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  reflModalHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: L.border, alignSelf: "center", marginBottom: 16 },
  reflModalHeader:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  reflModalLabel:     { flex: 1, fontSize: 14, fontWeight: "700", color: L.navy },
  reflModalClose:     { width: 32, height: 32, borderRadius: 16, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  reflModalQuote:     { fontSize: 16, fontStyle: "italic", color: L.navy, lineHeight: 26, marginBottom: 6 },
  reflModalVerse:     { fontSize: 12, color: L.grey, marginBottom: 16 },
  reflModalBody:      { fontSize: 14, color: L.dark, lineHeight: 24, paddingBottom: 16 },
});
