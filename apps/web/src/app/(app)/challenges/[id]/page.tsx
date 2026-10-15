"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, CalendarDays, Check, Minus, Pencil, Plus, Trash2, Trophy, Users, LogOut } from "lucide-react";
import {
  db, useAuth, addChallengeCount, challengeCategory, challengeDays, challengeProgressId, challengeStatus, challengeTotals,
  joinChallenge, setChallengeDay, setChallengeStep, toIsoDate, type ChallengeDoc, type ChallengeProgress,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { ChallengeFormModal } from "../_components/ChallengeFormModal";
import { STATUS_PILL, daysLeft, fmtRange } from "../_components/ChallengeCard";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";
import { challengeIcon } from "@/lib/challengeIcons";

function Ring({ pct, complete }: { pct: number; complete: boolean }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="w-36 h-36" role="img" aria-label={`${pct}% complete`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#F3F4F6" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={complete ? "#F5C518" : "#1E3A8A"} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }} />
      <text x="50" y="56" textAnchor="middle" fontSize="20" fontWeight="800" fill="#111827">{pct}%</text>
    </svg>
  );
}

export default function ChallengePage() {
  const { t: tr } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [c, setC] = useState<ChallengeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<ChallengeProgress | null>(null);
  const [all, setAll] = useState<ChallengeProgress[]>([]);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const today = toIsoDate(new Date());

  useEffect(() => {
    if (!user || !id) return;
    const u1 = onSnapshot(doc(db, "challenges", id), (snap) => {
      setC(snap.exists() ? ({ id: snap.id, ...snap.data() } as ChallengeDoc) : null);
      setLoading(false);
    }, () => setLoading(false));
    const u2 = onSnapshot(doc(db, "challengeProgress", challengeProgressId(id, user.id)), (snap) => {
      setMine(snap.exists() ? ({ id: snap.id, ...snap.data() } as ChallengeProgress) : null);
    }, () => {});
    const u3 = isStaff
      ? onSnapshot(query(collection(db, "challengeProgress"), where("challengeId", "==", id)), (snap) => {
          setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeProgress)));
        }, () => {})
      : () => {};
    return () => { u1(); u2(); u3(); };
  }, [user, id, isStaff]);

  const participants = useMemo(() => {
    if (!c) return [];
    return all.map((p) => ({ p, t: challengeTotals(c, p) })).sort((a, b) => b.t.pct - a.t.pct);
  }, [all, c]);

  if (!user) return null;
  if (loading) return <div className="py-24"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!c) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center">
        <p className="text-[#374151] font-medium">This challenge is no longer available.</p>
        <Link href="/challenges" className="inline-block mt-4 text-sm font-semibold text-[#1E3A8A]">Back to Challenges</Link>
      </div>
    );
  }

  const challenge = c;
  const cat = challengeCategory(challenge.category);
  const status = challengeStatus(challenge, today);
  const totals = challengeTotals(challenge, mine);
  const joined = !!mine;
  const canTrack = joined && status !== "upcoming";
  const days = challenge.kind === "daily" ? challengeDays(challenge) : [];
  const doneDays = new Set(mine?.days ?? []);

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    const wasComplete = totals.complete;
    try {
      await fn();
      if (success) toast({ message: success });
    } catch {
      toast({ message: tr("testimony.saveError"), type: "error" });
    } finally {
      setBusy(false);
    }
    return wasComplete;
  }

  async function join() {
    await run(() => joinChallenge(challenge, user!), status === "upcoming" ? tr("challenge.inUpcoming") : tr("challenge.inActive"));
  }

  async function leave() {
    if (!confirm(tr("challenge.leaveConfirm"))) return;
    await run(() => deleteDoc(doc(db, "challengeProgress", challengeProgressId(challenge.id, user!.id))), tr("challenge.left"));
  }

  async function removeChallenge() {
    if (!confirm(tr("challenge.deleteConfirm", { title: challenge.title }))) return;
    try {
      await deleteDoc(doc(db, "challenges", challenge.id));
      toast({ message: tr("challenge.deleted") });
      router.push("/challenges");
    } catch {
      toast({ message: tr("challenge.deleteError"), type: "error" });
    }
  }

  // Celebrate the moment the last unit is done.
  function celebrateIf(nextDone: number) {
    if (!totals.complete && nextDone >= totals.total) toast({ message: tr("challenge.celebrate", { title: challenge.title }) });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/challenges" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A]"><ArrowLeft size={16} /> {tr("nav.challenges")}</Link>

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1E3A8A] to-[#1B2E6B] text-white shadow-[0_20px_40px_-24px_rgba(30,58,138,0.9)] animate-fade-up">
        {challenge.imageURL && <img src={challenge.imageURL} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
        <div className="relative p-7 sm:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              {React.createElement(challengeIcon(cat.key), { size: 26, className: "text-[#F5C518]" })}
              <span className="text-xs font-semibold uppercase tracking-widest text-[#F5C518]">{tr(`challengeCat.${cat.key}`)}</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_PILL[status]}`}>
                {status === "active" ? tr("challenge.daysLeft", { count: daysLeft(challenge) }) : tr(`challengeStatus.${status}`)}
              </span>
            </div>
            <h1 className="!text-white !text-3xl sm:!text-4xl mt-3">{challenge.title}</h1>
            <p className="flex items-center gap-1.5 text-sm !text-white/75 mt-3"><CalendarDays size={15} /> {fmtRange(challenge)}</p>
            {challenge.description && <p className="text-white/85 mt-4 leading-relaxed whitespace-pre-line">{challenge.description}</p>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {isStaff && (
              <>
                <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 text-sm font-semibold hover:bg-white/25"><Pencil size={14} /> {tr("common.edit")}</button>
                <button onClick={removeChallenge} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 text-sm font-semibold hover:bg-[#DC2626]"><Trash2 size={14} /> {tr("common.delete")}</button>
              </>
            )}
            {!joined && status !== "ended" && (
              <button onClick={join} disabled={busy} className="px-7 py-3 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800] disabled:opacity-60">{tr("challenge.joinButton")}</button>
            )}
          </div>
        </div>
      </div>

      {/* Member tracker */}
      {joined && (
        <div className="grid md:grid-cols-[260px_1fr] gap-6">
          <div className="bg-white rounded-3xl shadow-sm p-6 flex flex-col items-center text-center">
            <Ring pct={totals.pct} complete={totals.complete} />
            <p className="font-semibold text-[#111827] mt-3">
              {totals.complete ? tr("challenge.complete") : tr("challenge.progressOf", { done: totals.done, total: totals.total, unit: challenge.kind === "goal" ? challenge.unit ?? "" : challenge.kind === "daily" ? tr("challenge.days") : tr("challenge.steps") })}
            </p>
            {totals.complete
              ? <p className="flex items-center gap-1.5 text-sm text-[#B45309] mt-1"><Trophy size={15} /> {tr("challenge.wellDone")}</p>
              : <p className="text-sm text-[#6B7280] mt-1">{status === "upcoming" ? tr("challenge.startsSoon") : status === "ended" ? tr("challenge.ended") : tr("challenge.keepGoing")}</p>}
            <button onClick={leave} className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#DC2626] mt-5"><LogOut size={13} /> {tr("challenge.leave")}</button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-6">
            {challenge.kind === "daily" && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-lg font-semibold text-[#111827]">{tr("challenge.yourDays")}</p>
                  {canTrack && status === "active" && (
                    <button onClick={() => { celebrateIf(totals.done + (doneDays.has(today) ? -1 : 1)); run(() => setChallengeDay(challenge, user, today, !doneDays.has(today))); }} disabled={busy}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold ${doneDays.has(today) ? "bg-[#22C55E] text-white" : "bg-[#F5C518] text-[#1B2E6B] hover:bg-[#e6b800]"}`}>
                      <Check size={16} className={doneDays.has(today) ? "animate-pop" : ""} /> {doneDays.has(today) ? tr("challenge.doneToday") : tr("challenge.markToday")}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-10 gap-2 mt-5">
                  {days.map((d, i) => {
                    const done = doneDays.has(d);
                    const future = d > today;
                    return (
                      <button key={d} disabled={!canTrack || future || busy}
                        onClick={() => { if (!done) celebrateIf(totals.done + 1); run(() => setChallengeDay(challenge, user, d, !done)); }}
                        title={new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" })}
                        className={`aspect-square rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all ${done ? "bg-[#1E3A8A] text-white" : d === today ? "bg-[#FEF9C3] ring-2 ring-[#F5C518] text-[#111827]" : future ? "bg-[#F9FAFB] text-[#D1D5DB]" : "bg-[#FEF2F2] text-[#B91C1C] hover:scale-105"}`}>
                        {done ? <Check size={14} /> : i + 1}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-3">{tr("challenge.tapPast")}</p>
              </>
            )}

            {challenge.kind === "goal" && (
              <>
                <p className="text-lg font-semibold text-[#111827]">{tr("challenge.log")}</p>
                <p className="font-display text-5xl font-bold text-[#111827] mt-4">{mine?.count ?? 0}<span className="text-xl text-[#9CA3AF] font-medium"> / {challenge.target} {challenge.unit}</span></p>
                {canTrack && (
                  <div className="flex flex-wrap items-center gap-2 mt-6">
                    {[1, 5].map((n) => (
                      <button key={n} onClick={() => { celebrateIf((mine?.count ?? 0) + n); run(() => addChallengeCount(challenge, user, n)); }} disabled={busy}
                        className="flex items-center gap-1 px-5 py-2.5 rounded-full bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B] disabled:opacity-60"><Plus size={15} /> {n}</button>
                    ))}
                    <div className="flex items-center gap-2 ml-2">
                      <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={tr("challenge.amount")}
                        className="w-20 px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:border-[#1E3A8A]" />
                      <button onClick={() => { const n = Math.round(Number(amount)); if (n > 0) { celebrateIf((mine?.count ?? 0) + n); run(() => addChallengeCount(challenge, user, n)); } }} disabled={busy || !(Number(amount) > 0)}
                        className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">{tr("challenge.add")}</button>
                    </div>
                    <button onClick={() => run(() => addChallengeCount(challenge, user, -1))} disabled={busy || (mine?.count ?? 0) <= 0} aria-label={tr("challenge.undo")}
                      className="ml-auto p-2.5 rounded-full text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30"><Minus size={16} /></button>
                  </div>
                )}
              </>
            )}

            {challenge.kind === "checklist" && (
              <>
                <p className="text-lg font-semibold text-[#111827]">{tr("challenge.stepsTitle")}</p>
                <div className="space-y-2 mt-4">
                  {(challenge.steps ?? []).map((s, i) => {
                    const done = (mine?.stepsDone ?? []).includes(i);
                    return (
                      <button key={i} disabled={!canTrack || busy}
                        onClick={() => { if (!done) celebrateIf(totals.done + 1); run(() => setChallengeStep(challenge, user, i, !done)); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-colors ${done ? "border-[#BBF7D0] bg-[#F0FDF4]" : "border-[#E5E7EB] hover:border-[#1E3A8A]/40"}`}>
                        <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${done ? "bg-[#22C55E] border-[#22C55E] text-white" : "border-[#D1D5DB]"}`}>{done && <Check size={14} />}</span>
                        <span className={`text-sm ${done ? "text-[#6B7280] line-through" : "text-[#111827]"}`}>{s}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {status === "upcoming" && <p className="text-sm text-[#6B7280] mt-4">{tr("challenge.trackingOpens")}</p>}
          </div>
        </div>
      )}

      {!joined && !isStaff && status === "ended" && (
        <div className="bg-white rounded-3xl p-8 text-center shadow-sm text-sm text-[#6B7280]">{tr("challenge.endedWatch")}</div>
      )}

      {/* Staff: participants */}
      {isStaff && (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-[#F3F4F6]">
            <p className="flex items-center gap-2 text-lg font-semibold text-[#111827]"><Users size={18} /> {tr("challenge.participants")} <span className="text-sm font-medium text-[#6B7280]">{participants.length}</span></p>
            <p className="text-sm text-[#6B7280]">{tr("challenge.summary", { done: participants.filter((x) => x.t.complete).length, avg: participants.length ? Math.round(participants.reduce((s, x) => s + x.t.pct, 0) / participants.length) : 0 })}</p>
          </div>
          {participants.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#9CA3AF]">{tr("challenge.noParticipants")}</p>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {participants.map(({ p, t }) => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-3.5">
                  <Link href={`/settings/members/${p.userId}`} className="w-48 truncate text-sm font-medium text-[#111827] hover:text-[#1E3A8A]">{p.userName || "Member"}</Link>
                  <div className="flex-1 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className={`h-full rounded-full ${t.complete ? "bg-[#F5C518]" : "bg-[#1E3A8A]"}`} style={{ width: `${t.pct}%` }} />
                  </div>
                  <span className="w-24 text-right text-sm text-[#374151]">{t.complete ? <span className="inline-flex items-center gap-1 text-[#B45309] font-semibold"><Trophy size={13} /> {tr("common.done")}</span> : `${t.pct}%`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && <ChallengeFormModal challenge={challenge} onClose={() => setEditing(false)} />}
    </div>
  );
}
