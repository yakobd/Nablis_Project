import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@nablis/shared/firebase";
import { useTranslation } from "@nablis/i18n";
import { db } from "../lib/firebase";
import { themedStyles, themedColors } from "../theme";

const L = { navy: "#1B2E6B", white: "#FFFFFF", border: "#E5E7EB", red: "#EF4444" };
const C = themedColors(L);

// Top-bar bell with a live count of unread notifications (announcements,
// appointments, messages, approvals…). Opens the notifications list.
export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, "notifications"), where("userId", "==", user.id), where("read", "==", false));
    return onSnapshot(q, (snap) => setUnread(snap.size), () => setUnread(0));
  }, [user?.id]);

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.push("/notifications" as any)}
      accessibilityLabel={unread ? `${t("nav.notifications")} (${unread})` : t("nav.notifications")}
    >
      <Ionicons name={unread ? "notifications" : "notifications-outline"} size={20} color={C.navy} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = themedStyles({
  btn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: L.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border },
  badge:     { position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: L.red, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: L.white },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
});
