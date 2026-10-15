// Hermes on React Native ships without Intl.PluralRules, which i18next needs for
// "_one"/"_other" plural keys. The polyfill only installs itself when missing.
import 'intl-pluralrules';
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

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    // Start in English so server and client render the same; apps switch to
    // the signed-in user's saved language (see changeLanguage).
    lng: 'en',
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
