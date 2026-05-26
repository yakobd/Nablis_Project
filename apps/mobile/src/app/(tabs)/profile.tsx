import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, useAuth } from "@nablis/shared/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/Avatar";

const C = {
  navy:   "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey:   "#9CA3AF", dark:   "#374151", border: "#E5E7EB",
  white:  "#FFFFFF", bg:     "#F9FAFB", red:    "#DC2626",
};

type MenuItemType = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  badge?: number;
};

// ─── Shared sign-out ──────────────────────────────────────────────────────────
function useSignOut() {
  const router = useRouter();
  return async () => {
    try {
      const { signOut } = await import("firebase/auth");
      const { auth }    = await import("@nablis/shared/firebase");
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };
}

// ─── Admin Profile ────────────────────────────────────────────────────────────
function AdminProfile() {
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const signOut    = useSignOut();

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  const MENU_GROUPS: MenuItemType[][] = [
    [
      { icon: "people-outline",       label: "Member Management",   route: "/attendance"     },
      { icon: "calendar-outline",     label: "All Appointments",    route: "/(tabs)/appointments" },
      { icon: "heart-outline",        label: "Testimonials",        route: "/testimony"      },
      { icon: "checkmark-circle-outline", label: "Attendance",      route: "/attendance"     },
      { icon: "images-outline",       label: "Gallery",             route: "/gallery"        },
    ],
    [
      { icon: "notifications-outline", label: "Notifications" },
      { icon: "contrast-outline",      label: "Appearance"    },
    ],
    [
      { icon: "log-out-outline", label: "Sign Out", onPress: handleSignOut, color: C.red },
    ],
  ];

  function navigate(route?: string, onPress?: () => void) {
    if (onPress) { onPress(); return; }
    if (route) router.push(route as any);
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <Avatar uri={user?.photoURL} name={user?.displayName || user?.email} size={80} bgColor={C.navy} textColor={C.yellow} />
        </View>
        <Text style={styles.userName}>{user?.displayName || "Admin"}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={[styles.memberBadge, { backgroundColor: C.navy }]}>
          <Text style={[styles.memberBadgeTxt, { color: C.yellow }]}>Administrator</Text>
        </View>
      </View>

      {MENU_GROUPS.map((group, gi) => (
        <View key={gi} style={styles.menuGroup}>
          {group.map((item, ii) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, ii < group.length - 1 && styles.menuItemBorder]}
              onPress={() => navigate(item.route, item.onPress)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, item.color ? { backgroundColor: "#FEF2F2" } : {}]}>
                <Ionicons name={item.icon} size={18} color={item.color ?? C.navy} />
              </View>
              <Text style={[styles.menuLabel, item.color ? { color: item.color } : {}]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={item.color ?? C.grey} style={styles.menuChev} />
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <Text style={styles.version}>Nablis v1.0.0 · Ethiopian Orthodox Ministry</Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Member Profile ───────────────────────────────────────────────────────────
function MemberProfile() {
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const signOut    = useSignOut();
  const [stats, setStats]   = useState({ pastVisits: 0, upcoming: 0, blogPosts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [apts, blogs] = await Promise.all([
          getDocs(query(collection(db, "appointments"), where("userId", "==", user.id))),
          getDocs(query(collection(db, "blogPosts"),   where("authorId", "==", user.id))),
        ]);
        const now = new Date();
        const upcoming = apts.docs.filter((d) => {
          const date = d.data().date?.toDate?.();
          return date && date >= now && d.data().status !== "cancelled";
        }).length;
        setStats({ pastVisits: apts.docs.length - upcoming, upcoming, blogPosts: blogs.size });
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  const MENU_GROUPS: MenuItemType[][] = [
    [
      { icon: "calendar-outline",         label: "My Appointments",  route: "/(tabs)/appointments" },
      { icon: "book-outline",             label: "Bible Study",      route: "/bible-study"  },
      { icon: "heart-outline",            label: "Testimonials",     route: "/testimony"    },
      { icon: "images-outline",           label: "Gallery",          route: "/gallery"      },
      { icon: "checkmark-circle-outline", label: "Attendance",       route: "/attendance"   },
    ],
    [
      { icon: "notifications-outline", label: "Notifications" },
      { icon: "language-outline",      label: "Language"      },
      { icon: "contrast-outline",      label: "Appearance"    },
    ],
    [
      { icon: "log-out-outline", label: "Sign Out", onPress: handleSignOut, color: C.red },
    ],
  ];

  function navigate(route?: string, onPress?: () => void) {
    if (onPress) { onPress(); return; }
    if (route) router.push(route as any);
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <Avatar uri={user?.photoURL} name={user?.displayName || user?.email} size={80} bgColor={C.navy} textColor={C.yellow} />
          <TouchableOpacity
            style={styles.editAvatarBtn}
            onPress={() => Alert.alert("Coming Soon", "Photo upload will be available in a future update.")}
          >
            <Ionicons name="camera" size={14} color={C.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.userName}>{user?.displayName || "Member"}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeTxt}>Community Member</Text>
        </View>
      </View>

      <View style={styles.statsCard}>
        {loading ? (
          <ActivityIndicator color={C.navy} />
        ) : (
          <>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.pastVisits}</Text>
              <Text style={styles.statLabel}>Past Visits</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.upcoming}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.blogPosts}</Text>
              <Text style={styles.statLabel}>Blog Posts</Text>
            </View>
          </>
        )}
      </View>

      {MENU_GROUPS.map((group, gi) => (
        <View key={gi} style={styles.menuGroup}>
          {group.map((item, ii) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, ii < group.length - 1 && styles.menuItemBorder]}
              onPress={() => navigate(item.route, item.onPress)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, item.color ? { backgroundColor: "#FEF2F2" } : {}]}>
                <Ionicons name={item.icon} size={18} color={item.color ?? C.navy} />
              </View>
              <Text style={[styles.menuLabel, item.color ? { color: item.color } : {}]}>
                {item.label}
              </Text>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeTxt}>{item.badge}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={item.color ?? C.grey} style={styles.menuChev} />
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <Text style={styles.version}>Nablis v1.0.0 · Ethiopian Orthodox Ministry</Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { role } = useAuth();
  if (role === "admin") return <AdminProfile />;
  return <MemberProfile />;
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  content:       { paddingHorizontal: 16, paddingTop: 16 },
  profileHeader: { alignItems: "center", marginBottom: 20 },
  avatarWrap:    { position: "relative", marginBottom: 12 },
  editAvatarBtn: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: C.navy, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.white },
  userName:      { fontSize: 20, fontWeight: "800", color: C.navy, marginBottom: 3 },
  userEmail:     { fontSize: 13, color: C.grey, marginBottom: 10 },
  memberBadge:   { backgroundColor: C.light, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  memberBadgeTxt:{ fontSize: 11, fontWeight: "700", color: C.navy },
  statsCard:     { flexDirection: "row", backgroundColor: C.white, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  statItem:      { flex: 1, alignItems: "center" },
  statNum:       { fontSize: 22, fontWeight: "800", color: C.navy },
  statLabel:     { fontSize: 10, color: C.grey, marginTop: 2 },
  statDivider:   { width: 1, height: 32, backgroundColor: C.border },
  menuGroup:     { backgroundColor: C.white, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  menuItem:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  menuItemBorder:{ borderBottomWidth: 1, borderBottomColor: C.border },
  menuIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.light, alignItems: "center", justifyContent: "center", marginRight: 12 },
  menuLabel:     { flex: 1, fontSize: 14, fontWeight: "600", color: C.dark },
  badge:         { backgroundColor: C.navy, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 6 },
  badgeTxt:      { color: C.white, fontSize: 10, fontWeight: "700" },
  menuChev:      { marginLeft: "auto" },
  version:       { textAlign: "center", fontSize: 11, color: C.grey, marginTop: 8 },
});
