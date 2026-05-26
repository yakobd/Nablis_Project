"use client";
import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

export interface GalleryItemData {
  id: string;
  imageURL: string;
  title: string;
  category: string;
}

interface GalleryGridProps {
  items: GalleryItemData[];
}

export function GalleryGrid({ items }: GalleryGridProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(
    () => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)),
    []
  );
  const next = useCallback(
    () =>
      setLightboxIdx((i) =>
        i !== null && i < items.length - 1 ? i + 1 : i
      ),
    [items.length]
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [lightboxIdx, close, prev, next]);

  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-[#9CA3AF]">
        <p className="text-5xl mb-3">🖼️</p>
        <p className="text-lg font-medium">No photos yet</p>
        <p className="text-sm mt-1">Check back soon for photos from our community.</p>
      </div>
    );
  }

  return (
    <>
      {/* Masonry grid */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="break-inside-avoid cursor-pointer group relative overflow-hidden rounded-xl bg-[#EEF1F8]"
            onClick={() => setLightboxIdx(idx)}
          >
            <img
              src={item.imageURL}
              alt={item.title}
              className="w-full block group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-end">
              <div className="p-3 w-full translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                <p className="text-white text-xs font-medium truncate">{item.title}</p>
              </div>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <ZoomIn size={13} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center p-4"
          onClick={close}
        >
          {/* Close */}
          <button
            onClick={close}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* Prev */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
              aria-label="Previous"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Next */}
          {lightboxIdx < items.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
              aria-label="Next"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Image */}
          <img
            src={items[lightboxIdx].imageURL}
            alt={items[lightboxIdx].title}
            className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {/* Caption */}
          <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
            <p className="text-white font-medium text-sm">{items[lightboxIdx].title}</p>
            <p className="text-white/50 text-xs mt-0.5">
              {lightboxIdx + 1} / {items.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
