"use client";
import React, { useState, useRef } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useRouter } from "next/navigation";
import {
  Upload, Image as ImageIcon, Pin, Lock, Calendar, Send,
  Link as LinkIcon, AlignLeft, ArrowLeft, MessageSquare,
} from "lucide-react";

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

export default function CreateBlogPage() {
  const router          = useRouter();
  const { user }        = useAuth();
  const fileRef         = useRef<HTMLInputElement>(null);
  const [title, setTitle]           = useState("");
  const [content, setContent]       = useState("");
  const [category, setCategory]     = useState("Teachings");
  const [altText, setAltText]       = useState("");
  const [destLink, setDestLink]     = useState("");
  const [pinned, setPinned]         = useState(false);
  const [internal, setInternal]     = useState(false);
  const [enableComments, setEnableComments] = useState(true);
  const [publishNow, setPublishNow] = useState(true);
  const [publishAt, setPublishAt]   = useState("");
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [saving, setSaving]         = useState(false);
  const [dragOver, setDragOver]     = useState(false);

  if (!user) return null;

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handlePublish() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      let imageURL = "";
      if (imageFile) {
        imageURL = await uploadToCloudinary(imageFile, "nablis/blogs");
      }
      await addDoc(collection(db, "blogPosts"), {
        authorId:   user!.id,
        authorName: user!.displayName || user!.email,
        title:      title.trim(),
        content:    content.trim(),
        category,
        imageURL:   imageURL || null,
        imageAlt:   altText.trim() || null,
        destLink:   destLink.trim() || null,
        pinned,
        internal,
        enableComments,
        status:     "published",
        publishAt:  publishNow
          ? serverTimestamp()
          : publishAt
            ? Timestamp.fromDate(new Date(publishAt))
            : serverTimestamp(),
        createdAt:  serverTimestamp(),
        comments:   [],
      });
      router.push("/blogs");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[#EEF1F8] text-[#6B7280] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Create New Blog</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Write and publish a spiritual teaching</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left — main editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Media upload */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full aspect-[16/6] object-cover" />
                <button onClick={() => { setImageFile(null); setImagePreview(""); }}
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
              <div className="flex items-center gap-2 mb-3">
                <Toggle label="Enable Comments" checked={enableComments} onChange={setEnableComments} />
              </div>
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

            <button onClick={handlePublish} disabled={saving || !title.trim() || !content.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
              {saving
                ? <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />
                : <Send size={14} />}
              {publishNow ? "Publish Now" : "Schedule"}
            </button>
          </div>

          {/* Tips */}
          <div className="bg-[#EEF1F8] rounded-2xl p-4">
            <p className="text-[#1B2E6B] font-semibold text-xs mb-2">Writing Tips</p>
            <ul className="space-y-1.5">
              {[
                "Keep the title clear and inspiring",
                "Include a relevant image",
                "Cite Bible verses for references",
                "Break content into readable paragraphs",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-1.5 text-[#6B7280] text-[11px]">
                  <span className="text-[#F5C518] mt-0.5">•</span> {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
