'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useLanguage } from '@/components/language-provider'
import { ThemeLanguageToggle } from '@/components/theme-language-toggle'
import { getDayNames } from '@/lib/i18n'
import {
  Users,
  Plus,
  Trash2,
  Pause,
  Timer,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
  Search,
  CalendarDays,
  Coins,
  Download,
  Smartphone,
  Settings,
  Pencil,
  RotateCcw,
  Save,
  Zap,
  X,
  AlertTriangle,
  Info,
  Play,
  TrendingUp,
  Activity,
  DollarSign,
  LogOut,
  User,
  Mail,
} from 'lucide-react'

// Types - renamed FillingSession to avoid conflict with next-auth Session
interface FillingSession {
  id: string
  familyId: string
  startTime: string
  endTime: string | null
  duration: number
  createdAt: string
}

interface Family {
  id: string
  name: string
  createdAt: string
  sessions: FillingSession[]
}

interface AppSettings {
  freeMinutesPerWeek: number
  pricePerMinute: number
  autoResetWeekly: boolean
  resetDay: number
  lastAutoReset: string | null
  resendApiKey?: string | null
}

interface FamilyWithUsage extends Family {
  weeklySeconds: number
  activeSessionId: string | null
  activeSessionStart: string | null
}

type ViewMode = 'dashboard' | 'log'

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

// Confirm dialog state
interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant: 'danger' | 'warning' | 'info'
  onConfirm: () => void
}

export default function Home() {
  const { data: session, status: sessionStatus } = useSession()
  const { t, locale, dir } = useLanguage()
  const [families, setFamilies] = useState<FamilyWithUsage[]>([])
  const [settings, setSettings] = useState<AppSettings>({ freeMinutesPerWeek: 12, pricePerMinute: 0.5, autoResetWeekly: true, resetDay: 6, lastAutoReset: null, resendApiKey: null })
  const [newFamilyName, setNewFamilyName] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [editFamilyDialogOpen, setEditFamilyDialogOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<{ id: string; name: string } | null>(null)
  const [editFamilyName, setEditFamilyName] = useState('')
  const [settingsForm, setSettingsForm] = useState<AppSettings>({ freeMinutesPerWeek: 12, pricePerMinute: 0.5, autoResetWeekly: true, resetDay: 6, lastAutoReset: null, resendApiKey: null })
  const [timers, setTimers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard')
  const [logSearch, setLogSearch] = useState('')
  const [selectedLogFamily, setSelectedLogFamily] = useState<string | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const timerIntervals = useRef<Record<string, NodeJS.Timeout>>({})

  // Toast system
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false, title: '', message: '', confirmLabel: t('confirm'), cancelLabel: t('cancel'), variant: 'danger', onConfirm: () => {}
  })

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
    setToasts((prev) => [...prev, { id, type, message, duration }])
    if (duration > 0) {
      toastTimers.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        delete toastTimers.current[id]
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id])
      delete toastTimers.current[id]
    }
  }, [])

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'info' = 'danger') => {
    setConfirmState({
      open: true,
      title,
      message,
      confirmLabel: variant === 'danger' ? t('delete') : variant === 'warning' ? t('confirm') : t('confirm'),
      cancelLabel: t('cancel'),
      variant,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, open: false }))
        onConfirm()
      },
    })
  }, [t])

  const freeMin = settings.freeMinutesPerWeek
  const priceMin = settings.pricePerMinute

  const dayNames = getDayNames(locale)
  const resetDayName = dayNames[settings.resetDay ?? 6] || dayNames[6]

  const getWeekStart = (resetDay: number): Date => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysSinceResetDay = (dayOfWeek - resetDay + 7) % 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - daysSinceResetDay)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  }

  // Timer management
  const startTimerInterval = useCallback((familyId: string) => {
    if (timerIntervals.current[familyId]) return
    timerIntervals.current[familyId] = setInterval(() => {
      setTimers((prev) => ({ ...prev, [familyId]: (prev[familyId] || 0) + 1 }))
    }, 1000)
  }, [])

  const stopTimerInterval = useCallback((familyId: string) => {
    if (timerIntervals.current[familyId]) {
      clearInterval(timerIntervals.current[familyId])
      delete timerIntervals.current[familyId]
    }
  }, [])

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false)
      showToast('success', t('installSuccess'))
    }
    setInstallPrompt(null)
  }

  // ====== API-BASED DATA OPERATIONS ======

  const refreshFamilies = useCallback(async () => {
    try {
      const [familiesRes, settingsRes] = await Promise.all([
        fetch('/api/families'),
        fetch('/api/settings'),
      ])

      if (!familiesRes.ok || !settingsRes.ok) throw new Error('API error')

      const data: Family[] = await familiesRes.json()
      const currentSettings: AppSettings = await settingsRes.json()

      setSettings(currentSettings)

      const familiesWithUsage: FamilyWithUsage[] = data.map((family) => {
        const weekStart = getWeekStart(currentSettings.resetDay ?? 6)
        const weeklySessions = (family.sessions || []).filter((s) => new Date(s.startTime) >= weekStart)
        const weeklySeconds = weeklySessions.reduce((acc, s) => acc + (s.duration || 0), 0)
        const activeSession = (family.sessions || []).find((s) => !s.endTime)

        return {
          ...family,
          weeklySeconds,
          activeSessionId: activeSession?.id || null,
          activeSessionStart: activeSession?.startTime || null,
        }
      })

      setFamilies(familiesWithUsage)

      familiesWithUsage.forEach((family) => {
        if (family.activeSessionId && family.activeSessionStart) {
          const elapsed = Math.floor((Date.now() - new Date(family.activeSessionStart).getTime()) / 1000)
          setTimers((prev) => ({ ...prev, [family.id]: elapsed }))
          startTimerInterval(family.id)
        }
      })
    } catch {
      showToast('error', t('dataLoadError'))
    }
  }, [startTimerInterval, showToast, t])

  useEffect(() => {
    const init = async () => {
      if (sessionStatus === 'authenticated') {
        await refreshFamilies()
      }
      setLoading(false)
    }
    init()
    return () => { Object.values(timerIntervals.current).forEach(clearInterval) }
  }, [refreshFamilies, sessionStatus])

  // Family operations via API
  const addFamily = async () => {
    if (!newFamilyName.trim()) return
    const familyNameCopy = newFamilyName.trim()
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: familyNameCopy }),
      })
      if (!res.ok) throw new Error()
      setNewFamilyName('')
      setAddDialogOpen(false)
      await refreshFamilies()
      showToast('success', `${t('addFamilySuccess')} "${familyNameCopy}"`)
    } catch {
      showToast('error', t('addFamilyError'))
    }
  }

  const deleteFamily = (id: string, name: string) => {
    showConfirm(
      t('deleteFamily'),
      `${t('deleteFamilyConfirm')} "${name}"؟ ${t('deleteFamilyWarning')}`,
      async () => {
        try {
          const res = await fetch(`/api/families/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error()
          stopTimerInterval(id)
          setTimers((prev) => { const n = { ...prev }; delete n[id]; return n })
          await refreshFamilies()
          showToast('success', `${t('deleteFamilySuccess')} "${name}"`)
        } catch {
          showToast('error', t('deleteFamilyError'))
        }
      },
      'danger'
    )
  }

  const openEditFamily = (family: FamilyWithUsage) => {
    setEditingFamily({ id: family.id, name: family.name })
    setEditFamilyName(family.name)
    setEditFamilyDialogOpen(true)
  }

  const saveEditFamily = async () => {
    if (!editingFamily || !editFamilyName.trim()) return
    try {
      const res = await fetch(`/api/families/${editingFamily.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editFamilyName.trim() }),
      })
      if (!res.ok) throw new Error()
      setEditFamilyDialogOpen(false)
      setEditingFamily(null)
      await refreshFamilies()
      showToast('success', t('editFamilySuccess'))
    } catch {
      showToast('error', t('editFamilyError'))
    }
  }

  const handleStartSession = async (familyId: string) => {
    try {
      const res = await fetch(`/api/families/${familyId}/start`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast('error', data.error || t('sessionStartError'))
        return
      }
      setTimers((prev) => ({ ...prev, [familyId]: 0 }))
      startTimerInterval(familyId)
      await refreshFamilies()
      showToast('info', t('sessionStarted'), 2000)
    } catch {
      showToast('error', t('sessionStartError'))
    }
  }

  const handleStopSession = async (familyId: string, sessionId: string) => {
    const elapsed = timers[familyId] || 0
    try {
      const res = await fetch(`/api/families/${familyId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, duration: elapsed }),
      })
      if (!res.ok) throw new Error()
      stopTimerInterval(familyId)
      await refreshFamilies()
      const mins = (elapsed / 60).toFixed(1)
      showToast('success', `${t('sessionStopSuccess')} - ${t('duration')}: ${mins} ${t('minute')}`)
    } catch {
      showToast('error', t('sessionStopError'))
    }
  }

  const resetWeekly = (familyId: string, familyName: string) => {
    showConfirm(
      t('resetUsage'),
      `${t('resetConfirm')} "${familyName}"؟`,
      async () => {
        try {
          const res = await fetch(`/api/families/${familyId}/reset`, { method: 'POST' })
          if (!res.ok) throw new Error()
          stopTimerInterval(familyId)
          setTimers((prev) => { const n = { ...prev }; delete n[familyId]; return n })
          await refreshFamilies()
          showToast('success', `${t('resetSuccess')} "${familyName}"`)
        } catch {
          showToast('error', t('resetError'))
        }
      },
      'warning'
    )
  }

  const resetAllCounters = () => {
    showConfirm(
      t('resetAllCounters'),
      t('resetAllConfirm'),
      async () => {
        try {
          const res = await fetch('/api/reset-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          if (!res.ok) throw new Error()
          families.forEach((family) => {
            if (family.activeSessionId) stopTimerInterval(family.id)
          })
          setTimers({})
          await refreshFamilies()
          showToast('success', t('resetAllSuccess'))
        } catch {
          showToast('error', t('resetAllError'))
        }
      },
      'warning'
    )
  }

  // Settings operations via API
  const openSettings = () => {
    setSettingsForm({ ...settings })
    setSettingsDialogOpen(true)
  }

  const saveSettingsForm = async () => {
    if (settingsForm.freeMinutesPerWeek <= 0 || settingsForm.pricePerMinute < 0) return
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      })
      if (!res.ok) throw new Error()
      setSettingsDialogOpen(false)
      await refreshFamilies()
      showToast('success', t('savedSuccessfully'))
    } catch {
      showToast('error', t('settingsError'))
    }
  }

  const handleResetSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freeMinutesPerWeek: 12,
          pricePerMinute: 0.5,
          autoResetWeekly: true,
          resetDay: 6,
          lastAutoReset: null,
        }),
      })
      if (!res.ok) throw new Error()
      setSettingsForm({ freeMinutesPerWeek: 12, pricePerMinute: 0.5, autoResetWeekly: true, resetDay: 6, lastAutoReset: null, resendApiKey: settingsForm.resendApiKey })
      await refreshFamilies()
      showToast('info', t('restoreDefaultsSuccess'))
    } catch {
      showToast('error', t('settingsError'))
    }
  }

  // Auto-reset check via API
  useEffect(() => {
    const checkAutoReset = async () => {
      try {
        const res = await fetch('/api/reset-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkAutoReset: true }),
        })
        const data = await res.json()
        if (data.didReset) {
          setTimers({})
          Object.values(timerIntervals.current).forEach(clearInterval)
          timerIntervals.current = {}
          await refreshFamilies()
          showToast('success', t('autoResetDone'), 4000)
        }
      } catch {
        // Silently handle auto-reset errors
      }
    }

    checkAutoReset()
    const interval = setInterval(checkAutoReset, 60000)
    return () => clearInterval(interval)
  }, [refreshFamilies, showToast, t])

  // Formatting helpers
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const hours = Math.floor(mins / 60)
    if (hours > 0) return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  const localeStr = locale === 'ar' ? 'ar-EG' : 'en-US'
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(localeStr, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const formatTimeOfDay = (dateStr: string) => new Date(dateStr).toLocaleTimeString(localeStr, { hour: '2-digit', minute: '2-digit' })

  const calculateCost = (family: FamilyWithUsage) => {
    const totalSeconds = family.weeklySeconds + (timers[family.id] || 0)
    const totalMinutes = totalSeconds / 60
    const freeMinutesVal = Math.min(totalMinutes, freeMin)
    const paidMinutesVal = Math.max(0, totalMinutes - freeMin)
    const cost = paidMinutesVal * priceMin
    return { totalMinutes, freeMinutes: freeMinutesVal, paidMinutes: paidMinutesVal, cost }
  }

  const getUsagePercentage = (family: FamilyWithUsage) => {
    const totalSeconds = family.weeklySeconds + (timers[family.id] || 0)
    return Math.min((totalSeconds / 60 / freeMin) * 100, 100)
  }

  const isOverFreeLimit = (family: FamilyWithUsage) => (family.weeklySeconds + (timers[family.id] || 0)) / 60 > freeMin

  const activeFamilyCount = families.filter((f) => f.activeSessionId).length
  const totalRevenue = families.reduce((acc, f) => acc + calculateCost(f).cost, 0)
  const totalFamiliesOverLimit = families.filter((f) => isOverFreeLimit(f)).length
  const totalMinutesUsed = families.reduce((acc, f) => acc + f.weeklySeconds / 60, 0)

  // Toast icon and style mapping
  const toastConfig: Record<ToastType, { icon: typeof CheckCircle2; bg: string; border: string; iconColor: string; textColor: string }> = {
    success: { icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', iconColor: 'text-emerald-600 dark:text-emerald-400', textColor: 'text-emerald-800 dark:text-emerald-300' },
    error: { icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', iconColor: 'text-red-600 dark:text-red-400', textColor: 'text-red-800 dark:text-red-300' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', iconColor: 'text-amber-600 dark:text-amber-400', textColor: 'text-amber-800 dark:text-amber-300' },
    info: { icon: Info, bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800', iconColor: 'text-cyan-600 dark:text-cyan-400', textColor: 'text-cyan-800 dark:text-cyan-300' },
  }

  // Show loading while session is being checked
  if (sessionStatus === 'loading' || loading) {
    return (
      <div dir={dir} className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-200 dark:shadow-cyan-900/30 mx-auto mb-4 animate-pulse">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Redirect to signin if not authenticated
  if (sessionStatus === 'unauthenticated') {
    if (typeof window !== 'undefined') {
      window.location.href = '/signin'
    }
    return (
      <div dir={dir} className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-200 dark:shadow-cyan-900/30 mx-auto mb-4">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('redirecting')}</p>
        </div>
      </div>
    )
  }

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* ====== TOAST NOTIFICATIONS ====== */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-md">
        {toasts.map((toast) => {
          const config = toastConfig[toast.type]
          const IconComp = config.icon
          return (
            <div
              key={toast.id}
              className={`${config.bg} ${config.border} border rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300`}
            >
              <IconComp className={`w-5 h-5 ${config.iconColor} flex-shrink-0`} />
              <span className={`text-sm font-medium ${config.textColor} flex-1`}>{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className={`${config.iconColor} hover:opacity-70 transition-opacity flex-shrink-0`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* ====== CONFIRM DIALOG ====== */}
      <Dialog open={confirmState.open} onOpenChange={(open) => { if (!open) setConfirmState((prev) => ({ ...prev, open: false })) }}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              {confirmState.variant === 'danger' && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
              {confirmState.variant === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              {confirmState.variant === 'info' && <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />}
              {confirmState.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-300 py-2">{confirmState.message}</p>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">{confirmState.cancelLabel}</Button>
            </DialogClose>
            <Button
              onClick={confirmState.onConfirm}
              className={
                confirmState.variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 text-white gap-1.5'
                  : confirmState.variant === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white gap-1.5'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5'
              }
            >
              {confirmState.variant === 'danger' && <Trash2 className="w-3.5 h-3.5" />}
              {confirmState.variant === 'warning' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {confirmState.variant === 'info' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {confirmState.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="bg-gradient-to-r from-cyan-600 to-emerald-600 text-white p-3 flex items-center justify-between gap-3 sticky top-0 z-[60]">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            <span className="text-sm font-medium">{t('installBannerDesc')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleInstall} className="gap-1"><Smartphone className="w-3 h-3" />{t('installBtn')}</Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => setShowInstallBanner(false)}>✕</Button>
          </div>
        </div>
      )}

      {/* ====== HEADER ====== */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-cyan-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-2 md:py-3 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-200 dark:shadow-cyan-900/30">
              <Droplets className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-bold text-gray-800 dark:text-gray-100">{t('appName')}</h1>
              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{t('appDesc')}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Theme & Language Toggle */}
            <ThemeLanguageToggle />

            {activeFamilyCount > 0 && (
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-[10px] md:text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                <span className="hidden sm:inline">{activeFamilyCount} {t('active')}</span>
                <span className="sm:hidden">{activeFamilyCount}</span>
              </Badge>
            )}

            {/* Auto reset indicator */}
            {settings.autoResetWeekly ? (
              <div className="hidden md:flex items-center gap-1.5 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{t('auto')}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 rounded px-1 py-0.5 border border-emerald-300 dark:border-emerald-700">{resetDayName}</span>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={resetAllCounters} className="gap-1 text-xs border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-700 bg-red-50/50 dark:bg-red-900/10 font-semibold h-7 px-2" title={t('resetAllCounters')}>
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('resetAll')}</span>
              </Button>
            )}

            {/* Settings */}
            <Button variant="outline" size="sm" onClick={openSettings} className="gap-1 md:gap-1.5 text-xs border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-400 dark:hover:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-900/10 font-semibold">
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">{t('settings')}</span>
            </Button>

            {/* Log view toggle */}
            <Button
              variant={currentView === 'log' ? 'default' : 'outline'}
              size="sm"
              className={`gap-1 md:gap-1.5 text-xs ${currentView === 'log' ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent' : 'border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'}`}
              onClick={() => setCurrentView(currentView === 'log' ? 'dashboard' : 'log')}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('log')}</span>
            </Button>

            {/* Add family */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 md:gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-md text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('add')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir={dir}>
                <DialogHeader>
                  <DialogTitle className={`flex items-center gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    {t('addFamilyNew')}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>{t('familyName')}</Label>
                    <Input placeholder={t('enterFamilyName')} value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFamily()} className={dir === 'rtl' ? 'text-right' : 'text-left'} />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <DialogClose asChild><Button variant="outline">{t('cancel')}</Button></DialogClose>
                  <Button onClick={addFamily} disabled={!newFamilyName.trim()} className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white">{t('add')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* User Menu */}
            {session?.user && (
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-cyan-50 to-emerald-50 dark:from-cyan-900/20 dark:to-emerald-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg px-2 py-1">
                  {session.user.image ? (
                    <img src={session.user.image} alt={session.user.name || ''} className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                      <User className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 max-w-[80px] truncate">{session.user.name || session.user.email}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/signin' })}
                  className="gap-1 text-xs border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-800 h-7 px-2"
                  title={t('signOut')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{t('signOutShort')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ====== SETTINGS DIALOG ====== */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg" dir={dir}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <Settings className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              {t('appSettings')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="free-minutes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('freeMinutesWeekly')}
              </Label>
              <Input
                id="free-minutes"
                type="number"
                min="1"
                step="1"
                value={settingsForm.freeMinutesPerWeek}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, freeMinutesPerWeek: Number(e.target.value) || 0 }))}
                className="text-center text-lg font-bold"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('freeMinutesDesc')}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="price-minute" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('pricePerMinute')}
              </Label>
              <Input
                id="price-minute"
                type="number"
                min="0"
                step="0.1"
                value={settingsForm.pricePerMinute}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, pricePerMinute: Number(e.target.value) || 0 }))}
                className="text-center text-lg font-bold"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('priceDesc')}</p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t('autoResetWeekly')}
                </Label>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('autoResetDesc')}</p>
              </div>
              <Switch
                checked={settingsForm.autoResetWeekly}
                onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, autoResetWeekly: checked }))}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
            {settingsForm.autoResetWeekly && (
              <div className="space-y-2 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t('resetDay')}
                </Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {dayNames.map((name, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSettingsForm((prev) => ({ ...prev, resetDay: index }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        settingsForm.resetDay === index
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30 border border-emerald-500'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('resetDayAutoDesc')} {dayNames[settingsForm.resetDay ?? 6]}</p>
              </div>
            )}
            <div className="bg-gradient-to-r from-cyan-50 to-emerald-50 dark:from-cyan-900/20 dark:to-emerald-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-3">
              <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1.5">{t('preview')}</p>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>{t('freeLimit')}</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{settingsForm.freeMinutesPerWeek} {t('minutesPerWeek')}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                <span>{t('extraPrice')}</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{settingsForm.pricePerMinute} {t('shekelPerMinute')}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                <span>{t('resetModeLabel')}</span>
                <span className={`font-bold ${settingsForm.autoResetWeekly ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {settingsForm.autoResetWeekly ? `${t('autoResetOn')} ${dayNames[settingsForm.resetDay ?? 6]}` : t('autoResetManual')}
                </span>
              </div>
            </div>

            {/* Email Settings */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                {t('emailSettings')}
              </Label>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('emailServiceStatus')}:</span>
                <span className={`text-[10px] font-bold ${settingsForm.resendApiKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {settingsForm.resendApiKey ? t('emailServiceActive') : t('emailServiceInactive')}
                </span>
              </div>
              <Input
                type="password"
                placeholder={t('resendApiKeyPlaceholder')}
                value={settingsForm.resendApiKey || ''}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, resendApiKey: e.target.value || null }))}
                className="text-sm"
                dir="ltr"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {t('resendApiKeyDesc')}
                {' · '}
                <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-300 underline">
                  {t('getResendKey')}
                </a>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleResetSettings} className="gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
              <RotateCcw className="w-3.5 h-3.5" />
              {t('restoreDefaults')}
            </Button>
            <DialogClose asChild><Button variant="outline">{t('cancel')}</Button></DialogClose>
            <Button onClick={saveSettingsForm} disabled={settingsForm.freeMinutesPerWeek <= 0 || settingsForm.pricePerMinute < 0} className="gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white">
              <Save className="w-3.5 h-3.5" />
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== EDIT FAMILY DIALOG ====== */}
      <Dialog open={editFamilyDialogOpen} onOpenChange={setEditFamilyDialogOpen}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <Pencil className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              {t('editFamily')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('familyName')}</Label>
              <Input
                placeholder={t('enterNewName')}
                value={editFamilyName}
                onChange={(e) => setEditFamilyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEditFamily()}
                className={dir === 'rtl' ? 'text-right' : 'text-left'}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline">{t('cancel')}</Button></DialogClose>
            <Button onClick={saveEditFamily} disabled={!editFamilyName.trim()} className="gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white">
              <Save className="w-3.5 h-3.5" />
              {t('saveEdit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DASHBOARD VIEW ====== */}
      {currentView === 'dashboard' && (
        <>
          {/* Stats Section - Responsive */}
          <div className="max-w-7xl mx-auto px-3 md:px-6 mt-3 md:mt-4">
            {/* Mobile: Settings info bar */}
            <div className="md:hidden bg-gradient-to-r from-cyan-50 to-emerald-50 dark:from-cyan-900/20 dark:to-emerald-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-3 flex flex-wrap items-center gap-3 justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-300">{t('freeLimitLabel')} {freeMin} {t('minutesPerWeek')}</p>
                  <p className="text-[10px] text-cyan-600 dark:text-cyan-400">{t('extraPriceLabel')} {priceMin} {t('shekelPerMinute')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span><span className="text-gray-600 dark:text-gray-400">{t('free')}</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span><span className="text-gray-600 dark:text-gray-400">{t('paid')}</span></div>
              </div>
            </div>

            {/* Desktop: Full stats dashboard */}
            <div className="hidden md:grid grid-cols-4 gap-4 mb-4">
              <Card className="border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-900/20 dark:to-gray-900 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{families.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('totalFamilies')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-900 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeFamilyCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('activeNow')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-900 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totalRevenue.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('totalRevenueShekel')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/20 dark:to-gray-900 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0">
                    <Timer className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{totalMinutesUsed.toFixed(1)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('totalMinutesUsed')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Desktop: Settings info bar */}
            <div className="hidden md:flex bg-gradient-to-r from-cyan-50/80 to-emerald-50/80 dark:from-cyan-900/20 dark:to-emerald-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-3 items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-300">{t('freeLimitInfo')} {freeMin} {t('minutesPerWeek')}</p>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400">{t('extraPriceInfo')} {priceMin} {t('shekel')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400"></span><span className="text-gray-600 dark:text-gray-400">{t('free')}</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400"></span><span className="text-gray-600 dark:text-gray-400">{t('paid')}</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-400"></span><span className="text-gray-600 dark:text-gray-400">{t('overLimitFamilies')} ({totalFamiliesOverLimit} {t('familiesOverLimitCount')})</span></div>
              </div>
            </div>
          </div>

          {/* Family Cards Grid */}
          <main className="max-w-7xl mx-auto px-3 md:px-6 pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-cyan-200 dark:border-cyan-800 border-t-cyan-600 dark:border-t-cyan-400 animate-spin"></div>
                <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>
              </div>
            ) : families.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-20 h-20 rounded-full bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center"><Users className="w-10 h-10 text-cyan-300 dark:text-cyan-700" /></div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('noFamilies')}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('addFamilyStart')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {families.map((family) => {
                  const isActive = !!family.activeSessionId
                  const timerSeconds = timers[family.id] || 0
                  const totalUsedMinutes = (family.weeklySeconds + timerSeconds) / 60
                  const { paidMinutes, cost } = calculateCost(family)
                  const usagePercent = getUsagePercentage(family)
                  const overLimit = isOverFreeLimit(family)
                  const freeRemaining = Math.max(0, freeMin - totalUsedMinutes)
                  const isExpanded = expandedFamily === family.id

                  return (
                    <Card key={family.id} className={`overflow-hidden transition-all duration-300 border-2 ${isActive ? 'border-emerald-400 dark:border-emerald-600 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800' : overLimit ? 'border-amber-300 dark:border-amber-700 shadow-md shadow-amber-50 dark:shadow-amber-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-md hover:shadow-cyan-50 dark:hover:shadow-cyan-900/10'}`}>
                      {isActive && <div className="h-1 bg-gradient-to-r from-cyan-500 to-emerald-500 animate-pulse" />}
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm md:text-base flex items-center gap-2">
                            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : overLimit ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400'}`}>
                              <Droplets className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </div>
                            <span className="truncate max-w-[100px] md:max-w-[160px] lg:max-w-[200px]">{family.name}</span>
                          </CardTitle>
                          <div className="flex items-center gap-1">
                            {isActive && <Badge className="bg-emerald-500 text-white text-[9px] md:text-[10px] px-1.5 py-0"><span className={`w-1 h-1 rounded-full bg-white animate-pulse ${dir === 'rtl' ? 'ml-0.5' : 'mr-0.5'}`}></span>{t('active')}</Badge>}
                            {overLimit && !isActive && <Badge variant="destructive" className="text-[9px] md:text-[10px] px-1.5 py-0">{t('overLimit')}</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className={`text-center py-3 md:py-4 rounded-xl ${isActive ? 'bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
                          <div className="text-3xl md:text-4xl font-mono font-bold tracking-wider">
                            <span className={isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}>{formatTime(timerSeconds)}</span>
                          </div>
                          {isActive && <p className="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{t('filling')}</p>}
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] md:text-xs">
                            <span className="text-gray-500 dark:text-gray-400">{t('freeUsage')}</span>
                            <span className={`font-medium ${overLimit ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {Math.min(totalUsedMinutes, freeMin).toFixed(1)}/{freeMin} {t('minShort')}
                            </span>
                          </div>
                          <Progress value={usagePercent} className={`h-2 ${overLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-emerald-500'}`} />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-100 dark:border-gray-700 text-center">
                            <p className="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-400">{t('freeRemaining')}</p>
                            <p className={`text-xs md:text-sm font-bold ${freeRemaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                              {freeRemaining > 0 ? `${freeRemaining.toFixed(1)} ${t('minShort')}` : t('exhausted')}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-100 dark:border-gray-700 text-center">
                            <p className="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-400">{t('amountDue')}</p>
                            <p className={`text-xs md:text-sm font-bold ${cost > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{cost.toFixed(2)} {t('shekel')}</p>
                          </div>
                        </div>

                        {paidMinutes > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-200 dark:border-amber-800 text-center">
                            <p className="text-[10px] md:text-xs text-amber-700 dark:text-amber-400">
                              <AlertCircle className={`w-2.5 h-2.5 inline ${dir === 'rtl' ? 'ml-0.5' : 'mr-0.5'}`} />
                              {t('extraInfo')}: <span className="font-bold">{paidMinutes.toFixed(1)}</span> {t('minShort')} × {priceMin} {t('shekel')}
                            </p>
                          </div>
                        )}

                        <Separator />

                        <div className="flex gap-1.5 md:gap-2">
                          {isActive ? (
                            <Button onClick={() => handleStopSession(family.id, family.activeSessionId!)} className="flex-1 gap-1.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-sm text-xs h-8 md:h-9">
                              <Pause className="w-3.5 h-3.5" />{t('stop')}
                            </Button>
                          ) : (
                            <Button onClick={() => handleStartSession(family.id)} className="flex-1 gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-sm text-xs h-8 md:h-9">
                              <Play className="w-3.5 h-3.5" />{t('start')}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openEditFamily(family)} className="gap-1 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-400 dark:hover:border-cyan-600 bg-cyan-50/50 dark:bg-cyan-900/10 h-8 md:h-9" title={t('edit')}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => resetWeekly(family.id, family.name)} className="gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10 h-8 md:h-9" title={t('resetUsage')}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deleteFamily(family.id, family.name)} className="gap-1 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600 bg-red-50/50 dark:bg-red-900/10 h-8 md:h-9" title={t('delete')}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Expandable session history */}
                        {family.sessions && family.sessions.filter((s) => s.endTime).length > 0 && (
                          <div>
                            <button
                              onClick={() => setExpandedFamily(isExpanded ? null : family.id)}
                              className="w-full flex items-center justify-center gap-1 text-[10px] md:text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 py-1 transition-colors"
                            >
                              <History className="w-3 h-3" />
                              {isExpanded ? t('hideLog') : `${t('showLog')} (${family.sessions.filter((s) => s.endTime).length})`}
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {isExpanded && (
                              <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="overflow-x-auto max-h-40 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                        <th className={`px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('from')}</th>
                                        <th className={`px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('to')}</th>
                                        <th className={`px-2 py-1.5 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('duration')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {family.sessions
                                        .filter((s) => s.endTime)
                                        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                                        .slice(0, 5)
                                        .map((session) => (
                                          <tr key={session.id} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">{formatTimeOfDay(session.startTime)}</td>
                                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">{session.endTime ? formatTimeOfDay(session.endTime) : '-'}</td>
                                            <td className="px-2 py-1.5 font-mono font-medium text-gray-700 dark:text-gray-300">{formatTime(session.duration)}</td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </main>
        </>
      )}

      {/* ====== LOG VIEW ====== */}
      {currentView === 'log' && (
        <main className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-4">
          {/* Mobile: 2x2 Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-4 md:hidden">
            <Card className="border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-900/20 dark:to-gray-900">
              <CardContent className="p-3 text-center">
                <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{families.length}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('numberOfFamilies')}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-900">
              <CardContent className="p-3 text-center">
                <Timer className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{totalMinutesUsed.toFixed(1)}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('totalMinutes')}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-900">
              <CardContent className="p-3 text-center">
                <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{totalRevenue.toFixed(2)}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('totalAmountShekel')}</p>
              </CardContent>
            </Card>
            <Card className="border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/20 dark:to-gray-900">
              <CardContent className="p-3 text-center">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-rose-700 dark:text-rose-400">{totalFamiliesOverLimit}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('familiesOverLimit')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Desktop: Stats bar inline */}
          <div className="hidden md:grid grid-cols-4 gap-4 mb-4">
            <Card className="border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-900/20 dark:to-gray-900 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center"><Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /></div>
                <div><p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{families.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">{t('numberOfFamilies')}</p></div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-900 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><Timer className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                <div><p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{totalMinutesUsed.toFixed(1)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{t('totalMinutes')}</p></div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-900 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                <div><p className="text-xl font-bold text-amber-700 dark:text-amber-400">{totalRevenue.toFixed(2)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{t('totalAmountShekel')}</p></div>
              </CardContent>
            </Card>
            <Card className="border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/20 dark:to-gray-900 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" /></div>
                <div><p className="text-xl font-bold text-rose-700 dark:text-rose-400">{totalFamiliesOverLimit}</p><p className="text-xs text-gray-500 dark:text-gray-400">{t('familiesOverLimit')}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <Card className="mb-4 border-gray-200 dark:border-gray-700">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[150px]">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400`} />
                  <Input placeholder={t('search')} value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className={`${dir === 'rtl' ? 'pr-8' : 'pl-8'} ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs h-8`} />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant={selectedLogFamily === null ? 'default' : 'outline'} size="sm" onClick={() => setSelectedLogFamily(null)} className={`text-[10px] h-7 ${selectedLogFamily === null ? 'bg-cyan-600 text-white' : ''}`}>{t('all')}</Button>
                  {families.map((f) => (
                    <Button key={f.id} variant={selectedLogFamily === f.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedLogFamily(f.id)} className={`text-[10px] h-7 ${selectedLogFamily === f.id ? 'bg-cyan-600 text-white' : ''}`}>{f.name}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log entries */}
          <div className="space-y-3 md:space-y-4 mb-4">
            {families.filter((f) => !selectedLogFamily || f.id === selectedLogFamily).filter((f) => !logSearch || f.name.includes(logSearch)).map((family) => {
              const { totalMinutes, freeMinutes: freeMinutesVal, paidMinutes: paidMinutesVal, cost } = calculateCost(family)
              const familySessions = family.sessions?.filter((s) => s.endTime) || []
              const overLimit = isOverFreeLimit(family)
              const isActive = !!family.activeSessionId

              return (
                <Card key={family.id} className={`overflow-hidden ${overLimit ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'} hover:shadow-md transition-shadow`}>
                  <CardHeader className={`pb-2 bg-gradient-to-l ${dir === 'rtl' ? 'from-gray-50 to-white dark:from-gray-800 dark:to-gray-900' : 'from-white to-gray-50 dark:from-gray-900 dark:to-gray-800'}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${overLimit ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>
                          <Droplets className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm md:text-base">{family.name}</CardTitle>
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                            <CalendarDays className={`w-2.5 h-2.5 inline ${dir === 'rtl' ? 'ml-0.5' : 'mr-0.5'}`} />
                            {formatDate(family.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openEditFamily(family)} className="gap-1 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-400 dark:hover:border-cyan-600 bg-cyan-50/50 dark:bg-cyan-900/10 font-semibold h-7 text-[10px]">
                          <Pencil className="w-3 h-3" />
                          <span className="hidden sm:inline">{t('edit')}</span>
                        </Button>
                        {isActive && <Badge className="bg-emerald-500 text-white text-[9px] gap-0.5"><span className="w-1 h-1 rounded-full bg-white animate-pulse"></span>{t('fillingInProgress')}</Badge>}
                        {overLimit ? <Badge variant="destructive" className="text-[9px]">{t('overLimit')}</Badge> : <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] hover:bg-emerald-100 dark:hover:bg-emerald-900/40">{t('withinLimit')}</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2 text-center border border-cyan-100 dark:border-cyan-800"><p className="text-[9px] md:text-[10px] text-cyan-600 dark:text-cyan-400">{t('total')}</p><p className="text-sm font-bold text-cyan-700 dark:text-cyan-400">{totalMinutes.toFixed(1)}</p></div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800"><p className="text-[9px] md:text-[10px] text-emerald-600 dark:text-emerald-400">{t('free')}</p><p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{freeMinutesVal.toFixed(1)}</p></div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center border border-amber-100 dark:border-amber-800"><p className="text-[9px] md:text-[10px] text-amber-600 dark:text-amber-400">{t('paid')}</p><p className="text-sm font-bold text-amber-700 dark:text-amber-400">{paidMinutesVal.toFixed(1)}</p></div>
                      <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center border border-rose-100 dark:border-rose-800"><p className="text-[9px] md:text-[10px] text-rose-600 dark:text-rose-400">{t('cost')}</p><p className="text-sm font-bold text-rose-700 dark:text-rose-400">{cost.toFixed(2)}</p></div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700 col-span-2 md:col-span-1"><p className="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-400">{t('sessions')}</p><p className="text-sm font-bold text-gray-700 dark:text-gray-300">{familySessions.length}</p></div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] md:text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{t('freeLimitUsage')}</span>
                        <span className={`font-medium ${overLimit ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>{Math.min(totalMinutes, freeMin).toFixed(1)}/{freeMin} {t('minShort')}</span>
                      </div>
                      <Progress value={getUsagePercentage(family)} className={`h-2 ${overLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-emerald-500'}`} />
                    </div>

                    {familySessions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />{t('fillingLogTitle')}
                        </h4>
                        {/* Mobile: Card list */}
                        <div className="md:hidden space-y-2">
                          {familySessions
                            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                            .map((session, idx) => {
                              const sessionMinutes = session.duration / 60
                              const sessionsBefore = familySessions.filter((s) => new Date(s.startTime).getTime() > new Date(session.startTime).getTime()).reduce((acc, s) => acc + s.duration / 60, 0)
                              const freeRemainingBefore = Math.max(0, freeMin - Math.min(sessionsBefore, freeMin))
                              const paidInSession = Math.max(0, sessionMinutes - freeRemainingBefore)
                              const sessionCost = paidInSession * priceMin

                              return (
                                <div key={session.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('sessionNum')} #{idx + 1}</span>
                                    {sessionCost > 0 ? <Badge variant="destructive" className="text-[9px]">{sessionCost.toFixed(2)} {t('shekel')}</Badge> : <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] hover:bg-emerald-100 dark:hover:bg-emerald-900/40">{t('free')}</Badge>}
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                    <span className="font-mono">{formatTimeOfDay(session.startTime)}</span>
                                    <span>→</span>
                                    <span className="font-mono">{session.endTime ? formatTimeOfDay(session.endTime) : '-'}</span>
                                    <span className="font-mono font-medium">{formatTime(session.duration)}</span>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                        {/* Desktop: Table view */}
                        <div className="hidden md:block rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                  <th className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>#</th>
                                  <th className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('date')}</th>
                                  <th className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('from')}</th>
                                  <th className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('to')}</th>
                                  <th className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('duration')}</th>
                                  <th className={`px-3 py-2 font-medium text-gray-600 dark:text-gray-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('costColumn')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {familySessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((session, idx) => {
                                  const sessionMinutes = session.duration / 60
                                  const sessionsBefore = familySessions.filter((s) => new Date(s.startTime).getTime() > new Date(session.startTime).getTime()).reduce((acc, s) => acc + s.duration / 60, 0)
                                  const freeRemainingBefore = Math.max(0, freeMin - Math.min(sessionsBefore, freeMin))
                                  const paidInSession = Math.max(0, sessionMinutes - freeRemainingBefore)
                                  const sessionCost = paidInSession * priceMin

                                  return (
                                    <tr key={session.id} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{idx + 1}</td>
                                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(session.startTime)}</td>
                                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono">{formatTimeOfDay(session.startTime)}</td>
                                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono">{session.endTime ? formatTimeOfDay(session.endTime) : '-'}</td>
                                      <td className="px-3 py-2">
                                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{formatTime(session.duration)}</span>
                                        <span className={`text-gray-400 dark:text-gray-500 ${dir === 'rtl' ? 'mr-0.5' : 'ml-0.5'}`}>({sessionMinutes.toFixed(1)}{t('minShort')})</span>
                                      </td>
                                      <td className="px-3 py-2">
                                        {sessionCost > 0 ? <Badge variant="destructive" className="text-[9px]">{sessionCost.toFixed(2)}</Badge> : <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[9px] hover:bg-emerald-100 dark:hover:bg-emerald-900/40">{t('free')}</Badge>}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <footer className="mt-6 pb-4">
            <div className="text-center text-[10px] md:text-xs text-gray-400 dark:text-gray-500">{t('fillingLogFooter')}</div>
          </footer>
        </main>
      )}
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
