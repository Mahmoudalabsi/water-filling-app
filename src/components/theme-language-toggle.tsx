'use client'

import { useLanguage } from '@/components/language-provider'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun, Languages } from 'lucide-react'
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

export function ThemeLanguageToggle() {
  const { locale, setLocale, t } = useLanguage()
  const { theme, setTheme } = useTheme()

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  if (!mounted) return null

  const isDark = theme === 'dark'

  return (
    <div className="flex items-center gap-1">
      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="h-8 w-8 p-0 rounded-lg"
        title={isDark ? t('lightMode') : t('darkMode')}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-gray-500" />
        )}
      </Button>

      {/* Language toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
        className="h-8 px-2 rounded-lg text-xs font-medium gap-1"
        title={t('language')}
      >
        <Languages className="w-3.5 h-3.5" />
        <span>{locale === 'ar' ? 'EN' : 'عربي'}</span>
      </Button>
    </div>
  )
}
