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
import { auth, db } from '../../lib/firebase';
import { uploadImage } from '../../lib/upload';
import { useAuth } from '@nablis/shared/firebase';
import { useTranslation } from '@nablis/i18n';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Avatar } from "../../components/Avatar";
import { BottomSheet } from "../../components/BottomSheet";
import { SidebarDrawer } from "../../components/SidebarDrawer";
import { themedStyles, themedColors } from "../../theme";

const L = {
  navy:   "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey:   "#9CA3AF", dark:   "#374151", border: "#E5E7EB",
  white:  "#FFFFFF", bg:     "#F9FAFB", red:    "#DC2626",
  green:  "#16A34A", inputBg: "#F9FAFB",
};
const C = themedColors(L);

const SCREEN_H = Dimensions.get("window").height;

type MenuItemType = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  badge?: number;
};

/* ─── Shared sign-out ─────────────────────────────────────────────────── */
function useSignOut() {
  const router = useRouter();
  return async () => {
    try {
      const { signOut } = require("firebase/auth");
      await signOut(auth);
      router.replace("/(auth)/login" as any);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Sign out failed.");
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

const inputStyles = themedStyles({
  wrap:      { marginBottom: 14 },
  label:     { fontSize: 11, fontWeight: "700", color: L.dark, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  row:       { position: "relative" },
  input:     { backgroundColor: L.inputBg, borderWidth: 1, borderColor: L.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: L.dark },
  disabled:  { color: L.grey, backgroundColor: "#F3F4F6" },
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

const msgStyles = themedStyles({
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

  const [employmentStatus, setEmploymentStatus] = useState("");

  const [photoUri,    setPhotoUri]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /* init fields when sheet opens */
  useEffect(() => {
    if (!visible || !user) return;
    const u = user as unknown as Record<string, unknown>;
    setDisplayName((u.displayName as string) ?? "");
    setChristianName((u.christianName as string) ?? "");
    setPhone(((u.phone ?? u.phoneNumber) as string) ?? "");
    setCity((u.cityOfResidence as string) ?? (u.city as string) ?? "");
    setParishChurch((u.parishChurch as string) ?? "");
    setEmploymentStatus((u.employmentStatus as string) ?? "");
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
        photoURL = await uploadImage(photoUri, "nablis/avatars");
        setUploading(false);
      }

      await updateDoc(doc(db, "users", user.id), {
        displayName:        displayName.trim(),
        christianName:      christianName.trim(),
        phone:              phone.trim(),
        phoneNumber:        phone.trim(),
        cityOfResidence:    city.trim(),
        parishChurch:       parishChurch.trim(),
        employmentStatus:   employmentStatus || null,
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

      <View style={inputStyles.wrap}>
        <Text style={inputStyles.label}>Employment / Work Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { value: 'employed',      label: 'Employed'      },
            { value: 'self_employed', label: 'Self Employed' },
            { value: 'student',       label: 'Student'       },
            { value: 'unemployed',    label: 'Unemployed'    },
            { value: 'retired',       label: 'Retired'       },
            { value: 'other',         label: 'Other'         },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[empStyles.chip, employmentStatus === opt.value && empStyles.chipActive]}
              onPress={() => setEmploymentStatus(opt.value)}
            >
              <Text style={[empStyles.chipTxt, employmentStatus === opt.value && empStyles.chipTxtActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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

const empStyles = themedStyles({
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: L.border, marginRight: 8, backgroundColor: L.white },
  chipActive:   { backgroundColor: L.navy, borderColor: L.navy },
  chipTxt:      { fontSize: 12, fontWeight: "600", color: L.dark },
  chipTxtActive:{ color: L.white },
});

const sheetStyles = themedStyles({
  title:        { fontSize: 17, fontWeight: "800", color: L.navy, marginBottom: 20 },
  avatarRow:    { flexDirection: "row", alignItems: "center", marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: L.border },
  avatarOverlay:{ ...StyleSheet.absoluteFill, borderRadius: 36, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  avatarEditBtn:{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: L.navy, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: L.white },
  avatarHint:   { fontSize: 12, color: L.grey, lineHeight: 17 },
  avatarSelected:{ fontSize: 12, color: L.green, fontWeight: "600", marginTop: 4 },
  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: L.navy, borderRadius: 14, paddingVertical: 14, marginTop: 6 },
  saveBtnText:  { color: L.white, fontWeight: "700", fontSize: 15 },
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

/* ─── Display & language ──────────────────────────────────────────────── */
type Appearance = "light" | "dark" | "system";

function DisplaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const prefs = (user as { preferences?: { appearance?: string; language?: string } } | null)?.preferences ?? {};
  const appearance: Appearance = prefs.appearance === "dark" || prefs.appearance === "system" ? prefs.appearance : "light";
  const language = prefs.language === "am" ? "am" : "en";
  const [saving, setSaving] = useState<string | null>(null);

  // Saved to the same fields as the web portal's Preferences, so both stay in sync.
  async function save(field: "appearance" | "language", value: string) {
    if (!user) return;
    setSaving(value);
    try {
      await updateDoc(doc(db, "users", user.id), { [`preferences.${field}`]: value, updatedAt: serverTimestamp() });
    } catch {
      Alert.alert(t("mobile.error"), t("mobile.notSaved"));
    } finally {
      setSaving(null);
    }
  }

  const option = (selected: boolean, label: string, icon: React.ComponentProps<typeof Ionicons>["name"], onPress: () => void, busy: boolean) => (
    <TouchableOpacity key={label} style={[displayStyles.option, selected && displayStyles.optionOn]} onPress={onPress} disabled={busy} activeOpacity={0.8}>
      <Ionicons name={icon} size={20} color={selected ? C.navy : C.grey} />
      <Text style={[displayStyles.optionTxt, selected && displayStyles.optionTxtOn]}>{label}</Text>
      {busy ? <ActivityIndicator size="small" color={C.navy} /> : selected ? <Ionicons name="checkmark-circle" size={18} color={C.navy} /> : null}
    </TouchableOpacity>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} height={470}>
      <Text style={sheetStyles.title}>{t("mobile.displayLanguage")}</Text>
      <Text style={displayStyles.label}>{t("prefs.appearance")}</Text>
      <View style={displayStyles.row}>
        {option(appearance === "light", t("prefs.light"), "sunny-outline", () => save("appearance", "light"), saving === "light")}
        {option(appearance === "dark", t("prefs.dark"), "moon-outline", () => save("appearance", "dark"), saving === "dark")}
        {option(appearance === "system", t("prefs.system"), "phone-portrait-outline", () => save("appearance", "system"), saving === "system")}
      </View>
      <Text style={displayStyles.label}>{t("prefs.language")}</Text>
      <View style={displayStyles.row}>
        {option(language === "en", "English", "language-outline", () => save("language", "en"), saving === "en")}
        {option(language === "am", "አማርኛ", "language-outline", () => save("language", "am"), saving === "am")}
      </View>
      <Text style={displayStyles.note}>{t("mobile.displayNote")}</Text>
    </BottomSheet>
  );
}

const displayStyles = themedStyles({
  label:       { fontSize: 12, fontWeight: "700", color: L.grey, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  row:         { gap: 8 },
  option:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: L.border, backgroundColor: L.white },
  optionOn:    { borderColor: L.navy, backgroundColor: L.light },
  optionTxt:   { flex: 1, fontSize: 15, fontWeight: "600", color: L.dark },
  optionTxtOn: { color: L.navy },
  note:        { fontSize: 12, color: L.grey, marginTop: 14, lineHeight: 17 },
});

/* ─── Admin Profile ───────────────────────────────────────────────────── */
function AdminProfile({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const signOut    = useSignOut();
  const { t }      = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDisplay, setShowDisplay] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  const MENU_GROUPS: MenuItemType[][] = [
    [
      { icon: "person-outline",        label: t("mobile.editProfile"),    onPress: () => setShowEditProfile(true)    },
      { icon: "shield-outline",        label: t("mobile.changePassword"), onPress: () => setShowChangePassword(true) },
    ],
    [
      { icon: "calendar-outline", label: t("mobile.allAppointments"), route: "/(tabs)/appointments" },
    ],
    [
      { icon: "notifications-outline", label: t("nav.notifications"), route: "/notifications" },
      { icon: "contrast-outline",      label: t("mobile.displayLanguage"), onPress: () => setShowDisplay(true) },
    ],
    [
      { icon: "log-out-outline", label: t("mobile.signOut"), onPress: handleSignOut, color: C.red },
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t("settingsNav.profile")}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
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
      <EditProfileSheet visible={showEditProfile} onClose={() => setShowEditProfile(false)} />
      <ChangePasswordSheet visible={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <DisplaySheet visible={showDisplay} onClose={() => setShowDisplay(false)} />
      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} currentRoute="/(tabs)/profile" />
    </View>
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
  const [showDisplay, setShowDisplay] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation();

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
      { icon: "person-outline",        label: t("mobile.editProfile"),    onPress: () => setShowEditProfile(true)    },
      { icon: "shield-outline",        label: t("mobile.changePassword"), onPress: () => setShowChangePassword(true) },
    ],
    [
      { icon: "notifications-outline", label: t("nav.notifications"),  route: "/notifications" },
      { icon: "contrast-outline",      label: t("mobile.displayLanguage"), onPress: () => setShowDisplay(true) },
    ],
    [
      { icon: "log-out-outline", label: t("mobile.signOut"), onPress: handleSignOut, color: C.red },
    ],
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t("settingsNav.profile")}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
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
            <Text style={styles.memberBadgeTxt}>{t("mobile.communityMember")}</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          {loading ? (
            <ActivityIndicator color={C.navy} />
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.pastVisits}</Text>
                <Text style={styles.statLabel}>{t("mobile.pastVisits")}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.upcoming}</Text>
                <Text style={styles.statLabel}>{t("mobile.upcoming")}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.blogPosts}</Text>
                <Text style={styles.statLabel}>{t("mobile.blogPosts")}</Text>
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
      <DisplaySheet visible={showDisplay} onClose={() => setShowDisplay(false)} />
      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} currentRoute="/(tabs)/profile" />
    </View>
  );
}

/* ─── Root Export ─────────────────────────────────────────────────────── */
export default function ProfileScreen() {
  const { role } = useAuth();
  if (role === "super_admin") return <AdminProfile isSuperAdmin />;
  if (role === "admin")       return <AdminProfile />;
  return <MemberProfile />;
}

const styles = themedStyles({
  root:          { flex: 1, backgroundColor: L.bg },
  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: L.bg },
  hamburgerBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: L.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border },
  hamburgerIcon: { fontSize: 22, color: L.navy, lineHeight: 26 },
  topBarTitle:   { fontSize: 17, fontWeight: "800", color: L.navy },
  content:       { paddingHorizontal: 16, paddingTop: 16 },
  profileHeader: { alignItems: "center", marginBottom: 20 },
  avatarWrap:    { position: "relative", marginBottom: 12 },
  editAvatarBtn: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: L.navy, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: L.white },
  userName:      { fontSize: 20, fontWeight: "800", color: L.navy, marginBottom: 3 },
  userEmail:     { fontSize: 13, color: L.grey, marginBottom: 10 },
  memberBadge:   { backgroundColor: L.light, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  memberBadgeTxt:{ fontSize: 11, fontWeight: "700", color: L.navy },
  statsCard:     { flexDirection: "row", backgroundColor: L.white, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: L.border, alignItems: "center" },
  statItem:      { flex: 1, alignItems: "center" },
  statNum:       { fontSize: 22, fontWeight: "800", color: L.navy },
  statLabel:     { fontSize: 10, color: L.grey, marginTop: 2 },
  statDivider:   { width: 1, height: 32, backgroundColor: L.border },
  menuGroup:     { backgroundColor: L.white, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: L.border, overflow: "hidden" },
  menuItem:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  menuItemBorder:{ borderBottomWidth: 1, borderBottomColor: L.border },
  menuIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center", marginRight: 12 },
  menuLabel:     { flex: 1, fontSize: 14, fontWeight: "600", color: L.dark },
  badge:         { backgroundColor: L.navy, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 6 },
  badgeTxt:      { color: L.white, fontSize: 10, fontWeight: "700" },
  menuChev:      { marginLeft: "auto" },
  version:       { textAlign: "center", fontSize: 11, color: L.grey, marginTop: 8 },
});
