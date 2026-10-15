"use client";
import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { X, ShieldCheck, Download } from "lucide-react";
import { useAuth, ensurePassCode, memberPassValue } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";

// The member's personal QR pass. Staff scan it at the door to check them in.
export function MemberPassModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(user?.passCode ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user || code) return;
    ensurePassCode(user).then(setCode).catch(() => setError(true));
  }, [user, code]);

  const qrCanvas = useRef<HTMLCanvasElement>(null);

  if (!user) return null;
  const name = user.displayName || user.email;

  // Saves the pass as a PNG card (logo, QR and name) the member can keep on their phone or print.
  async function download() {
    const qr = qrCanvas.current;
    if (!qr) return;
    const W = 720, H = 1000;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#1B2E6B"; g.fillRect(0, 0, W, 300);
    const logo = new Image();
    logo.src = "/Logo-White.png";
    await new Promise((r) => { logo.onload = r; logo.onerror = r; });
    if (logo.naturalWidth) {
      const lh = 80, lw = (logo.naturalWidth / logo.naturalHeight) * lh;
      g.drawImage(logo, (W - lw) / 2, 60, lw, lh);
    }
    g.textAlign = "center";
    g.fillStyle = "#F5C518"; g.font = "bold 26px sans-serif";
    g.fillText(t("pass.title"), W / 2, 200);
    g.fillStyle = "#FFFFFF";
    g.fillRect(W / 2 - 250, 240, 500, 500);
    g.drawImage(qr, W / 2 - 230, 260, 460, 460);
    g.fillStyle = "#111827"; g.font = "600 36px sans-serif";
    g.fillText(name ?? "", W / 2, 820, W - 80);
    g.fillStyle = "#6B7280"; g.font = "24px sans-serif";
    g.fillText(t("pass.active"), W / 2, 870);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `nablis-pass-${(name ?? "member").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30" aria-label={t("common.close")}><X size={16} /></button>
        <div className="bg-[#1B2E6B] px-6 pt-6 pb-16 text-center text-white">
          <img src="/Logo-White.png" alt="Nablis" className="h-10 w-auto mx-auto" />
          <p className="text-[11px] font-bold tracking-[0.25em] text-[#F5C518] mt-3">{t("pass.title")}</p>
        </div>
        <div className="-mt-12 px-6 pb-7 text-center">
          <div className="inline-block bg-white rounded-2xl p-4 shadow-xl border border-[#EEF1F8]">
            {code ? (
              <>
                <QRCodeSVG value={memberPassValue(user.id, code)} size={200} fgColor="#1B2E6B" level="M" />
                <QRCodeCanvas ref={qrCanvas} value={memberPassValue(user.id, code)} size={460} fgColor="#1B2E6B" level="M" className="hidden" />
              </>
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center text-sm text-[#9CA3AF]">
                {error ? t("pass.error") : <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin" />}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 mt-5">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="w-11 h-11 rounded-full object-cover" />
              : <span className="w-11 h-11 rounded-full bg-[#EEF1F8] text-[#1B2E6B] font-bold flex items-center justify-center">{name[0].toUpperCase()}</span>}
            <div className="text-left">
              <p className="font-semibold text-[#111827]">{name}</p>
              <p className="text-xs text-[#6B7280] flex items-center gap-1"><ShieldCheck size={12} className="text-[#16A34A]" /> {t("pass.active")}</p>
            </div>
          </div>
          <p className="text-xs text-[#6B7280] mt-5 leading-relaxed">
            {t("pass.hint")}
          </p>
          <button onClick={download} disabled={!code}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#162554] disabled:opacity-50">
            <Download size={15} /> {t("pass.download")}
          </button>
        </div>
      </div>
    </div>
  );
}
