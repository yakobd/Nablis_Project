"use client";
import React, { useEffect, useState } from "react";
import { Languages, Copy, Highlighter, Check } from "lucide-react";
import { useTranslation } from "@nablis/i18n";

/**
 * Floating "Translate · Copy · Highlight" bar shown above selected text inside
 * `containerRef` (as in the design). Highlight is only offered when editing.
 */
export function SelectionToolbar({
  containerRef,
  onHighlight,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onHighlight?: () => void;
}) {
  const { t } = useTranslation();
  const [pos, setPos] = useState<{ top: number; left: number; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function update() {
      const sel = window.getSelection();
      const container = containerRef.current;
      if (!sel || sel.isCollapsed || !container || !sel.rangeCount) { setPos(null); return; }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { setPos(null); return; }
      const rect = range.getBoundingClientRect();
      const box = container.getBoundingClientRect();
      setPos({ top: rect.top - box.top - 48, left: rect.left - box.left + rect.width / 2, text: sel.toString() });
      setCopied(false);
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [containerRef]);

  if (!pos || !pos.text.trim()) return null;

  const btn = "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold";
  return (
    <div
      className="absolute z-20 -translate-x-1/2 flex items-center gap-1 bg-[#111827] text-white rounded-lg shadow-xl px-1.5 py-1 animate-scale-in"
      style={{ top: Math.max(pos.top, -8), left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className={`${btn} hover:bg-white/10`}
        onClick={() => window.open(`https://translate.google.com/?sl=auto&tl=am&text=${encodeURIComponent(pos.text)}&op=translate`, "_blank", "noopener")}>
        <Languages size={13} /> {t("toolbar.translate")}
      </button>
      <span className="w-px h-4 bg-white/20" />
      <button className={`${btn} hover:bg-white/10`}
        onClick={() => navigator.clipboard.writeText(pos.text).then(() => setCopied(true)).catch(() => {})}>
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t("toolbar.copied") : t("toolbar.copy")}
      </button>
      {onHighlight && (
        <>
          <span className="w-px h-4 bg-white/20" />
          <button className={`${btn} bg-[#F5C518] text-[#111827] hover:bg-[#e6b800]`} onClick={onHighlight}>
            <Highlighter size={13} /> {t("toolbar.highlight")}
          </button>
        </>
      )}
    </div>
  );
}
