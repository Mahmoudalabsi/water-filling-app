import { ar, type TranslationKeys } from './ar'
import { en } from './en'

export type Locale = 'ar' | 'en'

const translations: Record<Locale, Record<TranslationKeys, string>> = { ar, en }

export function t(key: TranslationKeys, locale: Locale = 'ar'): string {
  return translations[locale]?.[key] || translations.ar[key] || key
}

export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function getLocaleName(locale: Locale): string {
  return locale === 'ar' ? 'العربية' : 'English'
}

export const dayNamesMap: Record<Locale, string[]> = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

export function getDayNames(locale: Locale): string[] {
  return dayNamesMap[locale]
}

export { type TranslationKeys }
