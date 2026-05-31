'use client'

import { createContext, useContext, useState, useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { type Locale, type TranslationKeys, t, getDirection } from '@/lib/i18n'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKeys) => string
  dir: 'rtl' | 'ltr'
}

const emptySubscribe = () => () => {}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'ar'
  try {
    const saved = localStorage.getItem('app-locale') as Locale | null
    if (saved === 'ar' || saved === 'en') return saved
  } catch {}
  return 'ar'
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'ar',
  setLocale: () => {},
  t: (key) => key,
  dir: 'rtl',
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const initialLocale = mounted ? getInitialLocale() : 'ar'
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('app-locale', newLocale)
    document.documentElement.lang = newLocale
    document.documentElement.dir = getDirection(newLocale)
  }, [])

  const translate = useCallback((key: TranslationKeys) => t(key, locale), [locale])
  const dir = getDirection(locale)

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translate, dir }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
