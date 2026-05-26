import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumb,
  className = '',
}) => {
  return (
    <div
      className={[
        'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 mb-1" aria-label="Breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className="text-[#9CA3AF] text-xs">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-xs text-[#6B7280] hover:text-[#1B2E6B] transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-xs text-[#9CA3AF]">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <h1 className="text-2xl font-bold text-[#1B2E6B] truncate">{title}</h1>

        {subtitle && (
          <p className="mt-0.5 text-sm text-[#6B7280]">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 mt-3 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
};
