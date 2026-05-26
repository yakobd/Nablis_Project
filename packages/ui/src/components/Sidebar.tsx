'use client';
import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Sun,
  Calendar,
  FileText,
  CalendarCheck,
  ClipboardList,
  Images,
  Quote,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

export type NavItemKey =
  | 'dashboard'
  | 'messaging'
  | 'bibleStudy'
  | 'dailyPrayers'
  | 'appointment'
  | 'blogs'
  | 'events'
  | 'attendance'
  | 'gallery'
  | 'testimonials'
  | 'settings';

export interface SidebarLabels
  extends Partial<Record<NavItemKey, string>> {
  logout?: string;
  appName?: string;
  appTagline?: string;
}

export interface SidebarProps {
  activeItem?: NavItemKey;
  onNavigate: (item: NavItemKey) => void;
  onLogout: () => void;
  labels?: SidebarLabels;
  badges?: Partial<Record<NavItemKey, number>>;
  className?: string;
}

interface NavEntry {
  key: NavItemKey;
  icon: LucideIcon;
  defaultLabel: string;
  section: 'main' | 'bottom';
}

const NAV_ENTRIES: NavEntry[] = [
  { key: 'dashboard',    icon: LayoutDashboard, defaultLabel: 'Dashboard',      section: 'main' },
  { key: 'messaging',    icon: MessageSquare,   defaultLabel: 'Messaging',      section: 'main' },
  { key: 'bibleStudy',   icon: BookOpen,        defaultLabel: 'Bible Study',    section: 'main' },
  { key: 'dailyPrayers', icon: Sun,             defaultLabel: 'Daily Prayers',  section: 'main' },
  { key: 'appointment',  icon: Calendar,        defaultLabel: 'Appointment',    section: 'main' },
  { key: 'blogs',        icon: FileText,        defaultLabel: 'Blogs',          section: 'main' },
  { key: 'events',       icon: CalendarCheck,   defaultLabel: 'Events',         section: 'main' },
  { key: 'attendance',   icon: ClipboardList,   defaultLabel: 'Attendance',     section: 'main' },
  { key: 'gallery',      icon: Images,          defaultLabel: 'Gallery',        section: 'main' },
  { key: 'testimonials', icon: Quote,           defaultLabel: 'Testimonials',   section: 'main' },
  { key: 'settings',     icon: Settings,        defaultLabel: 'Settings',       section: 'bottom' },
];

function NavItem({
  entry,
  isActive,
  label,
  badge,
  onClick,
}: {
  entry: NavEntry;
  isActive: boolean;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
        'transition-colors duration-150 group text-left',
        isActive
          ? 'bg-[#1B2E6B] text-white shadow-sm'
          : 'text-[#6B7280] hover:bg-[#EEF1F8] hover:text-[#1B2E6B]',
      ].join(' ')}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        size={18}
        className={[
          'flex-shrink-0 transition-colors',
          isActive ? 'text-white' : 'text-[#9CA3AF] group-hover:text-[#1B2E6B]',
        ].join(' ')}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={[
            'flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
            'flex items-center justify-center',
            isActive
              ? 'bg-white/20 text-white'
              : 'bg-[#EF4444] text-white',
          ].join(' ')}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeItem,
  onNavigate,
  onLogout,
  labels = {},
  badges = {},
  className = '',
}) => {
  const mainItems = NAV_ENTRIES.filter((e) => e.section === 'main');
  const bottomItems = NAV_ENTRIES.filter((e) => e.section === 'bottom');

  return (
    <aside
      className={[
        'flex flex-col w-60 h-screen bg-white border-r border-[#E5E7EB]',
        'flex-shrink-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold leading-none">ን</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1B2E6B] leading-tight truncate">
            {labels.appName ?? 'ናብሊስ'}
          </p>
          {labels.appTagline && (
            <p className="text-[10px] text-[#9CA3AF] leading-tight truncate">
              {labels.appTagline}
            </p>
          )}
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {mainItems.map((entry) => (
          <NavItem
            key={entry.key}
            entry={entry}
            isActive={activeItem === entry.key}
            label={labels[entry.key] ?? entry.defaultLabel}
            badge={badges[entry.key]}
            onClick={() => onNavigate(entry.key)}
          />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-4 pt-2 border-t border-[#E5E7EB] space-y-0.5 flex-shrink-0">
        {bottomItems.map((entry) => (
          <NavItem
            key={entry.key}
            entry={entry}
            isActive={activeItem === entry.key}
            label={labels[entry.key] ?? entry.defaultLabel}
            badge={badges[entry.key]}
            onClick={() => onNavigate(entry.key)}
          />
        ))}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#EF4444] hover:bg-[#FEF2F2] transition-colors duration-150 group text-left"
        >
          <LogOut
            size={18}
            className="flex-shrink-0 text-[#EF4444]"
          />
          <span className="flex-1 truncate">{labels.logout ?? 'Logout'}</span>
        </button>
      </div>
    </aside>
  );
};
