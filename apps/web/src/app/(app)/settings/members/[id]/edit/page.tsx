"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { db, useAuth, type User } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Field, INPUT, SettingsPanel } from "../../../_components/ui";
import { MemberAvatar } from "../../_components/shared";
import { useTranslation } from "@nablis/i18n";

interface Form {
  displayName: string;
  christianName: string;
  phone: string;
  gender: "" | "male" | "female";
  birthday: string; // YYYY-MM-DD
  address: string;
  neighborhood: string;
  city: string;
  country: string;
  zipCode: string;
  parishChurch: string;
  role: User["role"];
  status: User["status"];
}

function toForm(m: User): Form {
  const b = m.birthday?.toDate?.();
  return {
    displayName: m.displayName ?? "",
    christianName: m.christianName ?? "",
    phone: m.phoneNumber || m.phone || "",
    gender: m.gender ?? "",
    birthday: b ? `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}-${String(b.getDate()).padStart(2, "0")}` : "",
    address: m.address ?? "",
    neighborhood: m.neighborhood ?? "",
    city: m.cityOfResidence || m.city || "",
    country: m.countryOfResidence ?? "",
    zipCode: m.zipCode ?? "",
    parishChurch: m.parishChurch ?? "",
    role: m.role,
    status: m.status,
  };
}

export default function EditMemberPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, role } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const [member, setMember] = useState<User | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "users", id)).then((snap) => {
      if (!snap.exists()) return;
      const m = { id: snap.id, ...snap.data() } as User;
      setMember(m);
      setSaved(toForm(m));
      setF(toForm(m));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (!user) return null;
  if (loading) return <div className="bg-white rounded-3xl py-20"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!member || !f || !saved) return <div className="bg-white rounded-3xl p-12 text-center text-sm text-[#6B7280]">{t("memberEdit.notFound")}</div>;
  // Admins may edit regular members only (see firestore.rules).
  if (!isSuperAdmin && member.role !== "member") {
    return <div className="bg-white rounded-3xl p-12 text-center text-sm text-[#6B7280]">{t("memberEdit.onlyFather")}</div>;
  }

  const form = f;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...form, [k]: e.target.value } as Form);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const isSelf = member.id === user.id;

  async function save() {
    if (!form.displayName.trim()) { toast({ message: t("memberEdit.needName"), type: "error" }); return; }
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        displayName: form.displayName.trim(),
        christianName: form.christianName.trim(),
        phone: form.phone.trim(),
        phoneNumber: form.phone.trim(),
        gender: form.gender || null,
        birthday: form.birthday ? Timestamp.fromDate(new Date(`${form.birthday}T12:00:00`)) : null,
        address: form.address.trim(),
        neighborhood: form.neighborhood.trim(),
        cityOfResidence: form.city.trim(),
        countryOfResidence: form.country.trim(),
        zipCode: form.zipCode.trim(),
        parishChurch: form.parishChurch.trim(),
        updatedAt: serverTimestamp(),
      };
      if (isSuperAdmin && !isSelf) {
        updates.role = form.role;
        updates.status = form.status;
      }
      await updateDoc(doc(db, "users", member!.id), updates);
      setSaved(form);
      toast({ message: t("memberEdit.updated"), linkLabel: t("members.viewProfile"), onLink: () => router.push(`/settings/members/${member!.id}`) });
    } catch {
      toast({ message: t("memberEdit.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => router.push(`/settings/members/${member.id}`)} className="flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A]">
        <ArrowLeft size={16} /> {t("memberEdit.back")}
      </button>
      <SettingsPanel title={t("memberEdit.title")} onSave={save} onCancel={() => setF(saved)} saving={saving} dirty={dirty}>
        <div className="flex items-center gap-4 pb-8 border-b border-[#F3F4F6]">
          <MemberAvatar m={member} size={64} />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-[#111827] truncate">{member.displayName || "Unnamed"}</p>
            <p className="text-sm text-[#6B7280] truncate">{member.email}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 py-8 border-b border-[#F3F4F6]">
          <Field label={t("memberEdit.fullName")}><input value={f.displayName} onChange={set("displayName")} className={INPUT} /></Field>
          <Field label={t("memberInfo.christianName")}><input value={f.christianName} onChange={set("christianName")} className={INPUT} /></Field>
          <Field label={t("memberEdit.email")} hint={t("memberEdit.emailHint")}><input value={member.email} disabled className={INPUT} /></Field>
          <Field label={t("memberInfo.phone")}><input value={f.phone} onChange={set("phone")} type="tel" className={INPUT} /></Field>
          <Field label={t("memberInfo.gender")}>
            <select value={f.gender} onChange={set("gender")} className={INPUT + " cursor-pointer"}>
              <option value="">{t("memberEdit.notSpecified")}</option>
              <option value="female">{t("memberInfo.gender_female")}</option>
              <option value="male">{t("memberInfo.gender_male")}</option>
            </select>
          </Field>
          <Field label={t("memberInfo.birthday")}><input type="date" value={f.birthday} onChange={set("birthday")} max={new Date().toISOString().slice(0, 10)} className={INPUT} /></Field>
          <Field label={t("memberInfo.street")}><input value={f.address} onChange={set("address")} className={INPUT} /></Field>
          <Field label={t("memberEdit.neighborhood")}><input value={f.neighborhood} onChange={set("neighborhood")} className={INPUT} /></Field>
          <Field label={t("memberInfo.city")}><input value={f.city} onChange={set("city")} className={INPUT} /></Field>
          <Field label={t("memberInfo.country")}><input value={f.country} onChange={set("country")} className={INPUT} /></Field>
          <Field label={t("memberInfo.zip")}><input value={f.zipCode} onChange={set("zipCode")} className={INPUT} /></Field>
          <Field label={t("memberInfo.parish")}><input value={f.parishChurch} onChange={set("parishChurch")} className={INPUT} /></Field>
        </div>

        {isSuperAdmin && !isSelf && (
          <div className="grid sm:grid-cols-2 gap-6 pt-8">
            <div className="sm:col-span-2">
              <p className="text-lg text-[#111827]">{t("members.access")}</p>
              <p className="text-sm text-[#6B7280] mt-0.5">{t("memberEdit.accessHint")}</p>
            </div>
            <Field label={t("memberEdit.role")}>
              <select value={f.role} onChange={set("role")} className={INPUT + " cursor-pointer"}>
                <option value="member">{t("status.member")}</option>
                <option value="admin">{t("members.admin")}</option>
                {saved.role === "super_admin" && <option value="super_admin">{t("members.father")}</option>}
              </select>
            </Field>
            <Field label={t("study.status")}>
              <select value={f.status} onChange={set("status")} className={INPUT + " cursor-pointer"}>
                <option value="active">{t("groups.filter.active")}</option>
                <option value="pending">{t("memberEdit.pending")}</option>
                <option value="suspended">{t("memberEdit.suspended")}</option>
                <option value="rejected">{t("memberEdit.rejected")}</option>
              </select>
            </Field>
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}
