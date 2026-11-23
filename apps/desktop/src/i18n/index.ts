import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('devos_locale') || 'zh-CN' : 'zh-CN';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: savedLang,
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
});

export const switchLanguage = (lang: 'zh-CN' | 'en-US') => {
  i18n.changeLanguage(lang);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('devos_locale', lang);
  }
};

export default i18n;
