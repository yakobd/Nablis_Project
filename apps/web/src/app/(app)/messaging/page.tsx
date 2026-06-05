"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  collection, query, orderBy, onSnapshot, addDoc,
  serverTimestamp, Timestamp, getDocs, where, doc, updateDoc,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { Send, Search, MessageSquare, Circle } from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Timestamp | null;
  read?: boolean;
}

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantInitial: string;
  lastMessage: string;
  lastAt: Timestamp | null;
  unread: number;
}

function fmtTime(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}
function fmtAgo(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${mins || 1}m`;
  } catch { return ""; }
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-[#EEF1F8] flex items-center justify-center text-[10px] font-bold text-[#1B2E6B] flex-shrink-0">
          {(msg.senderName || "?")[0].toUpperCase()}
        </div>
      )}
      <div className={[
        "max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
        isOwn
          ? "bg-[#1B2E6B] text-white rounded-br-sm"
          : "bg-[#F3F4F6] text-[#374151] rounded-bl-sm",
      ].join(" ")}>
        <p>{msg.content}</p>
        <p className={`text-[9px] mt-1 ${isOwn ? "text-white/50 text-right" : "text-[#9CA3AF]"}`}>
          {fmtTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function ChatPanel({
  conversationId,
  partnerName,
}: {
  conversationId: string;
  partnerName: string;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
    return unsub;
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId:   user.id,
        senderName: user.displayName || user.email,
        content:    text.trim(),
        createdAt:  serverTimestamp(),
        read:       false,
      });
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: text.trim(),
        lastAt:      serverTimestamp(),
      });
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-[#EEF1F8] flex items-center justify-center text-sm font-bold text-[#1B2E6B]">
          {(partnerName || "?")[0].toUpperCase()}
        </div>
        <div>
          <p className="text-[#374151] font-semibold text-sm">{partnerName}</p>
          <div className="flex items-center gap-1.5">
            <Circle size={7} className="fill-green-400 text-green-400" />
            <span className="text-[#9CA3AF] text-[10px]">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF]">
            <MessageSquare size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} isOwn={msg.senderId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-[#F3F4F6] flex items-center gap-3 flex-shrink-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
        />
        <button onClick={sendMessage} disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-xl bg-[#F5C518] flex items-center justify-center text-[#1B2E6B] hover:bg-[#e6b800] disabled:opacity-60 transition-colors flex-shrink-0">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────
function AdminMessaging() {
  const { user } = useAuth();
  const [convos, setConvos]           = useState<Conversation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [search, setSearch]           = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "conversations"), orderBy("lastAt", "desc")))
      .then((snap) => {
        setConvos(snap.docs
          .filter((d) => {
            const data = d.data();
            const convType = data.type ?? 'member_admin';
            return convType !== 'member_superadmin';
          })
          .map((d) => {
            const data = d.data();
            return {
              id:                 d.id,
              participantId:      data.memberId ?? "",
              participantName:    data.memberName ?? "Unknown",
              participantInitial: (data.memberName ?? "?")[0].toUpperCase(),
              lastMessage:        data.lastMessage ?? "",
              lastAt:             data.lastAt ?? null,
              unread:             data.unread ?? 0,
            } as Conversation;
          }));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = convos.filter((c) =>
    !search || c.participantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      {/* Inbox sidebar */}
      <div className={`${activeConvo ? 'hidden md:flex' : 'flex'} w-full md:w-72 border-r border-[#F3F4F6] flex-col flex-shrink-0`}>
        <div className="px-4 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[#1B2E6B] font-bold text-sm mb-3">Messages</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center">
              <div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[#9CA3AF] text-xs px-4">
              {search ? "No conversations match your search." : "No conversations yet."}
            </div>
          ) : (
            filtered.map((c) => (
              <button key={c.id} onClick={() => setActiveConvo(c)}
                className={[
                  "w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors border-b border-[#F9FAFB]",
                  activeConvo?.id === c.id ? "bg-[#EEF1F8]" : "hover:bg-[#F9FAFB]",
                ].join(" ")}>
                <div className="w-10 h-10 rounded-full bg-[#EEF1F8] flex items-center justify-center text-sm font-bold text-[#1B2E6B] flex-shrink-0">
                  {c.participantInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[#374151] font-semibold text-xs truncate">{c.participantName}</p>
                    <span className="text-[#9CA3AF] text-[9px] ml-1 flex-shrink-0">{fmtAgo(c.lastAt)}</span>
                  </div>
                  <p className="text-[#9CA3AF] text-[10px] truncate mt-0.5">{c.lastMessage || "No messages yet"}</p>
                </div>
                {c.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#1B2E6B] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {c.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`${!activeConvo ? 'hidden md:flex' : 'flex'} flex-1 flex-col`}>
        {activeConvo ? (
          <>
            <div className="md:hidden px-4 py-2.5 border-b border-[#F3F4F6] flex-shrink-0">
              <button
                onClick={() => setActiveConvo(null)}
                className="text-sm text-[#1B2E6B] font-semibold flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Back to inbox
              </button>
            </div>
            <ChatPanel conversationId={activeConvo.id} partnerName={activeConvo.participantName} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
            <MessageSquare size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium text-[#374151]">Select a conversation</p>
            <p className="text-xs mt-1">Choose a member from the inbox to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Member view ───────────────────────────────────────────────────────────────
function MemberMessaging() {
  const { user }            = useAuth();
  const [convoId, setConvoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "conversations"), where("memberId", "==", user.id)))
      .then(async (snap) => {
        if (!snap.empty) {
          setConvoId(snap.docs[0].id);
        } else {
          const ref = await addDoc(collection(db, "conversations"), {
            memberId:    user.id,
            memberName:  user.displayName || user.email,
            lastMessage: "",
            lastAt:      serverTimestamp(),
            unread:      0,
            type:        'member_admin',
            createdAt:   serverTimestamp(),
          });
          setConvoId(ref.id);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Messaging</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Chat with the spiritual father</p>
      </div>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden h-[calc(100vh-12rem)]">
        {convoId ? (
          <ChatPanel conversationId={convoId} partnerName="Spiritual Father" />
        ) : (
          <div className="h-full flex items-center justify-center text-[#9CA3AF]">
            <p className="text-sm">Could not start conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MessagingPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return (role === "admin" || role === "super_admin") ? <AdminMessaging /> : <MemberMessaging />;
}
