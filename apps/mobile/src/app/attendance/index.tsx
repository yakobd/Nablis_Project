import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, orderBy, getDocs, addDoc, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useAuth } from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/Avatar";

const C = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark:   "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg:    "#F9FAFB",
};

interface AttendanceRecord {
  id: string;
  meetingTitle: string;
  date?: Timestamp;
  status: string;
  totalCapacity?: number;
}

interface CheckIn {
  id: string;
  userId: string;
  displayName: string;
  checkedInAt?: Timestamp;
}

function fmtDate(ts?: Timestamp) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function fmtTime(ts?: Timestamp) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    completed: { bg: "#DCFCE7", text: "#16A34A" },
    active:    { bg: "#DBEAFE", text: "#1D4ED8" },
    upcoming:  { bg: "#FEF9C3", text: "#92400E" },
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

function QRPlaceholder() {
  const cells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return row === 0 || row === 7 || col === 0 || col === 7 ||
      (row > 1 && row < 6 && col > 1 && col < 6 && (i % 3 === 0));
  });
  return (
    <View style={styles.qrGrid}>
      {cells.map((on, i) => (
        <View key={i} style={[styles.qrCell, on && styles.qrCellOn]} />
      ))}
    </View>
  );
}

// ─── Admin Attendance ─────────────────────────────────────────────────────────
function AdminAttendance() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const [checkIns, setCheckIns]   = useState<CheckIn[]>([]);
  const [sessions, setSessions]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]     = useState(true);

  function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function todayEnd()   { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

  async function load() {
    setLoading(true);
    try {
      const [checkInsSnap, sessionsSnap] = await Promise.all([
        getDocs(query(
          collection(db, "checkIns"),
          where("checkedInAt", ">=", Timestamp.fromDate(todayStart())),
          where("checkedInAt", "<=", Timestamp.fromDate(todayEnd()))
        )),
        getDocs(query(collection(db, "attendance"), orderBy("date", "desc"))),
      ]);
      setCheckIns(checkInsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckIn)));
      setSessions(sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={C.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{sessions.length}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: "#16A34A" }]}>{checkIns.length}</Text>
            <Text style={styles.statLabel}>Today's Check-ins</Text>
          </View>
        </View>

        {/* QR Code card */}
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Today's Session QR Code</Text>
          <Text style={styles.qrSub}>Display this QR code for members to scan and check in</Text>
          <QRPlaceholder />
          <View style={styles.qrInfo}>
            <Ionicons name="information-circle-outline" size={14} color={C.grey} />
            <Text style={styles.qrInfoTxt}>Dynamic QR generation requires a camera module</Text>
          </View>
        </View>

        {/* Today's check-ins */}
        <Text style={styles.sectionTitle}>Today's Check-ins ({checkIns.length})</Text>
        {loading ? (
          <ActivityIndicator color={C.navy} style={{ marginTop: 20 }} />
        ) : checkIns.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={36} color={C.grey} style={{ opacity: 0.3 }} />
            <Text style={styles.emptyTxt}>No check-ins today yet.</Text>
          </View>
        ) : (
          checkIns.map((c) => (
            <View key={c.id} style={styles.checkInRow}>
              <Avatar name={c.displayName} size={36} />
              <View style={styles.checkInInfo}>
                <Text style={styles.checkInName}>{c.displayName}</Text>
                <Text style={styles.checkInTime}>{fmtTime(c.checkedInAt)}</Text>
              </View>
              <View style={styles.checkInBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.checkInBadgeTxt}>Checked In</Text>
              </View>
            </View>
          ))
        )}

        {/* Session history */}
        {sessions.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Session History</Text>
            {sessions.map((a) => (
              <View key={a.id} style={styles.recordCard}>
                <View style={styles.recordLeft}>
                  <Text style={styles.recordTitle}>{a.meetingTitle}</Text>
                  <Text style={styles.recordDate}>{fmtDate(a.date)}</Text>
                </View>
                <StatusBadge status={a.status} />
              </View>
            ))}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ─── Member Attendance ────────────────────────────────────────────────────────
function MemberAttendance() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const [history, setHistory]     = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "attendance"), orderBy("date", "desc")))
      .then((snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
        setHistory(all.filter((a) => (a as any).attendees?.some((at: any) => at.userId === user.id)));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const attended = history.filter((a) => a.status === "completed").length;
  const rate     = history.length > 0 ? Math.round((attended / history.length) * 100) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Attendance</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{history.length}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: "#16A34A" }]}>{attended}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: C.yellow }]}>{rate}%</Text>
            <Text style={styles.statLabel}>Rate</Text>
          </View>
        </View>

        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Scan QR to Check In</Text>
          <Text style={styles.qrSub}>Ask your admin for today's QR code, then scan to mark attendance</Text>
          {checkedIn ? (
            <View style={styles.checkedInBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
              <Text style={styles.checkedInTxt}>Checked in for today!</Text>
            </View>
          ) : (
            <>
              <QRPlaceholder />
              <TouchableOpacity
                style={[styles.scanBtn, checkingIn && { opacity: 0.6 }]}
                disabled={checkingIn}
                onPress={async () => {
                  if (!user) return;
                  setCheckingIn(true);
                  try {
                    await addDoc(collection(db, "checkIns"), {
                      userId:      user.id,
                      displayName: user.displayName || user.email,
                      checkedInAt: serverTimestamp(),
                    });
                    setCheckedIn(true);
                    Alert.alert("Success", "You have been checked in!");
                  } catch {
                    Alert.alert("Error", "Failed to check in. Please try again.");
                  } finally {
                    setCheckingIn(false);
                  }
                }}
                activeOpacity={0.85}
              >
                {checkingIn
                  ? <ActivityIndicator size="small" color={C.white} />
                  : (
                    <>
                      <Ionicons name="qr-code-outline" size={18} color={C.white} />
                      <Text style={styles.scanTxt}> Scan QR Code</Text>
                    </>
                  )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Attendance History</Text>
        {loading ? (
          <ActivityIndicator color={C.navy} style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={36} color={C.grey} style={{ opacity: 0.3 }} />
            <Text style={styles.emptyTxt}>No attendance records found.</Text>
          </View>
        ) : (
          history.map((a) => (
            <View key={a.id} style={styles.recordCard}>
              <View style={styles.recordLeft}>
                <Text style={styles.recordTitle}>{a.meetingTitle}</Text>
                <Text style={styles.recordDate}>{fmtDate(a.date)}</Text>
              </View>
              <StatusBadge status={a.status} />
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function AttendanceScreen() {
  const { role } = useAuth();
  if (role === "admin") return <AdminAttendance />;
  return <MemberAttendance />;
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  headerTitle:   { flex: 1, fontSize: 18, fontWeight: "800", color: C.navy, textAlign: "center" },
  refreshBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: C.light, alignItems: "center", justifyContent: "center" },
  content:       { paddingHorizontal: 16 },
  statsRow:      { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard:      { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border },
  statNum:       { fontSize: 22, fontWeight: "800", color: C.navy, marginBottom: 2 },
  statLabel:     { fontSize: 10, color: C.grey, fontWeight: "600" },
  qrCard:        { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 24, alignItems: "center", borderWidth: 1, borderColor: C.border },
  qrTitle:       { fontSize: 15, fontWeight: "700", color: C.navy, marginBottom: 4 },
  qrSub:         { fontSize: 12, color: C.grey, textAlign: "center", marginBottom: 16, lineHeight: 18 },
  qrInfo:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  qrInfoTxt:     { fontSize: 11, color: C.grey, fontStyle: "italic" },
  qrGrid:        { width: 120, height: 120, flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  qrCell:        { width: 15, height: 15, backgroundColor: "#F3F4F6" },
  qrCellOn:      { backgroundColor: C.navy },
  scanBtn:       { flexDirection: "row", alignItems: "center", backgroundColor: C.navy, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  scanTxt:       { color: C.white, fontSize: 14, fontWeight: "700" },
  checkedInBadge:{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F0FDF4", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  checkedInTxt:  { fontSize: 14, fontWeight: "700", color: "#16A34A" },
  sectionTitle:  { fontSize: 15, fontWeight: "700", color: C.navy, marginBottom: 12 },
  emptyWrap:     { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTxt:      { fontSize: 14, color: C.grey },
  recordCard:    { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  recordLeft:    { flex: 1 },
  recordTitle:   { fontSize: 14, fontWeight: "600", color: C.dark, marginBottom: 3 },
  recordDate:    { fontSize: 12, color: C.grey },
  badge:         { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeTxt:      { fontSize: 10, fontWeight: "700" },
  // Admin check-in list
  checkInRow:    { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  checkInInfo:   { flex: 1 },
  checkInName:   { fontSize: 14, fontWeight: "600", color: C.dark },
  checkInTime:   { fontSize: 12, color: C.grey },
  checkInBadge:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FDF4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  checkInBadgeTxt:{ fontSize: 11, color: "#16A34A", fontWeight: "600" },
});
