import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Timestamp } from "firebase/firestore";

interface ChatBubbleProps {
  content: string;
  senderName: string;
  createdAt?: Timestamp | null;
  isOwn: boolean;
}

function fmtTime(ts?: Timestamp | null) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

export function ChatBubble({ content, senderName, createdAt, isOwn }: ChatBubbleProps) {
  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      {!isOwn && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(senderName || "?")[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.content, isOwn && styles.contentOwn]}>{content}</Text>
        <Text style={[styles.time, isOwn && styles.timeOwn]}>{fmtTime(createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, paddingHorizontal: 16 },
  rowOwn:      { flexDirection: "row-reverse" },
  avatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EEF1F8", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 },
  avatarText:  { fontSize: 11, fontWeight: "700", color: "#1B2E6B" },
  bubble:      { maxWidth: "72%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn:   { backgroundColor: "#1B2E6B", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#F3F4F6", borderBottomLeftRadius: 4 },
  content:     { fontSize: 14, color: "#374151", lineHeight: 20 },
  contentOwn:  { color: "#FFFFFF" },
  time:        { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  timeOwn:     { color: "rgba(255,255,255,0.5)", textAlign: "right" },
});
