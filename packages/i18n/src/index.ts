import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslations from './locales/en/translation.json';
import amTranslations from './locales/am/translation.json';

export type SupportedLanguage = 'en' | 'am';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'am'];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  am: 'አማርኛ',
};

export const defaultNS = 'translation';

export const resources = {
  en: { translation: enTranslations },
  am: { translation: amTranslations },
} as const;

function detectLanguage(): SupportedLanguage {
  const lang = (globalThis as any).navigator?.language as string | undefined;
  if (!lang) return 'en';
  const code = lang.split('-')[0] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'en';
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: detectLanguage(),
    fallbackLng: 'en',
    defaultNS,
    resources,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export function changeLanguage(lang: SupportedLanguage) {
  return i18n.changeLanguage(lang);
}

export default i18n;
export { useTranslation, Trans } from 'react-i18next';
