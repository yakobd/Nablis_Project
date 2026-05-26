'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1B2E6B] text-white border border-transparent hover:bg-[#152454] active:bg-[#0f1b3d]',
  secondary:
    'bg-transparent text-[#1B2E6B] border border-[#1B2E6B] hover:bg-[#EEF1F8] active:bg-[#dde3f0]',
  accent:
    'bg-[#F5C518] text-[#1B2E6B] border border-transparent font-semibold hover:bg-[#e6b800] active:bg-[#d4a900]',
  danger:
    'bg-[#EF4444] text-white border border-transparent hover:bg-[#dc2626] active:bg-[#b91c1c]',
  ghost:
    'bg-transparent text-[#6B7280] border border-transparent hover:bg-[#EEF1F8] hover:text-[#1B2E6B] active:bg-[#dde3f0]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5 h-8',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2 h-10',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5 h-12',
};

const iconSize: Record<ButtonSize, number> = { sm: 14, md: 15, lg: 17 };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-medium',
          'transition-colors duration-150 select-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2E6B]/50 focus-visible:ring-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          isDisabled
            ? 'opacity-50 cursor-not-allowed pointer-events-none'
            : 'cursor-pointer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={iconSize[size]} />
        ) : (
          leftIcon && (
            <span className="flex-shrink-0">{leftIcon}</span>
          )
        )}
        <span>{children}</span>
        {!loading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
