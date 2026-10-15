import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, type Announcement } from "@nablis/shared/firebase";
import { db } from "../../lib/firebase";
import { FadeInView } from "../../components/FadeInView";
import { themedStyles, themedColors } from "../../theme";
import i18n from "@nablis/i18n";

const L = { navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8", grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB", white: "#FFFFFF", bg: "#F9FAFB" };
const C = themedColors(L);

function fmtWhen(a: Announcement) {
  const d = (a.eventDate ?? a.createdAt)?.toDate?.();
  return d ? d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [attended, setAttended] = useState<Set<string>>(new Set());

  useEffect(() => onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap) => {
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
    setLoading(false);
  }, () => setLoading(false)), []);

  useEffect(() => {
    if (!user || isStaff) return;
    return onSnapshot(query(collection(db, "checkIns"), where("userId", "==", user.id)), (snap) => {
      setAttended(new Set(snap.docs.map((d) => d.data().sessionId as string)));
    });
  }, [user, isStaff]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>{i18n.t("nav.announcements")}</Text>
        <TouchableOpacity style={styles.passBtn} onPress={() => router.push("/announcements/pass" as any)}>
          <Ionicons name="qr-code-outline" size={16} color={C.navy} />
          <Text style={styles.passTxt}>My Pass</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={C.navy} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
          {items.length === 0 && <Text style={styles.empty}>No announcements yet.</Text>}
          {items.map((a, i) => {
            const upcoming = !a.eventDate || a.eventDate.toDate().getTime() > Date.now() - 6 * 3600_000;
            const went = attended.has(a.id);
            return (
              <FadeInView key={a.id} delay={i * 60} style={styles.card}>
                {a.imageURL ? <Image source={{ uri: a.imageURL }} style={styles.image} /> : null}
                <View style={styles.cardBody}>
                  <View style={styles.badges}>
                    {a.attendanceRequired && <Text style={styles.badgeReq}>ATTENDANCE REQUIRED</Text>}
                    {!isStaff && went && <Text style={styles.badgeOk}><Ionicons name="checkmark" size={10} color="#15803D" /> YOU ATTENDED</Text>}
                  </View>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.body}>{a.body}</Text>
                  <Text style={styles.meta}>
                    {fmtWhen(a)}{a.location ? `  ·  ${a.location}` : ""}
                  </Text>
                  {isStaff && a.attendanceRequired && upcoming && (
                    <TouchableOpacity style={styles.primary} onPress={() => router.push({ pathname: "/announcements/checkin", params: { id: a.id, title: a.title } } as any)}>
                      <Ionicons name="scan" size={18} color={C.white} />
                      <Text style={styles.primaryTxt}>Check in members</Text>
                    </TouchableOpacity>
                  )}
                  {!isStaff && a.attendanceRequired && upcoming && !went && (
                    <TouchableOpacity style={[styles.primary, { backgroundColor: C.yellow }]} onPress={() => router.push("/announcements/pass" as any)}>
                      <Ionicons name="qr-code" size={18} color={C.navy} />
                      <Text style={[styles.primaryTxt, { color: C.navy }]}>Show my pass</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </FadeInView>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = themedStyles({
  root:      { flex: 1, backgroundColor: L.bg },
  header:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: L.white, borderBottomWidth: 1, borderBottomColor: L.border },
  iconBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  title:     { flex: 1, fontSize: 20, fontWeight: "800", color: L.navy },
  passBtn:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: L.yellow },
  passTxt:   { fontSize: 12, fontWeight: "700", color: L.navy },
  list:      { padding: 16, gap: 14 },
  empty:     { textAlign: "center", color: L.grey, marginTop: 40 },
  card:      { backgroundColor: L.white, borderRadius: 18, borderWidth: 1, borderColor: L.border, overflow: "hidden" },
  image:     { width: "100%", height: 160 },
  cardBody:  { padding: 16, gap: 6 },
  badges:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badgeReq:  { fontSize: 10, fontWeight: "800", color: "#A16207", backgroundColor: "#FFF8DB", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  badgeOk:   { fontSize: 10, fontWeight: "800", color: "#15803D", backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  body:      { fontSize: 14, color: L.dark, lineHeight: 20 },
  meta:      { fontSize: 12, color: L.grey, marginTop: 2 },
  primary:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, paddingVertical: 12, borderRadius: 12, backgroundColor: L.navy },
  primaryTxt:{ color: L.white, fontWeight: "700", fontSize: 14 },
});
