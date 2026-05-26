"use client";
import React, { useState, useRef } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Upload, Users, Paperclip, X,
  Plus, Send, Trash2,
} from "lucide-react";

const INPUT  = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";
const SELECT = INPUT + " bg-white";

interface MaterialFile {
  name: string;
  file: File;
}

export default function CreateBibleStudyPage() {
  const router       = useRouter();
  const { user }     = useAuth();
  const coverRef     = useRef<HTMLInputElement>(null);
  const materialRef  = useRef<HTMLInputElement>(null);

  const [title, setTitle]             = useState("");
  const [description, setDesc]        = useState("");
  const [teacherName, setTeacher]     = useState("");
  const [category, setCategory]       = useState("Old Testament");
  const [startDate, setStartDate]     = useState("");
  const [status, setStatus]           = useState<"active" | "upcoming">("upcoming");
  const [coverFile, setCoverFile]     = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [dragOver, setDragOver]       = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [members, setMembers]         = useState<string[]>([]);
  const [materials, setMaterials]     = useState<MaterialFile[]>([]);
  const [saving, setSaving]           = useState(false);

  if (!user) return null;

  function handleCoverFile(f: File) {
    if (!f.type.startsWith("image/")) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  function handleMaterialFiles(files: FileList) {
    const newFiles = Array.from(files).map((f) => ({ name: f.name, file: f }));
    setMaterials((prev) => [...prev, ...newFiles]);
  }

  function addMember() {
    const email = memberEmail.trim().toLowerCase();
    if (!email || members.includes(email)) return;
    setMembers((prev) => [...prev, email]);
    setMemberEmail("");
  }

  function removeMember(email: string) {
    setMembers((prev) => prev.filter((m) => m !== email));
  }

  function removeMaterial(name: string) {
    setMaterials((prev) => prev.filter((m) => m.name !== name));
  }

  async function handleCreate() {
    if (!title.trim() || !teacherName.trim()) return;
    setSaving(true);
    try {
      let imageURL = "";
      if (coverFile) {
        imageURL = await uploadToCloudinary(coverFile, "nablis/bible-studies");
      }

      const materialURLs: string[] = [];
      for (const m of materials) {
        const url = await uploadToCloudinary(m.file, "nablis/bible-studies/materials");
        materialURLs.push(url);
      }

      await addDoc(collection(db, "bibleStudies"), {
        title:       title.trim(),
        description: description.trim(),
        teacherName: teacherName.trim(),
        category,
        startDate:   startDate ? Timestamp.fromDate(new Date(startDate)) : null,
        status,
        imageURL:    imageURL || null,
        members,
        materials:   materialURLs,
        createdBy:   user!.id,
        createdAt:   serverTimestamp(),
      });

      router.push("/bible-study");
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
          <h1 className="text-xl font-bold text-[#1B2E6B]">Create Bible Study</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Set up a new scripture study session</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cover image */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <input ref={coverRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); }} />
            {coverPreview ? (
              <div className="relative">
                <img src={coverPreview} alt="Cover" className="w-full aspect-[16/6] object-cover" />
                <button onClick={() => { setCoverFile(null); setCoverPreview(""); }}
                  className="absolute top-3 right-3 bg-black/50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-black/70">
                  Change Cover
                </button>
              </div>
            ) : (
              <div
                className={[
                  "border-2 border-dashed m-4 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                  dragOver ? "border-[#1B2E6B] bg-[#EEF1F8]" : "border-[#D1D5DB] hover:border-[#1B2E6B]",
                ].join(" ")}
                onClick={() => coverRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files[0]; if (f) handleCoverFile(f);
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EEF1F8] flex items-center justify-center">
                  <Upload size={24} className="text-[#9CA3AF]" />
                </div>
                <div className="text-center">
                  <p className="text-[#374151] font-semibold text-sm">Upload cover image</p>
                  <p className="text-[#9CA3AF] text-xs mt-1">JPG, PNG, WebP up to 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Title + description */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Study Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Book of Genesis" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={4}
                placeholder="Brief overview of this study…"
                className={INPUT + " resize-none"} />
            </div>
          </div>

          {/* Members */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#F3F4F6]">
              <Users size={14} className="text-[#9CA3AF]" />
              <span className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-wide">Add Members</span>
            </div>
            <div className="flex gap-2 mb-3">
              <input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMember(); } }}
                placeholder="Member email address…"
                className={INPUT} />
              <button onClick={addMember}
                className="flex items-center gap-1.5 bg-[#EEF1F8] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#dde3f0] transition-colors flex-shrink-0">
                <Plus size={14} /> Add
              </button>
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <span key={m} className="flex items-center gap-1.5 bg-[#EEF1F8] text-[#1B2E6B] text-xs font-medium px-3 py-1.5 rounded-full">
                    {m}
                    <button onClick={() => removeMember(m)} className="text-[#9CA3AF] hover:text-red-400 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {members.length === 0 && (
              <p className="text-[#9CA3AF] text-xs">No members added yet. Type an email and press Enter or click Add.</p>
            )}
          </div>

          {/* Materials */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#F3F4F6]">
              <Paperclip size={14} className="text-[#9CA3AF]" />
              <span className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-wide">Study Materials</span>
            </div>
            <input ref={materialRef} type="file" multiple className="hidden"
              onChange={(e) => { if (e.target.files) handleMaterialFiles(e.target.files); }} />
            <button onClick={() => materialRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#D1D5DB] rounded-xl py-4 text-[#6B7280] text-sm font-medium hover:border-[#1B2E6B] hover:text-[#1B2E6B] transition-colors mb-3">
              <Upload size={16} /> Upload Files (PDF, DOCX, MP3…)
            </button>
            {materials.length > 0 && (
              <div className="space-y-2">
                {materials.map((m) => (
                  <div key={m.name} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl">
                    <Paperclip size={14} className="text-[#9CA3AF] flex-shrink-0" />
                    <span className="flex-1 text-[#374151] text-xs font-medium truncate">{m.name}</span>
                    <button onClick={() => removeMaterial(m.name)} className="text-[#9CA3AF] hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 space-y-4">
            <h2 className="text-[#1B2E6B] font-semibold text-sm border-b border-[#F3F4F6] pb-3">Study Settings</h2>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Teacher Name *</label>
              <input value={teacherName} onChange={(e) => setTeacher(e.target.value)}
                placeholder="Full name of teacher…" className={INPUT} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
                {["Old Testament", "New Testament", "Theology", "Church History", "Spiritual Formation", "Youth"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Start Date</label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Initial Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "upcoming")} className={SELECT}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
              </select>
            </div>

            <button onClick={handleCreate} disabled={saving || !title.trim() || !teacherName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
              {saving
                ? <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />
                : <Send size={14} />}
              Create Study
            </button>
          </div>

          {/* Tips */}
          <div className="bg-[#EEF1F8] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={14} className="text-[#1B2E6B]" />
              <p className="text-[#1B2E6B] font-semibold text-xs">Study Tips</p>
            </div>
            <ul className="space-y-1.5">
              {[
                "Set a clear weekly schedule",
                "Upload reading materials in advance",
                "Keep groups small (8–15 members) for discussion",
                "Include prayer time in each session",
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
