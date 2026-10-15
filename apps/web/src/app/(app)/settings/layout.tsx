"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";
import { UserCircle2, Settings2, Bell, Building2, Users, UserPlus, Folder } from "lucide-react";

interface NavLinkDef {
  href: string;
  /** settingsNav.* translation key */
  label: string;
  Icon: typeof Bell;
  superAdminOnly?: boolean;
}

const ACCOUNT_LINKS: NavLinkDef[] = [
  { href: "/settings/profile",       label: "profile",       Icon: UserCircle2 },
  { href: "/settings/preferences",   label: "preferences",   Icon: Settings2 },
  { href: "/settings/notifications", label: "notifications", Icon: Bell },
];

const WORKSPACE_LINKS: NavLinkDef[] = [
  { href: "/settings/general",     label: "general",     Icon: Building2, superAdminOnly: true },
  { href: "/settings/members/new", label: "newMembers", Icon: UserPlus },
  { href: "/settings/members",     label: "members",     Icon: Users },
  { href: "/settings/groups",      label: "groups",      Icon: Folder, superAdminOnly: true },
];

function NavLink({ href, label, Icon, active }: NavLinkDef & { active: boolean }) {
  const { t } = useTranslation();
  return (
    <Link href={href}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap ${active ? "bg-[#F3F4F6] text-[#1E3A8A] font-semibold" : "text-[#374151] hover:bg-[#F9FAFB] hover:text-[#1E3A8A]"}`}>
      <Icon size={17} className={active ? "text-[#1E3A8A]" : "text-[#6B7280]"} />
      {t(`settingsNav.${label}`)}
    </Link>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const isStaff = isSuperAdmin || role === "admin";
  const { t } = useTranslation();

  function isActive(href: string) {
    if (href === "/settings/members") {
      // /settings/members/new has its own entry.
      return pathname.startsWith("/settings/members") && !pathname.startsWith("/settings/members/new");
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1>{t("settingsNav.title")}</h1>
        <p>{t("settingsNav.subtitle")}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <aside className="w-full lg:w-72 flex-shrink-0 bg-white rounded-3xl shadow-sm overflow-hidden lg:sticky lg:top-24 lg:min-h-[560px]">
          <div className="flex items-center gap-3 px-6 py-5 border-b-4 border-[#F3F4F6]">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-11 h-11 rounded-full object-cover" />
              : <span className="w-11 h-11 rounded-full bg-[#EEF1F8] text-[#1E3A8A] font-bold flex items-center justify-center">{(user?.displayName || user?.email || "?")[0].toUpperCase()}</span>}
            <p className="font-semibold text-[#111827] truncate">{user?.displayName || user?.email}</p>
          </div>
          <nav className="p-4 flex lg:block gap-1 overflow-x-auto">
            <p className="hidden lg:block px-3.5 pt-2 pb-2 text-[11px] font-semibold tracking-widest text-[#6B7280] uppercase">{t("settingsNav.yourAccount")}</p>
            {ACCOUNT_LINKS.map((l) => <NavLink key={l.href} {...l} active={isActive(l.href)} />)}
            {isStaff && (
              <>
                <p className="hidden lg:block px-3.5 pt-6 pb-2 text-[11px] font-semibold tracking-widest text-[#6B7280] uppercase">{t("settingsNav.workspace")}</p>
                {WORKSPACE_LINKS.filter((l) => isSuperAdmin || !l.superAdminOnly).map((l) => <NavLink key={l.href} {...l} active={isActive(l.href)} />)}
              </>
            )}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 w-full">{children}</div>
      </div>
    </div>
  );
}
