import { useEffect, useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useTranslation } from "@nablis/i18n";
import { useAuth, ensurePassCode, memberPassValue } from "@nablis/shared/firebase";
import { FadeInView } from "../../components/FadeInView";
import { themedStyles, tc } from "../../theme";

// The member's personal QR pass — staff scan it at the door.
export default function MemberPassScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(user?.passCode ?? null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  useEffect(() => {
    if (!user || code) return;
    ensurePassCode(user).then(setCode).catch(() => setError(true));
  }, [user, code]);

  if (!user) return null;
  const name = user.displayName || user.email;

  // Saves the QR code to the phone's photos so it works without opening the app.
  async function download() {
    if (!qrRef.current || saving) return;
    setSaving(true);
    // Loaded on tap: Expo Go lacks this native module, and a top-level import
    // would break the whole pass screen there. The installed app has it.
    let MediaLibrary: typeof import("expo-media-library/legacy");
    try {
      MediaLibrary = await import("expo-media-library/legacy");
    } catch {
      Alert.alert(t("pass.download"), t("pass.needApp"));
      setSaving(false);
      return;
    }
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert(t("pass.download"), t("pass.needPermission"));
        return;
      }
      const base64 = await new Promise<string>((resolve) => qrRef.current!.toDataURL(resolve));
      const uri = `${FileSystem.cacheDirectory}nablis-pass.png`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t("pass.download"), t("pass.saved"));
    } catch {
      Alert.alert(t("pass.download"), t("pass.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <FadeInView style={styles.card}>
        <View style={styles.cardTop}>
          <Image source={require("../../../assets/Logo-White.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.kicker}>{t("pass.title")}</Text>
        </View>
        <View style={styles.qrWrap}>
          {code ? (
            <QRCode value={memberPassValue(user.id, code)} size={220} color="#1B2E6B" backgroundColor="#FFFFFF" quietZone={16}
              getRef={(r: unknown) => { qrRef.current = r as typeof qrRef.current; }} />
          ) : error ? (
            <Text style={styles.err}>{t("pass.error")}</Text>
          ) : (
            <ActivityIndicator color={tc("#1B2E6B")} />
          )}
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}><Ionicons name="shield-checkmark" size={12} color="#16A34A" /> {t("pass.active")}</Text>
        <Text style={styles.hint}>{t("pass.hint")}</Text>
        {code && (
          <TouchableOpacity style={styles.download} onPress={download} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="download-outline" size={17} color="#FFFFFF" />}
            <Text style={styles.downloadText}>{t("pass.download")}</Text>
          </TouchableOpacity>
        )}
      </FadeInView>
    </View>
  );
}

const styles = themedStyles({
  root:    { flex: 1, backgroundColor: "#1B2E6B", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  back:    { position: "absolute", top: 52, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  card:    { width: "100%", maxWidth: 360, backgroundColor: "#FFFFFF", borderRadius: 28, overflow: "hidden", alignItems: "center", paddingBottom: 24 },
  cardTop: { width: "100%", backgroundColor: "#16265A", alignItems: "center", paddingVertical: 18 },
  logo:    { width: 120, height: 40 },
  kicker:  { color: "#F5C518", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginTop: 6 },
  qrWrap:  { marginTop: 24, padding: 14, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEF1F8", minWidth: 250, minHeight: 250, alignItems: "center", justifyContent: "center" },
  name:    { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 18 },
  status:  { fontSize: 12, color: "#16A34A", fontWeight: "600", marginTop: 4 },
  hint:    { fontSize: 12, color: "#6B7280", textAlign: "center", marginTop: 16, paddingHorizontal: 24, lineHeight: 18 },
  err:     { color: "#B91C1C", textAlign: "center", padding: 20 },
  download:     { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, backgroundColor: "#1B2E6B", paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14 },
  downloadText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
