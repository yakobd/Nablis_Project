"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { arrayRemove, arrayUnion, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { CloudUpload, Eye, EyeOff, FileText, Image as ImageIcon, Loader2, Trash2, X, AlertTriangle } from "lucide-react";
import { db, useAuth, type UserDocument } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { Field, INPUT, SettingsPanel } from "../_components/ui";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

interface Details {
  firstName: string;
  lastName: string;
  christianName: string;
  phone: string;
  country: string;
  city: string;
  neighborhood: string;
  parishChurch: string;
  employmentStatus: string;
}

const EMPLOYMENT = [
  { value: "", label: "Select…" },
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "unemployed", label: "Unemployed" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

function fromUser(user: unknown): Details {
  const u = (user ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const parts = str(u.displayName).trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    christianName: str(u.christianName),
    phone: str(u.phoneNumber) || str(u.phone),
    country: str(u.countryOfResidence),
    city: str(u.cityOfResidence),
    neighborhood: str(u.neighborhood),
    parishChurch: str(u.parishChurch),
    employmentStatus: str(u.employmentStatus),
  };
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} className={INPUT + " pr-12"} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("prof.hidePw") : t("prof.showPw")}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-[#111827]">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, firebaseUser, role } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState<Details>(() => fromUser(user));
  const [d, setD] = useState<Details>(saved);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const v = fromUser(user);
    setSaved(v);
    setD(v);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  const documents: UserDocument[] = Array.isArray(user.documents) ? user.documents.filter((x) => x && typeof x === "object") : [];
  const passwordFilled = !!(currentPw || newPw || confirmPw);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved) || passwordFilled;
  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  function cancel() {
    setD(saved);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ message: t("prof.imgTooBig"), type: "error" }); return; }
    setPhotoBusy(true);
    try {
      const url = await uploadToCloudinary(file, "nablis/avatars");
      await updateDoc(doc(db, "users", user!.id), { photoURL: url, updatedAt: serverTimestamp() });
      toast({ message: t("prof.picUpdated") });
    } catch {
      toast({ message: t("prof.picError"), type: "error" });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await updateDoc(doc(db, "users", user!.id), { photoURL: null, updatedAt: serverTimestamp() });
      toast({ message: t("prof.picRemoved") });
    } catch {
      toast({ message: t("prof.picRemoveError"), type: "error" });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onDocuments(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setDocBusy(true);
    try {
      const added: UserDocument[] = [];
      for (const f of files) {
        if (f.size > 25 * 1024 * 1024) { toast({ message: `${f.name} is larger than 25 MB.`, type: "error" }); continue; }
        const url = await uploadToCloudinary(f, "nablis/member-documents");
        added.push({ url, name: f.name, size: f.size, uploadedAt: Date.now() });
      }
      if (added.length) {
        await updateDoc(doc(db, "users", user!.id), { documents: arrayUnion(...added), updatedAt: serverTimestamp() });
        toast({ message: t("prof.docsUploaded", { count: added.length }) });
      }
    } catch {
      toast({ message: t("prof.docError"), type: "error" });
    } finally {
      setDocBusy(false);
    }
  }

  async function removeDocument(item: UserDocument) {
    if (!confirm(t("prof.removeConfirm", { name: item.name }))) return;
    try {
      await updateDoc(doc(db, "users", user!.id), { documents: arrayRemove(item) });
    } catch {
      toast({ message: t("prof.docRemoveError"), type: "error" });
    }
  }

  async function save() {
    const name = `${d.firstName.trim()} ${d.lastName.trim()}`.trim();
    if (!name) { toast({ message: t("prof.needName"), type: "error" }); return; }
    if (passwordFilled) {
      if (!currentPw || !newPw) { toast({ message: t("prof.needPw"), type: "error" }); return; }
      if (newPw.length < 8) { toast({ message: t("prof.pwShort"), type: "error" }); return; }
      if (newPw !== confirmPw) { toast({ message: t("prof.pwMismatch"), type: "error" }); return; }
    }
    setSaving(true);
    try {
      if (passwordFilled && firebaseUser?.email) {
        try {
          await reauthenticateWithCredential(firebaseUser, EmailAuthProvider.credential(firebaseUser.email, currentPw));
        } catch {
          toast({ message: t("prof.pwWrong"), type: "error" });
          return;
        }
        await updatePassword(firebaseUser, newPw);
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      }
      const previous = saved;
      await updateDoc(doc(db, "users", user!.id), {
        displayName: name,
        christianName: d.christianName.trim(),
        phone: d.phone.trim(),
        phoneNumber: d.phone.trim(),
        countryOfResidence: d.country.trim(),
        cityOfResidence: d.city.trim(),
        neighborhood: d.neighborhood.trim(),
        parishChurch: d.parishChurch.trim(),
        employmentStatus: d.employmentStatus,
        updatedAt: serverTimestamp(),
      });
      setSaved(d);
      toast({
        message: passwordFilled ? t("prof.updatedBoth") : t("prof.updated"),
        actionLabel: t("prof.undo"),
        onAction: () => {
          updateDoc(doc(db, "users", user!.id), {
            displayName: `${previous.firstName} ${previous.lastName}`.trim(),
            christianName: previous.christianName, phone: previous.phone, phoneNumber: previous.phone,
            countryOfResidence: previous.country, cityOfResidence: previous.city, neighborhood: previous.neighborhood,
            parishChurch: previous.parishChurch, employmentStatus: previous.employmentStatus,
          }).then(() => { setSaved(previous); setD(previous); }).catch(() => {});
        },
        linkLabel: role === "member" ? undefined : t("msg.viewProfile"),
        onLink: () => router.push(`/settings/members/${user!.id}`),
      });
    } catch {
      toast({ message: t("prof.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!firebaseUser?.email || !deletePw) return;
    setDeleteBusy(true);
    try {
      await reauthenticateWithCredential(firebaseUser, EmailAuthProvider.credential(firebaseUser.email, deletePw));
      await deleteDoc(doc(db, "users", user!.id));
      await deleteUser(firebaseUser);
      router.replace("/login");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      toast({ message: code === "auth/wrong-password" || code === "auth/invalid-credential" ? t("prof.incorrectPw") : t("prof.deleteError"), type: "error" });
      setDeleteBusy(false);
    }
  }

  const initial = (user.displayName || user.email || "?")[0].toUpperCase();

  return (
    <div className="space-y-5">
      <SettingsPanel title={t("settingsNav.profile")} saveLabel={t("prefs.save")} onSave={save} onCancel={cancel} saving={saving} dirty={dirty}>
        {/* Picture */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-8 border-b border-[#F3F4F6]">
          <div className="relative w-28 h-28 flex-shrink-0">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="w-28 h-28 rounded-full object-cover ring-4 ring-[#F3F4F6]" />
              : <span className="w-28 h-28 rounded-full bg-[#EEF1F8] text-[#1E3A8A] text-4xl font-bold flex items-center justify-center ring-4 ring-[#F3F4F6]">{initial}</span>}
            {photoBusy && <span className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-[#1E3A8A]" /></span>}
          </div>
          <div>
            <p className="text-sm font-medium text-[#111827]">{t("prof.picture")}</p>
            <div className="flex flex-wrap gap-3 mt-3">
              <button type="button" onClick={() => photoInput.current?.click()} disabled={photoBusy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-black disabled:opacity-60">
                <CloudUpload size={16} /> {t("prof.upload")}
              </button>
              {user.photoURL && (
                <button type="button" onClick={removePhoto} disabled={photoBusy}
                  className="px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60">
                  {t("share.remove")}
                </button>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] mt-2.5">{t("prof.picHint")}</p>
            <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onPhoto} />
          </div>
        </div>

        {/* Details */}
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-6 py-8 border-b border-[#F3F4F6]">
          <Field label={t("prof.firstName")}><input value={d.firstName} onChange={set("firstName")} autoComplete="given-name" className={INPUT} /></Field>
          <Field label={t("prof.lastName")}><input value={d.lastName} onChange={set("lastName")} autoComplete="family-name" className={INPUT} /></Field>
          <Field label={t("auth.email")} hint={t("prof.emailHint")}>
            <input value={user.email} disabled className={INPUT} />
          </Field>
          <Field label={t("prof.documents")} hint={t("prof.documentsHint")}>
            <div className="flex items-center gap-3 rounded-xl bg-[#EEF1F8] px-3 py-2.5">
              <button type="button" onClick={() => docInput.current?.click()} disabled={docBusy}
                className="flex items-center gap-2 px-5 py-1.5 rounded-lg bg-white text-sm text-[#374151] shadow-sm hover:text-[#1E3A8A] disabled:opacity-60">
                {docBusy && <Loader2 size={14} className="animate-spin" />} {t("prof.selectDoc")}
              </button>
              <span className="text-xs text-[#6B7280]">{t("prof.docHint")}</span>
              <input ref={docInput} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={onDocuments} />
            </div>
          </Field>
          {documents.length > 0 && (
            <div className="sm:col-span-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
              {documents.map((f) => {
                const isPdf = /\.pdf$/i.test(f.name);
                return (
                  <div key={f.url} className="group flex items-center gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
                    <span className="w-9 h-9 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center flex-shrink-0">
                      {isPdf ? <FileText size={17} /> : <ImageIcon size={17} />}
                    </span>
                    <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111827] truncate hover:text-[#1E3A8A]">{f.name}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{fileSize(f.size)} · {new Date(f.uploadedAt).toLocaleDateString(dateLocale(), { month: "short", day: "2-digit", year: "numeric" })}</p>
                    </a>
                    <button type="button" onClick={() => removeDocument(f)} aria-label={`${t("share.remove")} ${f.name}`}
                      className="p-1 text-[#9CA3AF] hover:text-[#DC2626] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <Field label={t("prof.christianName")} hint="የክርስትና ስም"><input value={d.christianName} onChange={set("christianName")} className={INPUT} /></Field>
          <Field label={t("prof.phone")} hint={t("prof.phoneHint")}><input value={d.phone} onChange={set("phone")} type="tel" autoComplete="tel" className={INPUT} /></Field>
          <Field label={t("prof.country")}><input value={d.country} onChange={set("country")} autoComplete="country-name" className={INPUT} /></Field>
          <Field label={t("prof.city")}><input value={d.city} onChange={set("city")} autoComplete="address-level2" className={INPUT} /></Field>
          <Field label={t("prof.neighborhood")}><input value={d.neighborhood} onChange={set("neighborhood")} className={INPUT} /></Field>
          <Field label={t("prof.parish")}><input value={d.parishChurch} onChange={set("parishChurch")} className={INPUT} /></Field>
          <Field label={t("prof.employment")}>
            <select value={d.employmentStatus} onChange={set("employmentStatus")} className={INPUT + " cursor-pointer"}>
              {EMPLOYMENT.map((o) => <option key={o.value} value={o.value}>{t(`employment.${o.value || "select"}`)}</option>)}
            </select>
          </Field>
        </div>

        {/* Password */}
        <div className="pt-8">
          <p className="text-lg text-[#111827]">{t("prof.changePw")}</p>
          <p className="text-sm text-[#6B7280] mt-0.5">{t("prof.changePwHint")}</p>
          <div className="grid md:grid-cols-3 gap-5 mt-6">
            <Field label={t("prof.oldPw")}><PasswordInput value={currentPw} onChange={setCurrentPw} placeholder={t("prof.enterPw")} autoComplete="current-password" /></Field>
            <Field label={t("prof.newPw")}><PasswordInput value={newPw} onChange={setNewPw} placeholder={t("prof.enterPw")} autoComplete="new-password" /></Field>
            <Field label={t("prof.confirmPw")}><PasswordInput value={confirmPw} onChange={setConfirmPw} placeholder={t("prof.confirmPw")} autoComplete="new-password" /></Field>
          </div>
          {newPw && newPw.length < 8 && <p className="text-xs text-[#B45309] mt-2">{t("prof.atLeast8")}</p>}
          {confirmPw && newPw !== confirmPw && <p className="text-xs text-[#DC2626] mt-2">{t("prof.pwMismatch")}</p>}
        </div>
      </SettingsPanel>

      {/* Danger zone */}
      <div className="bg-white rounded-3xl shadow-sm p-6 sm:px-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-[#DC2626]">{t("prof.deleteAccount")}</p>
          <p className="text-sm text-[#6B7280] mt-0.5">{t("prof.deleteHint")}</p>
        </div>
        <button type="button" onClick={() => setDeleting(true)}
          className="flex items-center gap-2 self-start px-5 py-2.5 rounded-xl border border-[#FCA5A5] text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2]">
          <Trash2 size={15} /> {t("prof.deleteAccount")}
        </button>
      </div>

      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !deleteBusy && setDeleting(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-7 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <span className="w-12 h-12 rounded-2xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center"><AlertTriangle size={22} /></span>
            <p className="text-lg font-semibold text-[#111827] mt-4">{t("prof.deleteTitle")}</p>
            <p className="text-sm text-[#6B7280] mt-1">{t("prof.deleteBody")}</p>
            <div className="mt-5"><PasswordInput value={deletePw} onChange={setDeletePw} placeholder={t("prof.yourPw")} autoComplete="current-password" /></div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => { setDeleting(false); setDeletePw(""); }} disabled={deleteBusy}
                className="px-5 py-2.5 text-sm font-semibold text-[#374151]">{t("common.cancel")}</button>
              <button type="button" onClick={deleteAccount} disabled={!deletePw || deleteBusy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#B91C1C] disabled:opacity-50">
                {deleteBusy && <Loader2 size={14} className="animate-spin" />} {t("prof.deletePermanently")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
