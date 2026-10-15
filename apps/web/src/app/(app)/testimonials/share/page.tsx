"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import {
  ArrowLeft, BookOpen, Play, UploadCloud, X, FileText, ShieldCheck, Pencil, CheckCircle2, Lightbulb,
} from "lucide-react";
import {
  db, useAuth, notify, TESTIMONY_CATEGORIES, testimonyCategoryLabel, type TestimonyAttachment,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { StoryBody, catLabel } from "../_components/shared";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";

interface Pending {
  file: File;
  preview: string | null;
}

const MAX_FILES = 4;
const INPUT = "w-full px-4 py-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-colors";

export default function ShareStoryPage() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { user, role } = useAuth();
  const toast = useToast();
  const isStaff = role === "admin" || role === "super_admin";
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"write" | "review">("write");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("healing");
  const [anonymous, setAnonymous] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Free the image previews when leaving the page.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).slice(0, MAX_FILES - files.length);
    const tooBig = incoming.find((f) => f.size > 25 * 1024 * 1024);
    if (tooBig) {
      toast({ message: tr("share.tooBig", { name: tooBig.name }), type: "error" });
      return;
    }
    setFiles((cur) => [
      ...cur,
      ...incoming.map((file) => ({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null })),
    ]);
  }

  function removeFile(i: number) {
    setFiles((cur) => {
      const f = cur[i];
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return cur.filter((_, j) => j !== i);
    });
  }

  function toReview(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!user) return;
    setSubmitting(true);
    try {
      const attachments: TestimonyAttachment[] = [];
      for (const f of files) {
        const url = await uploadToCloudinary(f.file, "nablis/testimonies");
        attachments.push({ url, name: f.file.name, kind: f.preview ? "image" : "document" });
      }
      const ref = await addDoc(collection(db, "testimonies"), {
        authorId: user.id,
        authorName: user.displayName || user.email || "Member",
        authorPhotoURL: user.photoURL ?? null,
        anonymous,
        title: title.trim(),
        content: content.trim(),
        category,
        // Staff stories go straight to the feed; members' wait for review.
        status: isStaff ? "published" : "pending",
        attachments,
        encouragedBy: [],
        likes: 0,
        createdAt: serverTimestamp(),
      });
      if (!isStaff) {
        const staff = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
        await notify(staff.docs.map((d) => ({
          userId: d.id, type: "testimony", link: `/testimonials/${ref.id}`,
          title: "New testimony to review",
          description: `${user.displayName || "A member"} shared "${title.trim()}".`,
        }))).catch(() => {});
      }
      toast({
        message: isStaff ? tr("share.published") : tr("share.sent"),
        linkLabel: tr("common.view"), onLink: () => router.push(`/testimonials/${ref.id}`),
      });
      router.push("/testimonials");
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : tr("share.error"), type: "error" });
      setSubmitting(false);
    }
  }

  if (!user) return null;
  const cover = files.find((f) => f.preview)?.preview;
  const postingAs = anonymous ? tr("testimony.anonymous") : user.displayName || user.email || tr("status.member");

  // ── Step 2: review ──────────────────────────────────────────────────────────
  if (step === "review") {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <button onClick={() => setStep("write")} className="flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] mb-3">
            <ArrowLeft size={16} /> {tr("share.backToEditing")}
          </button>
          <PageTitle id="reviewStory" />
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <article className="bg-white rounded-3xl shadow-sm overflow-hidden animate-fade-up">
            <div className="h-56 sm:h-72 bg-gradient-to-br from-[#1E3A8A] to-[#3B5BB5] relative">
              {cover && <img src={cover} alt="" className="w-full h-full object-cover" />}
              <span className="absolute left-5 bottom-5 px-3 py-1.5 rounded-full bg-[#F5C518] text-[#1B2E6B] text-[11px] font-bold uppercase tracking-wider">
                {tr("share.categoryBadge", { category: catLabel(category) })}
              </span>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1E3A8A] leading-tight">{title}</h2>
              <StoryBody content={content} />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {files.map((f, i) => f.preview
                    ? <img key={i} src={f.preview} alt="" className="w-20 h-20 rounded-xl object-cover" />
                    : <span key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F3F4F6] text-xs text-[#374151]"><FileText size={14} /> {f.file.name}</span>)}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#F9FAFB] border border-[#F3F4F6]">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-[#1E3A8A]" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">{tr("share.privacySetting")}</p>
                    <p className="text-sm text-[#111827]">{tr("share.postingAs")} <span className="font-semibold">{postingAs}</span></p>
                  </div>
                </div>
                <button onClick={() => setAnonymous((a) => !a)} className="text-sm font-semibold text-[#1E3A8A] hover:underline">{tr("share.change")}</button>
              </div>
            </div>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl shadow-sm p-6 text-center">
              <span className="w-14 h-14 rounded-2xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center mx-auto animate-float"><CheckCircle2 size={26} /></span>
              <p className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mt-4">{tr("share.ready")}</p>
              <p className="text-sm text-[#4B5563] mt-2">
                {isStaff ? tr("share.readyStaff") : tr("share.readyMember")}
              </p>
              <button onClick={submit} disabled={submitting}
                className="w-full flex items-center justify-center gap-2 mt-5 py-3.5 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800] disabled:opacity-60">
                {submitting && <span className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />}
                {isStaff ? tr("share.confirmPublish") : tr("share.confirmSubmit")}
              </button>
              <button onClick={() => setStep("write")} disabled={submitting}
                className="w-full flex items-center justify-center gap-2 mt-3 py-3 rounded-full border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">
                <Pencil size={14} /> {tr("share.editDetails")}
              </button>
            </div>
            <div className="bg-[#1E3A8A] rounded-3xl p-6 text-white">
              <p className="flex items-center gap-2 font-semibold"><Lightbulb size={17} className="text-[#F5C518]" /> {tr("share.reminders")}</p>
              <ul className="mt-3 space-y-2 text-sm text-white/80 list-disc pl-5">
                <li>{tr("share.r1")}</li>
                <li>{tr("share.r2")}</li>
                <li>{tr("share.r3")}</li>
                <li>{tr("share.r4")}</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ── Step 1: write ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/testimonials" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] mb-3">
          <ArrowLeft size={16} /> {tr("nav.testimonials")}
        </Link>
        <PageTitle id="shareStory" />
      </div>

      <div className="bg-[#1E3A8A] rounded-3xl p-6 sm:p-7 flex items-center gap-5 text-white relative overflow-hidden">
        <span className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5 animate-drift" />
        <span className="w-12 h-12 rounded-2xl bg-[#F5C518] text-[#1B2E6B] flex items-center justify-center flex-shrink-0"><BookOpen size={22} /></span>
        <div>
          <p className="italic text-white/90 leading-relaxed">
            &ldquo;{tr("share.verse")}&rdquo;
          </p>
          <p className="text-xs font-semibold text-[#F5C518] mt-1">{tr("share.verseRef")}</p>
        </div>
      </div>

      <form onSubmit={toReview} className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-2">{tr("share.titleLabel")}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120}
            placeholder={tr("share.titlePlaceholder")} className={INPUT} />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-[#111827] mb-2">{tr("events.category")}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT + " cursor-pointer"}>
              {TESTIMONY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{catLabel(c.key)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#111827] mb-2">{tr("share.privacy")}</label>
            <button type="button" onClick={() => setAnonymous((a) => !a)} role="switch" aria-checked={anonymous}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-sm text-[#111827]">
              {tr("share.postAnon")}
              <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${anonymous ? "bg-[#1E3A8A]" : "bg-[#D1D5DB]"}`}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${anonymous ? "translate-x-5" : ""}`} />
              </span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-2">{tr("share.journey")}</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={10} maxLength={8000}
            placeholder={tr("share.journeyPlaceholder")}
            className={INPUT + " resize-y leading-relaxed"} />
          <p className="text-right text-[11px] text-[#9CA3AF] mt-1">{content.length}/8000</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-2">{tr("share.attach")} <span className="font-normal text-[#9CA3AF]">({tr("share.optional")})</span></label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => files.length < MAX_FILES && fileInput.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${dragging ? "border-[#1E3A8A] bg-[#EEF1F8]" : "border-[#D1D5DB] hover:border-[#1E3A8A] hover:bg-[#F9FAFB]"}`}>
            <UploadCloud size={30} className="mx-auto text-[#1E3A8A]" />
            <p className="text-sm font-medium text-[#111827] mt-2">{tr("share.drop")}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">{tr("share.dropHint", { max: MAX_FILES })}</p>
            <input ref={fileInput} type="file" multiple accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {files.map((f, i) => (
                <div key={i} className="relative animate-scale-in">
                  {f.preview
                    ? <img src={f.preview} alt="" className="w-20 h-20 rounded-xl object-cover" />
                    : <div className="w-20 h-20 rounded-xl bg-[#F3F4F6] flex flex-col items-center justify-center gap-1 px-1"><FileText size={18} className="text-[#1E3A8A]" /><span className="text-[9px] text-[#6B7280] truncate w-full text-center">{f.file.name}</span></div>}
                  <button type="button" onClick={() => removeFile(i)} aria-label={tr("share.remove")}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#111827] text-white flex items-center justify-center">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={!title.trim() || !content.trim()}
            className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold tracking-wide hover:bg-[#e6b800] disabled:opacity-50">
            {tr("share.reviewButton")} <Play size={13} className="fill-current" />
          </button>
        </div>
      </form>
    </div>
  );
}
