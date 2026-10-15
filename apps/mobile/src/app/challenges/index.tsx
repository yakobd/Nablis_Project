import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import {
  useAuth, challengeCategory, challengeStatus, challengeTotals, type ChallengeDoc, type ChallengeProgress,
} from "@nablis/shared/firebase";
import { db } from "../../lib/firebase";
import { FadeInView } from "../../components/FadeInView";
import { challengeIcon } from "../../lib/challengeIcons";
import { themedStyles, themedColors } from "../../theme";
import i18n from "@nablis/i18n";

const L = { navy: "#1B2E6B", blue: "#1E3A8A", yellow: "#F5C518", light: "#EEF1F8", grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB", white: "#FFFFFF", bg: "#F9FAFB" };
const C = themedColors(L);
const STATUS = {
  upcoming: { bg: "#DBEAFE", fg: "#1D4ED8" },
  active: { bg: "#DCFCE7", fg: "#15803D" },
  ended: { bg: "#F3F4F6", fg: "#6B7280" },
};

function range(c: ChallengeDoc) {
  const f = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(c.startDate)} – ${f(c.endDate)}`;
}

function Card({ c, p, onPress }: { c: ChallengeDoc; p?: ChallengeProgress; onPress: () => void }) {
  const cat = challengeCategory(c.category);
  const status = challengeStatus(c);
  const t = p ? challengeTotals(c, p) : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cover}>
        {c.imageURL ? <Image source={{ uri: c.imageURL }} style={StyleSheet.absoluteFill} /> : <Ionicons name={challengeIcon(cat.key)} size={44} color="#FFFFFF" style={{ opacity: 0.9 }} />}
        <View style={[styles.pill, { backgroundColor: STATUS[status].bg }]}>
          <Text style={[styles.pillTxt, { color: STATUS[status].fg }]}>{status.toUpperCase()}</Text>
        </View>
        {t?.complete && <View style={[styles.pill, styles.donePill]}><Ionicons name="trophy" size={11} color={C.navy} /><Text style={[styles.pillTxt, { color: C.navy }]}>DONE</Text></View>}
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <Text style={styles.cat}>{cat.label.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={2}>{c.title}</Text>
        <Text style={styles.sub}>{range(c)}</Text>
        {t ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sub}>{t.done} / {t.total}</Text>
              <Text style={styles.pct}>{t.pct}%</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${t.pct}%`, backgroundColor: t.complete ? C.yellow : C.blue }]} /></View>
          </View>
        ) : status !== "ended" ? (
          <View style={styles.joinBtn}><Text style={styles.joinTxt}>Join challenge</Text></View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [items, setItems] = useState<ChallengeDoc[]>([]);
  const [progress, setProgress] = useState<ChallengeProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => onSnapshot(collection(db, "challenges"), (snap) => {
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeDoc)).sort((a, b) => b.startDate.localeCompare(a.startDate)));
    setLoading(false);
  }, () => setLoading(false)), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "challengeProgress"), where("userId", "==", user.id)), (snap) => {
      setProgress(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeProgress)));
    }, () => {});
  }, [user]);

  const mine = useMemo(() => new Map(progress.map((p) => [p.challengeId, p])), [progress]);
  const live = items.filter((c) => challengeStatus(c) !== "ended");
  const joined = live.filter((c) => mine.has(c.id));
  const open = live.filter((c) => !mine.has(c.id));
  const past = items.filter((c) => challengeStatus(c) === "ended" && mine.has(c.id));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t("nav.challenges")}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {isStaff && <Text style={styles.note}>Create and manage challenges from the web portal.</Text>}
        {loading ? <ActivityIndicator color={C.navy} style={{ marginTop: 40 }} /> : items.length === 0 ? (
          <View style={{ alignItems: "center", padding: 40, gap: 8 }}>
            <Ionicons name="trophy-outline" size={40} color={C.grey} />
            <Text style={styles.title}>No challenges yet</Text>
            <Text style={[styles.sub, { textAlign: "center" }]}>New challenges from the ministry will appear here.</Text>
          </View>
        ) : (
          <>
            {joined.length > 0 && <Text style={styles.section}>My challenges</Text>}
            {joined.map((c, i) => <FadeInView key={c.id} delay={i * 60}><Card c={c} p={mine.get(c.id)} onPress={() => router.push(`/challenges/${c.id}` as any)} /></FadeInView>)}
            <Text style={styles.section}>Join a challenge</Text>
            {open.length === 0 && <Text style={styles.sub}>You{"'"}ve joined every open challenge.</Text>}
            {open.map((c, i) => <FadeInView key={c.id} delay={i * 60}><Card c={c} onPress={() => router.push(`/challenges/${c.id}` as any)} /></FadeInView>)}
            {past.length > 0 && <Text style={styles.section}>Past challenges</Text>}
            {past.map((c) => <Card key={c.id} c={c} p={mine.get(c.id)} onPress={() => router.push(`/challenges/${c.id}` as any)} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles({
  root:        { flex: 1, backgroundColor: L.bg },
  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: L.white, borderBottomWidth: 1, borderBottomColor: L.border },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: L.navy },
  content:     { padding: 16, gap: 12 },
  note:        { fontSize: 12, color: L.dark, backgroundColor: "#FFFBEB", padding: 10, borderRadius: 10 },
  section:     { fontSize: 13, fontWeight: "700", color: L.dark, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  card:        { backgroundColor: L.white, borderRadius: 20, borderWidth: 1, borderColor: L.border, overflow: "hidden" },
  cover:       { height: 110, backgroundColor: L.blue, alignItems: "center", justifyContent: "center" },
  pill:        { position: "absolute", top: 10, left: 10, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  donePill:    { left: undefined, right: 10, backgroundColor: L.yellow, flexDirection: "row", alignItems: "center", gap: 3 },
  pillTxt:     { fontSize: 10, fontWeight: "800" },
  cat:         { fontSize: 10, fontWeight: "700", color: L.grey, letterSpacing: 0.8 },
  title:       { fontSize: 16, fontWeight: "700", color: "#111827" },
  sub:         { fontSize: 12, color: L.grey },
  pct:         { fontSize: 12, fontWeight: "700", color: "#111827" },
  rowBetween:  { flexDirection: "row", justifyContent: "space-between" },
  track:       { height: 7, borderRadius: 999, backgroundColor: "#F3F4F6", overflow: "hidden" },
  fill:        { height: "100%", borderRadius: 999 },
  joinBtn:     { alignSelf: "flex-start", marginTop: 8, backgroundColor: L.yellow, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  joinTxt:     { fontSize: 12, fontWeight: "800", color: L.navy },
});
