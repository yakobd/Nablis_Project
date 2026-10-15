import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import {
  useAuth, addChallengeCount, challengeCategory, challengeDays, challengeProgressId, challengeStatus, challengeTotals,
  joinChallenge, setChallengeDay, setChallengeStep, toIsoDate, type ChallengeDoc, type ChallengeProgress,
} from "@nablis/shared/firebase";
import { db } from "../../lib/firebase";
import { challengeIcon } from "../../lib/challengeIcons";
import { themedStyles, themedColors } from "../../theme";
import i18n from "@nablis/i18n";

const L = { navy: "#1B2E6B", blue: "#1E3A8A", yellow: "#F5C518", light: "#EEF1F8", grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB", white: "#FFFFFF", bg: "#F9FAFB", green: "#22C55E" };
const C = themedColors(L);

export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [c, setC] = useState<ChallengeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<ChallengeProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const today = toIsoDate(new Date());

  useEffect(() => {
    if (!id || !user) return;
    const u1 = onSnapshot(doc(db, "challenges", id), (snap) => {
      setC(snap.exists() ? ({ id: snap.id, ...snap.data() } as ChallengeDoc) : null);
      setLoading(false);
    }, () => setLoading(false));
    const u2 = onSnapshot(doc(db, "challengeProgress", challengeProgressId(id, user.id)), (snap) => {
      setMine(snap.exists() ? ({ id: snap.id, ...snap.data() } as ChallengeProgress) : null);
    }, () => {});
    return () => { u1(); u2(); };
  }, [id, user]);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    try { await fn(); after?.(); }
    catch { Alert.alert("Not saved", "Please check your connection and try again."); }
    finally { setBusy(false); }
  }

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={C.navy} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{i18n.t("nav.challenge")}</Text>
    </View>
  );

  if (loading || !c || !user) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        {loading ? <ActivityIndicator color={C.navy} style={{ marginTop: 40 }} /> : <Text style={styles.empty}>This challenge is no longer available.</Text>}
      </View>
    );
  }

  const challenge = c;
  const me = user;
  const cat = challengeCategory(challenge.category);
  const status = challengeStatus(challenge, today);
  const t = challengeTotals(challenge, mine);
  const joined = !!mine;
  const canTrack = joined && status !== "upcoming";
  const doneDays = new Set(mine?.days ?? []);
  const celebrate = (next: number) => { if (!t.complete && next >= t.total) Alert.alert("Challenge complete!", `Well done finishing "${challenge.title}".`); };

  function leave() {
    Alert.alert("Leave challenge?", "Your progress will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => run(() => deleteDoc(doc(db, "challengeProgress", challengeProgressId(challenge.id, me.id)))) },
    ]);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.hero}>
          {challenge.imageURL && <Image source={{ uri: challenge.imageURL }} style={[StyleSheet.absoluteFill, { opacity: 0.3 }]} />}
          <View style={styles.heroCatRow}>
            <Ionicons name={challengeIcon(cat.key)} size={13} color={C.yellow} />
            <Text style={styles.heroCat}>{cat.label.toUpperCase()} · {status.toUpperCase()}</Text>
          </View>
          <Text style={styles.heroTitle}>{challenge.title}</Text>
          <Text style={styles.heroSub}>
            {new Date(`${challenge.startDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(`${challenge.endDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
          {!!challenge.description && <Text style={styles.heroDesc}>{challenge.description}</Text>}
          {!joined && status !== "ended" && (
            <TouchableOpacity style={styles.joinBtn} disabled={busy} onPress={() => run(() => joinChallenge(challenge, me), () => Alert.alert("You're in!", status === "upcoming" ? "We'll see you on day one." : "Let's go!"))}>
              <Text style={styles.joinTxt}>Join Challenge</Text>
            </TouchableOpacity>
          )}
        </View>

        {joined && (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{t.complete ? "Complete!" : "Your progress"}</Text>
                <Text style={styles.pct}>{t.pct}%</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${t.pct}%`, backgroundColor: t.complete ? C.yellow : C.blue }]} /></View>
              <Text style={styles.sub}>{t.done} of {t.total} {challenge.kind === "goal" ? challenge.unit : challenge.kind === "daily" ? "days" : "steps"}</Text>
            </View>

            {challenge.kind === "daily" && (
              <View style={styles.card}>
                {canTrack && status === "active" && (
                  <TouchableOpacity disabled={busy} style={[styles.bigBtn, { backgroundColor: doneDays.has(today) ? C.green : C.yellow }]}
                    onPress={() => { if (!doneDays.has(today)) celebrate(t.done + 1); run(() => setChallengeDay(challenge, me, today, !doneDays.has(today))); }}>
                    <Ionicons name="checkmark" size={18} color={doneDays.has(today) ? C.white : C.navy} />
                    <Text style={[styles.bigBtnTxt, { color: doneDays.has(today) ? C.white : C.navy }]}>{doneDays.has(today) ? "Done today" : "Mark today done"}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.grid}>
                  {challengeDays(challenge).map((d, i) => {
                    const done = doneDays.has(d);
                    const future = d > today;
                    return (
                      <TouchableOpacity key={d} style={styles.cell} disabled={!canTrack || future || busy}
                        onPress={() => { if (!done) celebrate(t.done + 1); run(() => setChallengeDay(challenge, me, d, !done)); }}>
                        <View style={[styles.cellInner, { backgroundColor: done ? C.blue : d === today ? "#FEF9C3" : future ? C.bg : "#FEF2F2" }]}>
                          {done ? <Ionicons name="checkmark" size={14} color={C.white} /> : <Text style={[styles.cellTxt, { color: future ? "#D1D5DB" : C.dark }]}>{i + 1}</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {challenge.kind === "goal" && (
              <View style={styles.card}>
                <Text style={styles.count}>{mine?.count ?? 0}<Text style={styles.countOf}> / {challenge.target} {challenge.unit}</Text></Text>
                {canTrack && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {[1, 5, 10].map((n) => (
                      <TouchableOpacity key={n} disabled={busy} style={styles.addBtn} onPress={() => { celebrate((mine?.count ?? 0) + n); run(() => addChallengeCount(challenge, me, n)); }}>
                        <Text style={styles.addTxt}>+{n}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity disabled={busy || (mine?.count ?? 0) <= 0} style={[styles.addBtn, { backgroundColor: C.light }]} onPress={() => run(() => addChallengeCount(challenge, me, -1))}>
                      <Text style={[styles.addTxt, { color: C.dark }]}>−1</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {challenge.kind === "checklist" && (
              <View style={styles.card}>
                {(challenge.steps ?? []).map((s, i) => {
                  const done = (mine?.stepsDone ?? []).includes(i);
                  return (
                    <TouchableOpacity key={i} disabled={!canTrack || busy} style={styles.stepRow}
                      onPress={() => { if (!done) celebrate(t.done + 1); run(() => setChallengeStep(challenge, me, i, !done)); }}>
                      <View style={[styles.stepBox, done && { backgroundColor: C.green, borderColor: C.green }]}>{done && <Ionicons name="checkmark" size={14} color={C.white} />}</View>
                      <Text style={[styles.stepTxt, done && { color: C.grey, textDecorationLine: "line-through" }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {status === "upcoming" && <Text style={styles.sub}>Tracking opens when the challenge starts.</Text>}
            <TouchableOpacity onPress={leave} style={{ alignSelf: "center", padding: 8 }}>
              <Text style={[styles.sub, { color: "#DC2626" }]}>Leave challenge</Text>
            </TouchableOpacity>
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
  headerTitle: { fontSize: 20, fontWeight: "800", color: L.navy, flex: 1 },
  content:     { padding: 16, gap: 14 },
  empty:       { fontSize: 14, color: L.grey, textAlign: "center", marginTop: 40 },
  hero:        { backgroundColor: L.blue, borderRadius: 22, padding: 20, overflow: "hidden", gap: 6 },
  heroCatRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  heroCat:     { fontSize: 11, fontWeight: "700", color: L.yellow, letterSpacing: 0.8 },
  heroTitle:   { fontSize: 24, fontWeight: "800", color: L.white },
  heroSub:     { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  heroDesc:    { fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 20, marginTop: 6 },
  joinBtn:     { alignSelf: "flex-start", backgroundColor: L.yellow, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, marginTop: 10 },
  joinTxt:     { fontSize: 14, fontWeight: "800", color: L.navy },
  card:        { backgroundColor: L.white, borderRadius: 18, borderWidth: 1, borderColor: L.border, padding: 16, gap: 10 },
  cardTitle:   { fontSize: 16, fontWeight: "700", color: "#111827" },
  rowBetween:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pct:         { fontSize: 16, fontWeight: "800", color: "#111827" },
  track:       { height: 8, borderRadius: 999, backgroundColor: "#F3F4F6", overflow: "hidden" },
  fill:        { height: "100%", borderRadius: 999 },
  sub:         { fontSize: 12, color: L.grey },
  bigBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, paddingVertical: 12 },
  bigBtnTxt:   { fontSize: 15, fontWeight: "800" },
  grid:        { flexDirection: "row", flexWrap: "wrap" },
  cell:        { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  cellInner:   { flex: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cellTxt:     { fontSize: 12, fontWeight: "600" },
  count:       { fontSize: 40, fontWeight: "800", color: "#111827" },
  countOf:     { fontSize: 16, fontWeight: "500", color: L.grey },
  addBtn:      { flex: 1, backgroundColor: L.blue, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  addTxt:      { fontSize: 15, fontWeight: "800", color: L.white },
  stepRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  stepBox:     { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  stepTxt:     { fontSize: 14, color: "#111827", flex: 1 },
});
