import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { browserLanguage } from '../lib/language';

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: browserLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
