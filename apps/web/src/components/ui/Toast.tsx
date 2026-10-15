"use client";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

interface ToastOptions {
  message: string;
  type?: "success" | "error";
  /** e.g. "Undo" */
  actionLabel?: string;
  onAction?: () => void;
  /** e.g. "View Appointment" */
  linkLabel?: string;
  onLink?: () => void;
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

// Dark floating toast in the bottom-right corner (per the design).
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.id} role="status"
          className="fixed bottom-6 right-6 z-[60] flex items-start gap-3 bg-[#111827] text-white rounded-2xl shadow-2xl px-5 py-4 min-w-[300px] max-w-sm animate-scale-in">
          {toast.type === "error"
            ? <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="text-sm font-medium">{toast.message}</p>
            {(toast.actionLabel || toast.linkLabel) && (
              <div className="flex gap-5 mt-1 text-xs">
                {toast.actionLabel && (
                  <button className="text-white/70 hover:text-white"
                    onClick={() => { toast.onAction?.(); setToast(null); }}>
                    {toast.actionLabel}
                  </button>
                )}
                {toast.linkLabel && (
                  <button className="text-[#8B9CFF] hover:text-white"
                    onClick={() => { toast.onLink?.(); setToast(null); }}>
                    {toast.linkLabel}
                  </button>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setToast(null)} className="text-white/50 hover:text-white" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
