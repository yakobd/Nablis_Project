"use client";
import React, { useState, useRef, useEffect } from "react";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useParams, useRouter } from "next/navigation";
import {
  Upload, Image as ImageIcon, Pin, Send, Link as LinkIcon,
  AlignLeft, ArrowLeft, Trash2,
} from "lucide-react";
import type { BlogPost } from "@nablis/shared/firebase";

const INPUT  = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";
const SELECT = INPUT + " bg-white";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-[#374151]">{label}</span>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[#1B2E6B]" : "bg-[#D1D5DB]"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function toDatetimeLocal(ts: Timestamp | undefined | null): string {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

export default function UpdateBlogPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { user }  = useAuth();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [loadingPost, setLoadingPost] = useState(true);
  const [title, setTitle]             = useState("");
  const [content, setContent]         = useState("");
  const [category, setCategory]       = useState("Teachings");
  const [altText, setAltText]         = useState("");
  const [destLink, setDestLink]       = useState("");
  const [pinned, setPinned]           = useState(false);
  const [internal, setInternal]       = useState(false);
  const [enableComments, setEnableComments] = useState(true);
  const [publishNow, setPublishNow]   = useState(true);
  const [publishAt, setPublishAt]     = useState("");
  const [existingImageURL, setExistingImageURL] = useState("");
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [dragOver, setDragOver]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "blogPosts", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as BlogPost;
        setTitle(data.title ?? "");
        setContent(data.content ?? "");
        setCategory(data.category ?? "Teachings");
        setAltText((data as any).imageAlt ?? "");
        setDestLink((data as any).destLink ?? "");
        setPinned(data.pinned ?? false);
        setInternal((data as any).internal ?? false);
        setEnableComments((data as any).enableComments ?? true);
        const pa = (data as any).publishAt as Timestamp | null;
        if (pa) {
          setPublishNow(false);
          setPublishAt(toDatetimeLocal(pa));
        } else {
          setPublishNow(true);
        }
        setExistingImageURL(data.imageURL ?? "");
        setImagePreview(data.imageURL ?? "");
      }
    }).finally(() => setLoadingPost(false));
  }, [id]);

  if (!user) return null;

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleUpdate() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      let imageURL = existingImageURL;
      if (imageFile) {
        imageURL = await uploadToCloudinary(imageFile, "nablis/blogs");
      }
      await updateDoc(doc(db, "blogPosts", id), {
        title:      title.trim(),
        content:    content.trim(),
        category,
        imageURL:   imageURL || null,
        imageAlt:   altText.trim() || null,
        destLink:   destLink.trim() || null,
        pinned,
        internal,
        enableComments,
        publishAt:  publishNow
          ? serverTimestamp()
          : publishAt
            ? Timestamp.fromDate(new Date(publishAt))
            : serverTimestamp(),
        updatedAt:  serverTimestamp(),
      });
      router.push(`/blogs/${id}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "blogPosts", id));
      router.push("/blogs");
    } finally {
      setDeleting(false);
    }
  }

  if (loadingPost) {
    return (
      <div className="py-16 text-center">
        <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[#EEF1F8] text-[#6B7280] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1B2E6B]">Update Blog</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Edit and republish your teaching</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left — editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Media */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full aspect-[16/6] object-cover" />
                <button onClick={() => { setImageFile(null); setImagePreview(""); setExistingImageURL(""); }}
                  className="absolute top-3 right-3 bg-black/50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-black/70 transition-colors">
                  Change Image
                </button>
              </div>
            ) : (
              <div
                className={[
                  "border-2 border-dashed m-4 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                  dragOver ? "border-[#1B2E6B] bg-[#EEF1F8]" : "border-[#D1D5DB] hover:border-[#1B2E6B]",
                ].join(" ")}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files[0]; if (f) handleFile(f);
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EEF1F8] flex items-center justify-center">
                  <Upload size={24} className="text-[#9CA3AF]" />
                </div>
                <div className="text-center">
                  <p className="text-[#374151] font-semibold text-sm">Drag &amp; drop or click to upload</p>
                  <p className="text-[#9CA3AF] text-xs mt-1">JPG, PNG, WebP up to 10MB</p>
                </div>
              </div>
            )}

            <div className="px-5 pb-4">
              <Toggle label="Enable Comments" checked={enableComments} onChange={setEnableComments} />
            </div>
          </div>

          {/* Title */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add your spiritual title…"
              className="w-full text-xl font-bold text-[#1B2E6B] placeholder-[#9CA3AF]/50 focus:outline-none border-none"
            />
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F3F4F6]">
              <div className="w-8 h-8 rounded-full bg-[#1B2E6B] flex items-center justify-center text-[#F5C518] font-bold text-sm flex-shrink-0">
                {(user.displayName || user.email)[0].toUpperCase()}
              </div>
              <span className="text-[#374151] text-sm font-medium">{user.displayName || user.email}</span>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#F3F4F6]">
              <AlignLeft size={14} className="text-[#9CA3AF]" />
              <span className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-wide">Content</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder="Write your spiritual teaching here…"
              className="w-full text-[#374151] text-sm leading-relaxed placeholder-[#9CA3AF] focus:outline-none resize-none"
            />
          </div>

          {/* Alt text + link */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 flex items-center gap-1.5">
                <ImageIcon size={12} /> Image Alt Text
              </label>
              <input type="text" value={altText} onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for accessibility…" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 flex items-center gap-1.5">
                <LinkIcon size={12} /> Destination Link (optional)
              </label>
              <input type="url" value={destLink} onChange={(e) => setDestLink(e.target.value)}
                placeholder="https://…" className={INPUT} />
            </div>
          </div>
        </div>

        {/* Right — publish settings */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 space-y-4">
            <h2 className="text-[#1B2E6B] font-semibold text-sm border-b border-[#F3F4F6] pb-3">Publish Settings</h2>

            <Toggle label="Pin Blog" checked={pinned} onChange={setPinned} />

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Visibility</label>
              <select value={internal ? "internal" : "public"}
                onChange={(e) => setInternal(e.target.value === "internal")}
                className={SELECT}>
                <option value="public">Public</option>
                <option value="internal">Internal Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
                {["Teachings", "Theology", "Community", "Family", "Traditions", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#374151] mb-2">Publish Date</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={publishNow} onChange={() => setPublishNow(true)}
                    className="accent-[#1B2E6B]" />
                  <span className="text-sm text-[#374151]">Publish immediately</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!publishNow} onChange={() => setPublishNow(false)}
                    className="accent-[#1B2E6B]" />
                  <span className="text-sm text-[#374151]">Schedule for later</span>
                </label>
              </div>
              {!publishNow && (
                <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)}
                  className={`${INPUT} mt-2`} />
              )}
            </div>

            <button onClick={handleUpdate} disabled={saving || !title.trim() || !content.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
              {saving
                ? <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />
                : <Send size={14} />}
              Save Changes
            </button>

            {/* Delete */}
            <div className="pt-2 border-t border-[#F3F4F6]">
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-xs text-red-500 font-medium text-center">This will permanently delete the post.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:bg-[#F9FAFB] transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleDelete} disabled={deleting}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
                      {deleting
                        ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        : <Trash2 size={13} />}
                      Confirm Delete
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors">
                  <Trash2 size={13} /> Delete Post
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
