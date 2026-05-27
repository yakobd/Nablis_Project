import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection, query, orderBy, onSnapshot, addDoc, getDocs,
  where, doc, updateDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useAuth } from '@nablis/shared/firebase';
import { Ionicons } from "@expo/vector-icons";
import { ChatBubble } from "../../components/ChatBubble";
import { Avatar } from "../../components/Avatar";
import { SidebarDrawer } from "../../components/SidebarDrawer";

const C = {
  navy: "#1B2E6B", yellow: "#F5C518", light: "#EEF1F8",
  grey: "#9CA3AF", dark: "#374151", border: "#E5E7EB",
  white: "#FFFFFF", bg: "#F9FAFB",
};

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Timestamp | null;
}

interface Conversation {
  id: string;
  memberId: string;
  memberName: string;
  lastMessage: string;
  lastAt?: Timestamp;
  unread: number;
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
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
  const flatRef    = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "conversations", convoId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [convoId]);

  async function sendMessage() {
    if (!text.trim() || !user) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      await addDoc(collection(db, "conversations", convoId, "messages"), {
        senderId:   user.id,
        senderName: user.displayName || user.email,
        content,
        createdAt:  serverTimestamp(),
        read:       false,
      });
      await updateDoc(doc(db, "conversations", convoId), {
        lastMessage: content,
        lastAt:      serverTimestamp(),
        unread:      0,
      });
    } finally {
      setSending(false);
    }
  }

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
        <View style={styles.headerAvatarWrap}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{headerTitle.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.onlineDot} />
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
              createdAt={item.createdAt}
              isOwn={item.senderId === user?.id}
            />
          )}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={() => Alert.alert("Coming Soon", "File attachment will be available in a future update.")}>
          <Ionicons name="attach" size={20} color={C.grey} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.emojiBtn} onPress={() => Alert.alert("Coming Soon", "Emoji picker will be available in a future update.")}>
          <Ionicons name="happy-outline" size={20} color={C.grey} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor={C.grey}
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
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
  const [selected, setSelected]    = useState<Conversation | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "conversations"), orderBy("lastAt", "desc"))
      );
      setConvos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return (
      <ChatView
        convoId={selected.id}
        headerTitle={selected.memberName || "Member"}
        headerSub="Conversation with member"
        onBack={() => setSelected(null)}
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
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={C.navy} />
        </TouchableOpacity>
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
              onPress={() => setSelected(c)}
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
              {c.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadTxt}>{c.unread}</Text>
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
            memberId:    user.id,
            memberName:  user.displayName || user.email,
            lastMessage: "",
            lastAt:      serverTimestamp(),
            unread:      0,
            createdAt:   serverTimestamp(),
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

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  centerFull:    { flex: 1, alignItems: "center", justifyContent: "center" },

  // Chat header
  header:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: C.light, alignItems: "center", justifyContent: "center" },
  headerAvatarWrap:{ position: "relative" },
  headerAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },
  headerAvatarText:{ color: C.yellow, fontSize: 14, fontWeight: "800" },
  onlineDot:     { position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: "#22C55E", borderWidth: 2, borderColor: C.white },
  headerInfo:    { flex: 1 },
  headerTitle:   { fontSize: 14, fontWeight: "700", color: C.navy },
  headerSub:     { fontSize: 11, color: C.grey },

  // Chat messages
  messageList:   { paddingTop: 16, paddingBottom: 8 },
  emptyWrap:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  emptyTitle:    { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySub:      { fontSize: 13, color: C.grey, textAlign: "center" },

  // Input bar
  inputBar:      { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  attachBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  emojiBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  input:         { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: "#374151", backgroundColor: C.white, maxHeight: 100 },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.yellow, alignItems: "center", justifyContent: "center" },
  sendDisabled:  { opacity: 0.5 },

  // Admin inbox
  inboxHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  hamburgerBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: C.light, alignItems: "center", justifyContent: "center" },
  inboxTitle:    { flex: 1, fontSize: 20, fontWeight: "800", color: C.navy },
  refreshBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: C.light, alignItems: "center", justifyContent: "center" },
  convoRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  convoInfo:     { flex: 1 },
  convoTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  convoName:     { fontSize: 14, fontWeight: "700", color: "#374151" },
  convoTime:     { fontSize: 11, color: C.grey },
  convoLast:     { fontSize: 13, color: C.grey },
  unreadBadge:   { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.navy, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  unreadTxt:     { color: C.white, fontSize: 10, fontWeight: "700" },
});
