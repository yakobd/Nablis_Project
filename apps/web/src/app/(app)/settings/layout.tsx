"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase";
import { User, Sliders, Bell, Building2, Users, UserPlus, Group } from "lucide-react";

interface NavLinkDef {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const ACCOUNT_LINKS: NavLinkDef[] = [
  { href: "/settings/profile",       label: "Profile",       icon: <User size={15} /> },
  { href: "/settings/preferences",   label: "Preferences",   icon: <Sliders size={15} /> },
  { href: "/settings/notifications", label: "Notifications", icon: <Bell size={15} /> },
];

const WORKSPACE_LINKS: NavLinkDef[] = [
  { href: "/settings/general",      label: "General",      icon: <Building2 size={15} />, adminOnly: true },
  { href: "/settings/members",      label: "Members",      icon: <Users size={15} />,    adminOnly: true },
  { href: "/settings/members/new",  label: "New Members",  icon: <UserPlus size={15} />, adminOnly: true },
  { href: "/settings/groups",       label: "Groups",       icon: <Group size={15} />,    adminOnly: true },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
      {children}
    </p>
  );
}

function NavLink({ href, label, icon, active }: NavLinkDef & { active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
        active
          ? "bg-[#1B2E6B] text-white"
          : "text-[#6B7280] hover:bg-[#EEF1F8] hover:text-[#1B2E6B]",
      ].join(" ")}
    >
      <span className={active ? "text-white" : "text-[#9CA3AF]"}>{icon}</span>
      {label}
    </Link>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  function isActive(href: string) {
    if (href === "/settings/members") {
      // Exact match so /settings/members/new doesn't activate it
      return pathname === "/settings/members";
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Sub-nav */}
      <aside className="w-52 flex-shrink-0 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-3 self-start sticky top-0">
        <SectionLabel>Your Account</SectionLabel>
        {ACCOUNT_LINKS.map((link) => (
          <NavLink key={link.href} {...link} active={isActive(link.href)} />
        ))}

        {isAdmin && (
          <>
            <SectionLabel>Workspace</SectionLabel>
            {WORKSPACE_LINKS.map((link) => (
              <NavLink key={link.href} {...link} active={isActive(link.href)} />
            ))}
          </>
        )}
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
