"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft, FileText, Heart, Trash2, XCircle, CheckCircle2, EyeOff, ExternalLink } from "lucide-react";
import {
  db, useAuth, notify, submissionId, testimonyAuthor, encouragementCount, toggleEncouraged, type TestimonyDoc,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Avatar, CategoryPill, StoryBody, authorLabel, fmtDate } from "../_components/shared";
import { useTranslation } from "@nablis/i18n";

export default function TestimonyPage() {
  const { t: tr } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, role } = useAuth();
  const toast = useToast();
  const isStaff = role === "admin" || role === "super_admin";
  const [t, setT] = useState<TestimonyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    return onSnapshot(doc(db, "testimonies", id), (snap) => {
      setT(snap.exists() ? ({ id: snap.id, ...snap.data() } as TestimonyDoc) : null);
      setLoading(false);
    }, () => setLoading(false));
  }, [user, id]);

  async function decide(status: "published" | "rejected" | "pending") {
    if (!t || !user) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "testimonies", t.id), { status, reviewedBy: user.id, reviewedAt: serverTimestamp() });
      if (t.authorId && t.authorId !== user.id && status !== "pending") {
        await notify({
          userId: t.authorId, type: "testimony", link: `/testimonials/${t.id}`,
          title: status === "published" ? "Your testimony was published" : "Your testimony was not published",
          description: status === "published"
            ? `"${t.title}" is now shared with the community. Thank you for sharing!`
            : `"${t.title}" was reviewed and won't be published. You can message us for details.`,
        }).catch(() => {});
      }
      toast({
        message: status === "published" ? tr("testimony.approvedToast") : status === "rejected" ? tr("testimony.rejectedToast") : tr("testimony.pendingToast"),
        type: status === "rejected" ? "error" : "success",
      });
      if (status !== "pending") router.push("/testimonials");
    } catch {
      toast({ message: tr("testimony.updateError"), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!t || !confirm(`Delete "${t.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "testimonies", t.id));
      toast({ message: tr("testimony.deleted") });
      router.push("/testimonials");
    } catch {
      toast({ message: tr("testimony.deleteError"), type: "error" });
      setBusy(false);
    }
  }

  if (!user) return null;
  if (loading) {
    return <div className="py-20"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }
  if (!t) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center">
        <p className="text-[#374151] font-medium">{tr("testimony.unavailable")}</p>
        <Link href="/testimonials" className="inline-block mt-4 text-sm font-semibold text-[#1E3A8A]">{tr("testimony.backTo")}</Link>
      </div>
    );
  }

  const mine = t.authorId === user.id;
  const shownName = isStaff || mine ? t.authorName : authorLabel(t);
  const images = (t.attachments ?? []).filter((a) => a.kind === "image");
  const docs = (t.attachments ?? []).filter((a) => a.kind !== "image");
  const encouraged = t.encouragedBy?.includes(user.id);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
        <Link href="/testimonials" className="flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] hover:-translate-x-0.5 transition-transform">
          <ArrowLeft size={16} /> {tr("common.back")}
        </Link>
        <span className="w-px h-5 bg-[#E5E7EB]" />
        <p className="text-sm text-[#374151] font-medium">
          {isStaff && t.status === "pending" ? tr("testimony.review") : tr("testimony.story")} · <span className="text-[#6B7280]">{fmtDate(t)}</span>
        </p>
        {t.status !== "published" && (
          <span className={`ml-auto text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${t.status === "pending" ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
            {t.status === "pending" ? tr("testimony.pendingReview") : tr("apptStatus.rejected")}
          </span>
        )}
      </div>

      <article className="bg-white rounded-3xl shadow-sm overflow-hidden animate-fade-up">
        <div className="p-6 sm:p-8 border-b border-[#F3F4F6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={shownName} photo={isStaff || mine || !t.anonymous ? t.authorPhotoURL : null} size={52} />
            <div>
              <p className="font-semibold text-[#111827]">
                {shownName}
                {t.anonymous && (isStaff || mine) && <span className="ml-2 text-[11px] font-medium text-[#9CA3AF]">({tr("testimony.postingAnon")})</span>}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <CategoryPill category={t.category} />
                <span className="text-xs text-[#9CA3AF]">{fmtDate(t)}</span>
              </div>
            </div>
          </div>
          {isStaff && <p className="text-xs text-[#9CA3AF] font-mono">{tr("testimony.submissionId")}: {submissionId(t.id)}</p>}
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1E3A8A] leading-tight">{t.title}</h2>
          <StoryBody content={t.content} />

          {(images.length > 0 || docs.length > 0) && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">{tr("testimony.media")}</p>
              <div className="flex flex-wrap gap-3">
                {images.map((a) => (
                  <button key={a.url} onClick={() => setViewing(a.url)} className="w-28 h-28 rounded-xl overflow-hidden bg-[#EEF1F8] hover:ring-2 hover:ring-[#1E3A8A] transition">
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  </button>
                ))}
                {docs.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F3F4F6] text-sm text-[#374151] hover:bg-[#EEF1F8] max-w-[240px]">
                    <FileText size={16} className="text-[#1E3A8A] flex-shrink-0" />
                    <span className="truncate">{a.name}</span>
                    <ExternalLink size={12} className="text-[#9CA3AF] flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 sm:px-8 py-5 bg-[#F9FAFB] border-t border-[#F3F4F6] flex flex-wrap items-center justify-between gap-3">
          {t.status === "published" ? (
            <button onClick={() => toggleEncouraged(t.id, user.id, !encouraged).catch(() => toast({ message: tr("testimony.saveError"), type: "error" }))}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${encouraged ? "bg-[#FFE4E6] text-[#E11D48]" : "bg-white text-[#374151] border border-[#E5E7EB] hover:text-[#E11D48]"}`}>
              <Heart size={15} className={encouraged ? "fill-current animate-pop" : ""} />
              {encouraged ? tr("testimony.encouragedDone") : tr("testimony.encouraged")}
              {encouragementCount(t) > 0 && <span className="text-xs opacity-70">· {encouragementCount(t)}</span>}
            </button>
          ) : <span />}

          <div className="flex flex-wrap gap-3">
            {isStaff && t.status === "pending" && (
              <>
                <button onClick={() => decide("rejected")} disabled={busy}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-[#DC2626] text-[#DC2626] text-sm font-semibold hover:bg-[#FEF2F2] disabled:opacity-60">
                  <XCircle size={15} /> {tr("testimony.reject")}
                </button>
                <button onClick={() => decide("published")} disabled={busy}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800] disabled:opacity-60">
                  <CheckCircle2 size={15} /> {tr("testimony.approve")}
                </button>
              </>
            )}
            {isStaff && t.status === "published" && (
              <button onClick={() => decide("pending")} disabled={busy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] disabled:opacity-60">
                <EyeOff size={15} /> {tr("testimony.unpublish")}
              </button>
            )}
            {isStaff && t.status === "rejected" && (
              <button onClick={() => decide("published")} disabled={busy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800] disabled:opacity-60">
                <CheckCircle2 size={15} /> {tr("testimony.publishAnyway")}
              </button>
            )}
            {(isStaff || (mine && t.status === "pending")) && (
              <button onClick={remove} disabled={busy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-60">
                <Trash2 size={15} /> {mine && !isStaff ? tr("testimony.withdraw") : tr("common.delete")}
              </button>
            )}
          </div>
        </div>
      </article>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <img src={viewing} alt="" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
