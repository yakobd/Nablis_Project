import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, getDocs, doc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useAuth } from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const C = {
  navy:   "#1B2E6B",
  yellow: "#F5C518",
  light:  "#EEF1F8",
  grey:   "#9CA3AF",
  dark:   "#374151",
  border: "#E5E7EB",
  white:  "#FFFFFF",
  bg:     "#F9FAFB",
};

interface BibleStudy {
  id: string;
  title: string;
  teacherName: string;
  memberCount: number;
  fileCount: number;
  startDate?: Timestamp;
  status: "active" | "upcoming" | "completed";
  description?: string;
  members?: string[];
  materials?: string[];
}

function fmtDate(ts?: Timestamp) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    active:    { bg: "#DCFCE7", text: "#16A34A" },
    upcoming:  { bg: "#FEF9C3", text: "#92400E" },
    completed: { bg: "#F3F4F6", text: "#6B7280" },
  };
  const s = map[status] ?? map.completed;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeTxt, { color: s.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={styles.pbTrack}>
      <View style={[styles.pbFill, { width: `${pct}%` as any }]} />
    </View>
  );
}

export default function BibleStudyScreen() {
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const [studies, setStudies] = useState<BibleStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, "bibleStudies")))
      .then((snap) => {
        setStudies(snap.docs.map((d) => {
          const data = d.data();
          return {
            id:          d.id,
            title:       data.title ?? "",
            teacherName: data.teacher ?? data.teacherName ?? "",
            memberCount: data.members?.length ?? 0,
            fileCount:   data.materials?.length ?? 0,
            startDate:   data.startDate,
            status:      data.status ?? "upcoming",
            description: data.description ?? "",
            members:     data.members ?? [],
            materials:   data.materials ?? [],
          } as BibleStudy;
        }));
      })
      .finally(() => setLoading(false));
  }, []);

  const myStudies   = studies.filter((s) => s.members?.includes(user?.id ?? ""));
  const otherStudies = studies.filter((s) => !s.members?.includes(user?.id ?? ""));
  const completed   = myStudies.filter((s) => s.status === "completed").length;
  const progress    = myStudies.length > 0 ? Math.round((completed / myStudies.length) * 100) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bible Study</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome + progress */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeLeft}>
            <Text style={styles.welcomeGreet}>Welcome back,</Text>
            <Text style={styles.welcomeName}>{user?.displayName?.split(" ")[0] || "Member"}</Text>
            <Text style={styles.welcomeSub}>{myStudies.length} studies enrolled</Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressNum}>{progress}%</Text>
            <Text style={styles.progressLabel}>Done</Text>
          </View>
        </View>

        {/* My Studies */}
        {loading ? (
          <ActivityIndicator color={C.navy} style={{ marginTop: 20 }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>My Studies</Text>
            {myStudies.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="book-outline" size={32} color={C.grey} style={{ opacity: 0.3 }} />
                <Text style={styles.emptyTxt}>You&apos;re not enrolled in any studies yet.</Text>
              </View>
            ) : (
              myStudies.map((s) => (
                <View key={s.id} style={styles.studyCard}>
                  <View style={styles.studyIcon}>
                    <Ionicons name="book" size={22} color={C.navy} />
                  </View>
                  <View style={styles.studyInfo}>
                    <View style={styles.studyTop}>
                      <Text style={styles.studyTitle} numberOfLines={1}>{s.title}</Text>
                      <StatusBadge status={s.status} />
                    </View>
                    <Text style={styles.studyMeta}>Teacher: {s.teacherName}</Text>
                    <View style={styles.studyStats}>
                      <View style={styles.studyStat}>
                        <Ionicons name="people-outline" size={11} color={C.grey} />
                        <Text style={styles.studyStatTxt}> {s.memberCount}</Text>
                      </View>
                      <View style={styles.studyStat}>
                        <Ionicons name="document-text-outline" size={11} color={C.grey} />
                        <Text style={styles.studyStatTxt}> {s.fileCount} files</Text>
                      </View>
                      <View style={styles.studyStat}>
                        <Ionicons name="time-outline" size={11} color={C.grey} />
                        <Text style={styles.studyStatTxt}> {fmtDate(s.startDate)}</Text>
                      </View>
                    </View>
                    {s.status !== "completed" && (
                      <ProgressBar value={s.status === "active" ? 60 : 0} max={100} />
                    )}
                  </View>
                </View>
              ))
            )}

            {/* Available Studies */}
            {otherStudies.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Available Studies</Text>
                {otherStudies.map((s) => (
                  <View key={s.id} style={[styles.studyCard, styles.studyCardMuted]}>
                    <View style={[styles.studyIcon, { backgroundColor: "#F3F4F6" }]}>
                      <Ionicons name="book-outline" size={22} color={C.grey} />
                    </View>
                    <View style={styles.studyInfo}>
                      <View style={styles.studyTop}>
                        <Text style={styles.studyTitle} numberOfLines={1}>{s.title}</Text>
                        <StatusBadge status={s.status} />
                      </View>
                      <Text style={styles.studyMeta}>Teacher: {s.teacherName}</Text>
                      <TouchableOpacity
                        style={[styles.joinBtn, joiningId === s.id && { opacity: 0.6 }]}
                        disabled={joiningId === s.id}
                        onPress={async () => {
                          if (!user) return;
                          setJoiningId(s.id);
                          try {
                            await updateDoc(doc(db, "bibleStudies", s.id), {
                              members: arrayUnion(user.id),
                            });
                            setStudies((prev) => prev.map((x) =>
                              x.id === s.id ? { ...x, members: [...(x.members ?? []), user.id] } : x
                            ));
                          } finally {
                            setJoiningId(null);
                          }
                        }}
                      >
                        {joiningId === s.id
                          ? <ActivityIndicator size="small" color={C.navy} />
                          : <Text style={styles.joinTxt}>Request to Join</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: "800", color: C.navy, textAlign: "center" },
  content:      { paddingHorizontal: 16 },
  welcomeCard:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.navy, borderRadius: 20, padding: 20, marginBottom: 20 },
  welcomeLeft:  { flex: 1 },
  welcomeGreet: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 2 },
  welcomeName:  { color: C.white, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  welcomeSub:   { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  progressCircle:{ width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: C.yellow },
  progressNum:  { color: C.yellow, fontSize: 18, fontWeight: "800" },
  progressLabel:{ color: "rgba(255,255,255,0.7)", fontSize: 9 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.navy, marginBottom: 12 },
  emptyWrap:    { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyTxt:     { fontSize: 14, color: C.grey, textAlign: "center" },
  studyCard:    { flexDirection: "row", gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  studyCardMuted:{ borderColor: "#F3F4F6" },
  studyIcon:    { width: 44, height: 44, borderRadius: 12, backgroundColor: C.light, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  studyInfo:    { flex: 1 },
  studyTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  studyTitle:   { flex: 1, fontSize: 14, fontWeight: "700", color: C.navy, marginRight: 8 },
  studyMeta:    { fontSize: 12, color: C.grey, marginBottom: 8 },
  studyStats:   { flexDirection: "row", gap: 12, marginBottom: 8 },
  studyStat:    { flexDirection: "row", alignItems: "center" },
  studyStatTxt: { fontSize: 11, color: C.grey },
  pbTrack:      { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" },
  pbFill:       { height: 4, backgroundColor: C.navy, borderRadius: 2 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTxt:     { fontSize: 9, fontWeight: "700" },
  joinBtn:      { marginTop: 4, backgroundColor: C.light, borderRadius: 8, paddingVertical: 6, alignItems: "center" },
  joinTxt:      { fontSize: 12, fontWeight: "700", color: C.navy },
});
