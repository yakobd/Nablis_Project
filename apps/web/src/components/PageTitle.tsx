"use client";
import React from "react";
import { useTranslation } from "@nablis/i18n";

/**
 * Page heading + subtitle from the `pages.<id>` translations. Renders the
 * h1 and p as siblings so the `.app-main h1 + p` styles still apply.
 */
export function PageTitle({ id, values }: { id: string; values?: Record<string, string | number> }) {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t(`pages.${id}.title`)}</h1>
      <p>{t(`pages.${id}.subtitle`, values)}</p>
    </>
  );
}
