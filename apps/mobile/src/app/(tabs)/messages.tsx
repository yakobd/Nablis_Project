import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, orderBy, onSnapshot, addDoc, getDoc, getDocs,
  where, doc, updateDoc, serverTimestamp, increment, Timestamp,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { db } from '../../lib/firebase';
import { uploadImage } from '../../lib/upload';
import { useAuth, notify } from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { ChatBubble } from "../../components/ChatBubble";
import { Avatar } from "../../components/Avatar";
import { SidebarDrawer } from "../../components/SidebarDrawer";
import { themedStyles, themedColors } from "../../theme";

const L = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg: "#F9FAFB",
};
const C = themedColors(L);

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  attachmentURL?: string | null;
  attachmentName?: string | null;
  createdAt: Timestamp | null;
}

interface Conversation {
  id: string;
  memberId: string;
  memberName: string;
  lastMessage: string;
  lastAt?: Timestamp;
  unreadByStaff?: number;
}

function fmtAgo(ts?: Timestamp) {
  if (!ts) return "";
  try {
    const d = Date.now() - ts.toDate().getTime();
    const days = Math.floor(d / 86400000);
    if (days > 0) return `${days}d`;
    const hrs = Math.floor(d / 3600000);
    return hrs > 0 ? `${hrs}h` : "now";
  } catch { return ""; }
}

// ─── Shared Chat UI ───────────────────────────────────────────────────────────
// Conversations keep unreadByStaff / unreadByMember counters; opening a chat
// clears your own side, sending bumps the other side's.
function ChatView({
  convoId,
  headerTitle,
  headerSub,
  onBack,
  onMenuPress,
}: {
  convoId: string;
  headerTitle: string;
  headerSub: string;
  onBack?: () => void;
  onMenuPress?: () => void;
}) {
  const { user, role } = useAuth();
  const isStaff    = role === "admin" || role === "super_admin";
  const insets     = useSafeAreaInsets();
  const flatRef    = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText]         = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "conversations", convoId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      updateDoc(doc(db, "conversations", convoId), {
        [isStaff ? "unreadByStaff" : "unreadByMember"]: 0,
      }).catch(() => {});
    });
    return unsub;
  }, [convoId, isStaff]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Needed", "Please allow photo access in your device settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function sendMessage() {
    const content = text.trim();
    if ((!content && !photoUri) || !user) return;
    setSending(true);
    try {
      const attachmentURL = photoUri ? await uploadImage(photoUri, "nablis/messages") : null;
      await addDoc(collection(db, "conversations", convoId, "messages"), {
        senderId:   user.id,
        senderName: user.displayName || user.email,
        content,
        attachmentURL,
        createdAt:  serverTimestamp(),
        read:       false,
      });
      const convoRef = doc(db, "conversations", convoId);
      await updateDoc(convoRef, {
        lastMessage: content || "Photo",
        lastAt:      serverTimestamp(),
        [isStaff ? "unreadByMember" : "unreadByStaff"]: increment(1),
      });
      setText("");
      setPhotoUri(null);

      // Notify the other side.
      const convo = (await getDoc(convoRef)).data();
      if (isStaff && convo?.memberId) {
        await notify({
          userId: convo.memberId, type: "message", link: "/messaging",
          title: "New message", description: content || "Sent you a photo",
        });
      } else if (!isStaff) {
        const staff = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
        await notify(staff.docs.map((d) => ({
          userId: d.id, type: "message", link: "/messaging",
          title: `Message from ${user.displayName || "a member"}`, description: content || "Sent a photo",
        })));
      }
    } catch {
      Alert.alert("Not sent", "Your message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const canSend = (!!text.trim() || !!photoUri) && !sending;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        {onMenuPress && !onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onMenuPress}>
            <Ionicons name="menu" size={20} color={C.navy} />
          </TouchableOpacity>
        )}
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color={C.navy} />
          </TouchableOpacity>
        )}
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{headerTitle.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={44} color={C.grey} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Start the conversation</Text>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ChatBubble
              content={item.content}
              senderName={item.senderName}
              attachmentURL={item.attachmentURL}
              attachmentName={item.attachmentName}
              createdAt={item.createdAt}
              isOwn={item.senderId === user?.id}
            />
          )}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Selected photo preview */}
      {photoUri && (
        <View style={styles.previewBar}>
          <Image source={{ uri: photoUri }} style={styles.previewImg} />
          <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.previewRemove}>
            <Ionicons name="close" size={14} color={C.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickPhoto} disabled={sending}>
          <Ionicons name="image-outline" size={20} color={C.grey} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor={C.grey}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendDisabled]}
          onPress={sendMessage}
          disabled={!canSend}
          activeOpacity={0.85}
        >
          {sending
            ? <ActivityIndicator size="small" color={C.navy} />
            : <Ionicons name="send" size={18} color={C.navy} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Admin Messages ───────────────────────────────────────────────────────────
function AdminMessages() {
  const insets = useSafeAreaInsets();
  const [conversations, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading]      = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live inbox.
  useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("lastAt", "desc"));
    return onSnapshot(q, (snap) => {
      setConvos(
        snap.docs
          .filter((d) => (d.data().type ?? "member_admin") !== "member_superadmin")
          .map((d) => ({ id: d.id, ...d.data() } as Conversation))
      );
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const selected = conversations.find((c) => c.id === selectedId);
  if (selected) {
    return (
      <ChatView
        convoId={selected.id}
        headerTitle={selected.memberName || "Member"}
        headerSub="Conversation with member"
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.inboxHeader}>
        <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.inboxTitle}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.centerFull}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerFull}>
          <Ionicons name="chatbubbles-outline" size={44} color={C.grey} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {conversations.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.convoRow}
              onPress={() => setSelectedId(c.id)}
              activeOpacity={0.7}
            >
              <Avatar name={c.memberName} size={44} />
              <View style={styles.convoInfo}>
                <View style={styles.convoTop}>
                  <Text style={styles.convoName}>{c.memberName || "Member"}</Text>
                  <Text style={styles.convoTime}>{fmtAgo(c.lastAt)}</Text>
                </View>
                <Text style={styles.convoLast} numberOfLines={1}>
                  {c.lastMessage || "No messages yet"}
                </Text>
              </View>
              {(c.unreadByStaff ?? 0) > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadTxt}>{c.unreadByStaff}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} currentRoute="/(tabs)/messages" />
    </View>
  );
}

// ─── Member Messages ──────────────────────────────────────────────────────────
function MemberMessages() {
  const { user }       = useAuth();
  const insets         = useSafeAreaInsets();
  const [convoId, setConvoId]         = useState<string | null>(null);
  const [loadingConvo, setLoadingConvo] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const q = query(collection(db, "conversations"), where("memberId", "==", user.id));
        const snap = await getDocs(q);
        let id: string;
        if (!snap.empty) {
          id = snap.docs[0].id;
        } else {
          const ref = await addDoc(collection(db, "conversations"), {
            memberId:       user.id,
            memberName:     user.displayName || user.email,
            lastMessage:    "",
            lastAt:         serverTimestamp(),
            unreadByStaff:  0,
            unreadByMember: 0,
            createdAt:      serverTimestamp(),
            type:           "member_admin",
          });
          id = ref.id;
        }
        setConvoId(id);
      } finally {
        setLoadingConvo(false);
      }
    })();
  }, [user]);

  if (loadingConvo || !convoId) {
    return (
      <View style={[styles.root, styles.centerFull, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.navy} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ChatView
        convoId={convoId}
        headerTitle="Spiritual Father"
        headerSub="Chat with Your Father"
        onMenuPress={() => setSidebarOpen(true)}
      />
      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} currentRoute="/(tabs)/messages" />
    </View>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const { role } = useAuth();
  if (role === "admin" || role === "super_admin") return <AdminMessages />;
  return <MemberMessages />;
}

const styles = themedStyles({
  root:          { flex: 1, backgroundColor: L.bg },
  centerFull:    { flex: 1, alignItems: "center", justifyContent: "center" },

  // Chat header
  header:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: L.white, borderBottomWidth: 1, borderBottomColor: L.border },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  headerAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: L.navy, alignItems: "center", justifyContent: "center" },
  headerAvatarText:{ color: L.yellow, fontSize: 14, fontWeight: "800" },
  headerInfo:    { flex: 1 },
  headerTitle:   { fontSize: 14, fontWeight: "700", color: L.navy },
  headerSub:     { fontSize: 11, color: L.grey },

  // Chat messages
  messageList:   { paddingTop: 16, paddingBottom: 8 },
  emptyWrap:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  emptyTitle:    { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySub:      { fontSize: 13, color: L.grey, textAlign: "center" },

  // Input bar
  inputBar:      { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: L.white, borderTopWidth: 1, borderTopColor: L.border },
  attachBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  previewBar:    { flexDirection: "row", paddingHorizontal: 12, paddingTop: 8, backgroundColor: L.white, borderTopWidth: 1, borderTopColor: L.border },
  previewImg:    { width: 64, height: 64, borderRadius: 10 },
  previewRemove: { position: "absolute", left: 66, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: L.dark, alignItems: "center", justifyContent: "center" },
  input:         { flex: 1, borderWidth: 1, borderColor: L.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: "#374151", backgroundColor: L.white, maxHeight: 100 },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: L.yellow, alignItems: "center", justifyContent: "center" },
  sendDisabled:  { opacity: 0.5 },

  // Admin inbox
  inboxHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, backgroundColor: L.white, borderBottomWidth: 1, borderBottomColor: L.border, gap: 10 },
  hamburgerBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: L.light, alignItems: "center", justifyContent: "center" },
  hamburgerIcon: { fontSize: 20, color: L.navy, lineHeight: 24 },
  inboxTitle:    { flex: 1, fontSize: 20, fontWeight: "800", color: L.navy },
  convoRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: L.border, backgroundColor: L.white },
  convoInfo:     { flex: 1 },
  convoTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  convoName:     { fontSize: 14, fontWeight: "700", color: "#374151" },
  convoTime:     { fontSize: 11, color: L.grey },
  convoLast:     { fontSize: 13, color: L.grey },
  unreadBadge:   { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: L.navy, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  unreadTxt:     { color: L.white, fontSize: 10, fontWeight: "700" },
});
