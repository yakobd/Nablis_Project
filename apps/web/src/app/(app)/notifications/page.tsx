"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, writeBatch, Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
  Bell, CheckCircle2, XCircle, Calendar, BookOpen,
  Users, Star, UserCheck, Hand,
} from "lucide-react";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  link?: string;
  read: boolean;
  createdAt: Timestamp | null;
}

const TYPE_META: Record<string, { icon: React.ReactNode; filterKey: string }> = {
  appointment_confirmed: { icon: <CheckCircle2 size={16} className="text-green-500" />,  filterKey: "Appointments" },
  appointment_rejected:  { icon: <XCircle size={16} className="text-red-500" />,         filterKey: "Appointments" },
  appointment_request:   { icon: <Calendar size={16} className="text-[#1B2E6B]" />,      filterKey: "Appointments" },
  new_event:             { icon: <span className="text-base">🎉</span>,                  filterKey: "Events" },
  new_blog:              { icon: <BookOpen size={16} className="text-[#1B2E6B]" />,      filterKey: "Posts" },
  prayer_reminder:       { icon: <Hand size={16} className="text-[#F5C518]" />,          filterKey: "Prayers" },
  new_member:            { icon: <Users size={16} className="text-purple-500" />,         filterKey: "Members" },
  testimony_approved:    { icon: <Star size={16} className="text-[#F5C518]" />,          filterKey: "Posts" },
  member_approved:       { icon: <UserCheck size={16} className="text-green-500" />,     filterKey: "Members" },
};

const FILTERS = ["All", "Unread", "Events", "Appointments", "Prayers", "Posts", "Members"] as const;
type Filter = (typeof FILTERS)[number];

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "";
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days > 0)  return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins || 1}m ago`;
  } catch { return ""; }
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter]               = useState<Filter>("All");
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  async function markRead(id: string) {
    await updateDoc(doc(db, "notifications", id), { read: true });
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  }

  async function handleClick(n: Notification) {
    if (!n.read) await markRead(n.id);
    if (n.link) router.push(n.link);
  }

  const displayed = notifications.filter((n) => {
    if (filter === "All")    return true;
    if (filter === "Unread") return !n.read;
    return TYPE_META[n.type]?.filterKey === filter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Notifications</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="text-xs font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors">
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              filter === f ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
            ].join(" ")}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-[#9CA3AF]">
            <Bell size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {displayed.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={[
                  "w-full text-left px-5 py-4 flex items-start gap-4 transition-colors hover:bg-[#F9FAFB]",
                  !n.read ? "bg-[#EEF1F8]/50" : "",
                ].join(" ")}
              >
                <div className="w-9 h-9 rounded-full bg-[#EEF1F8] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {TYPE_META[n.type]?.icon ?? <Bell size={16} className="text-[#9CA3AF]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read ? "font-semibold text-[#1B2E6B]" : "font-medium text-[#374151]"} truncate`}>
                    {n.title}
                  </p>
                  <p className="text-[#6B7280] text-xs mt-0.5 line-clamp-2">{n.description}</p>
                  <p className="text-[#9CA3AF] text-[10px] mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[#1B2E6B] flex-shrink-0 mt-1.5" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
