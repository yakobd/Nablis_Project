"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  collection, query, orderBy, getDocs, addDoc, deleteDoc,
  doc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Plus, X, Upload, Trash2, ZoomIn, Calendar, Tag } from "lucide-react";

interface GalleryItem {
  id: string;
  title: string;
  imageURL: string;
  category: string;
  date?: Timestamp | null;
  uploadedBy?: string;
  createdAt?: Timestamp;
}

const CATEGORIES = ["All", "Liturgy", "Community", "Youth", "Retreats", "Celebrations"] as const;
type Cat = (typeof CATEGORIES)[number];

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";
const SELECT = INPUT + " bg-white";

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return ""; }
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors">
          <X size={24} />
        </button>
        <img src={item.imageURL} alt={item.title}
          className="w-full max-h-[80vh] object-contain rounded-2xl" />
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">{item.title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-white/50 text-xs flex items-center gap-1">
                <Tag size={10} /> {item.category}
              </span>
              {item.date && (
                <span className="text-white/50 text-xs flex items-center gap-1">
                  <Calendar size={10} /> {fmtDate(item.date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add image form ─────────────────────────────────────────────────────────────
interface AddFormProps {
  onClose: () => void;
  onAdded: () => void;
}
function AddImageModal({ onClose, onAdded }: AddFormProps) {
  const { user }        = useAuth();
  const fileRef         = useRef<HTMLInputElement>(null);
  const [title, setTitle]       = useState("");
  const [category, setCat]      = useState("Community");
  const [date, setDate]         = useState("");
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving]     = useState(false);

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (!file || !title.trim()) return;
    setSaving(true);
    try {
      const imageURL = await uploadToCloudinary(file, "nablis/gallery");
      await addDoc(collection(db, "gallery"), {
        title:      title.trim(),
        imageURL,
        category,
        date:       date ? Timestamp.fromDate(new Date(date)) : null,
        uploadedBy: user!.id,
        createdAt:  serverTimestamp(),
      });
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[#1B2E6B] font-bold text-base">Add Image</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Drop zone / preview */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {preview ? (
            <div className="relative rounded-xl overflow-hidden aspect-video">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              <button onClick={() => { setFile(null); setPreview(""); }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-lg p-1 hover:bg-black/70">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              className={[
                "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors",
                dragOver ? "border-[#1B2E6B] bg-[#EEF1F8]" : "border-[#D1D5DB] hover:border-[#1B2E6B]",
              ].join(" ")}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <Upload size={24} className="text-[#9CA3AF]" />
              <p className="text-[#374151] font-medium text-sm">Click or drag image here</p>
              <p className="text-[#9CA3AF] text-xs">JPG, PNG, WebP</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Image title…" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCat(e.target.value)} className={SELECT}>
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Date (optional)</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button onClick={handleSave} disabled={saving || !file || !title.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] disabled:opacity-60 transition-colors text-sm">
            {saving ? <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" /> : <Upload size={14} />}
            Upload Image
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Masonry grid ──────────────────────────────────────────────────────────────
function MasonryGrid({
  items, isAdminOrSuperAdmin, onSelect, onDelete,
}: {
  items: GalleryItem[];
  isAdminOrSuperAdmin: boolean;
  onSelect: (item: GalleryItem) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-[#9CA3AF]">
        <Upload size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No images in this category yet.</p>
      </div>
    );
  }
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
      {items.map((item) => (
        <div key={item.id} className="break-inside-avoid group relative rounded-xl overflow-hidden cursor-pointer bg-[#EEF1F8]"
          onClick={() => onSelect(item)}>
          <img src={item.imageURL} alt={item.title} className="w-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white font-semibold text-xs line-clamp-1">{item.title}</p>
              {item.date && <p className="text-white/60 text-[9px] mt-0.5">{fmtDate(item.date)}</p>}
            </div>
            <div className="absolute top-2 right-2 flex gap-1">
              <div className="p-1.5 rounded-lg bg-white/20 text-white">
                <ZoomIn size={12} />
              </div>
              {isAdminOrSuperAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                  className="p-1.5 rounded-lg bg-red-500/70 text-white hover:bg-red-500 transition-colors">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GalleryAppPage() {
  const { user, role } = useAuth();
  const isAdminOrSuperAdmin = role === "admin" || role === "super_admin";
  const [items, setItems]       = useState<GalleryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeCat, setActiveCat] = useState<Cat>("All");
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [showAdd, setShowAdd]   = useState(false);

  function load() {
    setLoading(true);
    getDocs(query(collection(db, "gallery"), orderBy("createdAt", "desc")))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryItem))))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  if (!user) return null;

  const filtered = activeCat === "All"
    ? items
    : items.filter((i) => i.category === activeCat);

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, "gallery", id));
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Gallery</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Community photos and memories</p>
        </div>
        {isAdminOrSuperAdmin && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
            <Plus size={15} /> Add Image
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setActiveCat(c)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              activeCat === c ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
            ].join(" ")}>
            {c}
          </button>
        ))}
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-4 text-xs text-[#9CA3AF]">
        <span>{items.length} total images</span>
        <span>·</span>
        <span>{filtered.length} in {activeCat}</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <MasonryGrid
          items={filtered}
          isAdminOrSuperAdmin={isAdminOrSuperAdmin}
          onSelect={setLightbox}
          onDelete={handleDelete}
        />
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}

      {/* Add modal */}
      {showAdd && (
        <AddImageModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}
