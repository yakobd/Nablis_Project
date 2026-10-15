"use client";
import React, { useRef, useState } from "react";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { X, Plus, Trash2, CalendarDays, Target, ListChecks, ImagePlus, Loader2 } from "lucide-react";
import {
  db, useAuth, notify, CHALLENGE_CATEGORIES, challengeDays, type ChallengeDoc, type ChallengeKind,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@nablis/i18n";
import { challengeIcon } from "@/lib/challengeIcons";

const INPUT = "w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 focus:border-[#1E3A8A]";

function isoIn(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const KINDS: { key: ChallengeKind; label: string; hint: string; Icon: typeof Target }[] = [
  { key: "daily", label: "Every day", hint: "Tick each day, e.g. 40 days of prayer", Icon: CalendarDays },
  { key: "goal", label: "Reach a goal", hint: "Log progress toward a total, e.g. 50 Psalms", Icon: Target },
  { key: "checklist", label: "Checklist", hint: "Complete a list of steps", Icon: ListChecks },
];

export function ChallengeFormModal({ challenge, onClose, onSaved }: { challenge?: ChallengeDoc | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const imageInput = useRef<HTMLInputElement>(null);
  const editing = !!challenge;
  const [title, setTitle] = useState(challenge?.title ?? "");
  const [description, setDescription] = useState(challenge?.description ?? "");
  const [category, setCategory] = useState(challenge?.category ?? "prayer");
  const [kind, setKind] = useState<ChallengeKind>(challenge?.kind ?? "daily");
  const [startDate, setStartDate] = useState(challenge?.startDate ?? isoIn(0));
  const [endDate, setEndDate] = useState(challenge?.endDate ?? isoIn(39));
  const [target, setTarget] = useState(String(challenge?.target ?? 50));
  const [unit, setUnit] = useState(challenge?.unit ?? "chapters");
  const [steps, setSteps] = useState<string[]>(challenge?.steps?.length ? challenge.steps : ["", ""]);
  const [imageURL, setImageURL] = useState<string | null>(challenge?.imageURL ?? null);
  const [uploading, setUploading] = useState(false);
  const [notifyMembers, setNotifyMembers] = useState(!editing);
  const [saving, setSaving] = useState(false);

  const days = startDate && endDate && endDate >= startDate ? challengeDays({ startDate, endDate }).length : 0;

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      setImageURL(await uploadToCloudinary(f, "nablis/challenges"));
    } catch {
      toast({ message: t("chForm.uploadError"), type: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!user) return;
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) return toast({ message: t("chForm.needTitle"), type: "error" });
    if (!days) return toast({ message: t("chForm.badDates"), type: "error" });
    if (days > 366) return toast({ message: t("chForm.tooLong"), type: "error" });
    if (kind === "goal" && !(Number(target) > 0)) return toast({ message: t("chForm.needGoal"), type: "error" });
    if (kind === "checklist" && cleanSteps.length === 0) return toast({ message: t("chForm.needStep"), type: "error" });

    setSaving(true);
    const data = {
      title: title.trim(),
      description: description.trim(),
      category,
      kind,
      startDate,
      endDate,
      target: kind === "goal" ? Math.round(Number(target)) : null,
      unit: kind === "goal" ? unit.trim() || "times" : null,
      steps: kind === "checklist" ? cleanSteps : [],
      imageURL,
    };
    try {
      let id = challenge?.id;
      if (editing && id) {
        await updateDoc(doc(db, "challenges", id), { ...data, updatedAt: serverTimestamp() });
      } else {
        const ref = await addDoc(collection(db, "challenges"), { ...data, createdBy: user.id, createdAt: serverTimestamp() });
        id = ref.id;
      }
      if (notifyMembers && id) {
        const members = await getDocs(query(collection(db, "users"), where("status", "==", "active")));
        await notify(members.docs.filter((d) => d.id !== user.id).map((d) => ({
          userId: d.id, type: "challenge", link: `/challenges/${id}`,
          title: editing ? `Challenge updated: ${data.title}` : `New challenge: ${data.title}`,
          description: data.description.slice(0, 140) || "Join the challenge and grow together.",
        }))).catch(() => {});
      }
      toast({ message: editing ? t("chForm.updated") : t("chForm.created") });
      onSaved?.(id!);
      onClose();
    } catch {
      toast({ message: t("chForm.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <p className="text-lg font-semibold text-[#111827]">{editing ? t("chForm.editTitle") : t("chForm.newTitle")}</p>
          <button onClick={onClose} aria-label={t("common.close")} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={18} /></button>
        </div>

        <div className="px-7 pb-4 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("planUpload.titleLabel")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 40 Days of Morning Prayer" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("planUpload.description")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("chForm.descPlaceholder")} className={INPUT + " resize-none"} />
          </div>

          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("events.category")}</label>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_CATEGORIES.map((c) => (
                <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${category === c.key ? "bg-[#1E3A8A] text-white" : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"}`}>
                  <span className="inline-flex items-center gap-1.5">{React.createElement(challengeIcon(c.key), { size: 15 })} {t(`challengeCat.${c.key}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("chForm.tracking")}</label>
            <div className="grid sm:grid-cols-3 gap-3">
              {KINDS.map((k) => (
                <button key={k.key} type="button" onClick={() => setKind(k.key)} disabled={editing}
                  className={`text-left rounded-2xl border-2 p-4 transition-colors disabled:cursor-not-allowed ${kind === k.key ? "border-[#1E3A8A] bg-[#F5F7FF]" : "border-[#E5E7EB] hover:border-[#1E3A8A]/40 disabled:opacity-50"}`}>
                  <k.Icon size={18} className="text-[#1E3A8A]" />
                  <p className="font-semibold text-sm text-[#111827] mt-2">{t(`chForm.kind.${k.key}`)}</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">{t(`chForm.kindHint.${k.key}`)}</p>
                </button>
              ))}
            </div>
            {editing && <p className="text-[11px] text-[#9CA3AF] mt-1.5">{t("chForm.trackingLocked")}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#111827] mb-2">{t("chForm.starts")}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm text-[#111827] mb-2">{t("chForm.ends")}</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
            </div>
          </div>
          {days > 0 && <p className="text-xs text-[#6B7280] -mt-2">{days} day{days === 1 ? "" : "s"}</p>}

          {kind === "goal" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#111827] mb-2">{t("chForm.goal")}</label>
                <input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="block text-sm text-[#111827] mb-2">{t("chForm.counting")}</label>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("chForm.unitPlaceholder")} className={INPUT} />
              </div>
            </div>
          )}

          {kind === "checklist" && (
            <div>
              <label className="block text-sm text-[#111827] mb-2">{t("chForm.steps")}</label>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="w-8 h-11 flex items-center justify-center text-xs font-semibold text-[#9CA3AF]">{i + 1}</span>
                    <input value={s} onChange={(e) => setSteps((p) => p.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Step ${i + 1}`} className={INPUT} />
                    <button type="button" onClick={() => setSteps((p) => p.filter((_, j) => j !== i))} disabled={steps.length === 1} aria-label={t("chForm.removeStep")}
                      className="p-3 rounded-xl text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-30"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setSteps((p) => [...p, ""])} className="flex items-center gap-1.5 mt-2 text-sm font-semibold text-[#1E3A8A]"><Plus size={15} /> {t("chForm.addStep")}</button>
            </div>
          )}

          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("chForm.cover")} <span className="text-[#9CA3AF]">({t("share.optional")})</span></label>
            {imageURL ? (
              <div className="relative rounded-2xl overflow-hidden h-36">
                <img src={imageURL} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setImageURL(null)} aria-label={t("blogForm.removeImage")} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={15} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => imageInput.current?.click()} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D1D5DB] hover:border-[#1E3A8A] py-6 text-sm text-[#6B7280]">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />} {uploading ? t("chForm.uploading") : t("chForm.addImage")}
              </button>
            )}
            <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={onImage} />
          </div>

          <label className="flex items-center gap-3 text-sm text-[#374151] cursor-pointer">
            <input type="checkbox" checked={notifyMembers} onChange={(e) => setNotifyMembers(e.target.checked)} className="w-4 h-4 accent-[#1E3A8A]" />
            Notify all members
          </label>
        </div>

        <div className="flex justify-end gap-3 px-7 py-5 border-t border-[#F3F4F6]">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-[#374151]">{t("common.cancel")}</button>
          <button onClick={save} disabled={saving || uploading}
            className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B] disabled:opacity-50">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {editing ? t("prefs.save") : t("chForm.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
