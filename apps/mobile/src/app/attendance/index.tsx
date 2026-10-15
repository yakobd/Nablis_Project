import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, orderBy, onSnapshot, doc, getDoc, updateDoc, where, Timestamp,
} from "firebase/firestore";
import { CameraView, useCameraPermissions } from "expo-camera";
import { db } from '../../lib/firebase';
import { useAuth, checkIn, parseCheckInQR, attendanceSummary, type Attendance, type CheckIn } from '@nablis/shared/firebase';
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { themedStyles, themedColors } from "../../theme";
import i18n from "@nablis/i18n";

const L = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark:   "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg:    "#F9FAFB", green: "#16A34A",
};
const C = themedColors(L);

function fmtDate(ts?: Timestamp | null) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}
function fmtTime(ts?: Timestamp | null) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    completed: { bg: "#F3F4F6", text: "#6B7280" },
    active:    { bg: "#DCFCE7", text: "#16A34A" },
    upcoming:  { bg: "#FEF9C3", text: "#92400E" },
  };
  const s = map[status] ?? map.completed;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeTxt, { color: s.text }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
    </View>
  );
}

function useSessions() {
  const [sessions, setSessions] = useState<Attendance[]>([]);
  const [loading, setLoading]   = useState(true);
  useEffect(() => onSnapshot(
    query(collection(db, "attendance"), orderBy("date", "desc")),
    (snap) => { setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance))); setLoading(false); },
    () => setLoading(false)
  ), []);
  return { sessions, loading };
}

// ─── QR scanner ───────────────────────────────────────────────────────────────
function Scanner({ visible, onClose, onScanned }: {
  visible: boolean;
  onClose: () => void;
  onScanned: (sessionId: string, code: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  useEffect(() => { if (visible) setHandled(false); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.scannerRoot}>
        {!permission ? (
          <ActivityIndicator color={C.white} />
        ) : !permission.granted ? (
          <View style={styles.scannerMsg}>
            <Text style={styles.scannerTxt}>Camera access is needed to scan the attendance QR code.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryTxt}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handled ? undefined : ({ data }) => {
              const parsed = parseCheckInQR(data);
              if (!parsed) return;
              setHandled(true);
              onScanned(parsed.sessionId, parsed.code);
            }}
          />
        )}
        <View style={styles.scannerFrame} pointerEvents="none" />
        <TouchableOpacity style={styles.scannerClose} onPress={onClose}>
          <Ionicons name="close" size={26} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.scannerHint}>Point the camera at the QR code shown at the meeting</Text>
      </View>
    </Modal>
  );
}

// ─── Member view ──────────────────────────────────────────────────────────────
function MemberAttendance() {
  const { user } = useAuth();
  const { sessions, loading } = useSessions();
  const [mine, setMine]       = useState<CheckIn[]>([]);
  const [scanning, setScanning] = useState(false);
  const [codes, setCodes]     = useState<Record<string, string>>({});
  const [busy, setBusy]       = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "checkIns"), where("userId", "==", user.id)), (snap) => {
      setMine(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckIn)));
    });
  }, [user]);

  const attended = useMemo(() => new Set(mine.map((c) => c.sessionId)), [mine]);
  const open = sessions.filter((s) => s.status === "active" && !attended.has(s.id));
  const summary = user ? attendanceSummary(sessions, user.id, attended, user.createdAt) : null;
  // Every gathering since joining that has happened, or that they attended.
  const since = (user?.createdAt?.toMillis?.() ?? 0) - 86400000;
  const history = sessions.filter((s) => {
    const at = (s.date ?? s.createdAt)?.toMillis?.() ?? 0;
    return attended.has(s.id) || (s.status !== "upcoming" && at <= Date.now() && at >= since);
  });
  const pct = summary?.percent ?? null;
  const R = 34, CIRC = 2 * Math.PI * R;

  async function submit(sessionId: string, code: string) {
    if (!user || !code.trim()) return;
    setBusy(sessionId);
    const result = await checkIn(sessionId, code, user);
    setBusy(null);
    const title = sessions.find((s) => s.id === sessionId)?.meetingTitle ?? "the meeting";
    if (result === "ok") Alert.alert("Checked in", `Welcome! You're checked in to ${title}.`);
    else if (result === "already") Alert.alert("Already checked in", `You're already checked in to ${title}.`);
    else Alert.alert("Not accepted", "That code is not valid, or check-in for this session has closed.");
  }

  return (
    <>
      <View style={[styles.card, styles.pctCard]}>
        <View style={{ width: 84, height: 84, alignItems: "center", justifyContent: "center" }}>
          <Svg width={84} height={84} viewBox="0 0 84 84" style={StyleSheet.absoluteFill}>
            <Circle cx={42} cy={42} r={R} stroke="#F3F4F6" strokeWidth={8} fill="none" />
            <Circle cx={42} cy={42} r={R} stroke={C.yellow} strokeWidth={8} fill="none" strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`} strokeDashoffset={CIRC - ((pct ?? 0) / 100) * CIRC}
              transform="rotate(-90 42 42)" />
          </Svg>
          <Text style={styles.pctNum}>{pct === null ? "—" : `${pct}%`}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Attendance Percentage</Text>
          <Text style={styles.pctHead}>{pct === null ? "Welcome!" : pct >= 90 ? "Keep it up!" : pct >= 70 ? "You're doing well" : "Every gathering counts"}</Text>
          <Text style={styles.cardSub}>
            {summary && summary.total ? `${summary.attended} of ${summary.total} gatherings · Goal 90%` : "Your rate appears after your first gathering."}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.scanBtn} onPress={() => setScanning(true)} activeOpacity={0.85}>
        <Ionicons name="qr-code-outline" size={22} color={C.navy} />
        <Text style={styles.scanTxt}>Scan QR to Check In</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={C.navy} style={{ marginTop: 32 }} />
      ) : (
        <>
          {open.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{s.meetingTitle}</Text>
                  <Text style={styles.cardSub}>Check-in open · {fmtDate(s.date)}</Text>
                </View>
                <StatusBadge status={s.status} />
              </View>
              <View style={styles.codeRow}>
                <TextInput
                  style={styles.codeInput}
                  value={codes[s.id] ?? ""}
                  onChangeText={(t) => setCodes((p) => ({ ...p, [s.id]: t.toUpperCase() }))}
                  placeholder="Enter code"
                  placeholderTextColor={C.grey}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, (!codes[s.id]?.trim() || busy === s.id) && { opacity: 0.5 }]}
                  disabled={!codes[s.id]?.trim() || busy === s.id}
                  onPress={() => submit(s.id, codes[s.id] ?? "")}
                >
                  {busy === s.id ? <ActivityIndicator color={C.white} size="small" /> : <Text style={styles.primaryTxt}>Check in</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Your Attendance History</Text>
          {history.length === 0 ? (
            <Text style={styles.empty}>No gatherings yet since you joined.</Text>
          ) : history.map((s) => {
            const went = attended.has(s.id);
            return (
              <View key={s.id} style={[styles.card, styles.rowBetween]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{s.meetingTitle}</Text>
                  <Text style={styles.cardSub}>{fmtDate(s.date)} · {fmtTime(s.date)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: went ? "#DCFCE7" : "#FEE2E2", flexDirection: "row", alignItems: "center", gap: 4 }]}>
                  <Ionicons name={went ? "checkmark-circle" : "close-circle"} size={14} color={went ? C.green : "#DC2626"} />
                  <Text style={[styles.badgeTxt, { color: went ? C.green : "#DC2626" }]}>{went ? "Attended" : "Absent"}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      <Scanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(sessionId, code) => { setScanning(false); submit(sessionId, code); }}
      />
    </>
  );
}

// ─── Admin view ───────────────────────────────────────────────────────────────
function AdminAttendance() {
  const { sessions, loading } = useSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode]       = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  useEffect(() => {
    if (!selectedId && sessions.length) {
      setSelectedId((sessions.find((s) => s.status === "active") ?? sessions[0]).id);
    }
  }, [sessions, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setCode(null);
    getDoc(doc(db, "attendanceCodes", selectedId)).then((s) => setCode(s.data()?.code ?? null)).catch(() => {});
    return onSnapshot(query(collection(db, "checkIns"), where("sessionId", "==", selectedId)), (snap) => {
      setCheckIns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckIn))
        .sort((a, b) => (b.checkedInAt?.toMillis?.() ?? 0) - (a.checkedInAt?.toMillis?.() ?? 0)));
    });
  }, [selectedId]);

  const selected = sessions.find((s) => s.id === selectedId);

  async function setStatus(status: Attendance["status"]) {
    if (!selected) return;
    try { await updateDoc(doc(db, "attendance", selected.id), { status }); }
    catch { Alert.alert("Error", "Could not update the session."); }
  }

  if (loading) return <ActivityIndicator color={C.navy} style={{ marginTop: 32 }} />;
  if (!selected) {
    return <Text style={styles.empty}>No sessions yet. Create one from the web dashboard (Attendance › New Session).</Text>;
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{selected.meetingTitle}</Text>
            <Text style={styles.cardSub}>{fmtDate(selected.date)} · {fmtTime(selected.date)}</Text>
          </View>
          <StatusBadge status={selected.status} />
        </View>
        <Text style={styles.bigCode}>{code ?? "······"}</Text>
        <Text style={styles.cardSub}>Members can type this code to check in. Show the QR code from the web dashboard for scanning.</Text>
        <View style={styles.statRow}>
          <Text style={styles.statNum}>{checkIns.length}</Text>
          <Text style={styles.cardSub}>
            checked in{selected.totalCapacity ? ` of ${selected.totalCapacity} expected` : ""}
          </Text>
        </View>
        {selected.status === "active" ? (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => setStatus("completed")}>
            <Text style={[styles.primaryTxt, { color: "#DC2626" }]}>End Session</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStatus("active")}>
            <Text style={styles.primaryTxt}>{selected.status === "completed" ? "Reopen" : "Start"} Check-in</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Checked In</Text>
      {checkIns.length === 0 ? (
        <Text style={styles.empty}>No check-ins yet.</Text>
      ) : checkIns.map((c) => (
        <View key={c.id} style={[styles.listRow, styles.rowBetween]}>
          <Text style={styles.listName}>{c.userName}</Text>
          <Text style={styles.cardSub}>{fmtTime(c.checkedInAt)}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>All Sessions</Text>
      {sessions.map((s) => (
        <TouchableOpacity key={s.id} onPress={() => setSelectedId(s.id)}
          style={[styles.listRow, styles.rowBetween, s.id === selectedId && { backgroundColor: C.light }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listName}>{s.meetingTitle}</Text>
            <Text style={styles.cardSub}>{fmtDate(s.date)}</Text>
          </View>
          <StatusBadge status={s.status} />
        </TouchableOpacity>
      ))}
    </>
  );
}

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t("nav.attendance")}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {isStaff ? <AdminAttendance /> : <MemberAttendance />}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles({
  root:         { flex: 1, backgroundColor: L.bg },
  header:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: L.white, borderBottomWidth: 1, borderBottomColor: L.border },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  headerTitle:  { fontSize: 20, fontWeight: "800", color: L.navy },
  content:      { padding: 16, gap: 12 },

  pctCard:      { flexDirection: "row", alignItems: "center", gap: 16 },
  pctNum:       { fontSize: 18, fontWeight: "800", color: "#111827" },
  pctHead:      { fontSize: 14, fontWeight: "600", color: L.dark, marginTop: 2 },
  scanBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: L.yellow, borderRadius: 14, paddingVertical: 16 },
  scanTxt:      { fontSize: 15, fontWeight: "700", color: L.navy },

  card:         { backgroundColor: L.white, borderRadius: 16, borderWidth: 1, borderColor: L.border, padding: 16, gap: 10 },
  rowBetween:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle:    { fontSize: 15, fontWeight: "700", color: L.navy },
  cardSub:      { fontSize: 12, color: L.grey },
  codeRow:      { flexDirection: "row", gap: 8 },
  codeInput:    { flex: 1, borderWidth: 1, borderColor: L.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, letterSpacing: 3, color: L.dark },
  primaryBtn:   { backgroundColor: L.navy, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  primaryTxt:   { color: L.white, fontWeight: "700", fontSize: 14 },

  bigCode:      { fontSize: 36, fontWeight: "800", letterSpacing: 8, color: L.navy, textAlign: "center", marginVertical: 6 },
  statRow:      { flexDirection: "row", alignItems: "baseline", gap: 8 },
  statNum:      { fontSize: 28, fontWeight: "800", color: L.navy },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: L.dark, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  empty:        { fontSize: 13, color: L.grey, textAlign: "center", paddingVertical: 16 },
  listRow:      { backgroundColor: L.white, borderRadius: 12, borderWidth: 1, borderColor: L.border, paddingHorizontal: 14, paddingVertical: 12 },
  listName:     { fontSize: 14, fontWeight: "600", color: L.dark },

  badge:        { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt:     { fontSize: 11, fontWeight: "700" },

  scannerRoot:  { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  scannerMsg:   { padding: 32, gap: 16, alignItems: "center" },
  scannerTxt:   { color: L.white, fontSize: 15, textAlign: "center" },
  scannerFrame: { position: "absolute", width: 240, height: 240, borderWidth: 3, borderColor: L.yellow, borderRadius: 20 },
  scannerClose: { position: "absolute", top: 48, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  scannerHint:  { position: "absolute", bottom: 64, color: L.white, fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
});
