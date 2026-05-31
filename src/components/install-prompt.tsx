'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const emptySubscribe = () => () => {}

export function InstallPrompt() {
  const { t } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  useEffect(() => {
    if (!mounted) return

    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true

    if (standalone) return

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

    // Listen for beforeinstallprompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // For iOS, show a tip after a delay
    if (isIOS) {
      setTimeout(() => setShowPrompt(true), 5000)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [mounted])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true)

  if (!showPrompt || isStandalone || !mounted) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-cyan-200 dark:border-cyan-800 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{t('installApp')}</h3>
            {isIOS ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('iosInstallTip')}
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('installDesc')}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowPrompt(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:from-cyan-700 hover:to-emerald-700 transition-all"
          >
            <Download className="w-4 h-4" />
            {t('installNow')}
          </button>
        )}
      </div>
    </div>
  )
}
