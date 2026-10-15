"use client";
import React, { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";

/**
 * Continuous camera QR scanner (html5-qrcode, loaded on demand). Calls
 * onScan for every new code; the same code is ignored for `cooldownMs` so a
 * pass held in front of the camera isn't processed repeatedly.
 */
export function QrScanner({
  onScan,
  paused = false,
  cooldownMs = 3000,
}: {
  onScan: (value: string) => void;
  paused?: boolean;
  cooldownMs?: number;
}) {
  const elId = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const last = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);
  onScanRef.current = onScan;
  pausedRef.current = paused;

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void; isScanning?: boolean } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(elId.current, { verbose: false });
        scanner = s as unknown as typeof scanner;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (text) => {
            if (pausedRef.current) return;
            const now = Date.now();
            if (text === last.current.value && now - last.current.at < cooldownMs) return;
            last.current = { value: text, at: now };
            onScanRef.current(text);
          },
          () => {}
        );
      } catch (e) {
        setError(e instanceof Error && /permission|denied|NotAllowed/i.test(e.message)
          ? "Camera access was blocked. Allow the camera in your browser settings and reload."
          : "No camera found. Use manual check-in below, or open this page on a phone.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner?.isScanning !== false) scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [cooldownMs]);

  return (
    <div className="relative w-full aspect-square max-w-[420px] mx-auto rounded-2xl overflow-hidden bg-[#0B1430]">
      <div id={elId.current} className="w-full h-full [&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full" />
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-white/80 p-6">
          <CameraOff size={32} />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-[62%] aspect-square rounded-2xl border-[3px] border-[#F5C518] shadow-[0_0_0_9999px_rgba(11,20,48,0.35)]">
            <div className="absolute left-2 right-2 h-0.5 bg-[#F5C518]/80 animate-[scanline_2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}
      {paused && !error && <div className="absolute inset-0 bg-[#0B1430]/60" />}
    </div>
  );
}
