import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Timestamp } from "firebase/firestore";
import { FadeInView } from "./FadeInView";
import { themedStyles } from "../theme";
import { Ionicons } from "@expo/vector-icons";

interface ChatBubbleProps {
  content: string;
  senderName: string;
  attachmentURL?: string | null;
  attachmentName?: string | null;
  createdAt?: Timestamp | null;
  isOwn: boolean;
}

function fmtTime(ts?: Timestamp | null) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

export function ChatBubble({ content, senderName, attachmentURL, attachmentName, createdAt, isOwn }: ChatBubbleProps) {
  return (
    <FadeInView offset={8} style={[styles.row, isOwn && styles.rowOwn]}>
      {!isOwn && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(senderName || "?")[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {attachmentURL ? (
          <TouchableOpacity onPress={() => Linking.openURL(attachmentURL)} activeOpacity={0.85}>
            {/\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(attachmentURL) ? (
              <Image source={{ uri: attachmentURL }} style={styles.image} resizeMode="cover" />
            ) : (
              <Text style={[styles.fileChip, isOwn && styles.contentOwn]}><Ionicons name="attach" size={14} /> {attachmentName || "Attachment"}</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {content ? <Text style={[styles.content, isOwn && styles.contentOwn]}>{content}</Text> : null}
        <Text style={[styles.time, isOwn && styles.timeOwn]}>{fmtTime(createdAt)}</Text>
      </View>
    </FadeInView>
  );
}

const styles = themedStyles({
  row:         { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, paddingHorizontal: 16 },
  rowOwn:      { flexDirection: "row-reverse" },
  avatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EEF1F8", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 },
  avatarText:  { fontSize: 11, fontWeight: "700", color: "#1B2E6B" },
  bubble:      { maxWidth: "72%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn:   { backgroundColor: "#1B2E6B", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#F3F4F6", borderBottomLeftRadius: 4 },
  image:       { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },
  fileChip:    { fontSize: 13, fontWeight: "600", color: "#1B2E6B", textDecorationLine: "underline", marginBottom: 6 },
  content:     { fontSize: 14, color: "#374151", lineHeight: 20 },
  contentOwn:  { color: "#FFFFFF" },
  time:        { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  timeOwn:     { color: "rgba(255,255,255,0.5)", textAlign: "right" },
});
