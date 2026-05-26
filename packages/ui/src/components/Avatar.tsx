import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  className?: string;
  online?: boolean;
  onClick?: () => void;
}

const sizeMap: Record<
  AvatarSize,
  { container: string; text: string; dot: string; ring: string }
> = {
  xs: { container: 'w-6 h-6', text: 'text-[9px]', dot: 'w-1.5 h-1.5', ring: 'ring-1' },
  sm: { container: 'w-8 h-8', text: 'text-[11px]', dot: 'w-2 h-2', ring: 'ring-2' },
  md: { container: 'w-10 h-10', text: 'text-sm', dot: 'w-2.5 h-2.5', ring: 'ring-2' },
  lg: { container: 'w-12 h-12', text: 'text-base', dot: 'w-3 h-3', ring: 'ring-2' },
  xl: { container: 'w-16 h-16', text: 'text-xl', dot: 'w-3.5 h-3.5', ring: 'ring-2' },
};

const PALETTE = [
  'bg-[#1B2E6B] text-white',
  'bg-[#3B82F6] text-white',
  'bg-[#10B981] text-white',
  'bg-[#8B5CF6] text-white',
  'bg-[#F59E0B] text-white',
  'bg-[#EC4899] text-white',
  'bg-[#06B6D4] text-white',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  online,
  onClick,
}) => {
  const { container, text, dot, ring } = sizeMap[size];
  const initials = name ? getInitials(name) : '?';
  const colorClass = name ? pickColor(name) : 'bg-[#9CA3AF] text-white';

  return (
    <div
      className={[
        'relative inline-flex flex-shrink-0',
        onClick ? 'cursor-pointer' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {src ? (
        <img
          src={src}
          alt={name ?? 'User avatar'}
          className={`${container} rounded-full object-cover ${ring} ring-white`}
          draggable={false}
        />
      ) : (
        <div
          className={`${container} rounded-full flex items-center justify-center font-semibold select-none ${colorClass} ${ring} ring-white`}
          aria-label={name ?? 'Avatar'}
        >
          <span className={text}>{initials}</span>
        </div>
      )}

      {online !== undefined && (
        <span
          className={[
            dot,
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white flex-shrink-0',
            online ? 'bg-[#10B981]' : 'bg-[#9CA3AF]',
          ].join(' ')}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
