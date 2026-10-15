import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Modal, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from '../../lib/firebase';
import {
  useAuth, notify, TESTIMONY_CATEGORIES, testimonyAuthor, testimonyCategoryLabel,
} from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/Avatar";
import { BottomSheet } from "../../components/BottomSheet";
import { themedStyles, themedColors } from "../../theme";
import i18n from "@nablis/i18n";

const L = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark:   "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg:    "#F9FAFB",
};
const C = themedColors(L);

interface Testimony {
  id: string;
  authorName: string;
  authorId: string;
  title: string;
  content: string;
  category: string;
  status: "pending" | "published" | "rejected";
  likes?: number;
  anonymous?: boolean;
  createdAt?: Timestamp;
}

const CATEGORIES = TESTIMONY_CATEGORIES.map((c) => c.key);

type AdminTab  = "pending" | "published" | "rejected";
type MemberTab = "published";

function fmtAgo(ts?: Timestamp) {
  if (!ts) return "";
  try {
    const d = Date.now() - ts.toDate().getTime();
    const days = Math.floor(d / 86400000);
    if (days > 0) return `${days}d ago`;
    const hrs = Math.floor(d / 3600000);
    return hrs > 0 ? `${hrs}h ago` : "Just now";
  } catch { return ""; }
}

// ─── Shared: Detail modal ─────────────────────────────────────────────────────
function DetailModal({ item, onClose, staff }: { item: Testimony | null; onClose: () => void; staff?: boolean }) {
  const name = item ? (staff ? item.authorName : testimonyAuthor(item)) : "";
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.detailHandle} />
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle} numberOfLines={2}>{item?.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.detailClose}>
              <Ionicons name="close" size={20} color={C.dark} />
            </TouchableOpacity>
          </View>
          <View style={styles.detailMeta}>
            <Avatar name={name} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailAuthor}>{name}</Text>
              <Text style={styles.detailTime}>{fmtAgo(item?.createdAt)}</Text>
            </View>
            <View style={styles.catBadge}>
              <Text style={styles.catText}>{testimonyCategoryLabel(item?.category)}</Text>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.detailContent}>{item?.content}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Admin Testimonies ────────────────────────────────────────────────────────
function AdminTestimonies() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const [all, setAll]               = useState<Testimony[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<AdminTab>("pending");
  const [detailItem, setDetailItem] = useState<Testimony | null>(null);
  const [actionId, setActionId]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "testimonies"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony));
      data.sort((a, b) => ((b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
      setAll(data);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const displayed = all.filter((t) => t.status === tab);
  const pendingCount   = all.filter((t) => t.status === "pending").length;
  const publishedCount = all.filter((t) => t.status === "published").length;
  const rejectedCount  = all.filter((t) => t.status === "rejected").length;

  async function handleAction(id: string, status: "published" | "rejected") {
    setActionId(id);
    try {
      await updateDoc(doc(db, "testimonies", id), { status });
      Alert.alert("Done", status === "published" ? "Testimony published." : "Testimony rejected.");
      await load();
    } catch {
      Alert.alert("Error", "Failed to update testimony.");
    } finally {
      setActionId(null);
    }
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending:   { bg: "#FEF9C3", text: "#92400E" },
    published: { bg: "#DCFCE7", text: "#16A34A" },
    rejected:  { bg: "#FEF2F2", text: "#DC2626" },
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t("nav.testimonials")}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={C.navy} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Pending",   value: pendingCount,   color: "#D97706" },
          { label: "Published", value: publishedCount, color: "#16A34A" },
          { label: "Rejected",  value: rejectedCount,  color: "#DC2626" },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["pending", "published", "rejected"] as AdminTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {displayed.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No {tab} testimonials.</Text>
            </View>
          )}
          {displayed.map((t) => {
            const sc = statusColors[t.status];
            return (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Avatar name={t.authorName} size={36} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardAuthor}>{t.authorName}</Text>
                    <Text style={styles.cardTime}>{fmtAgo(t.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>
                      {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.catBadge}>
                  <Text style={styles.catText}>{testimonyCategoryLabel(t.category)}</Text>
                </View>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <Text style={styles.cardContent} numberOfLines={2}>{t.content}</Text>
                <View style={styles.cardFooter}>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => setDetailItem(t)}>
                    <Text style={styles.viewBtnTxt}>VIEW</Text>
                  </TouchableOpacity>
                  {t.status === "pending" && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={[styles.approveBtn, !!actionId && { opacity: 0.6 }]}
                        onPress={() => handleAction(t.id, "published")}
                        disabled={!!actionId}
                      >
                        {actionId === t.id
                          ? <ActivityIndicator size="small" color={C.white} />
                          : <Text style={styles.approveBtnTxt}>Approve</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectBtn, !!actionId && { opacity: 0.6 }]}
                        onPress={() => handleAction(t.id, "rejected")}
                        disabled={!!actionId}
                      >
                        <Text style={styles.rejectBtnTxt}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <DetailModal item={detailItem} onClose={() => setDetailItem(null)} staff />
    </View>
  );
}

// ─── Member Testimonies ───────────────────────────────────────────────────────
function MemberTestimonies() {
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const [all, setAll]               = useState<Testimony[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [detailItem, setDetailItem] = useState<Testimony | null>(null);
  const [formTitle, setFormTitle]   = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCat, setFormCat]       = useState(CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "testimonies"), where("status", "==", "published")));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony));
      data.sort((a, b) => ((b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
      setAll(data);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Members only see published testimonies
  const published = all;

  async function submitTestimony() {
    if (!user || !formTitle.trim() || !formContent.trim()) return;
    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, "testimonies"), {
        authorId:   user.id,
        authorName: user.displayName || user.email,
        title:      formTitle.trim(),
        content:    formContent.trim(),
        category:   formCat,
        status:     "pending",
        likes:      0,
        encouragedBy: [],
        createdAt:  serverTimestamp(),
      });
      // Tell the Spiritual Father there is a story to review (as on the web).
      const fathers = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
      await notify(fathers.docs.filter((d) => d.id !== user.id).map((d) => ({
        userId: d.id, type: "testimony", link: `/testimonials/${ref.id}`,
        title: "New testimony to review",
        description: `${user.displayName || "A member"} shared "${formTitle.trim()}".`,
      }))).catch(() => {});
      setFormTitle(""); setFormContent(""); setShowForm(false);
      Alert.alert("Submitted", "Your testimony has been submitted for review.");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t("nav.testimonials")}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={20} color={C.navy} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Published", value: published.length, color: "#16A34A" },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { flex: 0, paddingHorizontal: 24 }]}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {published.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No published testimonials yet.</Text>
            </View>
          )}
          {published.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Avatar name={testimonyAuthor(t)} size={36} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardAuthor}>{testimonyAuthor(t)}</Text>
                  <Text style={styles.cardTime}>{fmtAgo(t.createdAt)}</Text>
                </View>
                <View style={[styles.catBadge, { marginBottom: 0 }]}>
                  <Text style={styles.catText}>{testimonyCategoryLabel(t.category)}</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <Text style={styles.cardContent} numberOfLines={3}>{t.content}</Text>
              <View style={styles.cardFooter}>
                <View style={styles.likesRow}>
                  <Ionicons name="heart-outline" size={13} color={C.grey} />
                  <Text style={styles.likesText}>{t.likes ?? 0}</Text>
                </View>
                <TouchableOpacity style={styles.viewBtn} onPress={() => setDetailItem(t)}>
                  <Text style={styles.viewBtnTxt}>VIEW DETAILS</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />

      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} height={540}>
        <Text style={styles.sheetTitle}>Share Your Testimony</Text>
        <Text style={styles.sheetSub}>Encourage the community with your story</Text>

        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput style={styles.input} value={formTitle} onChangeText={setFormTitle}
          placeholder="Give your testimony a title…" placeholderTextColor={C.grey} />

        <Text style={styles.fieldLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, formCat === c && styles.chipActive]}
              onPress={() => setFormCat(c)}>
              <Text style={[styles.chipTxt, formCat === c && styles.chipTxtActive]}>{testimonyCategoryLabel(c)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Your Story</Text>
        <TextInput style={[styles.input, styles.textarea]} value={formContent}
          onChangeText={setFormContent} placeholder="Share what God has done for you…"
          placeholderTextColor={C.grey} multiline numberOfLines={5} />

        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submitTestimony} disabled={submitting}>
          {submitting ? <ActivityIndicator color={C.navy} />
            : <Text style={styles.submitTxt}>Submit Testimony</Text>}
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function TestimonyScreen() {
  const { role } = useAuth();
  if (role === "admin") return <AdminTestimonies />;
  return <MemberTestimonies />;
}

const styles = themedStyles({
  root:        { flex: 1, backgroundColor: L.bg },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: L.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: L.navy, textAlign: "center" },
  addBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: L.yellow, alignItems: "center", justifyContent: "center" },
  refreshBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  statsRow:    { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCard:    { flex: 1, backgroundColor: L.white, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: L.border },
  statNum:     { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  statLabel:   { fontSize: 10, color: L.grey, fontWeight: "600" },
  tabs:        { flexDirection: "row", marginHorizontal: 16, backgroundColor: L.white, borderRadius: 12, borderWidth: 1, borderColor: L.border, padding: 4, marginBottom: 16 },
  tabBtn:      { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9 },
  tabActive:   { backgroundColor: L.navy },
  tabTxt:      { fontSize: 11, fontWeight: "600", color: L.grey },
  tabTxtActive:{ color: L.white },
  list:        { paddingHorizontal: 16 },
  center:      { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText:   { fontSize: 14, color: L.grey },
  card:        { backgroundColor: L.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: L.border },
  cardHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cardInfo:    { flex: 1 },
  cardAuthor:  { fontSize: 13, fontWeight: "700", color: L.dark },
  cardTime:    { fontSize: 11, color: L.grey },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 10, fontWeight: "700" },
  catBadge:    { backgroundColor: L.light, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 6 },
  catText:     { fontSize: 10, fontWeight: "700", color: L.navy },
  cardTitle:   { fontSize: 14, fontWeight: "700", color: L.navy, marginBottom: 6 },
  cardContent: { fontSize: 13, color: L.dark, lineHeight: 20, marginBottom: 12 },
  cardFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  likesRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  likesText:   { fontSize: 12, color: L.grey },
  viewBtn:     { backgroundColor: L.light, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  viewBtnTxt:  { fontSize: 10, fontWeight: "800", color: L.navy, letterSpacing: 0.5 },
  adminActions:{ flexDirection: "row", gap: 8 },
  approveBtn:  { backgroundColor: "#16A34A", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 70, alignItems: "center" },
  approveBtnTxt:{ color: L.white, fontSize: 12, fontWeight: "700" },
  rejectBtn:   { backgroundColor: "#FEF2F2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#FECACA" },
  rejectBtnTxt:{ color: "#DC2626", fontSize: 12, fontWeight: "700" },
  sheetTitle:  { fontSize: 18, fontWeight: "800", color: L.navy, marginBottom: 4 },
  sheetSub:    { fontSize: 13, color: L.grey, marginBottom: 20 },
  fieldLabel:  { fontSize: 12, fontWeight: "700", color: L.dark, marginBottom: 8 },
  input:       { borderWidth: 1, borderColor: L.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: L.dark, backgroundColor: L.white, marginBottom: 14 },
  textarea:    { height: 100, textAlignVertical: "top" },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: L.border, marginRight: 8, backgroundColor: L.white },
  chipActive:  { backgroundColor: L.navy, borderColor: L.navy },
  chipTxt:     { fontSize: 12, fontWeight: "600", color: L.dark },
  chipTxtActive:{ color: L.white },
  submitBtn:   { backgroundColor: L.yellow, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  submitTxt:   { fontSize: 15, fontWeight: "700", color: L.navy },
  detailOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  detailSheet: { backgroundColor: L.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
  detailHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: L.border, alignSelf: "center", marginBottom: 16 },
  detailHeader:{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  detailTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: L.navy },
  detailClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  detailMeta:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  detailAuthor:{ fontSize: 13, fontWeight: "700", color: L.dark },
  detailTime:  { fontSize: 11, color: L.grey },
  detailContent:{ fontSize: 14, color: L.dark, lineHeight: 24, paddingBottom: 24 },
});
