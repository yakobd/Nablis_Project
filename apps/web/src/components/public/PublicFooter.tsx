import React from "react";
import Link from "next/link";
import { Phone, Mail, MapPin, Facebook, Youtube, Instagram } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function PublicFooter() {
  return (
    <footer className="bg-[#1B2E6B] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16 mb-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#F5C518] flex items-center justify-center">
                <span className="text-[#1B2E6B] font-bold text-base leading-none">ን</span>
              </div>
              <div className="leading-tight">
                <p className="font-bold text-white text-[15px] leading-tight">ናቡስ</p>
                <p className="text-[10px] text-white/50 leading-tight tracking-wide">Nablis Ministry</p>
              </div>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              Dedicated to spiritual growth, community building, and faith guidance through compassionate Orthodox ministry.
            </p>
            <div className="flex gap-2">
              {[
                { Icon: Facebook, href: "#" },
                { Icon: Youtube, href: "#" },
                { Icon: Instagram, href: "#" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-[#F5C518] hover:text-[#1B2E6B] transition-colors"
                  aria-label="Social link"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
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
                  href="tel:+971564983456"
                  className="text-white/60 text-sm hover:text-[#F5C518] transition-colors"
                >
                  +971 56 498 3456
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={15} className="text-[#F5C518] mt-0.5 flex-shrink-0" />
                <a
                  href="mailto:info@nablis.com"
                  className="text-white/60 text-sm hover:text-[#F5C518] transition-colors"
                >
                  info@nablis.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={15} className="text-[#F5C518] mt-0.5 flex-shrink-0" />
                <span className="text-white/60 text-sm">Dubai, United Arab Emirates</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/40 text-sm">
            © 2024 Nablis Ministry. All rights reserved.
          </p>
          <div className="flex gap-5">
            <a href="#" className="text-white/40 text-xs hover:text-white/70 transition-colors">Privacy Policy</a>
            <a href="#" className="text-white/40 text-xs hover:text-white/70 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
