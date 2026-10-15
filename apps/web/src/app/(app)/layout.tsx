'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, usePresenceHeartbeat } from '@nablis/shared/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  LayoutDashboard, Mail, BookOpenText, HandHeart, Users, MessageSquare, CalendarDays,
  ClipboardList, Image as ImageIcon, MessageSquareQuote, UserCog, Bell, Settings, LogOut,
  Search, Menu, X, ChevronDown, Phone, User as UserIcon, Megaphone, QrCode, Trophy, Sun, Moon,
  type LucideIcon,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { usePublicSettings } from '@/lib/publicSettings';
import { useDisplayPrefs, useQuickPrefs } from '@/lib/preferences';
import { useTranslation } from '@nablis/i18n';
import { ToastProvider } from '@/components/ui/Toast';
import { MemberPassModal } from '@/components/MemberPassModal';

const NAV_ITEMS: { key: string; label: string; path: string; icon: LucideIcon; roles?: string[] }[] = [
  { key: 'dashboard',     label: 'Dashboard',     path: '/dashboard',     icon: LayoutDashboard },
  { key: 'announcements', label: 'Announcements', path: '/announcements', icon: Megaphone },
  { key: 'messaging',     label: 'Messaging',     path: '/messaging',     icon: Mail },
  { key: 'bible-study',   label: 'Bible Study',   path: '/bible-study',   icon: BookOpenText },
  { key: 'daily-prayers', label: 'Daily Prayers', path: '/daily-prayers', icon: HandHeart },
  { key: 'appointment',   label: 'Appointment',   path: '/appointment',   icon: Users },
  { key: 'blogs',         label: 'Blogs',         path: '/blogs',         icon: MessageSquare },
  { key: 'events',        label: 'Events',        path: '/events',        icon: CalendarDays },
  { key: 'attendance',    label: 'Attendance',    path: '/attendance',    icon: ClipboardList },
  { key: 'gallery',       label: 'Gallery',       path: '/gallery-app',   icon: ImageIcon },
  { key: 'testimonials',  label: 'Testimonials',  path: '/testimonials',  icon: MessageSquareQuote },
  { key: 'challenges',    label: 'Challenges',    path: '/challenges',    icon: Trophy },
  { key: 'members',       label: 'Members',       path: '/settings/members', icon: UserCog, roles: ['super_admin', 'admin'] },
  { key: 'notifications', label: 'Notifications', path: '/notifications', icon: Bell },
  { key: 'settings',      label: 'Settings',      path: '/settings/profile', icon: Settings },
];

// Translation keys for nav items whose key differs from the locale key.
const NAV_KEYS: Record<string, string> = {
  "bible-study": "bibleStudy", "daily-prayers": "dailyPrayers",
};

function getActiveKey(pathname: string): string {
  if (pathname.startsWith('/announcements')) return 'announcements';
  if (pathname.startsWith('/messaging')) return 'messaging';
  if (pathname.startsWith('/bible-study')) return 'bible-study';
  if (pathname.startsWith('/daily-prayers')) return 'daily-prayers';
  if (pathname.startsWith('/appointment')) return 'appointment';
  if (pathname.startsWith('/blogs')) return 'blogs';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/attendance')) return 'attendance';
  if (pathname.startsWith('/gallery-app')) return 'gallery';
  if (pathname.startsWith('/testimonials')) return 'testimonials';
  if (pathname.startsWith('/challenges')) return 'challenges';
  if (pathname.startsWith('/members') || pathname.startsWith('/settings/members')) return 'members';
  if (pathname.startsWith('/notifications')) return 'notifications';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/search')) return '';
  return 'dashboard';
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [aptBadge, setAptBadge] = useState(0);
  const [msgBadge, setMsgBadge] = useState(0);
  const [memberBadge, setMemberBadge] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const publicSettings = usePublicSettings();
  const { t } = useTranslation();
  usePresenceHeartbeat(user?.status === 'active' ? user.id : null);
  useDisplayPrefs();
  const { language, isDark, setLanguage, toggleTheme } = useQuickPrefs();

  const isLoginPage    = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isPendingPage  = pathname === '/pending';
  const isPublicPage   = isLoginPage || isRegisterPage;

  useEffect(() => { setSidebarOpen(false); setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.id),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => setUnreadCount(snap.size));
    return unsub;
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Appointments badge: pending appointments
  useEffect(() => {
    if (!user) return;
    const q = role === 'member'
      ? query(collection(db, 'appointments'), where('memberId', '==', user.id), where('status', '==', 'pending'))
      : query(collection(db, 'appointments'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => setAptBadge(snap.size));
    return unsub;
  }, [user?.id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Members badge: super_admin only - pending member registrations
  useEffect(() => {
    if (!user || role !== 'super_admin') return;
    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => setMemberBadge(snap.size));
    return unsub;
  }, [user?.id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Messaging badge: conversations with messages this user hasn't seen
  useEffect(() => {
    if (!user) return;
    const q = role === 'member'
      ? query(collection(db, 'conversations'), where('memberId', '==', user.id))
      : query(collection(db, 'conversations'), where('unreadByStaff', '>', 0));
    const unsub = onSnapshot(q, (snap) => setMsgBadge(
      role === 'member'
        ? snap.docs.filter((d) => (d.data().unreadByMember ?? 0) > 0).length
        : snap.size
    ));
    return unsub;
  }, [user?.id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Status-aware routing
  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (!isPublicPage) router.replace('/login');
      return;
    }

    if (user.status === 'rejected') {
      signOut().then(() => router.replace('/login'));
      return;
    }

    if (user.status === 'pending') {
      if (!isPendingPage) router.replace('/pending');
      return;
    }

    if (isPublicPage || isPendingPage) {
      router.replace('/dashboard');
    }
  }, [loading, user?.id, user?.status, isPublicPage, isPendingPage, router, signOut]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session cookie management
  useEffect(() => {
    if (!loading) {
      if (user) {
        document.cookie = '__nablis_session=1; path=/; SameSite=Strict';
      } else {
        document.cookie = '__nablis_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
    }
  }, [loading, user]);

  // Public auth pages — no sidebar
  if (isPublicPage || isPendingPage) {
    if (!loading && user && user.status === 'active' && (isPublicPage || isPendingPage)) return null;
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 min-h-screen bg-[#CDD6E3]">
        <img src="/Logo-Blue.png" alt="Nablis" className="h-20 w-auto animate-pulse" />
        <div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const activeKey = getActiveKey(pathname);
  const visibleNav = NAV_ITEMS.filter((item) =>
    !item.roles || item.roles.includes(role ?? '')
  );

  function getBadge(key: string): number {
    if (key === 'notifications') return unreadCount;
    if (key === 'appointment') return aptBadge;
    if (key === 'messaging') return msgBadge;
    if (key === 'members') return memberBadge;
    return 0;
  }

  const isStaff = role === 'admin' || role === 'super_admin';

  async function handleLogout() {
    await signOut();
    document.cookie = '__nablis_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.replace('/login');
  }

  return (
    <ToastProvider>
    <div className="flex min-h-screen bg-[#CDD6E3]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR — floating panel */}
      <aside
        className={`fixed top-0 left-0 h-screen md:h-auto md:max-h-screen w-[228px] bg-[#F4F6F9] md:rounded-br-3xl shadow-[4px_0_24px_-12px_rgba(27,46,107,0.25)] z-50 flex flex-col overflow-y-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Close button - mobile only */}
        <button
          className="md:hidden absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="px-6 pt-7 pb-4 flex justify-center">
          <img src="/Logo-Blue.png" alt="Nablis" className="logo-light h-20 w-auto object-contain" />
          <img src="/Logo-White.png" alt="" aria-hidden className="logo-dark h-20 w-auto object-contain" />
        </Link>

        <p className="px-7 pb-3 text-[15px] font-extrabold tracking-[0.18em] text-[#1B2E6B] font-display">{t('shell.overview')}</p>

        {/* Nav items */}
        <nav className="px-4 pb-4 space-y-1">
          {visibleNav.map((item) => {
            const badgeCount = getBadge(item.key);
            const active = activeKey === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => { router.push(item.path); setSidebarOpen(false); }}
                data-nav-active={active ? "" : undefined}
                className={`w-full text-left pl-4 pr-3 py-2.5 rounded-full text-[15px] font-medium transition-all duration-200 cursor-pointer flex items-center gap-3
                  ${active
                    ? 'bg-[#1B2E6B] text-white shadow-[0_8px_18px_-8px_rgba(27,46,107,0.7)]'
                    : 'text-[#1F2937] hover:bg-white hover:text-[#1B2E6B] hover:translate-x-0.5'
                  }`}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="flex-1">{t(`nav.${NAV_KEYS[item.key] ?? item.key}`, { defaultValue: item.label })}</span>
                {badgeCount > 0 && (
                  <span key={badgeCount} className={`animate-pop text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-[#F5C518] text-[#1B2E6B]' : 'bg-red-500 text-white'}`}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={handleLogout}
            className="w-full text-left pl-4 pr-3 py-2.5 rounded-full text-[15px] font-medium text-[#E5484D] hover:bg-red-50 cursor-pointer flex items-center gap-3 mt-3"
          >
            <LogOut size={17} /> {t('nav.logout')}
          </button>
        </nav>

        {/* Get the app (members) */}
        {!isStaff && (publicSettings.appStoreUrl || publicSettings.playStoreUrl) && (
          <div className="mx-3 mb-5 mt-auto rounded-2xl bg-[#1B2E6B] p-4 text-white animate-fade-up">
            <p className="text-[10px] font-bold tracking-widest text-[#F5C518] mb-1.5">{t('shell.getApp')}</p>
            <p className="text-[11px] text-white/80 leading-relaxed mb-3">{t('shell.getAppText')}</p>
            <div className="space-y-2">
              {publicSettings.appStoreUrl && (
                <a href={publicSettings.appStoreUrl} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 bg-white text-[#111827] text-xs font-semibold rounded-lg py-2 hover:bg-[#F5C518]">
                  App Store
                </a>
              )}
              {publicSettings.playStoreUrl && (
                <a href={publicSettings.playStoreUrl} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-semibold rounded-lg py-2 hover:bg-white/20">
                  Google Play
                </a>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[228px]">
        {/* Floating top bar */}
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 md:px-10 py-4 bg-[#CDD6E3]/80 backdrop-blur-md">
          {/* Hamburger - mobile only */}
          <button
            className="md:hidden w-10 h-10 rounded-full bg-white text-[#1B2E6B] flex items-center justify-center shadow-sm flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <form
            role="search"
            className="relative flex-1 md:flex-none md:w-[460px]"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get('q')?.toString().trim();
              if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            <input
              type="search"
              name="q"
              placeholder={t('shell.searchPlaceholder')}
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-[#F4F6F9] border border-transparent text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#1B2E6B]/20 focus:shadow-[0_6px_20px_-10px_rgba(27,46,107,0.4)]"
            />
          </form>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Language: one tap switches between English and Amharic */}
            <div className="hidden sm:flex items-center p-1 rounded-full bg-[#F4F6F9] text-xs font-semibold" role="group" aria-label={t('prefs.language')}>
              {(['en', 'am'] as const).map((l) => (
                <button key={l} onClick={() => setLanguage(l)} aria-pressed={language === l}
                  className={`px-3 py-1.5 rounded-full transition-colors ${language === l ? 'bg-[#1B2E6B] text-white' : 'text-[#1B2E6B] hover:bg-white'}`}>
                  {l === 'en' ? 'EN' : 'አማ'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
              className="sm:hidden w-10 h-10 rounded-full bg-[#F4F6F9] text-[#1B2E6B] text-xs font-bold flex items-center justify-center flex-shrink-0"
              aria-label={t('prefs.language')}
            >
              {language === 'en' ? 'EN' : 'አማ'}
            </button>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-[#F4F6F9] text-[#1B2E6B] flex items-center justify-center hover:bg-white hover:shadow-md flex-shrink-0"
              aria-label={isDark ? t('shell.lightMode') : t('shell.darkMode')}
              title={isDark ? t('shell.lightMode') : t('shell.darkMode')}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={() => router.push('/notifications')}
              className="relative w-10 h-10 rounded-full bg-[#F4F6F9] text-[#1B2E6B] flex items-center justify-center hover:bg-white hover:shadow-md flex-shrink-0"
              aria-label="Notifications"
            >
              <Bell size={17} fill="currentColor" />
              {unreadCount > 0 && (
                <span key={unreadCount} className="animate-pop absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-[#CDD6E3]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push('/messaging')}
              className="relative w-10 h-10 rounded-full bg-[#F4F6F9] text-[#1B2E6B] items-center justify-center hover:bg-white hover:shadow-md flex-shrink-0 hidden sm:flex"
              aria-label="Messages"
            >
              <Mail size={17} />
              {msgBadge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#F5C518] ring-2 ring-[#CDD6E3]" />
              )}
            </button>

            {/* User pill + menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#F4F6F9] hover:bg-white hover:shadow-md"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[#1B2E6B] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:flex flex-col items-start leading-tight text-left">
                  <span className="text-[13px] text-[#111827] font-medium truncate max-w-[140px]">
                    {user.displayName || user.email}
                  </span>
                  <span className="text-[11px] text-[#6B7280]">
                    {role === 'super_admin' ? t('members.father') : role === 'admin' ? t('members.admin') : t('status.member')}
                  </span>
                </span>
                <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div role="menu" className="absolute right-0 mt-2 w-48 z-20 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] py-2 animate-scale-in">
                    <Link href="/settings/profile" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#374151] hover:bg-[#EEF1F8]">
                      <UserIcon size={15} /> {t('shell.myProfile')}
                    </Link>
                    <button onClick={() => { setMenuOpen(false); setPassOpen(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#374151] hover:bg-[#EEF1F8]">
                      <QrCode size={15} /> {t('shell.myPass')}
                    </button>
                    <Link href="/settings/preferences" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#374151] hover:bg-[#EEF1F8]">
                      <Settings size={15} /> {t('nav.settings')}
                    </Link>
                    <div className="my-1 border-t border-[#F3F4F6]" />
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#E5484D] hover:bg-red-50">
                      <LogOut size={15} /> {t('nav.logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content — re-keyed per route so each page animates in */}
        <main className="app-main flex-1 px-4 md:px-10 pb-8 pt-2">
          <div key={pathname} className="stagger-page max-w-[1180px]">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="mx-4 md:mx-10 mb-6 pt-5 border-t border-[#1B2E6B]/40 flex flex-col sm:flex-row gap-2 sm:items-center justify-between text-[13px] text-[#1F2937]">
          <span>{t('shell.rights', { year: new Date().getFullYear() })}</span>
          <div className="flex items-center gap-6">
            <a href={`tel:${publicSettings.contactPhone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 hover:text-[#1B2E6B]">
              <Phone size={13} /> {publicSettings.contactPhone}
            </a>
            <a href={`mailto:${publicSettings.contactEmail}`} className="flex items-center gap-1.5 hover:text-[#1B2E6B]">
              <Mail size={13} /> {publicSettings.contactEmail}
            </a>
          </div>
        </footer>
      </div>
      {passOpen && <MemberPassModal onClose={() => setPassOpen(false)} />}
    </div>
    </ToastProvider>
  );
}
