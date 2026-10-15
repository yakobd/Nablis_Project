import i18n from "@nablis/i18n";

/** Locale for dates and numbers: Amharic month/day names when the UI is in Amharic. */
export function dateLocale(): string {
  return i18n.language === "am" ? "am-ET" : "en-US";
}
