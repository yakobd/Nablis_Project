import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import {
  useAuth, isoToday, parseIso, planProgress, readingStreak, monthlyPerformance, readingProgressId, setReadingDone,
  type ReadingPlan,
} from "@nablis/shared/firebase";
import { db } from "../../lib/firebase";
import { FadeInView } from "../../components/FadeInView";
import { themedStyles, themedColors } from "../../theme";
import i18n from "@nablis/i18n";

const L = { navy: "#1B2E6B", blue: "#1E3A8A", yellow: "#F5C518", light: "#EEF1F8", grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB", white: "#FFFFFF", bg: "#F9FAFB", green: "#16A34A", red: "#DC2626" };
const C = themedColors(L);
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => parseIso(iso).toLocaleDateString("en-US", opts);
const passageLink = (reading: string) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reading)}&version=NKJV`;

export default function ReadingPlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [plan, setPlan] = useState<ReadingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = isoToday();

  useEffect(() => onSnapshot(query(collection(db, "readingPlans"), where("active", "==", true)), (snap) => {
    const d = snap.docs[0];
    setPlan(d ? ({ id: d.id, entries: [], ...d.data() } as unknown as ReadingPlan) : null);
    setLoading(false);
  }, () => setLoading(false)), []);

  useEffect(() => {
    if (!user || !plan) return;
    return onSnapshot(doc(db, "readingProgress", readingProgressId(plan.id, user.id)), (snap) => {
      setCompleted((snap.data()?.completed as string[] | undefined) ?? []);
    }, () => {});
  }, [user, plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = useMemo(() => new Map((plan?.entries ?? []).map((e) => [e.date, e.reading])), [plan]);
  const done = useMemo(() => new Set(completed), [completed]);

  async function toggle(date: string) {
    if (!user || !plan || date > today) return;
    const on = !done.has(date);
    setBusy(date);
    setCompleted((c) => (on ? [...c, date] : c.filter((d) => d !== date)));
    try {
      await setReadingDone(plan, user, date, on);
    } catch {
      setCompleted((c) => (on ? c.filter((d) => d !== date) : [...c, date]));
      Alert.alert("Not saved", "Please check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={C.navy} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{i18n.t("nav.readingPlan")}</Text>
    </View>
  );

  if (loading || !plan) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        {loading ? <ActivityIndicator color={C.navy} style={{ marginTop: 40 }} /> : (
          <View style={styles.emptyBox}>
            <Ionicons name="book-outline" size={40} color={C.grey} />
            <Text style={styles.emptyTitle}>No reading plan yet</Text>
            <Text style={styles.emptyTxt}>{isStaff ? "Upload the yearly plan from the web portal (Bible Study › Daily Reading Plan)." : "The ministry will publish this year's plan here soon."}</Text>
          </View>
        )}
      </View>
    );
  }

  const progress = planProgress(plan, completed, today);
  const streak = readingStreak(plan, completed, today);
  const monthly = monthlyPerformance(plan, completed, today);
  const todayReading = byDate.get(today);
  const missed = plan.entries.filter((e) => e.date < today && !done.has(e.date)).reverse().slice(0, 14);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7;
  const cells = Array.from({ length: lead + daysInMonth }, (_, i) => {
    if (i < lead) return null;
    const d = new Date(month.getFullYear(), month.getMonth(), i - lead + 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, day: d.getDate(), reading: byDate.get(iso) };
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <FadeInView>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>TODAY · {fmt(today, { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}</Text>
            {todayReading ? (
              <>
                <Text style={styles.heroReading}>{todayReading}</Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                  <TouchableOpacity onPress={() => toggle(today)} disabled={busy === today}
                    style={[styles.heroBtn, { backgroundColor: done.has(today) ? "#22C55E" : C.yellow }]}>
                    <Ionicons name="checkmark" size={18} color={done.has(today) ? C.white : C.navy} />
                    <Text style={[styles.heroBtnTxt, { color: done.has(today) ? C.white : C.navy }]}>{done.has(today) ? "Completed" : "Mark as read"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Linking.openURL(passageLink(todayReading))} style={[styles.heroBtn, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
                    <Ionicons name="open-outline" size={16} color={C.white} />
                    <Text style={[styles.heroBtnTxt, { color: C.white }]}>Read</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.heroNone}>No reading scheduled today.</Text>
            )}
          </View>
        </FadeInView>

        <View style={styles.statsRow}>
          {[
            { label: "On track", value: `${progress.onTrackPct}%`, icon: "flag-outline" as const, color: C.blue },
            { label: "Year", value: `${progress.overallPct}%`, icon: "trending-up-outline" as const, color: C.green },
            { label: "Streak", value: `${streak}`, icon: "flame-outline" as const, color: "#EA580C" },
            { label: "Behind", value: `${progress.behind}`, icon: "alert-circle-outline" as const, color: progress.behind ? C.red : C.grey },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Ionicons name={s.icon} size={18} color={s.color} />
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.navBtn}><Ionicons name="chevron-back" size={18} color={C.dark} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.navBtn}><Ionicons name="chevron-forward" size={18} color={C.dark} /></TouchableOpacity>
            </View>
          </View>
          <View style={styles.weekRow}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <Text key={i} style={styles.weekDay}>{d}</Text>)}
          </View>
          <View style={styles.grid}>
            {cells.map((c, i) => {
              if (!c) return <View key={`x${i}`} style={styles.cell} />;
              const isDone = done.has(c.iso);
              const isToday = c.iso === today;
              const past = c.iso < today;
              const bg = !c.reading ? "transparent" : isDone ? C.blue : isToday ? "#FEF9C3" : past ? "#FEF2F2" : C.bg;
              const fg = !c.reading ? "#D1D5DB" : isDone ? C.white : past && !isToday ? "#B91C1C" : C.dark;
              return (
                <TouchableOpacity key={c.iso} style={styles.cell} disabled={!c.reading || c.iso > today || busy === c.iso}
                  onPress={() => toggle(c.iso)} onLongPress={() => c.reading && Alert.alert(fmt(c.iso, { weekday: "long", month: "short", day: "numeric" }), c.reading)}>
                  <View style={[styles.cellInner, { backgroundColor: bg }, isToday && { borderWidth: 2, borderColor: C.yellow }]}>
                    <Text style={[styles.cellTxt, { color: fg }]}>{c.day}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>Tap a past day to mark it · long-press to see its reading</Text>
        </View>

        {missed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Catch up</Text>
            {missed.map((e) => (
              <View key={e.date} style={styles.missRow}>
                <TouchableOpacity onPress={() => toggle(e.date)} disabled={busy === e.date} style={styles.checkbox} />
                <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(passageLink(e.reading))}>
                  <Text style={styles.missReading}>{e.reading}</Text>
                  <Text style={styles.missDate}>{fmt(e.date, { weekday: "short", month: "short", day: "numeric" })}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly performance</Text>
          <View style={styles.bars}>
            {monthly.map((m) => (
              <View key={m.month} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${m.pct === null ? 3 : Math.max(3, m.pct)}%`, backgroundColor: m.pct === null ? "#F3F4F6" : C.blue }]} />
                </View>
                <Text style={styles.barLabel}>{MONTHS[m.month]}</Text>
                <Text style={styles.barPct}>{m.pct === null ? "" : `${m.pct}`}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles({
  root:        { flex: 1, backgroundColor: L.bg },
  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: L.white, borderBottomWidth: 1, borderBottomColor: L.border },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: L.navy },
  content:     { padding: 16, gap: 14 },
  emptyBox:    { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle:  { fontSize: 16, fontWeight: "700", color: L.dark },
  emptyTxt:    { fontSize: 13, color: L.grey, textAlign: "center" },

  hero:        { backgroundColor: L.blue, borderRadius: 22, padding: 20 },
  heroLabel:   { fontSize: 11, fontWeight: "700", color: L.yellow, letterSpacing: 1 },
  heroReading: { fontSize: 26, fontWeight: "800", color: L.white, marginTop: 8 },
  heroNone:    { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 8 },
  heroBtn:     { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  heroBtnTxt:  { fontSize: 14, fontWeight: "700" },

  statsRow:    { flexDirection: "row", gap: 8 },
  stat:        { flex: 1, backgroundColor: L.white, borderRadius: 14, borderWidth: 1, borderColor: L.border, padding: 10, alignItems: "center", gap: 2 },
  statNum:     { fontSize: 18, fontWeight: "800", color: "#111827" },
  statLabel:   { fontSize: 11, color: L.grey },

  card:        { backgroundColor: L.white, borderRadius: 18, borderWidth: 1, borderColor: L.border, padding: 16, gap: 10 },
  cardTitle:   { fontSize: 16, fontWeight: "700", color: "#111827" },
  rowBetween:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn:      { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: L.bg },
  weekRow:     { flexDirection: "row" },
  weekDay:     { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: L.grey },
  grid:        { flexDirection: "row", flexWrap: "wrap" },
  cell:        { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  cellInner:   { flex: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cellTxt:     { fontSize: 13, fontWeight: "600" },
  hint:        { fontSize: 11, color: L.grey },

  missRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  checkbox:    { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: "#D1D5DB" },
  missReading: { fontSize: 14, fontWeight: "600", color: "#111827" },
  missDate:    { fontSize: 11, color: L.grey },

  bars:        { flexDirection: "row", gap: 4, height: 130, alignItems: "flex-end" },
  barCol:      { flex: 1, alignItems: "center", height: "100%" },
  barTrack:    { flex: 1, width: "70%", justifyContent: "flex-end" },
  bar:         { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel:    { fontSize: 10, color: L.grey, marginTop: 4 },
  barPct:      { fontSize: 9, color: L.dark, height: 12 },
});
