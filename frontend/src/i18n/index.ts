import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './locales/de.json';
import en from './locales/en.json';

// Only trust an explicit prior choice from our own toggle (localStorage) — never
// auto-detect from navigator.language. German must stay the default regardless
// of the visitor's browser locale; the DE/EN toggle is the only way to opt in.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    fallbackLng: 'de',
    supportedLngs: ['de', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'ab_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
