"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { Upload, Info, Paperclip, Smile, MoreHorizontal, Trash2, Film, PlayCircle } from "lucide-react";
import {
  db, useAuth, notify, youTubeEmbed, BLOG_CATEGORIES, type BlogDoc,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@nablis/i18n";

const EMOJIS = ["🙏", "✝️", "📖", "🕊️", "❤️", "✨", "🕯️", "⛪", "🌿", "☀️", "🙌", "💛"];
const LINE = "w-full bg-transparent border-0 border-b border-[#111827]/70 px-0 py-3 text-[15px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1B2E6B] focus:ring-0";

function toLocalInput(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-[#1E3A8A]" : "bg-[#E5E7EB]"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

// "Create New Blog" / "Update Blog" card from the design.
export function BlogForm({ blogId }: { blogId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [loaded, setLoaded]     = useState(!blogId);
  const [original, setOriginal] = useState<BlogDoc | null>(null);
  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [category, setCategory] = useState<string>(BLOG_CATEGORIES[0]);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [youtube, setYoutube]   = useState("");
  const [altText, setAltText]   = useState("");
  const [showAlt, setShowAlt]   = useState(false);
  const [destLink, setDestLink] = useState("");
  const [pinned, setPinned]     = useState(false);
  const [internal, setInternal] = useState(true);
  // New posts follow the author's "Enable Comments" setting (Settings › Notifications).
  const [comments, setComments] = useState(
    (user as { notifications?: { blog?: { enableComments?: boolean } } } | null)?.notifications?.blog?.enableComments !== false
  );
  const [later, setLater]       = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!blogId) return;
    getDoc(doc(db, "blogPosts", blogId)).then((s) => {
      if (s.exists()) {
        const b = { id: s.id, ...s.data() } as BlogDoc;
        setOriginal(b);
        setTitle(b.title ?? "");
        setContent(b.content ?? "");
        setCategory(b.category || BLOG_CATEGORIES[0]);
        setImageURL(b.imageURL ?? null);
        if (youTubeEmbed(b.videoURL)) setYoutube(b.videoURL ?? ""); else setVideoURL(b.videoURL ?? null);
        setAltText(b.imageAlt ?? "");
        setShowAlt(!!b.imageAlt);
        setDestLink(b.destLink ?? "");
        setPinned(!!b.pinned);
        setInternal(b.internal !== false);
        setComments(b.enableComments !== false);
        const scheduled = (b.publishAt?.toMillis?.() ?? 0) > Date.now();
        setLater(scheduled);
        setPublishAt(scheduled ? toLocalInput(b.publishAt) : "");
      }
      setLoaded(true);
    });
  }, [blogId]);

  async function uploadMedia(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) { setError(t("blogForm.imageOrVideo")); return; }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadToCloudinary(file, "nablis/blogs");
      if (file.type.startsWith("video/")) setVideoURL(url); else setImageURL(url);
    } catch {
      setError(t("blogForm.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function attach(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, "nablis/blogs");
      setContent((c) => `${c}${c && !c.endsWith("\n") ? "\n" : ""}📎 ${file.name}: ${url}\n`);
    } catch { setError(t("blogForm.attachFailed")); }
    finally { setUploading(false); }
  }

  function insertEmoji(e: string) {
    const el = bodyRef.current;
    if (!el) { setContent((c) => c + e); return; }
    const start = el.selectionStart ?? content.length;
    const next = content.slice(0, start) + e + content.slice(el.selectionEnd ?? start);
    setContent(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + e.length; });
  }

  async function publish() {
    if (!user) return;
    if (!title.trim() || !content.trim()) { setError(t("blogForm.needFields")); return; }
    if (youtube && !youTubeEmbed(youtube)) { setError(t("blogForm.badYoutube")); return; }
    if (destLink && !/^https?:\/\//.test(destLink.trim())) { setError(t("blogForm.badLink")); return; }
    if (later && !publishAt) { setError(t("blogForm.needDate")); return; }
    setSaving(true);
    setError(null);
    try {
      const when = later && publishAt ? Timestamp.fromDate(new Date(publishAt)) : null;
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category,
        imageURL,
        imageAlt: altText.trim() || null,
        videoURL: youtube.trim() || videoURL,
        destLink: destLink.trim() || null,
        pinned,
        internal,
        enableComments: comments,
        status: "published" as const,
        updatedAt: serverTimestamp(),
      };
      let id = blogId;
      if (blogId) {
        await updateDoc(doc(db, "blogPosts", blogId), { ...payload, ...(when ? { publishAt: when } : {}) });
      } else {
        id = (await addDoc(collection(db, "blogPosts"), {
          ...payload,
          authorId: user.id,
          authorName: user.displayName || user.email,
          authorPhotoURL: user.photoURL ?? null,
          publishAt: when ?? serverTimestamp(),
          views: 0,
          createdAt: serverTimestamp(),
        })).id;
        if (!when) {
          const members = await getDocs(query(collection(db, "users"), where("status", "==", "active"), where("role", "==", "member")));
          await notify(members.docs.map((m) => ({
            userId: m.id, type: "new_blog", link: `/blogs/${id}`,
            title: `New Post: ${payload.title}`,
            description: `A new reflection by ${user.displayName || "the ministry"}.`,
          })));
        }
      }
      toast({ message: when ? t("blogForm.scheduled") : blogId ? t("blogForm.updated") : t("blogForm.published"), linkLabel: t("common.view"), onLink: () => router.push(`/blogs/${id}`) });
      router.push(`/blogs/${id}`);
    } catch {
      setError(t("prayersPage.saveError"));
      setSaving(false);
    }
  }

  async function remove() {
    if (!blogId) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteDoc(doc(db, "blogPosts", blogId));
    toast({ message: t("blogForm.deleted") });
    router.push("/blogs");
  }

  if (!loaded) return <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const ytEmbed = youTubeEmbed(youtube);

  return (
    <div className="space-y-8">
      <div>
        <h1>{blogId ? t("blogForm.updateTitle") : t("blogsPage.create")}</h1>
        <p>{t("pages.blogs.subtitle")}</p>
      </div>

      <div className="bg-white rounded-[28px] shadow-[0_24px_60px_-30px_rgba(27,46,107,0.45)] grid lg:grid-cols-[340px_1fr] max-w-[920px] overflow-hidden">
        {/* Media */}
        <div className="p-7 lg:border-r border-[#F3F4F6] flex flex-col gap-5">
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="text-[#9CA3AF] hover:text-[#374151]" aria-label={t("msg.more")}><MoreHorizontal size={20} /></button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute z-20 mt-1 w-48 bg-white rounded-xl shadow-xl border border-[#E5E7EB] py-1.5 animate-scale-in">
                  {imageURL && <button onClick={() => { setImageURL(null); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[#EEF1F8]">{t("blogForm.removeImage")}</button>}
                  {videoURL && <button onClick={() => { setVideoURL(null); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[#EEF1F8]">{t("blogForm.removeVideo")}</button>}
                  <button onClick={() => { mediaInput.current?.click(); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[#EEF1F8]">{t("blogForm.replaceMedia")}</button>
                </div>
              </>
            )}
          </div>
          <input ref={mediaInput} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { uploadMedia(e.target.files?.[0]); e.target.value = ""; }} />
          <div
            onClick={() => !imageURL && !videoURL && mediaInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadMedia(e.dataTransfer.files?.[0]); }}
            className={`relative flex-1 min-h-[420px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6 transition-colors cursor-pointer overflow-hidden ${dragOver ? "border-[#1B2E6B] bg-[#EEF1F8]" : "border-[#E5E7EB] bg-[#F9FAFB]"}`}>
            {imageURL || videoURL ? (
              <div className="w-full space-y-3">
                {imageURL && <img src={imageURL} alt={altText} className="w-full rounded-xl object-cover max-h-72" />}
                {videoURL && <video src={videoURL} controls className="w-full rounded-xl max-h-60 bg-black" />}
                <button onClick={(e) => { e.stopPropagation(); mediaInput.current?.click(); }} className="text-xs font-semibold text-[#1B2E6B] hover:underline">
                  {imageURL && !videoURL ? t("blogForm.addVideo") : t("blogForm.replace")}
                </button>
              </div>
            ) : (
              <>
                <span className="w-11 h-11 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center">
                  {uploading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload size={18} />}
                </span>
                <p className="text-[15px] text-[#111827] mt-4 max-w-[220px]">{t("blogForm.drop")}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-auto pt-10">{t("blogForm.dropHint")}</p>
                <p className="text-[11px] text-[#111827] font-semibold underline mt-1">{t("blogForm.saveAfter")}</p>
              </>
            )}
          </div>
          <div className="relative">
            <PlayCircle size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#DC2626]" />
            <input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder={t("blogForm.youtube")} className={LINE + " pl-6 text-sm"} />
          </div>
          {ytEmbed && <iframe src={ytEmbed} title={t("blogForm.videoPreview")} className="w-full aspect-video rounded-xl" allowFullScreen />}
          <button onClick={() => setComments((v) => !v)}
            className={`w-full py-3.5 rounded-full font-semibold transition-colors ${comments ? "bg-[#1E3A8A] text-white hover:bg-[#1B2E6B]" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"}`}>
            {comments ? t("blogForm.commentsOn") : t("blogForm.enableComments")}
          </button>
        </div>

        {/* Details */}
        <div className="p-7 sm:p-10 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-sm text-[#111827]">
              <Switch checked={pinned} onChange={setPinned} label={t("blogForm.pin")} />
              PIN Blog
              <span title={t("blogForm.pinHint")}><Info size={13} className="text-[#9CA3AF]" /></span>
            </label>
            <div className="flex">
              <select value={internal ? "internal" : "public"} onChange={(e) => setInternal(e.target.value === "internal")}
                className="pl-4 pr-8 py-2.5 rounded-l-lg bg-[#F1F4F9] text-sm font-medium text-[#111827] focus:outline-none">
                <option value="internal">{t("blogForm.internal")}</option>
                <option value="public">{t("blogForm.public")}</option>
              </select>
              <button onClick={publish} disabled={saving || uploading}
                className="px-6 py-2.5 rounded-r-lg bg-[#1E3A8A] text-white font-semibold hover:bg-[#1B2E6B] disabled:opacity-60">
                {saving ? t("common.saving") : blogId ? t("common.update") : later ? t("blogForm.schedule") : t("blogForm.publish")}
              </button>
            </div>
          </div>

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("blogForm.titlePlaceholder")}
            className={`${LINE} mt-10 text-3xl sm:text-[34px] font-bold placeholder-[#9CA3AF]`} />

          <div className="flex items-center justify-between gap-3 mt-6">
            <div className="flex items-center gap-3">
              <span className="relative">
                {(original?.authorPhotoURL ?? user?.photoURL)
                  ? <img src={(original?.authorPhotoURL ?? user?.photoURL)!} alt="" className="w-11 h-11 rounded-full object-cover" />
                  : <span className="w-11 h-11 rounded-full bg-[#1B2E6B] text-white font-bold flex items-center justify-center">{(user?.displayName || "U")[0]}</span>}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#F5C518] ring-2 ring-white" />
              </span>
              <div>
                <p className="font-semibold text-[#111827]">{original?.authorName ?? user?.displayName ?? t("blogForm.you")}</p>
                <p className="text-sm text-[#6B7280]">{user?.role === "super_admin" ? t("blogForm.leadFather") : t("blogForm.team")}</p>
              </div>
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#F1F4F9] text-sm text-[#111827] focus:outline-none" aria-label={t("events.category")}>
              {[...BLOG_CATEGORIES, ...(BLOG_CATEGORIES.includes(category as never) ? [] : [category])].map((c) => <option key={c} value={c}>{t(`blogCat.${c}`, { defaultValue: c })}</option>)}
            </select>
          </div>

          <div className="relative mt-8">
            <textarea ref={bodyRef} value={content} onChange={(e) => setContent(e.target.value)} rows={5}
              placeholder={t("blogForm.contentPlaceholder")}
              className={`${LINE} resize-y pr-16 min-h-[52px]`} />
            <div className="absolute right-0 top-3 flex items-center gap-2 text-[#6B7280]">
              <input ref={attachInput} type="file" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
              <button onClick={() => attachInput.current?.click()} aria-label={t("msg.attach")} className="hover:text-[#1B2E6B]"><Paperclip size={17} /></button>
              <button onClick={() => setEmojiOpen((v) => !v)} aria-label={t("msg.emoji")} className="hover:text-[#1B2E6B]"><Smile size={18} /></button>
            </div>
            {emojiOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
                <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-2 grid grid-cols-6 gap-1 animate-scale-in">
                  {EMOJIS.map((e) => <button key={e} onClick={() => insertEmoji(e)} className="w-8 h-8 rounded-lg hover:bg-[#EEF1F8] text-lg">{e}</button>)}
                </div>
              </>
            )}
          </div>

          <div className="mt-6">
            {showAlt ? (
              <input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder={t("blogForm.altPlaceholder")} className={LINE} autoFocus />
            ) : (
              <button onClick={() => setShowAlt(true)} className="px-4 py-2 rounded-full bg-[#F1F4F9] text-sm font-medium text-[#111827] hover:bg-[#E5E9F2]">{t("blogForm.addAlt")}</button>
            )}
          </div>

          <input value={destLink} onChange={(e) => setDestLink(e.target.value)} placeholder={t("blogForm.destLink")} className={`${LINE} mt-8`} />

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-auto pt-12 text-[15px] text-[#111827]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" checked={!later} onChange={() => setLater(false)} className="w-5 h-5 accent-[#1E3A8A]" /> {t("blogForm.now")}
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" checked={later} onChange={() => setLater(true)} className="w-5 h-5 accent-[#1E3A8A]" /> {t("blogForm.later")}
            </label>
            {later && (
              <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm animate-scale-in" />
            )}
          </div>

          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
          {blogId && (
            <button onClick={remove} className="self-start flex items-center gap-1.5 mt-6 text-sm font-semibold text-[#DC2626] hover:underline">
              <Trash2 size={14} /> {confirmDelete ? t("blogForm.confirmDelete") : t("blogForm.delete")}
            </button>
          )}
          {(videoURL || ytEmbed) && <p className="flex items-center gap-1.5 text-xs text-[#6B7280] mt-3"><Film size={12} /> {t("blogForm.videosNote")}</p>}
        </div>
      </div>
    </div>
  );
}
