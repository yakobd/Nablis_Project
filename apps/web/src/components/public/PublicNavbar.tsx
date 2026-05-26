"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Calendar } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className={[
          "sticky top-0 z-50 w-full transition-all duration-200",
          scrolled ? "bg-white shadow-md" : "bg-white border-b border-[#E5E7EB]",
        ].join(" ")}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#1B2E6B] flex items-center justify-center shadow-sm">
              <span className="text-[#F5C518] font-bold text-base leading-none">ን</span>
            </div>
            <div className="leading-tight">
              <p className="text-[#1B2E6B] font-bold text-[15px] leading-tight">ናቡስ</p>
              <p className="text-[10px] text-[#9CA3AF] leading-tight tracking-wide">Nablis Ministry</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center" aria-label="Main">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-[#EEF1F8] text-[#1B2E6B]"
                    : "text-[#6B7280] hover:text-[#1B2E6B] hover:bg-[#EEF1F8]",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-2">
            <Link
              href="/contact"
              className="hidden sm:inline-flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] active:bg-[#d4a900] transition-colors flex-shrink-0"
            >
              <Calendar size={14} />
              Book Appointment
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 rounded-xl text-[#6B7280] hover:text-[#1B2E6B] hover:bg-[#EEF1F8] transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 top-16">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white shadow-xl w-full py-4 px-4 border-b border-[#E5E7EB]">
            <nav className="flex flex-col gap-1 mb-4" aria-label="Mobile">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive(href)
                      ? "bg-[#1B2E6B] text-white"
                      : "text-[#374151] hover:bg-[#EEF1F8] hover:text-[#1B2E6B]",
                  ].join(" ")}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <Link
              href="/contact"
              className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-3 rounded-xl hover:bg-[#e6b800] transition-colors"
            >
              <Calendar size={16} />
              Book Appointment
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
