import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { db, useAuth } from "@nablis/shared/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Avatar } from "../../components/Avatar";
import { BottomSheet } from "../../components/BottomSheet";

const C = {
  navy:   "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey:   "#9CA3AF", dark:   "#374151", border: "#E5E7EB",
  white:  "#FFFFFF", bg:     "#F9FAFB", red:    "#DC2626",
  green:  "#16A34A", inputBg: "#F9FAFB",
};

const SCREEN_H = Dimensions.get("window").height;

type MenuItemType = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  badge?: number;
};

/* ─── Cloudinary direct upload (unsigned preset) ────────────────────── */
// Requires EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET
// in apps/mobile/.env. Create an unsigned upload preset in your Cloudinary dashboard.
async function uploadImageToCloudinary(imageUri: string): Promise<string> {
  const cloudName   = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "nablis_unsigned";

  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: "avatar.jpg",
  } as unknown as Blob);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "nablis/avatars");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url as string;
}

/* ─── Shared sign-out ─────────────────────────────────────────────────── */
function useSignOut() {
  const router = useRouter();
  return async () => {
    try {
      const { signOut } = await import("firebase/auth");
      const { auth }    = await import("@nablis/shared/firebase");
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (err: unknown) {
      console.error("Sign out error:", err);
    }
  };
}

/* ─── Shared input component ──────────────────────────────────────────── */
function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  secureTextEntry,
  rightIcon,
  editable = true,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  rightIcon?: React.ReactNode;
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <View style={inputStyles.wrap}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={inputStyles.row}>
        <TextInput
          style={[inputStyles.input, !editable && inputStyles.disabled, rightIcon ? { paddingRight: 44 } : {}]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.grey}
          secureTextEntry={secureTextEntry}
          editable={editable}
          autoCapitalize="none"
          keyboardType={keyboardType ?? "default"}
        />
        {rightIcon && <View style={inputStyles.rightIcon}>{rightIcon}</View>}
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrap:      { marginBottom: 14 },
  label:     { fontSize: 11, fontWeight: "700", color: C.dark, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  row:       { position: "relative" },
  input:     { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.dark },
  disabled:  { color: C.grey, backgroundColor: "#F3F4F6" },
  rightIcon: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
});

/* ─── Toast / message ──────────────────────────────────────────────────── */
function InlineMsg({ msg }: { msg: { type: "ok" | "err"; text: string } | null }) {
  if (!msg) return null;
  const isOk = msg.type === "ok";
  return (
    <View style={[msgStyles.wrap, isOk ? msgStyles.ok : msgStyles.err]}>
      <Ionicons
        name={isOk ? "checkmark-circle" : "alert-circle"}
        size={14}
        color={isOk ? C.green : C.red}
        style={{ marginRight: 6 }}
      />
      <Text style={[msgStyles.text, { color: isOk ? C.green : C.red }]}>{msg.text}</Text>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, marginBottom: 12 },
  ok:   { backgroundColor: "#F0FDF4" },
  err:  { backgroundColor: "#FEF2F2" },
  text: { fontSize: 13, fontWeight: "500", flex: 1 },
});

/* ─── Edit Profile Bottom Sheet ───────────────────────────────────────── */
function EditProfileSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user, firebaseUser } = useAuth();

  const [displayName,   setDisplayName]   = useState("");
  const [christianName, setChristianName] = useState("");
  const [phone,         setPhone]         = useState("");
  const [city,          setCity]          = useState("");
  const [parishChurch,  setParishChurch]  = useState("");

  const [photoUri,    setPhotoUri]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /* init fields when sheet opens */
  useEffect(() => {
    if (!visible || !user) return;
    const u = user as Record<string, unknown>;
    setDisplayName((u.displayName as string) ?? "");
    setChristianName((u.christianName as string) ?? "");
    setPhone(((u.phone ?? u.phoneNumber) as string) ?? "");
    setCity((u.cityOfResidence as string) ?? (u.city as string) ?? "");
    setParishChurch((u.parishChurch as string) ?? "");
    setPhotoUri(null);
    setMsg(null);
  }, [visible]);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow photo access in your device settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    try {
      let photoURL = user.photoURL;

      if (photoUri) {
        setUploading(true);
        photoURL = await uploadImageToCloudinary(photoUri);
        setUploading(false);
      }

      await updateDoc(doc(db, "users", user.id), {
        displayName:        displayName.trim(),
        christianName:      christianName.trim(),
        phone:              phone.trim(),
        phoneNumber:        phone.trim(),
        cityOfResidence:    city.trim(),
        parishChurch:       parishChurch.trim(),
        ...(photoURL !== user.photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });

      setMsg({ type: "ok", text: "Profile updated successfully." });
      setTimeout(() => { onClose(); }, 1200);
    } catch (err: unknown) {
      setUploading(false);
      console.error(err);
      setMsg({ type: "err", text: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const avatarUri  = photoUri ?? user?.photoURL ?? null;
  const avatarName = displayName || user?.displayName || user?.email;
  const isBusy     = saving || uploading;

  return (
    <BottomSheet visible={visible} onClose={onClose} height={SCREEN_H * 0.88}>
      <Text style={sheetStyles.title}>Edit Profile</Text>

      {/* avatar row */}
      <View style={sheetStyles.avatarRow}>
        <View style={{ position: "relative" }}>
          <Avatar uri={avatarUri} name={avatarName} size={72} bgColor={C.navy} textColor={C.yellow} />
          {uploading && (
            <View style={sheetStyles.avatarOverlay}>
              <ActivityIndicator color={C.white} size="small" />
            </View>
          )}
          <TouchableOpacity style={sheetStyles.avatarEditBtn} onPress={pickPhoto} disabled={isBusy}>
            <Ionicons name="camera" size={14} color={C.white} />
          </TouchableOpacity>
        </View>
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={sheetStyles.avatarHint}>Tap the camera icon to change your photo</Text>
          {photoUri && (
            <Text style={sheetStyles.avatarSelected}>New photo selected</Text>
          )}
        </View>
      </View>

      <InlineMsg msg={msg} />

      <LabeledInput label="Full Name" value={displayName}   onChange={setDisplayName}   placeholder="Your full name" />
      <LabeledInput label="Christian Name / የክርስትና ስም" value={christianName} onChange={setChristianName} placeholder="e.g. Tewodros, Mariam…" />
      <LabeledInput label="Phone Number" value={phone} onChange={setPhone} placeholder="+971 5X XXX XXXX" keyboardType="phone-pad" />
      <LabeledInput label="City of Residence" value={city} onChange={setCity} placeholder="e.g. Dubai" />
      <LabeledInput label="Parish Church" value={parishChurch} onChange={setParishChurch} placeholder="Your local parish" />
      <LabeledInput label="Email Address" value={user?.email ?? ""} editable={false} />

      <TouchableOpacity
        style={[sheetStyles.saveBtn, isBusy && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={isBusy}
        activeOpacity={0.8}
      >
        {isBusy ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Ionicons name="checkmark" size={16} color={C.white} style={{ marginRight: 6 }} />
            <Text style={sheetStyles.saveBtnText}>Save Changes</Text>
          </>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  title:        { fontSize: 17, fontWeight: "800", color: C.navy, marginBottom: 20 },
  avatarRow:    { flexDirection: "row", alignItems: "center", marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  avatarOverlay:{ ...StyleSheet.absoluteFillObject, borderRadius: 36, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  avatarEditBtn:{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: C.navy, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.white },
  avatarHint:   { fontSize: 12, color: C.grey, lineHeight: 17 },
  avatarSelected:{ fontSize: 12, color: C.green, fontWeight: "600", marginTop: 4 },
  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.navy, borderRadius: 14, paddingVertical: 14, marginTop: 6 },
  saveBtnText:  { color: C.white, fontWeight: "700", fontSize: 15 },
});

/* ─── Change Password Bottom Sheet ─────────────────────────────────────── */
function ChangePasswordSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { firebaseUser } = useAuth();

  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showCurr,   setShowCurr]   = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setMsg(null);
    }
  }, [visible]);

  async function handleChange() {
    if (!firebaseUser?.email) return;
    if (newPw !== confirmPw) { setMsg({ type: "err", text: "New passwords do not match." }); return; }
    if (newPw.length < 8)    { setMsg({ type: "err", text: "Password must be at least 8 characters." }); return; }

    setSaving(true);
    setMsg(null);
    try {
      const cred = EmailAuthProvider.credential(firebaseUser.email, currentPw);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, newPw);
      setMsg({ type: "ok", text: "Password updated successfully." });
      setTimeout(() => { onClose(); }, 1200);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setMsg({ type: "err", text: "Current password is incorrect." });
      } else {
        setMsg({ type: "err", text: "Failed to update password. Try again." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} height={480}>
      <Text style={sheetStyles.title}>Change Password</Text>

      <InlineMsg msg={msg} />

      <LabeledInput
        label="Current Password"
        value={currentPw}
        onChange={setCurrentPw}
        placeholder="••••••••"
        secureTextEntry={!showCurr}
        rightIcon={
          <TouchableOpacity onPress={() => setShowCurr((v) => !v)}>
            <Ionicons name={showCurr ? "eye-off-outline" : "eye-outline"} size={18} color={C.grey} />
          </TouchableOpacity>
        }
      />
      <LabeledInput
        label="New Password"
        value={newPw}
        onChange={setNewPw}
        placeholder="Min. 8 characters"
        secureTextEntry={!showNew}
        rightIcon={
          <TouchableOpacity onPress={() => setShowNew((v) => !v)}>
            <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={18} color={C.grey} />
          </TouchableOpacity>
        }
      />
      <LabeledInput
        label="Confirm New Password"
        value={confirmPw}
        onChange={setConfirmPw}
        placeholder="Repeat new password"
        secureTextEntry
      />

      <TouchableOpacity
        style={[sheetStyles.saveBtn, (saving || !currentPw || !newPw || !confirmPw) && { opacity: 0.6 }]}
        onPress={handleChange}
        disabled={saving || !currentPw || !newPw || !confirmPw}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.white} style={{ marginRight: 6 }} />
            <Text style={sheetStyles.saveBtnText}>Update Password</Text>
          </>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}

/* ─── Admin Profile ───────────────────────────────────────────────────── */
function AdminProfile({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
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
      { icon: "people-outline",            label: "Member Management",   route: "/attendance"          },
      { icon: "calendar-outline",          label: "All Appointments",    route: "/(tabs)/appointments" },
      { icon: "heart-outline",             label: "Testimonials",        route: "/testimony"           },
      { icon: "checkmark-circle-outline",  label: "Attendance",          route: "/attendance"          },
      { icon: "images-outline",            label: "Gallery",             route: "/gallery"             },
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

  const badgeLabel = isSuperAdmin ? "Spiritual Father" : "Administrator";
  const badgeBg    = isSuperAdmin ? C.yellow            : C.navy;
  const badgeFg    = isSuperAdmin ? C.navy              : C.yellow;

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
        <View style={[styles.memberBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.memberBadgeTxt, { color: badgeFg }]}>{badgeLabel}</Text>
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

/* ─── Member Profile ──────────────────────────────────────────────────── */
function MemberProfile() {
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const signOut    = useSignOut();

  const [stats, setStats]   = useState({ pastVisits: 0, upcoming: 0, blogPosts: 0 });
  const [loading, setLoading] = useState(true);
  const [showEditProfile,    setShowEditProfile]    = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

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

  function navigate(route?: string, onPress?: () => void) {
    if (onPress) { onPress(); return; }
    if (route) router.push(route as any);
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
      { icon: "person-outline",         label: "Edit Profile",      onPress: () => setShowEditProfile(true) },
      { icon: "shield-outline",         label: "Change Password",   onPress: () => setShowChangePassword(true) },
      { icon: "notifications-outline",  label: "Notifications" },
      { icon: "language-outline",       label: "Language"      },
      { icon: "contrast-outline",       label: "Appearance"    },
    ],
    [
      { icon: "log-out-outline", label: "Sign Out", onPress: handleSignOut, color: C.red },
    ],
  ];

  return (
    <>
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
              onPress={() => setShowEditProfile(true)}
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

      <EditProfileSheet
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />
      <ChangePasswordSheet
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
}

/* ─── Root Export ─────────────────────────────────────────────────────── */
export default function ProfileScreen() {
  const { role } = useAuth();
  if (role === "super_admin") return <AdminProfile isSuperAdmin />;
  if (role === "admin")       return <AdminProfile />;
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
