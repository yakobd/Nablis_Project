"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import {
  Plus, X, Users, Search, Check, MoreVertical, Building2, Bus, BookOpen, HandHeart, PartyPopper, Sparkles,
  UserPlus, Pencil, FolderMinus, Filter, ArrowUpDown, Star,
} from "lucide-react";
import { db, useAuth } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { INPUT, Toggle } from "../_components/ui";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";

const CATEGORIES = [
  { key: "prayer", get label() { return i18n.t("groupCat.prayer"); }, Icon: HandHeart },
  { key: "bible_study", get label() { return i18n.t("groupCat.bible_study"); }, Icon: BookOpen },
  { key: "pilgrimage", get label() { return i18n.t("groupCat.pilgrimage"); }, Icon: Bus },
  { key: "festival", get label() { return i18n.t("groupCat.festival"); }, Icon: PartyPopper },
  { key: "youth", get label() { return i18n.t("groupCat.youth"); }, Icon: Sparkles },
  { key: "other", get label() { return i18n.t("groupCat.other"); }, Icon: Building2 },
] as const;
const categoryOf = (key?: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

interface Group {
  id: string;
  name: string;
  description: string;
  category?: string;
  active?: boolean;
  members: string[];
  /** Key members shown on the card (subset of members). */
  leaders?: string[];
  createdAt?: { toMillis?: () => number };
}

interface UserOption { id: string; displayName: string; email: string; photoURL: string | null; role: string }

type SortKey = "newest" | "name" | "size";

function Avatar({ u, size = 28 }: { u: UserOption; size?: number }) {
  return u.photoURL
    ? <img src={u.photoURL} alt="" className="rounded-full object-cover ring-2 ring-white flex-shrink-0" style={{ width: size, height: size }} />
    : <span className="rounded-full bg-[#EEF1F8] text-[#1E3A8A] font-bold flex items-center justify-center ring-2 ring-white flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {(u.displayName || u.email || "?")[0].toUpperCase()}
      </span>;
}

function CardMenu({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-[#F9FAFB]";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={t("groups.options")} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"><MoreVertical size={17} /></button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-48 bg-white rounded-2xl border border-[#F3F4F6] shadow-xl py-2 animate-scale-in origin-top-right">
          <p className="px-4 pb-1 text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase">{t("groups.optionsTitle")}</p>
          <button onClick={() => { setOpen(false); onView(); }} className={item + " text-[#374151]"}><UserPlus size={15} /> {t("groups.view")}</button>
          <button onClick={() => { setOpen(false); onEdit(); }} className={item + " text-[#374151]"}><Pencil size={15} /> {t("groups.edit")}</button>
          <button onClick={() => { setOpen(false); onDelete(); }} className={item + " text-[#DC2626] hover:bg-[#FEF2F2]"}><FolderMinus size={15} /> {t("groups.delete")}</button>
        </div>
      )}
    </div>
  );
}

export default function GroupsPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [menu, setMenu] = useState<"filter" | "sort" | null>(null);
  const [viewing, setViewing] = useState<Group | null>(null);

  // Editor state. null = closed, "new" = create.
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("prayer");
  const [active, setActive] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [leaders, setLeaders] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "groups")),
      getDocs(query(collection(db, "users"), where("status", "==", "active"))),
    ]).then(([gSnap, uSnap]) => {
      setGroups(gSnap.docs.map((d) => ({ id: d.id, name: "", description: "", members: [], ...d.data() } as Group)));
      setUsers(uSnap.docs
        .map((d) => ({ id: d.id, displayName: d.data().displayName ?? "", email: d.data().email ?? "", photoURL: d.data().photoURL ?? null, role: d.data().role ?? "member" }))
        .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email)));
    }).catch(() => toast({ message: t("groups.loadError"), type: "error" }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const tabs = useMemo(() => {
    const used = new Set(groups.map((g) => categoryOf(g.category).key));
    return CATEGORIES.filter((c) => used.has(c.key));
  }, [groups]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .filter((g) => tab === "all" || categoryOf(g.category).key === tab)
      .filter((g) => statusFilter === "all" || (statusFilter === "active" ? g.active !== false : g.active === false))
      .filter((g) => {
        if (!q) return true;
        const people = g.members.map((id) => byId.get(id)).filter(Boolean).map((u) => `${u!.displayName} ${u!.email}`).join(" ");
        return `${g.name} ${g.description} ${categoryOf(g.category).label} ${people}`.toLowerCase().includes(q);
      })
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name)
        : sort === "size" ? b.members.length - a.members.length
        : (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  }, [groups, tab, statusFilter, search, sort, byId]);

  const memberMatches = users.filter((u) => `${u.displayName} ${u.email}`.toLowerCase().includes(memberSearch.toLowerCase()));

  function open(g: Group | "new") {
    setEditing(g);
    setName(g === "new" ? "" : g.name);
    setDescription(g === "new" ? "" : g.description);
    setCategory(g === "new" ? (tab !== "all" ? tab : "prayer") : categoryOf(g.category).key);
    setActive(g === "new" ? true : g.active !== false);
    setSelected(g === "new" ? [] : g.members);
    setLeaders(g === "new" ? [] : (g.leaders ?? []));
    setMemberSearch("");
  }

  function toggleMember(id: string) {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setLeaders((p) => p.filter((x) => x !== id || !selected.includes(id)));
  }
  function toggleLeader(id: string) {
    setLeaders((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
    setSelected((p) => (p.includes(id) ? p : [...p, id]));
  }

  async function save() {
    if (!name.trim() || !editing) return;
    setSaving(true);
    const data = {
      name: name.trim(), description: description.trim(), category, active,
      members: selected, leaders: leaders.filter((l) => selected.includes(l)),
    };
    try {
      if (editing === "new") {
        const ref = await addDoc(collection(db, "groups"), { ...data, createdAt: serverTimestamp() });
        const created = { id: ref.id, ...data, createdAt: { toMillis: () => Date.now() } };
        setGroups((p) => [...p, created]);
        toast({
          message: t("groups.created"),
          actionLabel: t("groups.undo"),
          onAction: () => deleteDoc(ref).then(() => setGroups((p) => p.filter((g) => g.id !== ref.id))).catch(() => {}),
          linkLabel: t("groups.view"),
          onLink: () => setViewing(created),
        });
      } else {
        await updateDoc(doc(db, "groups", editing.id), { ...data, updatedAt: serverTimestamp() });
        setGroups((p) => p.map((g) => (g.id === editing.id ? { ...g, ...data } : g)));
        toast({ message: t("groups.updated") });
      }
      setEditing(null);
    } catch {
      toast({ message: t("groups.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(g: Group) {
    if (!confirm(t("groups.deleteConfirm", { name: g.name }))) return;
    try {
      await deleteDoc(doc(db, "groups", g.id));
      setGroups((p) => p.filter((x) => x.id !== g.id));
      toast({ message: t("groups.deleted") });
    } catch {
      toast({ message: t("groups.deleteError"), type: "error" });
    }
  }

  if (role !== "super_admin") {
    return <div className="bg-white rounded-3xl p-12 text-center text-sm text-[#6B7280]">{t("groups.onlyFather")}</div>;
  }

  const pill = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-medium ${on ? "bg-[#1E3A8A] text-white" : "bg-[#F3F4F6] text-[#374151]"}`;

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-10 animate-fade-up">
      <h2 className="font-display text-3xl font-bold text-[#111827]">{t("groups.title")}</h2>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mt-6 pb-6 border-b border-[#F3F4F6]">
        <div className="relative flex-1 md:max-w-lg">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("groups.search")}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#F3F4F6] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 focus:bg-white" />
        </div>
        <button onClick={() => open("new")}
          className="md:ml-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(30,58,138,0.9)] hover:bg-[#1B2E6B]">
          <Plus size={17} /> {t("groups.addNew")}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-4">
        <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB]">
          {[{ key: "all", label: t("groups.all") }, ...tabs].map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === tb.key ? "border-[#1E3A8A] text-[#1E3A8A] font-semibold" : "border-transparent text-[#6B7280] hover:text-[#1E3A8A]"}`}>
              {tb.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 relative self-end">
          <button onClick={() => setMenu(menu === "filter" ? null : "filter")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm ${statusFilter !== "all" ? "border-[#1E3A8A] text-[#1E3A8A] bg-[#EEF1F8]" : "border-[#E5E7EB] text-[#374151]"}`}>
            <Filter size={14} /> {t("common.filter")}
          </button>
          <button onClick={() => setMenu(menu === "sort" ? null : "sort")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5E7EB] text-sm text-[#374151]">
            <ArrowUpDown size={14} /> {t("common.sort")}
          </button>
          {menu && (
            <div className="absolute right-0 top-11 z-20 w-56 bg-white rounded-2xl border border-[#F3F4F6] shadow-xl p-4 animate-scale-in origin-top-right">
              {menu === "filter" ? (
                <>
                  <p className="text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase mb-2">{t("study.status")}</p>
                  <div className="flex gap-2">
                    {(["all", "active", "inactive"] as const).map((s) => (
                      <button key={s} onClick={() => { setStatusFilter(s); setMenu(null); }} className={pill(statusFilter === s)}>{t(`groups.filter.${s}`)}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase mb-2">{t("groups.sortBy")}</p>
                  <div className="flex flex-wrap gap-2">
                    {([["newest", t("groups.newest")], ["name", t("planAdmin.sortName")], ["size", t("groups.mostMembers")]] as [SortKey, string][]).map(([k, l]) => (
                      <button key={k} onClick={() => { setSort(k); setMenu(null); }} className={pill(sort === k)}>{l}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : visible.length === 0 ? (
        <div className="mt-8 py-14 rounded-2xl border-2 border-dashed border-[#E5E7EB] text-center">
          <Users size={34} className="mx-auto text-[#1E3A8A]/30" />
          <p className="text-sm text-[#6B7280] mt-3">{groups.length ? t("groups.noMatch") : t("groups.empty")}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 mt-6 stagger">
          {visible.map((g) => {
            const members = g.members.map((id) => byId.get(id)).filter(Boolean) as UserOption[];
            const keyMembers = [...(g.leaders ?? []).map((id) => byId.get(id)).filter(Boolean) as UserOption[], ...members]
              .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i).slice(0, 2);
            const cat = categoryOf(g.category);
            const isActive = g.active !== false;
            return (
              <div key={g.id} className={`rounded-2xl border border-[#E5E7EB] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all ${isActive ? "" : "opacity-70"}`}>
                <div className="flex items-start gap-4">
                  <span className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isActive ? "bg-[#EEF1F8] text-[#1E3A8A]" : "bg-[#F3F4F6] text-[#9CA3AF]"}`}><cat.Icon size={24} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-[#111827] truncate">{g.name}</p>
                    <p className="flex items-center gap-1.5 text-sm text-[#6B7280]">
                      <span className={`w-2 h-2 rounded-full ${isActive ? "bg-[#22C55E]" : "bg-[#9CA3AF]"}`} />
                      {isActive ? t("groups.filter.active") : t("groups.filter.inactive")} · {t("groups.memberCount", { count: members.length })}
                    </p>
                  </div>
                  <CardMenu onView={() => setViewing(g)} onEdit={() => open(g)} onDelete={() => remove(g)} />
                </div>

                <div className="border-t border-[#F3F4F6] mt-4 pt-3">
                  <p className="text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase">{t("groups.keyMembers")}</p>
                  {keyMembers.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF] py-3">{t("groups.noMembers")}</p>
                  ) : keyMembers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 mt-3">
                      <Avatar u={u} size={36} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{u.displayName || u.email}</p>
                        <p className="text-[11px] text-[#6B7280] truncate">{(g.leaders ?? []).includes(u.id) ? t("groups.leader") : t("status.member")} · {u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-[#F3F4F6] mt-4 pt-4">
                  <div className="flex -space-x-2 items-center">
                    {members.slice(0, 3).map((u) => <Avatar key={u.id} u={u} />)}
                    {members.length > 3 && <span className="w-7 h-7 rounded-full bg-[#EEF1F8] text-[#1E3A8A] text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">+{members.length - 3}</span>}
                  </div>
                  <button onClick={() => setViewing(g)} className="text-sm font-semibold text-[#111827] hover:text-[#1E3A8A]">{t("groups.viewAll")}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View group */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-[#F3F4F6]">
              <div>
                <p className="text-lg font-semibold text-[#111827]">{viewing.name}</p>
                <p className="text-sm text-[#6B7280]">{categoryOf(viewing.category).label} · {t("groups.memberCount", { count: viewing.members.length })}</p>
                {viewing.description && <p className="text-sm text-[#374151] mt-2">{viewing.description}</p>}
              </div>
              <button onClick={() => setViewing(null)} aria-label={t("common.close")} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              {viewing.members.map((id) => byId.get(id)).filter(Boolean).map((u) => (
                <Link key={u!.id} href={`/settings/members/${u!.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F9FAFB]">
                  <Avatar u={u!} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[#111827] truncate">{u!.displayName || u!.email}</span>
                    <span className="block text-[11px] text-[#6B7280] truncate">{u!.email}</span>
                  </span>
                  {(viewing.leaders ?? []).includes(u!.id) && <span className="flex items-center gap-1 text-[10px] font-bold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full"><Star size={10} /> {t("groups.leaderBadge")}</span>}
                </Link>
              ))}
              {viewing.members.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-6">{t("groups.noMembers")}</p>}
            </div>
            <div className="flex justify-end px-7 py-4 border-t border-[#F3F4F6]">
              <button onClick={() => { const g = viewing; setViewing(null); open(g); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"><Pencil size={14} /> {t("groups.edit")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / edit */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-7 pt-6 pb-4">
              <p className="text-lg font-semibold text-[#111827]">{editing === "new" ? t("groups.addNew") : t("groups.edit")}</p>
              <button onClick={() => setEditing(null)} aria-label={t("common.close")} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={18} /></button>
            </div>
            <div className="px-7 pb-2 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm text-[#111827] mb-2">{t("groups.name")}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Community Prayer" className={INPUT} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#111827] mb-2">{t("events.category")}</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT + " cursor-pointer"}>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#111827] mb-2">{t("study.status")}</label>
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-[#E5E7EB]">
                    <span className="text-sm text-[#374151]">{active ? t("groups.filter.active") : t("groups.filter.inactive")}</span>
                    <Toggle checked={active} onChange={setActive} label={t("groups.activeLabel")} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#111827] mb-2">{t("planUpload.description")}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t("groups.descPlaceholder")} className={INPUT + " resize-none"} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-[#111827]">{t("nav.members")}</label>
                  <span className="text-xs text-[#6B7280]">{selected.length} selected · tap ★ for key members (up to 2)</span>
                </div>
                <div className="relative mb-2">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder={t("ann.searchMember")} className={INPUT + " pl-10 py-2.5"} />
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
                  {memberMatches.length === 0 && <p className="text-xs text-[#9CA3AF] p-4 text-center">{t("ann.noMember")}</p>}
                  {memberMatches.map((u) => {
                    const on = selected.includes(u.id);
                    const lead = leaders.includes(u.id);
                    return (
                      <div key={u.id} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${on ? "bg-[#EEF1F8]" : "hover:bg-[#F9FAFB]"}`}>
                        <button type="button" onClick={() => toggleMember(u.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <Avatar u={u} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-[#111827] truncate">{u.displayName || u.email}</span>
                            {u.displayName && <span className="block text-[11px] text-[#9CA3AF] truncate">{u.email}</span>}
                          </span>
                          <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${on ? "bg-[#1E3A8A] border-[#1E3A8A] text-white" : "border-[#D1D5DB]"}`}>{on && <Check size={12} />}</span>
                        </button>
                        <button type="button" onClick={() => toggleLeader(u.id)} aria-label={lead ? t("groups.removeKey") : t("groups.markKey")}
                          className={`p-1 rounded-md ${lead ? "text-[#F59E0B]" : "text-[#D1D5DB] hover:text-[#F59E0B]"}`}>
                          <Star size={16} className={lead ? "fill-current" : ""} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-7 py-5 border-t border-[#F3F4F6] mt-3">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-[#374151]">{t("common.cancel")}</button>
              <button onClick={save} disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B] disabled:opacity-50">
                {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {editing === "new" ? t("groups.create") : t("prefs.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
