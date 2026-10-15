"use client";
import React from "react";
import Link from "next/link";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import { usePublicSettings } from "@/lib/publicSettings";

// lucide-react 1.x no longer ships brand icons.
type IconProps = { size?: number };
const Facebook = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z" />
  </svg>
);
const Youtube = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9L15.5 12l-5.7 3.1z" />
  </svg>
);
const Instagram = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function PublicFooter() {
  const s = usePublicSettings();
  const socials = [
    { Icon: Facebook,  href: s.facebookUrl,  label: "Facebook" },
    { Icon: Youtube,   href: s.youtubeUrl,   label: "YouTube" },
    { Icon: Instagram, href: s.instagramUrl, label: "Instagram" },
    { Icon: Send,      href: s.telegramUrl,  label: "Telegram" },
  ].filter((x) => x.href);

  return (
    <footer className="bg-[#1B2E6B] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16 mb-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center mb-5">
              <img src="/Logo-White.png" alt="Nablis" className="h-12 w-auto" />
            </Link>
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              Dedicated to spiritual growth, community building, and faith guidance through compassionate Orthodox ministry.
            </p>
            {socials.length > 0 && (
              <div className="flex gap-2">
                {socials.map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-[#F5C518] hover:text-[#1B2E6B] transition-colors"
                    aria-label={label}
                  >
                    <Icon size={15} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Quick Links</h3>
            <ul className="space-y-2.5">
              {LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-white/60 text-sm hover:text-[#F5C518] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone size={15} className="text-[#F5C518] mt-0.5 flex-shrink-0" />
                <a
                  href={`tel:${s.contactPhone.replace(/\s+/g, "")}`}
                  className="text-white/60 text-sm hover:text-[#F5C518] transition-colors"
                >
                  {s.contactPhone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={15} className="text-[#F5C518] mt-0.5 flex-shrink-0" />
                <a
                  href={`mailto:${s.contactEmail}`}
                  className="text-white/60 text-sm hover:text-[#F5C518] transition-colors"
                >
                  {s.contactEmail}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={15} className="text-[#F5C518] mt-0.5 flex-shrink-0" />
                <span className="text-white/60 text-sm">{s.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} Nablis Ministry. All rights reserved.
          </p>
          <Link href="/login" className="text-white/40 text-xs hover:text-white/70 transition-colors">
            Member Sign In
          </Link>
        </div>
      </div>
    </footer>
  );
}
