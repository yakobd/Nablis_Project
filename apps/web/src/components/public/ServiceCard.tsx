import React from "react";
import Link from "next/link";

export interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  audience?: string;
  features?: string[];
  href?: string;
  accentColor?: string;
}

export function ServiceCard({
  icon,
  title,
  description,
  audience,
  features,
  href = "/contact",
  accentColor = "#1B2E6B",
}: ServiceCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-200"
        style={{ backgroundColor: `${accentColor}15` }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
      </div>

      <h3 className="text-[#1B2E6B] font-semibold text-lg mb-2">{title}</h3>
      <p className="text-[#6B7280] text-sm leading-relaxed mb-4">{description}</p>

      {features && features.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-[#6B7280]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}

      {audience && (
        <p className="text-xs text-[#9CA3AF] mb-5 mt-auto pt-3 border-t border-[#F3F4F6]">
          <span className="font-medium">For:</span> {audience}
        </p>
      )}

      <Link
        href={href}
        className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors"
      >
        Book Appointment
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
