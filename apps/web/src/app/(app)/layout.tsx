// LAYOUT VERSION 5 - RESPONSIVE WITH MOBILE SIDEBAR
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@nablis/shared/firebase';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'messaging', label: 'Messaging', path: '/messaging' },
  { key: 'bible-study', label: 'Bible Study', path: '/bible-study' },
  { key: 'daily-prayers', label: 'Daily Prayers', path: '/daily-prayers' },
  { key: 'appointment', label: 'Appointment', path: '/appointment' },
  { key: 'blogs', label: 'Blogs', path: '/blogs' },
  { key: 'events', label: 'Events', path: '/events' },
  { key: 'attendance', label: 'Attendance', path: '/attendance' },
  { key: 'gallery', label: 'Gallery', path: '/gallery-app' },
  { key: 'testimonials', label: 'Testimonials', path: '/testimonials' },
  { key: 'members', label: 'Members', path: '/members', roles: ['super_admin', 'admin'] },
  { key: 'settings', label: 'Settings', path: '/settings/profile' },
];

function getActiveKey(pathname: string): string {
  if (pathname.startsWith('/messaging')) return 'messaging';
  if (pathname.startsWith('/bible-study')) return 'bible-study';
  if (pathname.startsWith('/daily-prayers')) return 'daily-prayers';
  if (pathname.startsWith('/appointment')) return 'appointment';
  if (pathname.startsWith('/blogs')) return 'blogs';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/attendance')) return 'attendance';
  if (pathname.startsWith('/gallery-app')) return 'gallery';
  if (pathname.startsWith('/testimonials')) return 'testimonials';
  if (pathname.startsWith('/members')) return 'members';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage    = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isPendingPage  = pathname === '/pending';
  const isPublicPage   = isLoginPage || isRegisterPage;

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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
      <div className="flex items-center justify-center min-h-screen bg-[#EEF1F8]">
        <div className="text-[#1B2E6B] text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const activeKey = getActiveKey(pathname);
  const visibleNav = NAV_ITEMS.filter((item) =>
    !item.roles || item.roles.includes(role ?? '')
  );

  return (
    <div className="flex min-h-screen bg-[#EEF1F8]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 h-screen w-[220px] bg-white border-r border-gray-200 z-50 flex flex-col overflow-y-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Close button - mobile only */}
        <button
          className="md:hidden absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Logo */}
        <div className="p-5 pb-2">
          <img src="/Logo-Blue.png" alt="Nablis" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2">
          {visibleNav.map((item) => (
            <button
              key={item.key}
              onClick={() => { router.push(item.path); setSidebarOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors cursor-pointer
                ${activeKey === item.key
                  ? 'bg-[#1B2E6B] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={async () => {
              await signOut();
              document.cookie = '__nablis_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
              router.replace('/login');
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[220px]">
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-16 flex items-center gap-3 px-4 md:px-6">
          {/* Hamburger - mobile only */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <input
            type="text"
            placeholder="Search..."
            className="flex-1 md:flex-none md:w-72 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]"
          />
          <div className="flex items-center gap-3 ml-auto">
            <span className="hidden sm:block text-sm text-gray-600 font-medium truncate max-w-[140px]">
              {user.displayName || user.email}
            </span>
            <div className="w-9 h-9 rounded-full bg-[#1B2E6B] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
