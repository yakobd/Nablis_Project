import React from 'react';

export type BadgeVariant =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'member'
  | 'admin'
  | 'default';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { pill: string; dot: string }> = {
  pending: {
    pill: 'bg-[#FFFBEB] text-[#92400E] border border-[#F5C518]/50',
    dot: 'bg-[#F5C518]',
  },
  confirmed: {
    pill: 'bg-[#ECFDF5] text-[#065F46] border border-[#10B981]/40',
    dot: 'bg-[#10B981]',
  },
  rejected: {
    pill: 'bg-[#FEF2F2] text-[#991B1B] border border-[#EF4444]/40',
    dot: 'bg-[#EF4444]',
  },
  member: {
    pill: 'bg-[#EFF6FF] text-[#1E40AF] border border-[#3B82F6]/40',
    dot: 'bg-[#3B82F6]',
  },
  admin: {
    pill: 'bg-[#EEF1F8] text-[#1B2E6B] border border-[#1B2E6B]/30',
    dot: 'bg-[#1B2E6B]',
  },
  default: {
    pill: 'bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB]',
    dot: 'bg-[#6B7280]',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  size = 'md',
  dot = false,
  className = '',
}) => {
  const { pill, dot: dotColor } = variantStyles[variant];

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-medium leading-none',
        size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-xs',
        pill,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && (
        <span
          className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${dotColor}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
