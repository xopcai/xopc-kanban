import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

export const LOCALE_KEY = 'xopc-locale';

export type AppLocale = 'en' | 'zh';

function readStoredLocale(): AppLocale {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    if (v === 'en' || v === 'zh') return v;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    if (navigator.language.toLowerCase().startsWith('zh')) return 'zh';
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: readStoredLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function syncDocumentLang(lng: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
}

syncDocumentLang(i18n.language);

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LOCALE_KEY, lng);
  } catch {
    /* ignore */
  }
  syncDocumentLang(lng);
});

export default i18n;
