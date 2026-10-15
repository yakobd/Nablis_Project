"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Megaphone, Plus, X, CalendarDays, MapPin, ScanLine, QrCode, ClipboardCheck, ImagePlus, CheckCircle2 } from "lucide-react";
import {
  db, useAuth, notify, createAnnouncement, type Announcement,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { MemberPassModal } from "@/components/MemberPassModal";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const FIELD = "w-full px-4 py-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15 focus:border-[#1B2E6B]";
const LABEL = "block text-[13px] font-semibold tracking-wider text-[#111827] uppercase mb-2";

function fmtWhen(a: Pick<Announcement, "eventDate" | "createdAt">) {
  const d = (a.eventDate ?? a.createdAt)?.toDate?.();
  if (!d) return "";
  return d.toLocaleString(dateLocale(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ── Create dialog ─────────────────────────────────────────────────────────────
function NewAnnouncement({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, attendance: boolean) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [when, setWhen]         = useState("");
  const [location, setLocation] = useState("");
  const [attendance, setAttendance] = useState(false);
  const [image, setImage]       = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try { setImage(await uploadToCloudinary(f, "nablis/announcements")); }
    catch { setError("Image upload failed."); }
    finally { setUploading(false); }
  }

  async function publish() {
    if (!user) return;
    if (!title.trim() || !body.trim()) { setError(t("ann.needTitle")); return; }
    if (attendance && !when) { setError(t("ann.needDate")); return; }
    setSaving(true);
    setError(null);
    try {
      const id = await createAnnouncement({
        title, body, location, imageURL: image,
        eventDate: when ? new Date(when) : null,
        attendanceRequired: attendance,
      }, user);
      const members = await getDocs(query(collection(db, "users"), where("status", "==", "active")));
      await notify(members.docs.filter((d) => d.id !== user.id).map((d) => ({
        userId: d.id,
        type: "announcement",
        link: `/announcements/${id}`,
        title: `📢 ${title.trim()}`,
        description: attendance ? `Attendance is required. ${body.trim()}` : body.trim(),
      })));
      onCreated(id, attendance);
    } catch {
      setError(t("ann.publishError"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[600px] shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#E5E7EB]">
          <h3 className="text-2xl font-bold text-[#111827]">{t("ann.new")}</h3>
          <button onClick={onClose} className="text-[#6B7280]" aria-label={t("common.close")}><X size={20} /></button>
        </div>
        <div className="px-7 py-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={LABEL}>{t("ann.title")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gather up — Monthly Meeting" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{t("ann.message")}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={t("ann.messagePlaceholder")} className={FIELD + " resize-none"} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{t("book.step2")} {attendance ? "" : `(${t("share.optional")})`}</label>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>{t("ann.location")}</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. St. Mary's Hall" className={FIELD} />
            </div>
          </div>
          <div>
            <label className={LABEL}>{t("ann.image")}</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            {image ? (
              <div className="relative w-fit">
                <img src={image} alt="" className="h-28 rounded-lg object-cover" />
                <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#111827] text-white flex items-center justify-center" aria-label={t("share.remove")}><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-[#E5E7EB] text-sm font-semibold text-[#1B2E6B] hover:bg-[#F8FAFC] disabled:opacity-60">
                <ImagePlus size={16} /> {uploading ? t("ann.uploading") : t("ann.addImage")}
              </button>
            )}
          </div>

          {/* Attendance toggle */}
          <button type="button" onClick={() => setAttendance((v) => !v)}
            className={`w-full text-left rounded-xl border-2 p-4 flex items-start gap-4 transition-colors ${attendance ? "border-[#1B2E6B] bg-[#F5F7FC]" : "border-[#E5E7EB] hover:border-[#1B2E6B]/40"}`}>
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${attendance ? "bg-[#1B2E6B] text-white" : "bg-[#EEF1F8] text-[#1B2E6B]"}`}>
              <ClipboardCheck size={20} />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-[#111827]">{t("ann.mandatory")}</p>
              <p className="text-sm text-[#6B7280] mt-0.5">{t("ann.mandatoryHint")}</p>
            </div>
            <span className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${attendance ? "bg-[#1B2E6B]" : "bg-[#D1D5DB]"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${attendance ? "translate-x-5" : ""}`} />
            </span>
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-7 py-5 bg-[#F9FAFB] rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-semibold text-[#374151] hover:bg-white">{t("common.cancel")}</button>
          <button onClick={publish} disabled={saving || uploading}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-[#F5C518] text-[#111827] font-semibold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800] disabled:opacity-60">
            <Megaphone size={16} /> {saving ? t("ann.publishing") : t("ann.publish")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const toast = useToast();
  const [items, setItems]     = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [attended, setAttended] = useState<Set<string>>(new Set());

  useEffect(() => onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap) => {
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
    setLoading(false);
  }, () => setLoading(false)), []);

  // Which gatherings the member has been checked in to.
  useEffect(() => {
    if (!user || isStaff) return;
    return onSnapshot(query(collection(db, "checkIns"), where("userId", "==", user.id)), (snap) => {
      setAttended(new Set(snap.docs.map((d) => d.data().sessionId as string)));
    });
  }, [user, isStaff]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <PageTitle id="announcements" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowPass(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#1B2E6B] font-semibold shadow-sm hover:shadow-md">
            <QrCode size={18} /> {t("shell.myPass")}
          </button>
          {isStaff && (
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F5C518] text-[#111827] font-semibold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800]">
              <Plus size={18} /> {t("ann.new")}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-[#9CA3AF]">
          <Megaphone size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("memberDash.noAnnouncements")}</p>
        </div>
      ) : (
        <div className="space-y-4 stagger max-w-[880px]">
          {items.map((a) => {
            const upcoming = !a.eventDate || a.eventDate.toDate().getTime() > Date.now() - 6 * 3600_000;
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col sm:flex-row">
                {a.imageURL && <img src={a.imageURL} alt="" className="sm:w-56 h-44 sm:h-auto object-cover" />}
                <div className="flex-1 p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {a.attendanceRequired && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF8DB] text-[#A16207] text-[11px] font-bold">
                        <ClipboardCheck size={12} /> {t("ann.required")}
                      </span>
                    )}
                    {!isStaff && attended.has(a.id) && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-[11px] font-bold">
                        <CheckCircle2 size={12} /> {t("ann.youAttended")}
                      </span>
                    )}
                    <span className="text-xs text-[#9CA3AF]">by {a.createdByName}</span>
                  </div>
                  <Link href={`/announcements/${a.id}`} className="text-xl font-semibold text-[#111827] hover:text-[#1B2E6B]">{a.title}</Link>
                  <p className="text-[#4B5563] mt-1.5 line-clamp-3 whitespace-pre-wrap">{a.body}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm text-[#4B5563]">
                    {a.eventDate && <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-[#1B2E6B]" />{fmtWhen(a)}</span>}
                    {a.location && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#1B2E6B]" />{a.location}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {isStaff && a.attendanceRequired && upcoming && (
                      <Link href={`/announcements/${a.id}?tab=checkin`}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#162554]">
                        <ScanLine size={16} /> {t("ann.checkInMembers")}
                      </Link>
                    )}
                    <Link href={`/announcements/${a.id}${isStaff && a.attendanceRequired ? "?tab=results" : ""}`}
                      className="px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8]">
                      {isStaff && a.attendanceRequired ? t("ann.viewAttendance") : t("blogsPage.readMore")}
                    </Link>
                    {!isStaff && a.attendanceRequired && upcoming && !attended.has(a.id) && (
                      <button onClick={() => setShowPass(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5C518] text-[#111827] text-sm font-semibold">
                        <QrCode size={16} /> {t("ann.showPass")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <NewAnnouncement
          onClose={() => setCreating(false)}
          onCreated={(id, att) => { setCreating(false); toast({ message: att ? t("ann.publishedOpen") : t("ann.published") }); void id; }}
        />
      )}
      {showPass && <MemberPassModal onClose={() => setShowPass(false)} />}
    </div>
  );
}
