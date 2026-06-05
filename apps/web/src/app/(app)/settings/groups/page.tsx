"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, where,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { Plus, Trash2, X, Users } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  createdAt?: unknown;
}

interface UserOption { id: string; displayName: string; email: string; }

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors bg-white";

export default function GroupsPage() {
  const { role } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "groups")),
      getDocs(query(collection(db, "users"), where("status", "==", "active"))),
    ]).then(([gSnap, uSnap]) => {
      setGroups(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
      setUsers(uSnap.docs.map((d) => ({
        id: d.id,
        displayName: d.data().displayName ?? "",
        email: d.data().email ?? "",
      })));
    }).finally(() => setLoading(false));
  }, []);

  async function createGroup() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "groups"), {
        name: name.trim(),
        description: description.trim(),
        members: selectedMembers,
        createdAt: serverTimestamp(),
      });
      setGroups((p) => [...p, { id: ref.id, name: name.trim(), description: description.trim(), members: selectedMembers }]);
      setName(""); setDescription(""); setSelectedMembers([]); setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm("Delete this group?")) return;
    await deleteDoc(doc(db, "groups", id));
    setGroups((p) => p.filter((g) => g.id !== id));
  }

  async function removeMember(groupId: string, memberId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const updated = group.members.filter((m) => m !== memberId);
    await updateDoc(doc(db, "groups", groupId), { members: updated });
    setGroups((p) => p.map((g) => g.id === groupId ? { ...g, members: updated } : g));
  }

  if (role !== "super_admin") {
    return <div className="py-16 text-center text-[#9CA3AF] text-sm">Only super admins can manage groups.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Groups</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Manage ministry groups and their members</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
          <Plus size={15} /> New Group
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : groups.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-[#E5E7EB]">
          <Users size={36} className="mx-auto mb-2 text-[#9CA3AF] opacity-30" />
          <p className="text-sm text-[#9CA3AF]">No groups yet. Create your first group.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const memberUsers = users.filter((u) => g.members.includes(u.id));
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-[#1B2E6B] font-semibold text-sm">{g.name}</h3>
                    {g.description && <p className="text-[#9CA3AF] text-xs mt-0.5">{g.description}</p>}
                  </div>
                  <button onClick={() => deleteGroup(g.id)}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-red-50 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {memberUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-1.5 bg-[#EEF1F8] rounded-lg px-2.5 py-1.5 text-xs text-[#374151]">
                      <span>{u.displayName || u.email}</span>
                      <button onClick={() => removeMember(g.id, u.id)} className="text-[#9CA3AF] hover:text-red-500 transition-colors"><X size={11} /></button>
                    </div>
                  ))}
                  {memberUsers.length === 0 && <p className="text-[#9CA3AF] text-xs">No members yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
              <h3 className="text-[#1B2E6B] font-bold">Create Group</h3>
              <button onClick={() => setShowForm(false)} className="text-[#9CA3AF] hover:text-[#6B7280]"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Group Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Youth Ministry" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  placeholder="What is this group for?" className={INPUT + " resize-none"} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">Members</label>
                <div className="max-h-40 overflow-y-auto border border-[#E5E7EB] rounded-xl p-2 space-y-1">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-[#1B2E6B]"
                        checked={selectedMembers.includes(u.id)}
                        onChange={(e) => setSelectedMembers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} />
                      <span className="text-xs text-[#374151]">{u.displayName || u.email}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={createGroup} disabled={saving || !name.trim()}
                className="w-full flex items-center justify-center gap-2 bg-[#1B2E6B] text-white font-semibold py-2.5 rounded-xl hover:bg-[#162554] disabled:opacity-60 transition-colors text-sm">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
