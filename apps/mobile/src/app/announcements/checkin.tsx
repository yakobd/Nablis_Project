import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Vibration, ActivityIndicator, Image, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, parseMemberPass, staffCheckIn, type StaffCheckInResult } from "@nablis/shared/firebase";
import { db } from "../../lib/firebase";
import { themedStyles } from "../../theme";

const FEEDBACK: Record<StaffCheckInResult["status"], { title: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ok:       { title: "Checked in",              bg: "#16A34A", icon: "checkmark-circle" },
  already:  { title: "Already checked in",      bg: "#CA8A04", icon: "alert-circle" },
  invalid:  { title: "Not a valid member pass", bg: "#DC2626", icon: "close-circle" },
  inactive: { title: "Membership not active",   bg: "#DC2626", icon: "close-circle" },
  closed:   { title: "Check-in is closed",      bg: "#4B5563", icon: "lock-closed" },
};

// Staff scan member passes at the entrance; each scan checks the member in.
export default function CheckInScanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState<(StaffCheckInResult & { at: number }) | null>(null);
  const busy = useRef(false);
  const last = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    const unsubCount = onSnapshot(query(collection(db, "checkIns"), where("sessionId", "==", id)), (s) => setCount(s.size));
    const unsubSession = onSnapshot(doc(db, "attendance", id), (s) => setOpen(s.data()?.status === "active"));
    return () => { unsubCount(); unsubSession(); };
  }, [id]);

  function show(r: StaffCheckInResult) {
    setResult({ ...r, at: Date.now() });
    Vibration.vibrate(r.status === "ok" ? 80 : [0, 120, 80, 120]);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 2600, useNativeDriver: true }).start();
  }

  async function onScanned(value: string) {
    if (busy.current || !user || !id) return;
    const now = Date.now();
    if (value === last.current.value && now - last.current.at < 3000) return;
    last.current = { value, at: now };
    const pass = parseMemberPass(value);
    if (!pass) { show({ status: "invalid" }); return; }
    busy.current = true;
    try {
      show(await staffCheckIn(id, pass.uid, pass.passCode, user));
    } catch {
      show({ status: "invalid" });
    } finally {
      busy.current = false;
    }
  }

  const fb = result ? FEEDBACK[result.status] : null;

  return (
    <View style={styles.root}>
      {!permission ? (
        <ActivityIndicator color="#fff" style={{ flex: 1 }} />
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color="#fff" />
          <Text style={styles.centerTxt}>Camera access is needed to scan member passes.</Text>
          <TouchableOpacity style={styles.allowBtn} onPress={requestPermission}>
            <Text style={styles.allowTxt}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      ) : open ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => onScanned(data)}
        />
      ) : (
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={44} color="#fff" />
          <Text style={styles.centerTxt}>Check-in is closed for this gathering.</Text>
          <TouchableOpacity style={styles.allowBtn} onPress={() => updateDoc(doc(db, "attendance", id!), { status: "active" })}>
            <Text style={styles.allowTxt}>Reopen check-in</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle} numberOfLines={1}>{title || "Check-in"}</Text>
          <Text style={styles.topSub}>{count} checked in</Text>
        </View>
        {open && (
          <TouchableOpacity style={styles.closeBtn} onPress={() => updateDoc(doc(db, "attendance", id!), { status: "completed" })}>
            <Ionicons name="lock-closed-outline" size={14} color="#fff" />
            <Text style={styles.closeTxt}>Close</Text>
          </TouchableOpacity>
        )}
      </View>

      {open && permission?.granted && <View style={styles.frame} pointerEvents="none" />}

      {/* Result banner */}
      {fb && result && (
        <Animated.View style={[styles.result, { backgroundColor: fb.bg, paddingBottom: insets.bottom + 18, opacity: flash.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.92, 1, 1] }) }]}>
          {"photoURL" in result && result.photoURL
            ? <Image source={{ uri: result.photoURL }} style={styles.resultPhoto} />
            : <Ionicons name={fb.icon} size={44} color="#fff" />}
          <View style={{ flex: 1 }}>
            <Text style={styles.resultTitle}>{fb.title}</Text>
            {result.name ? <Text style={styles.resultName}>{result.name}</Text> : null}
          </View>
        </Animated.View>
      )}
      {!result && open && permission?.granted && (
        <View style={[styles.hint, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.hintTxt}>{"Point the camera at a member's pass"}</Text>
        </View>
      )}
    </View>
  );
}

const styles = themedStyles({
  root:        { flex: 1, backgroundColor: "#0B1430" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  centerTxt:   { color: "#fff", textAlign: "center", fontSize: 15 },
  allowBtn:    { backgroundColor: "#F5C518", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  allowTxt:    { color: "#1B2E6B", fontWeight: "700" },
  top:         { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "rgba(11,20,48,0.65)" },
  topBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  topTitle:    { color: "#fff", fontSize: 16, fontWeight: "700" },
  topSub:      { color: "#F5C518", fontSize: 13, fontWeight: "600" },
  closeBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)" },
  closeTxt:    { color: "#fff", fontSize: 12, fontWeight: "700" },
  frame:       { position: "absolute", top: "30%", alignSelf: "center", width: 250, height: 250, borderRadius: 24, borderWidth: 3, borderColor: "#F5C518" },
  result:      { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 22, paddingTop: 20 },
  resultPhoto: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#fff" },
  resultTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  resultName:  { color: "#fff", fontSize: 15, marginTop: 2 },
  hint:        { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingTop: 16, backgroundColor: "rgba(11,20,48,0.55)" },
  hintTxt:     { color: "#fff", fontSize: 14 },
});
