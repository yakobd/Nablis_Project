"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc,
} from "firebase/firestore";
import { Plus, Image as ImageIcon, X, ChevronLeft, ChevronRight, Trash2, Pencil, Church, CalendarDays, FolderOpen, Download } from "lucide-react";
import { db, useAuth } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const CATEGORIES = ["Pilgrimage", "Bible Study", "Community Prayer", "Others"] as const;

interface Photo {
  id: string;
  imageURL: string;
  title: string;
  category: string;
  churchName?: string;
  album?: string | null;
  date?: Timestamp | null;
  uploadedBy?: string;
  createdAt?: Timestamp;
}

// Mosaic from the design: a wide + narrow row, four tall tiles, then two halves.
const PATTERN = [
  "sm:col-span-3 sm:row-span-2", "sm:col-span-1 sm:row-span-2",
  "sm:col-span-1 sm:row-span-2", "sm:col-span-1 sm:row-span-2", "sm:col-span-1 sm:row-span-2", "sm:col-span-1 sm:row-span-2",
  "sm:col-span-2 sm:row-span-2", "sm:col-span-2 sm:row-span-2",
];

function monthYear(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" }) : "";
}
function isoDay(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const LINE = "w-full bg-transparent border-0 border-b border-dashed border-[#C7CFDD] px-0 py-1 placeholder-[#9CA3AF] focus:outline-none focus:border-[#1B2E6B] focus:ring-0";

export default function GalleryAppPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const toast = useToast();
  const [photos, setPhotos]   = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("All");
  const [album, setAlbum]     = useState<string>("");
  const [open, setOpen]       = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Add-image tile state
  const [files, setFiles]     = useState<File[]>([]);
  const [title, setTitle]     = useState("");
  const [date, setDate]       = useState("");
  const [newCat, setNewCat]   = useState<string>("");
  const [church, setChurch]   = useState("");
  const [newAlbum, setNewAlbum] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onSnapshot(query(collection(db, "gallery"), orderBy("createdAt", "desc")), (snap) => {
    setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Photo)));
    setLoading(false);
  }, () => setLoading(false)), []);

  const albums = useMemo(() => Array.from(new Set(photos.map((p) => p.album).filter(Boolean))) as string[], [photos]);
  const shown = photos.filter((p) =>
    (category === "All" || p.category === category || (category === "Others" && !CATEGORIES.slice(0, 3).includes(p.category as never)))
    && (!album || p.album === album));
  const current = open !== null ? shown[open] : null;

  // Lightbox keyboard navigation
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % shown.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + shown.length) % shown.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shown.length]);

  async function upload() {
    if (!user || files.length === 0) return;
    if (!title.trim()) { toast({ type: "error", message: t("gal.needTitle") }); return; }
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(t("gal.uploading", { i: i + 1, n: files.length }));
        const imageURL = await uploadToCloudinary(files[i], "nablis/gallery");
        await addDoc(collection(db, "gallery"), {
          imageURL,
          title: title.trim(),
          category: newCat || "Others",
          churchName: church.trim(),
          album: newAlbum.trim() || null,
          date: date ? Timestamp.fromDate(new Date(`${date}T00:00`)) : serverTimestamp(),
          uploadedBy: user.id,
          createdAt: serverTimestamp(),
        });
      }
      toast({ message: t("gal.added", { count: files.length }) });
      setFiles([]); setTitle(""); setDate(""); setNewCat(""); setChurch(""); setNewAlbum("");
    } catch {
      toast({ type: "error", message: t("gal.uploadError") });
    } finally {
      setProgress(null);
    }
  }

  async function saveEdit(p: Photo, data: Partial<Photo>) {
    await updateDoc(doc(db, "gallery", p.id), data);
    setEditing(false);
    toast({ message: t("gal.updated") });
  }

  async function remove(p: Photo) {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteDoc(doc(db, "gallery", p.id));
    setConfirmDelete(false);
    setOpen(null);
    toast({ message: t("gal.deleted") });
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <PageTitle id="gallery" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => { setCategory(c); setOpen(null); }}
            className={`px-6 sm:px-8 py-2.5 rounded-full text-sm font-medium transition-all ${category === c ? "bg-[#1E3A8A] text-white shadow-[0_8px_18px_-8px_rgba(30,58,138,0.8)]" : "bg-white text-[#111827] hover:bg-[#EEF1F8]"}`}>
            {t(`galCat.${c}`)}
          </button>
        ))}
        {albums.length > 0 && (
          <label className="flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-full bg-white text-sm text-[#374151]">
            <FolderOpen size={15} className="text-[#1E3A8A]" />
            <select value={album} onChange={(e) => setAlbum(e.target.value)} className="bg-transparent focus:outline-none pr-1">
              <option value="">{t("gal.allAlbums")}</option>
              {albums.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 auto-rows-[220px] sm:auto-rows-[200px] gap-5 stagger">
          {shown.map((p, i) => (
            <button key={p.id} onClick={() => { setOpen(i); setEditing(false); setConfirmDelete(false); }}
              className={`relative rounded-3xl overflow-hidden shadow-md group text-left ${PATTERN[i % PATTERN.length]}`}>
              <img src={p.imageURL} alt={p.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
              <div className="absolute left-5 bottom-5 right-5 flex items-center gap-3 text-white">
                <span className="w-10 h-10 rounded-full bg-white text-[#1E3A8A] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"><ImageIcon size={17} /></span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold leading-tight truncate">{p.title}</span>
                  <span className="block text-xs text-white/85">{monthYear(p.date ?? p.createdAt)}</span>
                </span>
              </div>
            </button>
          ))}

          {/* Add image tile */}
          {isStaff && (
            <div className="sm:col-span-1 sm:row-span-2 row-span-2 rounded-3xl border-2 border-[#1E3A8A] bg-[#F1F4FA] shadow-md p-5 flex flex-col">
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} className="flex-1 flex flex-col items-center justify-center text-[#1E3A8A] group">
                {files.length ? (
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {files.slice(0, 6).map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="aspect-square w-full rounded-lg object-cover" />)}
                    {files.length > 6 && <span className="text-xs col-span-3 text-center">+{files.length - 6} more</span>}
                  </div>
                ) : (
                  <>
                    <Plus size={64} strokeWidth={2.5} className="transition-transform group-hover:rotate-90 duration-300" />
                    <span className="font-semibold mt-1">{t("gal.addImage")}</span>
                  </>
                )}
              </button>
              <div className="flex items-start gap-3 mt-3">
                <span className="w-9 h-9 rounded-full bg-white text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-sm"><ImageIcon size={15} /></span>
                <div className="flex-1 min-w-0 space-y-1">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("gal.enterTitle")} className={`${LINE} text-base text-[#111827]`} />
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${LINE} text-xs text-[#4B5563]`} aria-label={t("gal.setDate")} />
                  <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className={`${LINE} text-xs text-[#4B5563]`} aria-label={t("gal.setCategory")}>
                    <option value="">{t("gal.setCategory")}</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{t(`galCat.${c}`)}</option>)}
                  </select>
                  <input value={church} onChange={(e) => setChurch(e.target.value)} placeholder={t("gal.church")} className={`${LINE} text-xs text-[#4B5563]`} />
                  <input value={newAlbum} onChange={(e) => setNewAlbum(e.target.value)} placeholder={t("gal.albumOptional")} list="gallery-albums" className={`${LINE} text-xs text-[#4B5563]`} />
                  <datalist id="gallery-albums">{albums.map((a) => <option key={a} value={a} />)}</datalist>
                </div>
              </div>
              {files.length > 0 && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setFiles([])} disabled={!!progress} className="px-3 py-2 rounded-lg text-xs font-semibold text-[#6B7280] hover:bg-white">{t("gal.clear")}</button>
                  <button onClick={upload} disabled={!!progress} className="flex-1 py-2 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold disabled:opacity-60">
                    {progress ?? t("gal.upload", { count: files.length })}
                  </button>
                </div>
              )}
            </div>
          )}

          {shown.length === 0 && !isStaff && (
            <div className="sm:col-span-4 bg-white rounded-3xl p-12 text-center text-[#9CA3AF]">{t("gal.empty")}</div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {current && open !== null && (
        <div className="fixed inset-0 z-50 bg-[#0B1430]/95 flex flex-col" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between px-5 py-4 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm text-white/70">{open + 1} / {shown.length}</span>
            <div className="flex items-center gap-2">
              <a href={current.imageURL} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:bg-white/10" aria-label={t("gal.original")}><Download size={18} /></a>
              {isStaff && <button onClick={() => setEditing((v) => !v)} className="p-2 rounded-full hover:bg-white/10" aria-label={t("gal.editDetails")}><Pencil size={18} /></button>}
              {isStaff && (
                <button onClick={() => remove(current)} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm ${confirmDelete ? "bg-red-600" : "hover:bg-white/10"}`} aria-label={t("common.delete")}>
                  <Trash2 size={17} /> {confirmDelete && "Confirm delete"}
                </button>
              )}
              <button onClick={() => setOpen(null)} className="p-2 rounded-full hover:bg-white/10" aria-label={t("common.close")}><X size={22} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center gap-3 px-3 min-h-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen((open - 1 + shown.length) % shown.length)} className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label={t("pagination.previous")}><ChevronLeft size={22} /></button>
            <img key={current.id} src={current.imageURL} alt={current.title} className="max-h-full max-w-[min(1100px,80vw)] rounded-2xl object-contain animate-scale-in" />
            <button onClick={() => setOpen((open + 1) % shown.length)} className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label={t("pagination.next")}><ChevronRight size={22} /></button>
          </div>
          <div className="px-6 py-5 text-white" onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <EditDetails photo={current} onSave={(d) => saveEdit(current, d)} onCancel={() => setEditing(false)} />
            ) : (
              <div className="max-w-3xl mx-auto text-center">
                <p className="text-xl font-semibold">{current.title}</p>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-1.5 text-sm text-white/75">
                  <span className="flex items-center gap-1.5"><CalendarDays size={13} /> {monthYear(current.date ?? current.createdAt)}</span>
                  {current.churchName && <span className="flex items-center gap-1.5"><Church size={13} /> {current.churchName}</span>}
                  <span>{current.category}</span>
                  {current.album && <span className="flex items-center gap-1.5"><FolderOpen size={13} /> {current.album}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditDetails({ photo, onSave, onCancel }: { photo: Photo; onSave: (d: Partial<Photo>) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(photo.title);
  const [category, setCategory] = useState(photo.category);
  const [church, setChurch] = useState(photo.churchName ?? "");
  const [album, setAlbum] = useState(photo.album ?? "");
  const [date, setDate] = useState(isoDay(photo.date));
  const field = "px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder-white/50 focus:outline-none focus:border-[#F5C518]";
  return (
    <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder={t("ann.title")} />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
        {CATEGORIES.map((c) => <option key={c} value={c} className="text-black">{t(`galCat.${c}`)}</option>)}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      <input value={church} onChange={(e) => setChurch(e.target.value)} className={field} placeholder={t("gal.church")} />
      <input value={album} onChange={(e) => setAlbum(e.target.value)} className={field} placeholder={t("gal.album")} />
      <button onClick={() => onSave({
        title: title.trim() || photo.title, category, churchName: church.trim(), album: album.trim() || null,
        ...(date ? { date: Timestamp.fromDate(new Date(`${date}T00:00`)) } : {}),
      })} className="px-4 py-2 rounded-lg bg-[#F5C518] text-[#111827] text-sm font-semibold">{t("events.save")}</button>
      <button onClick={onCancel} className="px-3 py-2 text-sm text-white/70">{t("common.cancel")}</button>
    </div>
  );
}
