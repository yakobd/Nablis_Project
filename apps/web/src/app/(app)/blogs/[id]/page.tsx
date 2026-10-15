"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  doc, getDoc, onSnapshot, addDoc, collection, updateDoc, arrayUnion, Timestamp, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import {
  ArrowLeft, CalendarDays, Download, Eye, Reply, Ban, Undo2, Pencil, ChevronDown, Send, ExternalLink, MessageSquare,
} from "lucide-react";
import {
  db, useAuth, countBlogView, youTubeEmbed, blogExcerpt, type BlogDoc,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

interface CommentReply { authorName: string; content: string; createdAt: Timestamp }
interface CommentDoc {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  content: string;
  createdAt?: Timestamp;
  hidden?: boolean;
  replies?: CommentReply[];
  legacy?: boolean;
}

const PAGE = 5;

function ago(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  if (!d) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return i18n.t("time.minsAgo", { count: Math.max(mins, 1) });
  const h = Math.floor(mins / 60);
  if (h < 24) return i18n.t("time.hoursAgo", { count: h });
  const days = Math.floor(h / 24);
  return days === 1 ? i18n.t("time.yesterday") : d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" });
}

export default function BlogDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const toast = useToast();
  const [post, setPost]         = useState<BlogDoc | null>(null);
  const [missing, setMissing]   = useState(false);
  const [legacy, setLegacy]     = useState<CommentDoc[]>([]);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [shown, setShown]       = useState(PAGE);
  const [replyTo, setReplyTo]   = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy]         = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => onSnapshot(doc(db, "blogPosts", id), (s) => {
    if (!s.exists()) { setMissing(true); return; }
    const data = { id: s.id, ...s.data() } as BlogDoc & { comments?: CommentDoc[] };
    setPost(data);
    setLegacy((data.comments ?? []).map((c) => ({ ...c, legacy: true })));
  }), [id]);

  useEffect(() => onSnapshot(query(collection(db, "blogPosts", id, "comments"), orderBy("createdAt", "desc")), (snap) => {
    setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommentDoc)));
  }), [id]);

  // One view per browser session.
  useEffect(() => {
    try {
      const key = `viewed-blog-${id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage unavailable */ }
    countBlogView(id);
  }, [id]);

  const all = useMemo(() => [...comments, ...legacy], [comments, legacy]);
  const visible = isStaff ? all : all.filter((c) => !c.hidden);
  const disabled = post?.enableComments === false;

  if (missing) return <div className="py-16 text-center text-[#6B7280]">{t("blogPost.missing")}</div>;
  if (!post || !user) return <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const published = (post.publishAt ?? post.createdAt)?.toDate?.();
  const embed = youTubeEmbed(post.videoURL);

  async function toggleComments() {
    await updateDoc(doc(db, "blogPosts", id), { enableComments: disabled });
    toast({ message: disabled ? t("blogPost.commentsOn") : t("blogPost.commentsOff") });
  }

  async function setHidden(c: CommentDoc, hidden: boolean) {
    try {
      await updateDoc(doc(db, "blogPosts", id, "comments", c.id), { hidden });
    } catch {
      toast({ type: "error", message: t("blogPost.updateError") });
    }
  }

  async function postReply(c: CommentDoc) {
    if (!replyText.trim() || !user) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "blogPosts", id, "comments", c.id), {
        replies: arrayUnion({ authorName: user.displayName || user.email, content: replyText.trim(), createdAt: Timestamp.now() }),
      });
      setReplyText(""); setReplyTo(null);
      toast({ message: t("blogPost.responsePosted") });
    } catch {
      toast({ type: "error", message: t("blogPost.responseError") });
    } finally { setBusy(false); }
  }

  async function postComment() {
    if (!newComment.trim() || !user) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "blogPosts", id, "comments"), {
        authorId: user.id,
        authorName: user.displayName || user.email || "Member",
        authorPhotoURL: user.photoURL ?? null,
        content: newComment.trim(),
        createdAt: serverTimestamp(),
      });
      setNewComment("");
    } catch {
      toast({ type: "error", message: t("blogPost.commentError") });
    } finally { setBusy(false); }
  }

  function exportComments() {
    const rows = [["Author", "Date", "Comment", "Hidden", "Replies"], ...all.map((c) => [
      c.authorName, c.createdAt?.toDate?.().toISOString() ?? "", c.content, c.hidden ? "yes" : "no",
      (c.replies ?? []).map((r) => `${r.authorName}: ${r.content}`).join(" | "),
    ])];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `comments-${post!.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[760px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><ArrowLeft size={15} /> {t("common.back")}</button>
        {isStaff && <Link href={`/blogs/${id}/update`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-sm font-semibold text-[#1B2E6B] shadow-sm hover:shadow-md"><Pencil size={14} /> {t("blogPost.edit")}</Link>}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex gap-5">
        {(post.imageURL) && <img src={post.imageURL} alt={post.imageAlt ?? ""} className="w-28 h-28 rounded-xl object-cover flex-shrink-0" />}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-[#6B7280]"><CalendarDays size={13} /> {t("blogPost.published", { date: published?.toLocaleDateString(dateLocale(), { month: "long", day: "numeric", year: "numeric" }) ?? "" })}</p>
          <p className="font-display text-2xl font-bold text-[#111827] mt-1 leading-tight">{post.title}</p>
          <p className="text-sm text-[#6B7280] mt-2">{blogExcerpt(post, 180)}</p>
          <p className="text-xs text-[#9CA3AF] mt-2">{t("blogPost.byline", { author: post.authorName, category: t(`blogCat.${post.category}`, { defaultValue: post.category }), views: post.views ?? 0 })}</p>
        </div>
      </div>

      {/* Article */}
      <article className="bg-white rounded-2xl shadow-sm p-7">
        {embed && <iframe src={embed} title={post.title} className="w-full aspect-video rounded-xl mb-6" allowFullScreen />}
        {!embed && post.videoURL && <video src={post.videoURL} controls className="w-full rounded-xl mb-6 bg-black max-h-[420px]" />}
        <div className="text-[#374151] leading-8 text-[16px] whitespace-pre-wrap">{post.content}</div>
        {post.destLink && (
          <a href={post.destLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-[#1E3A8A] hover:underline">
            {t("blogPost.learnMore")} <ExternalLink size={13} />
          </a>
        )}
      </article>

      {/* Comments toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {isStaff && (
            <button onClick={toggleComments} className="flex items-center gap-3 pl-4 pr-2 py-2 rounded-full bg-white text-sm text-[#111827] shadow-sm">
              {t("blogPost.disableComments")}
              <span className={`relative w-10 h-6 rounded-full transition-colors ${disabled ? "bg-[#1E3A8A]" : "bg-[#E5E7EB]"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${disabled ? "translate-x-4" : ""}`} />
              </span>
            </button>
          )}
          <span className="text-sm text-[#111827]"><strong>{visible.length}</strong> {t("blogPost.totalComments")}</span>
        </div>
        {isStaff && (
          <button onClick={exportComments} disabled={all.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F5C518] text-[#1E3A8A] font-semibold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800] disabled:opacity-50">
            <Download size={16} /> {t("blogPost.exportComments")}
          </button>
        )}
      </div>

      {/* New comment */}
      {disabled ? (
        <p className="text-sm text-[#6B7280] bg-white rounded-2xl px-5 py-4 shadow-sm">{t("blogPost.commentsClosed")}</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3">
          {user.photoURL ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-[#1B2E6B] text-white text-sm font-bold flex items-center justify-center">{(user.displayName || "U")[0]}</span>}
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} placeholder={t("blogPost.commentPlaceholder")}
            className="flex-1 resize-none bg-[#F8FAFC] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
          <button onClick={postComment} disabled={busy || !newComment.trim()} className="self-end flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold disabled:opacity-50">
            <Send size={14} /> {t("blogPost.post")}
          </button>
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-4">
        {visible.length === 0 && (
          <div className="text-center text-[#9CA3AF] py-8"><MessageSquare size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">{t("blogPost.noComments")}</p></div>
        )}
        {visible.slice(0, shown).map((c) => (
          <div key={c.id} className={`rounded-2xl p-5 shadow-sm transition-colors animate-fade-up ${c.hidden ? "bg-[#EEF1F7]" : "bg-white"}`}>
            <div className="flex gap-4">
              {c.authorPhotoURL ? <img src={c.authorPhotoURL} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" /> : <span className="w-11 h-11 rounded-full bg-[#EEF1F8] text-[#1B2E6B] font-bold flex items-center justify-center flex-shrink-0">{(c.authorName || "?")[0]}</span>}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 font-semibold text-[#111827]">
                    {c.authorName}
                    {c.hidden && <span className="px-2 py-0.5 rounded bg-[#E5E7EB] text-[9px] font-bold tracking-wider text-[#6B7280]">{t("blogPost.hidden")}</span>}
                  </p>
                  <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{ago(c.createdAt)}</span>
                </div>
                <p className={`mt-1.5 leading-relaxed ${c.hidden ? "text-[#6B7280] italic" : "text-[#374151]"} ${expanded === c.id ? "" : "line-clamp-4"}`}>
                  {c.hidden ? `"${c.content}"` : c.content}
                </p>

                {(c.replies ?? []).map((r, i) => (
                  <div key={i} className="mt-3 pl-3 border-l-2 border-[#F5C518]">
                    <p className="text-[11px] font-semibold text-[#1B2E6B]">{t("blogPost.replied", { name: r.authorName })}</p>
                    <p className="text-sm text-[#374151]">{r.content}</p>
                  </div>
                ))}

                {(isStaff || c.content.length > 280) && (
                  <div className="flex items-center gap-5 mt-3 text-sm font-medium">
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="flex items-center gap-1.5 text-[#1E3A8A] hover:underline">
                      <Eye size={15} /> {expanded === c.id ? t("blogPost.less") : t("common.view")}
                    </button>
                    {isStaff && !c.legacy && (
                      <>
                        {!c.hidden && (
                          <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${replyTo === c.id ? "bg-[#1E3A8A] text-white" : "text-[#1E3A8A] hover:underline"}`}>
                            <Reply size={15} /> {t("blogPost.reply")}
                          </button>
                        )}
                        {c.hidden
                          ? <button onClick={() => setHidden(c, false)} className="flex items-center gap-1.5 text-[#1E3A8A] hover:underline"><Undo2 size={15} /> {t("blogPost.unhide")}</button>
                          : <button onClick={() => setHidden(c, true)} className="flex items-center gap-1.5 text-[#E11D48] hover:underline"><Ban size={15} /> {t("blogPost.hide")}</button>}
                        {c.authorId && <Link href={`/settings/members/${c.authorId}`} className="text-[#6B7280] hover:underline">{t("settingsNav.profile")}</Link>}
                      </>
                    )}
                  </div>
                )}

                {replyTo === c.id && (
                  <div className="mt-4 pt-4 border-t border-[#F3F4F6] flex gap-3 animate-fade-up">
                    {user.photoURL ? <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-[#14B8A6] text-white text-xs font-bold flex items-center justify-center">{(user.displayName || "U")[0]}</span>}
                    <div className="flex-1 bg-[#F8FAFC] rounded-xl p-3">
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} autoFocus placeholder={t("blogPost.replyPlaceholder")}
                        className="w-full resize-none bg-transparent text-sm focus:outline-none" />
                      <div className="flex justify-end">
                        <button onClick={() => postReply(c)} disabled={busy || !replyText.trim()} className="text-xs font-bold text-[#1E3A8A] hover:underline disabled:opacity-50">{t("blogPost.postResponse")}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {visible.length > shown && (
        <div className="flex justify-center">
          <button onClick={() => setShown((n) => n + PAGE)} className="flex items-center gap-1.5 font-semibold text-[#1E3A8A] hover:underline">
            View More Comments <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
