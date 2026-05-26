'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, MessageSquare, ChevronDown, Settings, LogOut, User } from 'lucide-react';
import { Avatar } from './Avatar';

export interface TopbarUser {
  name: string;
  role?: string;
  avatar?: string | null;
}

export interface TopbarProps {
  user: TopbarUser;
  onSearch?: (query: string) => void;
  onNotificationClick?: () => void;
  onMessageClick?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogoutClick?: () => void;
  notificationCount?: number;
  messageCount?: number;
  searchPlaceholder?: string;
  className?: string;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function IconButton({
  onClick,
  label,
  count,
  children,
}: {
  onClick?: () => void;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative p-2 rounded-xl text-[#6B7280] hover:text-[#1B2E6B] hover:bg-[#EEF1F8] transition-colors"
    >
      {children}
      {count !== undefined && <CountBadge count={count} />}
    </button>
  );
}

export const Topbar: React.FC<TopbarProps> = ({
  user,
  onSearch,
  onNotificationClick,
  onMessageClick,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  notificationCount = 0,
  messageCount = 0,
  searchPlaceholder = 'Search...',
  className = '',
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchValue);
  };

  return (
    <header
      className={[
        'h-16 bg-white border-b border-[#E5E7EB] flex items-center px-6 gap-4 flex-shrink-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm bg-[#EEF1F8] rounded-xl border border-transparent
              text-[#1B2E6B] placeholder:text-[#9CA3AF]
              focus:outline-none focus:bg-white focus:border-[#1B2E6B]/30 focus:ring-2 focus:ring-[#1B2E6B]/10
              transition-colors"
          />
        </div>
      </form>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Icon actions */}
      <div className="flex items-center gap-1">
        <IconButton
          onClick={onMessageClick}
          label="Messages"
          count={messageCount}
        >
          <MessageSquare size={20} />
        </IconButton>

        <IconButton
          onClick={onNotificationClick}
          label="Notifications"
          count={notificationCount}
        >
          <Bell size={20} />
        </IconButton>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-[#E5E7EB] flex-shrink-0" />

      {/* User dropdown */}
      <div className="relative flex-shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-[#EEF1F8] transition-colors"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          <Avatar src={user.avatar} name={user.name} size="sm" />
          <div className="text-left hidden sm:block min-w-0">
            <p className="text-sm font-semibold text-[#1B2E6B] leading-tight truncate max-w-[120px]">
              {user.name}
            </p>
            {user.role && (
              <p className="text-xs text-[#9CA3AF] leading-tight truncate max-w-[120px]">
                {user.role}
              </p>
            )}
          </div>
          <ChevronDown
            size={14}
            className={`text-[#9CA3AF] flex-shrink-0 transition-transform duration-150 ${
              dropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl border border-[#E5E7EB] shadow-lg py-1.5 z-[100]">
            <DropdownItem
              icon={<User size={15} />}
              label="Profile"
              onClick={() => { onProfileClick?.(); setDropdownOpen(false); }}
            />
            <DropdownItem
              icon={<Settings size={15} />}
              label="Settings"
              onClick={() => { onSettingsClick?.(); setDropdownOpen(false); }}
            />
            <div className="mx-2 my-1.5 h-px bg-[#E5E7EB]" />
            <DropdownItem
              icon={<LogOut size={15} />}
              label="Log out"
              onClick={() => { onLogoutClick?.(); setDropdownOpen(false); }}
              danger
            />
          </div>
        )}
      </div>
    </header>
  );
};

function DropdownItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
        danger
          ? 'text-[#EF4444] hover:bg-[#FEF2F2]'
          : 'text-[#374151] hover:bg-[#EEF1F8] hover:text-[#1B2E6B]',
      ].join(' ')}
    >
      <span className="flex-shrink-0">{icon}</span>
      {label}
    </button>
  );
}
