"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Public-facing ministry info, edited in Settings › General (settings/general).
export interface PublicSettings {
  contactEmail: string;
  contactPhone: string;
  address: string;
  facebookUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  telegramUrl: string;
  playStoreUrl: string;
  appStoreUrl: string;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  contactEmail: "nablis.info@gmail.com",
  contactPhone: "+251912872622",
  address: "Dubai, United Arab Emirates",
  facebookUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
  telegramUrl: "",
  playStoreUrl: "",
  appStoreUrl: "",
};

let cache: Promise<PublicSettings> | null = null;

function load(): Promise<PublicSettings> {
  cache ??= getDoc(doc(db, "settings", "general"))
    .then((snap) => {
      const d = snap.exists() ? snap.data() : {};
      const out = { ...DEFAULT_PUBLIC_SETTINGS };
      (Object.keys(out) as (keyof PublicSettings)[]).forEach((k) => {
        if (typeof d[k] === "string" && d[k].trim()) out[k] = d[k].trim();
      });
      return out;
    })
    .catch(() => DEFAULT_PUBLIC_SETTINGS);
  return cache;
}

export function usePublicSettings(): PublicSettings {
  const [settings, setSettings] = useState(DEFAULT_PUBLIC_SETTINGS);
  useEffect(() => {
    load().then(setSettings);
  }, []);
  return settings;
}
