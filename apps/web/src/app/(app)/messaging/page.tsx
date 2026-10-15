"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  collection, query, orderBy, onSnapshot, addDoc, getDoc, getDocs,
  serverTimestamp, Timestamp, where, doc, updateDoc, increment,
} from "firebase/firestore";
import { Search, MessageSquare, Paperclip, X, Smile, SendHorizontal, UserRound, MoreVertical, ImageIcon, FileText, ArrowLeft } from "lucide-react";
import {
  db, useAuth, notify, isOnline, presenceLabel, type User,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

interface Message {
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
  lastAt: Timestamp | null;
  unreadByStaff: number;
}

type Person = Pick<User, "id" | "displayName" | "email" | "photoURL" | "role" | "lastSeen">;

const EMOJIS = ["🙏", "✝️", "❤️", "🕊️", "😊", "🙂", "😇", "🤲", "🌿", "☀️", "🌙", "⭐", "👍", "👏", "💐", "📖", "🕯️", "⛪", "😢", "🤗", "💛", "🙌", "✨", "🌹"];

function fmtTime(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function fmtAgo(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  const diff = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return i18n.t("msg.mins", { n: Math.max(mins, 1) });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return i18n.t("msg.hours", { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? i18n.t("time.yesterday") : ts.toDate().toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
}
function dayLabel(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return i18n.t("msg.today");
  if (diff === 1) return i18n.t("msg.yesterday");
  return d.toLocaleDateString(dateLocale(), { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
}

function Avatar({ person, name, size = 44, dot = false }: { person?: Person | null; name: string; size?: number; dot?: boolean }) {
  return (
    <span className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      {person?.photoURL
        ? <img src={person.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
        : <span className="w-full h-full rounded-full bg-[#EEF1F8] text-[#1B2E6B] font-bold flex items-center justify-center" style={{ fontSize: size * 0.36 }}>{(name || "?")[0].toUpperCase()}</span>}
      {dot && isOnline(person?.lastSeen) && (
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22C55E] ring-2 ring-white" />
      )}
    </span>
  );
}

// ── Profile popup ─────────────────────────────────────────────────────────────
function ProfileCard({ person, name, onClose }: { person: Person | null; name: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-6 text-center relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-[#9CA3AF]" aria-label={t("common.close")}><X size={16} /></button>
        <div className="flex justify-center"><Avatar person={person} name={name} size={88} /></div>
        <p className="text-xl font-bold text-[#111827] mt-3">{name}</p>
        <p className="text-sm text-[#6B7280]">{person?.role === "super_admin" ? t("msg.father") : person?.role === "admin" ? t("msg.admin") : t("status.member")}</p>
        <p className={`text-xs mt-2 ${isOnline(person?.lastSeen) ? "text-[#16A34A]" : "text-[#9CA3AF]"}`}>{presenceLabel(person?.lastSeen)}</p>
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────
// Conversations keep unreadByStaff (member → ministry) and unreadByMember
// (ministry → member). Opening a chat clears your own side.
function ChatPanel({
  conversationId, partner, partnerName, memberId,
}: {
  conversationId: string;
  partner: Person | null;
  partnerName: string;
  memberId: string;
}) {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText]         = useState("");
  const [file, setFile]         = useState<File | null>(null);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "conversations", conversationId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
      updateDoc(doc(db, "conversations", conversationId), { [isStaff ? "unreadByStaff" : "unreadByMember"]: 0 }).catch(() => {});
    });
  }, [conversationId, isStaff]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const groups = useMemo(() => {
    const out: { label: string; items: Message[] }[] = [];
    for (const m of messages) {
      const label = m.createdAt ? dayLabel(m.createdAt.toDate()) : t("msg.today");
      if (out[out.length - 1]?.label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(m);
    }
    return out;
  }, [messages]);

  async function sendMessage() {
    const content = text.trim();
    if ((!content && !file) || !user) return;
    setSending(true);
    setError(null);
    try {
      const attachmentURL = file ? await uploadToCloudinary(file, "nablis/messages") : null;
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.id,
        senderName: user.displayName || user.email,
        content,
        attachmentURL,
        attachmentName: file?.name ?? null,
        createdAt: serverTimestamp(),
        read: false,
      });
      const convoRef = doc(db, "conversations", conversationId);
      await updateDoc(convoRef, {
        lastMessage: content || (file?.name ?? "Attachment"),
        lastAt: serverTimestamp(),
        [isStaff ? "unreadByMember" : "unreadByStaff"]: increment(1),
      });
      setText("");
      setFile(null);

      if (isStaff) {
        await notify({ userId: memberId, type: "message", link: "/messaging", title: "New message", description: content || "Sent you an attachment" });
      } else {
        const staff = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
        await notify(staff.docs.map((d) => ({
          userId: d.id, type: "message", link: "/messaging",
          title: `Message from ${user.displayName || "a member"}`, description: content || "Sent an attachment",
        })));
      }
    } catch {
      setError("Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function markUnread() {
    setMenuOpen(false);
    await updateDoc(doc(db, "conversations", conversationId), { [isStaff ? "unreadByStaff" : "unreadByMember"]: 1 }).catch(() => {});
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-3 flex-shrink-0 bg-white">
        <Avatar person={partner} name={partnerName} size={42} />
        <div className="flex-1 min-w-0">
          <p className="text-[#111827] font-semibold text-lg leading-tight truncate">{partnerName}</p>
          <p className={`flex items-center gap-1.5 text-xs ${isOnline(partner?.lastSeen) ? "text-[#16A34A]" : "text-[#9CA3AF]"}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline(partner?.lastSeen) ? "bg-[#22C55E]" : "bg-[#D1D5DB]"}`} />
            {presenceLabel(partner?.lastSeen)}
          </p>
        </div>
        {isStaff ? (
          <Link href={`/settings/members/${memberId}`} className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><UserRound size={15} /> {t("msg.viewProfile")}</Link>
        ) : (
          <button onClick={() => setProfileOpen(true)} className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><UserRound size={15} /> {t("msg.viewProfile")}</button>
        )}
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EEF1F8]" aria-label={t("msg.more")}><MoreVertical size={18} /></button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-48 z-20 bg-white rounded-xl shadow-xl border border-[#E5E7EB] py-1.5 animate-scale-in">
                <button onClick={() => { setMenuOpen(false); setProfileOpen(true); }} className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#EEF1F8]">{t("msg.viewProfile")}</button>
                <button onClick={markUnread} className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#EEF1F8]">{t("msg.markUnread")}</button>
                {isStaff && <Link href="/appointment" className="block px-4 py-2 text-sm text-[#374151] hover:bg-[#EEF1F8]">{t("nav.appointment")}</Link>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#F8FAFC] space-y-6 min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF] py-16">
            <MessageSquare size={36} className="mb-2 opacity-30" />
            <p className="text-sm">{t("msg.sayHello")}</p>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.label} className="space-y-5">
            <div className="flex justify-center">
              <span className="px-3 py-1 rounded-full bg-[#E5EAF1] text-[11px] font-bold tracking-widest text-[#4B5563]">{g.label}</span>
            </div>
            {g.items.map((m) => {
              const own = m.senderId === user?.id;
              const isImage = !!m.attachmentURL && /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(m.attachmentURL);
              return (
                <div key={m.id} className={`flex items-end gap-2.5 animate-fade-up ${own ? "flex-row-reverse" : ""}`}>
                  {own
                    ? <Avatar person={user} name={user?.displayName || "Me"} size={34} />
                    : <Avatar person={partner} name={m.senderName || partnerName} size={34} />}
                  <div className={`max-w-[75%] flex flex-col ${own ? "items-end" : "items-start"}`}>
                    {m.content && (
                      <div className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap break-words ${own ? "bg-[#1E3A8A] text-white rounded-br-md" : "bg-[#E5EAF1] text-[#111827] rounded-bl-md"}`}>
                        {m.content}
                      </div>
                    )}
                    {m.attachmentURL && (
                      isImage ? (
                        <a href={m.attachmentURL} target="_blank" rel="noreferrer" className="mt-1.5">
                          <img src={m.attachmentURL} alt={m.attachmentName ?? t("msg.attachment")} className="rounded-xl max-h-60 border border-[#E5E7EB]" />
                        </a>
                      ) : (
                        <a href={m.attachmentURL} target="_blank" rel="noreferrer"
                          className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#E5EAF1] text-sm text-[#111827] hover:bg-[#DCE2EC]">
                          <FileText size={15} className="text-[#1B2E6B]" /> {m.attachmentName ?? t("msg.attachment")}
                        </a>
                      )
                    )}
                    {isImage && m.attachmentName && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-[#6B7280]"><ImageIcon size={11} /> {m.attachmentName}</span>
                    )}
                    <span className="text-[11px] text-[#9CA3AF] mt-1 px-1">{fmtTime(m.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 sm:px-5 py-4 border-t border-[#E5E7EB] bg-white flex-shrink-0 space-y-2">
        {error && <p className="text-red-500 text-xs">{error}</p>}
        {file && (
          <div className="flex items-center gap-2 text-xs text-[#374151] bg-[#EEF1F8] rounded-lg px-3 py-1.5 w-fit">
            <Paperclip size={12} /> <span className="truncate max-w-[240px]">{file.name}</span>
            <button onClick={() => setFile(null)} aria-label={t("msg.removeAttachment")}><X size={12} /></button>
          </div>
        )}
        <div className="relative flex items-center gap-2 bg-[#F1F4F9] border border-[#E5E7EB] rounded-xl pl-3 pr-1.5 py-1.5">
          <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} className="p-1.5 text-[#6B7280] hover:text-[#1B2E6B]" aria-label={t("msg.attach")}>
            <Paperclip size={18} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={isStaff ? t("msg.placeholderStaff") : t("msg.placeholder")}
            className="flex-1 min-w-0 bg-transparent py-2 text-[15px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none"
          />
          <button onClick={() => setEmojiOpen((v) => !v)} className="p-1.5 text-[#6B7280] hover:text-[#1B2E6B]" aria-label={t("msg.emoji")}>
            <Smile size={19} />
          </button>
          <button onClick={sendMessage} disabled={sending || (!text.trim() && !file)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C518] text-[#111827] font-semibold hover:bg-[#e6b800] disabled:opacity-50">
            {sending ? t("book.sending") : t("messaging.send")} <SendHorizontal size={16} />
          </button>
          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
              <div className="absolute bottom-full right-24 mb-2 z-20 bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-2 grid grid-cols-8 gap-1 animate-scale-in">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { setText((t) => t + e); inputRef.current?.focus(); }}
                    className="w-8 h-8 rounded-lg text-lg hover:bg-[#EEF1F8]">{e}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {profileOpen && <ProfileCard person={partner} name={partnerName} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

// ── Admin / Spiritual Father view ─────────────────────────────────────────────
function AdminMessaging() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const memberParam  = searchParams.get("member");
  const [convos, setConvos]     = useState<Conversation[]>([]);
  const [people, setPeople]     = useState<Record<string, Person>>({});
  const [loading, setLoading]   = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("lastAt", "desc"));
    return onSnapshot(q, (snap) => {
      setConvos(snap.docs
        .filter((d) => (d.data().type ?? "member_admin") !== "member_superadmin")
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            memberId: data.memberId ?? "",
            memberName: data.memberName ?? "Unknown",
            lastMessage: data.lastMessage ?? "",
            lastAt: data.lastAt ?? null,
            unreadByStaff: data.unreadByStaff ?? 0,
          };
        }));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  // Live photos + presence for everyone in the inbox.
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "users"), where("status", "==", "active")), (snap) => {
      setPeople(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Person])));
    });
    return unsub;
  }, []);

  // /messaging?member=<uid> opens or starts that member's chat.
  useEffect(() => {
    if (!memberParam || loading) return;
    const existing = convos.find((c) => c.memberId === memberParam);
    if (existing) { setActiveId(existing.id); return; }
    (async () => {
      const member = await getDoc(doc(db, "users", memberParam));
      if (!member.exists()) return;
      const ref = await addDoc(collection(db, "conversations"), {
        memberId: memberParam,
        memberName: member.data().displayName || member.data().email,
        lastMessage: "", lastAt: serverTimestamp(),
        unreadByStaff: 0, unreadByMember: 0,
        type: "member_admin", createdAt: serverTimestamp(),
      });
      setActiveId(ref.id);
    })();
  }, [memberParam, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId && convos.length && typeof window !== "undefined" && window.innerWidth >= 768) setActiveId(convos[0].id);
  }, [convos, activeId]);

  const active = convos.find((c) => c.id === activeId) ?? null;
  const filtered = convos.filter((c) => !search || c.memberName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <PageTitle id="messagingStaff" />
      </div>
      <div className="flex h-[calc(100vh-17rem)] min-h-[520px] bg-white shadow-sm overflow-hidden">
        {/* Inbox */}
        <div className={`${active ? "hidden md:flex" : "flex"} w-full md:w-[320px] border-r border-[#E5E7EB] flex-col flex-shrink-0`}>
          <div className="px-4 py-5">
            <h2 className="text-xl font-semibold text-[#111827] mb-4">{t("msg.inbox")}</h2>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("msg.search")}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#F1F4F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-10"><div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-[#9CA3AF] text-xs px-4">{search ? t("msg.noMatch") : t("msg.noConversations")}</p>
            ) : filtered.map((c) => {
              const person = people[c.memberId];
              const isActive = activeId === c.id;
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-4 py-4 flex items-center gap-3 border-b border-[#F1F4F9] border-l-4 transition-colors ${isActive ? "bg-[#F1F4F9] border-l-[#1E3A8A]" : "border-l-transparent hover:bg-[#F9FAFB]"}`}>
                  <Avatar person={person} name={c.memberName} size={46} dot />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[#111827] text-[15px] truncate ${c.unreadByStaff > 0 ? "font-bold" : "font-semibold"}`}>{c.memberName}</p>
                      <span className="text-[#9CA3AF] text-[11px] flex-shrink-0">{fmtAgo(c.lastAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-[13px] truncate ${c.unreadByStaff > 0 ? "text-[#111827]" : "text-[#6B7280]"}`}>{c.lastMessage ? `"${c.lastMessage}"` : t("messaging.noMessages")}</p>
                      {c.unreadByStaff > 0 && (
                        <span className="min-w-[20px] h-5 px-1 rounded-full bg-[#F5C518] text-[#111827] text-[11px] font-bold flex items-center justify-center flex-shrink-0 animate-pop">{c.unreadByStaff}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat */}
        <div className={`${!active ? "hidden md:flex" : "flex"} flex-1 flex-col min-w-0`}>
          {active ? (
            <>
              <div className="md:hidden px-4 py-2.5 border-b border-[#E5E7EB]">
                <button onClick={() => setActiveId(null)} className="text-sm text-[#1B2E6B] font-semibold flex items-center gap-1.5"><ArrowLeft size={14} /> {t("msg.backToInbox")}</button>
              </div>
              <ChatPanel key={active.id} conversationId={active.id} memberId={active.memberId}
                partner={people[active.memberId] ?? null} partnerName={active.memberName} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
              <MessageSquare size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium text-[#374151]">{t("msg.select")}</p>
              <p className="text-xs mt-1">{t("msg.selectHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Member view ───────────────────────────────────────────────────────────────
function MemberMessaging() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [convoId, setConvoId] = useState<string | null>(null);
  const [father, setFather]   = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "conversations"), where("memberId", "==", user.id)))
      .then(async (snap) => {
        if (!snap.empty) {
          setConvoId(snap.docs[0].id);
        } else {
          const ref = await addDoc(collection(db, "conversations"), {
            memberId: user.id,
            memberName: user.displayName || user.email,
            lastMessage: "", lastAt: serverTimestamp(),
            unreadByStaff: 0, unreadByMember: 0,
            type: "member_admin", createdAt: serverTimestamp(),
          });
          setConvoId(ref.id);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  // The Spiritual Father's live profile (name, photo, presence).
  useEffect(() => onSnapshot(query(collection(db, "users"), where("role", "==", "super_admin")), (snap) => {
    const d = snap.docs[0];
    setFather(d ? ({ id: d.id, ...d.data() } as Person) : null);
  }), []);

  return (
    <div className="space-y-6">
      <div>
        <PageTitle id="messagingMember" />
      </div>
      <div className="bg-white shadow-sm overflow-hidden h-[calc(100vh-17rem)] min-h-[520px] max-w-[900px]">
        {loading ? (
          <div className="h-full flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin" /></div>
        ) : convoId && user ? (
          <ChatPanel conversationId={convoId} memberId={user.id} partner={father} partnerName={father?.displayName || "Spiritual Father"} />
        ) : (
          <div className="h-full flex items-center justify-center text-[#9CA3AF] text-sm">{t("msg.startError")}</div>
        )}
      </div>
    </div>
  );
}

export default function MessagingPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return role === "admin" || role === "super_admin"
    ? <Suspense fallback={null}><AdminMessaging /></Suspense>
    : <MemberMessaging />;
}
