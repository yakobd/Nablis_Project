// LAYOUT VERSION 4 - STATUS-AWARE ROUTING
'use client';

import React, { useEffect } from 'react';
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

  const isLoginPage    = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isPendingPage  = pathname === '/pending';
  const isPublicPage   = isLoginPage || isRegisterPage;

  // Status-aware routing
  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Unauthenticated: allow login/register, redirect everything else
      if (!isPublicPage) router.replace('/login');
      return;
    }

    // Rejected: sign out and send to login
    if (user.status === 'rejected') {
      signOut().then(() => router.replace('/login'));
      return;
    }

    // Pending: hold them on the pending page
    if (user.status === 'pending') {
      if (!isPendingPage) router.replace('/pending');
      return;
    }

    // Active user: redirect away from auth/pending pages
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
      {/* SIDEBAR */}
      <aside className="fixed top-0 left-0 h-screen w-[220px] bg-white border-r border-gray-200 z-50 flex flex-col overflow-y-auto">
        {/* Logo */}
        <div className="p-5 pb-0">
          <div className="text-2xl font-bold text-[#1B2E6B] mb-8">ናቡስ</div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2">
          {visibleNav.map((item) => (
            <button
              key={item.key}
              onClick={() => router.push(item.path)}
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
      <div className="ml-[220px] flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
          <input
            type="text"
            placeholder="Search..."
            className="w-72 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">
              {user.displayName || user.email}
            </span>
            <div className="w-9 h-9 rounded-full bg-[#1B2E6B] text-white flex items-center justify-center text-sm font-bold">
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
