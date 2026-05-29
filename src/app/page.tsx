'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Users,
  Plus,
  Trash2,
  Play,
  Pause,
  Timer,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
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
} from 'lucide-react'
import {
  type Family,
  type AppSettings,
  getFamilies,
  getSettings,
  saveSettings as storeSaveSettings,
  resetSettings as storeResetSettings,
  addFamily as storeAddFamily,
  updateFamily as storeUpdateFamily,
  deleteFamily as storeDeleteFamily,
  startSession as storeStartSession,
  stopSession as storeStopSession,
  resetWeeklyUsage as storeResetWeeklyUsage,
  resetAllWeeklyUsage as storeResetAllWeeklyUsage,
} from '@/lib/store'

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
  const [families, setFamilies] = useState<FamilyWithUsage[]>([])
  const [settings, setSettings] = useState<AppSettings>({ freeMinutesPerWeek: 12, pricePerMinute: 0.5, autoResetWeekly: true, resetDay: 6, lastAutoReset: null })
  const [newFamilyName, setNewFamilyName] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [editFamilyDialogOpen, setEditFamilyDialogOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<{ id: string; name: string } | null>(null)
  const [editFamilyName, setEditFamilyName] = useState('')
  const [settingsForm, setSettingsForm] = useState<AppSettings>({ freeMinutesPerWeek: 12, pricePerMinute: 0.5, autoResetWeekly: true, resetDay: 6, lastAutoReset: null })
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
    open: false, title: '', message: '', confirmLabel: 'تأكيد', cancelLabel: 'إلغاء', variant: 'danger', onConfirm: () => {}
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
      confirmLabel: variant === 'danger' ? 'حذف' : variant === 'warning' ? 'تأكيد' : 'موافق',
      cancelLabel: 'إلغاء',
      variant,
      onConfirm: () => {
        setConfirmState((prev) => ({ ...prev, open: false }))
        onConfirm()
      },
    })
  }, [])

  const freeMin = settings.freeMinutesPerWeek
  const priceMin = settings.pricePerMinute

  // Arabic day names for selector
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const resetDayName = dayNames[settings.resetDay ?? 6] || 'السبت'

  // Calculate week start based on the selected reset day
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
      showToast('success', 'تم تثبيت التطبيق بنجاح!')
    }
    setInstallPrompt(null)
  }

  const refreshFamilies = useCallback(() => {
    try {
      const data = getFamilies()
      const currentSettings = getSettings()
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
      showToast('error', 'حدث خطأ في تحميل البيانات')
    }
  }, [startTimerInterval, showToast])

  useEffect(() => {
    const init = () => {
      refreshFamilies()
      setLoading(false)
    }
    init()
    return () => { Object.values(timerIntervals.current).forEach(clearInterval) }
  }, [refreshFamilies])

  // Family operations
  const addFamily = () => {
    if (!newFamilyName.trim()) return
    storeAddFamily(newFamilyName.trim())
    setNewFamilyName('')
    setAddDialogOpen(false)
    refreshFamilies()
    showToast('success', `تمت إضافة عائلة "${newFamilyName.trim()}" بنجاح`)
  }

  const deleteFamily = (id: string, name: string) => {
    showConfirm(
      'حذف العائلة',
      `هل أنت متأكد من حذف عائلة "${name}"؟ سيتم حذف جميع بياناتها وجلساتها.`,
      () => {
        storeDeleteFamily(id)
        stopTimerInterval(id)
        setTimers((prev) => { const n = { ...prev }; delete n[id]; return n })
        refreshFamilies()
        showToast('success', `تم حذف عائلة "${name}"`)
      },
      'danger'
    )
  }

  const openEditFamily = (family: FamilyWithUsage) => {
    setEditingFamily({ id: family.id, name: family.name })
    setEditFamilyName(family.name)
    setEditFamilyDialogOpen(true)
  }

  const saveEditFamily = () => {
    if (!editingFamily || !editFamilyName.trim()) return
    storeUpdateFamily(editingFamily.id, editFamilyName.trim())
    setEditFamilyDialogOpen(false)
    setEditingFamily(null)
    refreshFamilies()
    showToast('success', 'تم تعديل اسم العائلة بنجاح')
  }

  const handleStartSession = (familyId: string) => {
    const result = storeStartSession(familyId)
    if (result.success) {
      setTimers((prev) => ({ ...prev, [familyId]: 0 }))
      startTimerInterval(familyId)
      refreshFamilies()
      showToast('info', 'تم بدء جلسة التعبئة', 2000)
    } else {
      showToast('error', result.error || 'حدث خطأ في بدء الجلسة')
    }
  }

  const handleStopSession = (familyId: string, sessionId: string) => {
    const elapsed = timers[familyId] || 0
    storeStopSession(familyId, sessionId, elapsed)
    stopTimerInterval(familyId)
    refreshFamilies()
    const mins = (elapsed / 60).toFixed(1)
    showToast('success', `تم إيقاف الجلسة - المدة: ${mins} دقيقة`)
  }

  const resetWeekly = (familyId: string, familyName: string) => {
    showConfirm(
      'إعادة تعيين الاستخدام',
      `هل أنت متأكد من إعادة تعيين الاستخدام الأسبوعي لعائلة "${familyName}"؟`,
      () => {
        storeResetWeeklyUsage(familyId)
        stopTimerInterval(familyId)
        setTimers((prev) => { const n = { ...prev }; delete n[familyId]; return n })
        refreshFamilies()
        showToast('success', `تم إعادة تعيين الاستخدام لعائلة "${familyName}"`)
      },
      'warning'
    )
  }

  const resetAllCounters = () => {
    showConfirm(
      'تصفير جميع العدادات',
      'هل أنت متأكد من تصفير جميع العدادات؟ سيتم حذف جميع الجلسات لجميع العائلات.',
      () => {
        families.forEach((family) => {
          if (family.activeSessionId) {
            stopTimerInterval(family.id)
          }
        })
        setTimers({})
        storeResetAllWeeklyUsage()
        refreshFamilies()
        showToast('success', 'تم تصفير جميع العدادات بنجاح')
      },
      'warning'
    )
  }

  // Settings operations
  const openSettings = () => {
    setSettingsForm({ ...settings })
    setSettingsDialogOpen(true)
  }

  const saveSettingsForm = () => {
    if (settingsForm.freeMinutesPerWeek <= 0 || settingsForm.pricePerMinute < 0) return
    storeSaveSettings(settingsForm)
    setSettingsDialogOpen(false)
    refreshFamilies()
    showToast('success', 'تم حفظ الإعدادات بنجاح')
  }

  const handleResetSettings = () => {
    storeResetSettings()
    setSettingsForm({ freeMinutesPerWeek: 12, pricePerMinute: 0.5, autoResetWeekly: true, resetDay: 6, lastAutoReset: null })
    refreshFamilies()
    showToast('info', 'تم استعادة الإعدادات الافتراضية')
  }

  // Toggle auto-reset (only from settings)
  const toggleAutoReset = (checked: boolean) => {
    const updated = { ...settings, autoResetWeekly: checked }
    storeSaveSettings(updated)
    setSettings(updated)
    showToast('info', checked ? `تم تفعيل التصفير التلقائي كل ${resetDayName}` : 'تم تعطيل التصفير التلقائي - استخدم زر التصفير', 3000)
  }

  // Auto-reset check: run on load and periodically
  useEffect(() => {
    const checkAutoReset = () => {
      try {
        const currentSettings = getSettings()
        if (!currentSettings.autoResetWeekly) return

        const weekStart = getWeekStart(currentSettings.resetDay ?? 6)
        const lastReset = currentSettings.lastAutoReset ? new Date(currentSettings.lastAutoReset) : null

        if (!lastReset || lastReset < weekStart) {
          storeResetAllWeeklyUsage()
          const newSettings = { ...currentSettings, lastAutoReset: new Date().toISOString() }
          storeSaveSettings(newSettings)
          setSettings(newSettings)
          setTimers({})
          Object.values(timerIntervals.current).forEach(clearInterval)
          timerIntervals.current = {}
          refreshFamilies()
          showToast('success', 'تم التصفير التلقائي الأسبوعي', 4000)
        }
      } catch {
        // Silently handle auto-reset errors
      }
    }

    checkAutoReset()
    const interval = setInterval(checkAutoReset, 60000)
    return () => clearInterval(interval)
  }, [refreshFamilies, showToast, resetDayName])

  // Formatting helpers
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const hours = Math.floor(mins / 60)
    if (hours > 0) return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
  const formatTimeOfDay = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

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
    success: { icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-600', textColor: 'text-emerald-800' },
    error: { icon: AlertCircle, bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-600', textColor: 'text-red-800' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', iconColor: 'text-amber-600', textColor: 'text-amber-800' },
    info: { icon: Info, bg: 'bg-cyan-50', border: 'border-cyan-200', iconColor: 'text-cyan-600', textColor: 'text-cyan-800' },
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50">
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
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              {confirmState.variant === 'danger' && <AlertCircle className="w-5 h-5 text-red-600" />}
              {confirmState.variant === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {confirmState.variant === 'info' && <Info className="w-5 h-5 text-cyan-600" />}
              {confirmState.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">{confirmState.message}</p>
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
            <span className="text-sm font-medium">ثبّت التطبيق على هاتفك</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleInstall} className="gap-1"><Smartphone className="w-3 h-3" />تثبيت</Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => setShowInstallBanner(false)}>✕</Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-cyan-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-200">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-800">تعبئة المياه</h1>
              <p className="text-[10px] text-gray-500">إدارة استهلاك المياه للعائلات</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {activeFamilyCount > 0 && (
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                {activeFamilyCount} نشط
              </Badge>
            )}
            {/* Reset status indicator - no switch, just status + optional reset button */}
            {settings.autoResetWeekly ? (
              <div className="flex items-center gap-1.5 bg-emerald-50/80 rounded-lg border border-emerald-200 px-2 py-1">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] font-semibold text-emerald-700">تلقائي</span>
                <span className="text-[9px] text-emerald-600 bg-emerald-100 rounded px-1 py-0.5 border border-emerald-300">{resetDayName}</span>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={resetAllCounters} className="gap-1 text-xs border-red-300 text-red-700 hover:text-red-800 hover:bg-red-50 hover:border-red-400 bg-red-50/50 font-semibold h-7 px-2" title="تصفير جميع العدادات">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تصفير</span>
              </Button>
            )}
            {/* Settings Button */}
            <Button variant="outline" size="sm" onClick={openSettings} className="gap-1.5 text-xs border-cyan-300 text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 hover:border-cyan-400 bg-cyan-50/50 font-semibold">
              <Settings className="w-4 h-4" />
              <span>الإعدادات</span>
            </Button>
            <Button
              variant={currentView === 'log' ? 'default' : 'outline'}
              size="sm"
              className={`gap-1.5 text-xs ${currentView === 'log' ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-50'}`}
              onClick={() => setCurrentView(currentView === 'log' ? 'dashboard' : 'log')}
            >
              <History className="w-3.5 h-3.5" />
              <span>السجل</span>
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-md text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-right">
                    <Users className="w-5 h-5 text-cyan-600" />
                    إضافة عائلة جديدة
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>اسم العائلة</Label>
                    <Input placeholder="أدخل اسم العائلة..." value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFamily()} className="text-right" />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                  <Button onClick={addFamily} disabled={!newFamilyName.trim()} className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white">إضافة</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* ====== SETTINGS DIALOG ====== */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Settings className="w-5 h-5 text-cyan-600" />
              إعدادات التطبيق
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="free-minutes" className="text-sm font-medium text-gray-700">
                الدقائق المجانية الأسبوعية
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
              <p className="text-[10px] text-gray-400">عدد الدقائق المجانية لكل عائلة أسبوعياً</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="price-minute" className="text-sm font-medium text-gray-700">
                سعر الدقيقة الإضافية (شيكل)
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
              <p className="text-[10px] text-gray-400">سعر كل دقيقة بعد تجاوز الحد المجاني</p>
            </div>

            {/* Auto Reset Weekly */}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  تصفير تلقائي أسبوعي
                </Label>
                <p className="text-[10px] text-gray-400">يتم تصفير العدادات تلقائياً كل أسبوع</p>
              </div>
              <Switch
                checked={settingsForm.autoResetWeekly}
                onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, autoResetWeekly: checked }))}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            {/* Reset Day Selector - only visible when auto reset is on */}
            {settingsForm.autoResetWeekly && (
              <div className="space-y-2 bg-emerald-50/50 border border-emerald-200 rounded-xl p-3">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-emerald-600" />
                  يوم التصفير الأسبوعي
                </Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {dayNames.map((name, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSettingsForm((prev) => ({ ...prev, resetDay: index }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        settingsForm.resetDay === index
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 border border-emerald-500'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">يتم تصفير العدادات تلقائياً كل يوم {dayNames[settingsForm.resetDay ?? 6]}</p>
              </div>
            )}

            {/* Preview */}
            <div className="bg-gradient-to-r from-cyan-50 to-emerald-50 border border-cyan-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-cyan-800 mb-1.5">معاينة الإعدادات:</p>
              <div className="flex justify-between text-xs text-gray-600">
                <span>الحد المجاني:</span>
                <span className="font-bold text-emerald-700">{settingsForm.freeMinutesPerWeek} دقيقة/أسبوع</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>سعر الإضافي:</span>
                <span className="font-bold text-amber-700">{settingsForm.pricePerMinute} شيكل/دقيقة</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>التصفير:</span>
                <span className={`font-bold ${settingsForm.autoResetWeekly ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {settingsForm.autoResetWeekly ? `تلقائي كل ${dayNames[settingsForm.resetDay ?? 6]}` : 'يدوي بالزر'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleResetSettings} className="gap-1.5 text-amber-600 hover:text-amber-700">
              <RotateCcw className="w-3.5 h-3.5" />
              استعادة الافتراضي
            </Button>
            <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
            <Button onClick={saveSettingsForm} disabled={settingsForm.freeMinutesPerWeek <= 0 || settingsForm.pricePerMinute < 0} className="gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white">
              <Save className="w-3.5 h-3.5" />
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== EDIT FAMILY DIALOG ====== */}
      <Dialog open={editFamilyDialogOpen} onOpenChange={setEditFamilyDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Pencil className="w-5 h-5 text-cyan-600" />
              تعديل بيانات العائلة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم العائلة</Label>
              <Input
                placeholder="أدخل الاسم الجديد..."
                value={editFamilyName}
                onChange={(e) => setEditFamilyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEditFamily()}
                className="text-right"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
            <Button onClick={saveEditFamily} disabled={!editFamilyName.trim()} className="gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white">
              <Save className="w-3.5 h-3.5" />
              حفظ التعديل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DASHBOARD VIEW */}
      {currentView === 'dashboard' && (
        <>
          <div className="max-w-6xl mx-auto px-3 mt-3">
            <div className="bg-gradient-to-r from-cyan-50 to-emerald-50 border border-cyan-200 rounded-xl p-3 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-700" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-cyan-800">مجاني: {freeMin} دقيقة/أسبوع</p>
                  <p className="text-[10px] text-cyan-600">إضافي: {priceMin} شيكل/دقيقة</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span><span className="text-gray-600">مجاني</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span><span className="text-gray-600">مدفوع</span></div>
              </div>
            </div>
          </div>

          <main className="max-w-6xl mx-auto px-3 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-600 animate-spin"></div>
                <p className="text-gray-500">جاري التحميل...</p>
              </div>
            ) : families.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-20 h-20 rounded-full bg-cyan-50 flex items-center justify-center"><Users className="w-10 h-10 text-cyan-300" /></div>
                <h2 className="text-lg font-semibold text-gray-700">لا توجد عائلات بعد</h2>
                <p className="text-gray-500 text-sm">اضغط على &quot;إضافة&quot; لبدء الاستخدام</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {families.map((family) => {
                  const isActive = !!family.activeSessionId
                  const timerSeconds = timers[family.id] || 0
                  const totalUsedMinutes = (family.weeklySeconds + timerSeconds) / 60
                  const { paidMinutes, cost } = calculateCost(family)
                  const usagePercent = getUsagePercentage(family)
                  const overLimit = isOverFreeLimit(family)
                  const freeRemaining = Math.max(0, freeMin - totalUsedMinutes)

                  return (
                    <Card key={family.id} className={`overflow-hidden transition-all duration-300 border-2 ${isActive ? 'border-emerald-400 shadow-lg shadow-emerald-100 ring-1 ring-emerald-200' : overLimit ? 'border-amber-300 shadow-md shadow-amber-50' : 'border-gray-200 hover:border-cyan-300 hover:shadow-md hover:shadow-cyan-50'}`}>
                      {isActive && <div className="h-1 bg-gradient-to-r from-cyan-500 to-emerald-500 animate-pulse" />}
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100 text-emerald-600' : overLimit ? 'bg-amber-100 text-amber-600' : 'bg-cyan-100 text-cyan-600'}`}>
                              <Droplets className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate max-w-[120px]">{family.name}</span>
                          </CardTitle>
                          <div className="flex items-center gap-1">
                            {isActive && <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0"><span className="w-1 h-1 rounded-full bg-white animate-pulse ml-0.5"></span>نشط</Badge>}
                            {overLimit && !isActive && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">تجاوز</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className={`text-center py-3 rounded-xl ${isActive ? 'bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                          <div className="text-3xl font-mono font-bold tracking-wider">
                            <span className={isActive ? 'text-emerald-700' : 'text-gray-700'}>{formatTime(timerSeconds)}</span>
                          </div>
                          {isActive && <p className="text-[10px] text-emerald-600 mt-0.5">جاري التعبئة...</p>}
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-500">الاستخدام المجاني</span>
                            <span className={`font-medium ${overLimit ? 'text-amber-600' : 'text-gray-700'}`}>
                              {Math.min(totalUsedMinutes, freeMin).toFixed(1)}/{freeMin} د
                            </span>
                          </div>
                          <Progress value={usagePercent} className={`h-2 ${overLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-emerald-500'}`} />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                            <p className="text-[9px] text-gray-500">المتبقي مجاناً</p>
                            <p className={`text-xs font-bold ${freeRemaining > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {freeRemaining > 0 ? `${freeRemaining.toFixed(1)} د` : 'انتهى'}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                            <p className="text-[9px] text-gray-500">المبلغ المستحق</p>
                            <p className={`text-xs font-bold ${cost > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{cost.toFixed(2)} شيكل</p>
                          </div>
                        </div>

                        {paidMinutes > 0 && (
                          <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 text-center">
                            <p className="text-[10px] text-amber-700">
                              <AlertCircle className="w-2.5 h-2.5 inline ml-0.5" />
                              إضافي: <span className="font-bold">{paidMinutes.toFixed(1)}</span> د × {priceMin} شيكل
                            </p>
                          </div>
                        )}

                        <Separator />

                        <div className="flex gap-1.5">
                          {isActive ? (
                            <Button onClick={() => handleStopSession(family.id, family.activeSessionId!)} className="flex-1 gap-1.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-sm text-xs h-8">
                              <Pause className="w-3.5 h-3.5" />إيقاف
                            </Button>
                          ) : (
                            <Button onClick={() => handleStartSession(family.id)} className="flex-1 gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-sm text-xs h-8">
                              <Play className="w-3.5 h-3.5" />تشغيل
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openEditFamily(family)} className="gap-1 border-cyan-300 text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 hover:border-cyan-400 bg-cyan-50/50 font-semibold h-8 text-[10px]">
                            <Pencil className="w-3 h-3" />
                            <span>تعديل</span>
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => setExpandedFamily(expandedFamily === family.id ? null : family.id)} className="border-gray-200 h-8 w-8">
                            {expandedFamily === family.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => resetWeekly(family.id, family.name)} className="border-gray-200 text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 w-8" title="إعادة تعيين">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => deleteFamily(family.id, family.name)} className="border-gray-200 text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {expandedFamily === family.id && (
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Separator />
                            <p className="text-[10px] font-semibold text-gray-600 flex items-center gap-1">
                              <Timer className="w-2.5 h-2.5" />تفاصيل الأسبوع
                            </p>
                            <ScrollArea className="max-h-32">
                              {family.sessions && family.sessions.length > 0 ? (
                                <div className="space-y-1">
                                  {family.sessions.filter((s) => s.endTime).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((session) => (
                                    <div key={session.id} className="flex items-center justify-between text-[10px] bg-gray-50 rounded-lg px-2 py-1.5">
                                      <div className="flex items-center gap-1">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                        <span className="text-gray-600">{formatDateTime(session.startTime)}</span>
                                      </div>
                                      <span className="font-medium text-gray-700">{formatTime(session.duration)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-gray-400 text-center py-2">لا توجد جلسات سابقة</p>
                              )}
                            </ScrollArea>
                            <div className="flex justify-between text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                              <span>إجمالي الأسبوع:</span>
                              <span className="font-medium">{formatTime(family.weeklySeconds)}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </main>
          <footer className="mt-6 pb-4">
            <div className="max-w-6xl mx-auto px-3 text-center text-[10px] text-gray-400">نظام حساب تعبئة المياه</div>
          </footer>
        </>
      )}

      {/* LOG VIEW */}
      {currentView === 'log' && (
        <main className="max-w-6xl mx-auto px-3 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-white">
              <CardContent className="p-3 text-center">
                <Users className="w-5 h-5 text-cyan-600 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-cyan-700">{families.length}</p>
                <p className="text-[10px] text-gray-500">عدد العائلات</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-3 text-center">
                <Timer className="w-5 h-5 text-emerald-600 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-emerald-700">{totalMinutesUsed.toFixed(1)}</p>
                <p className="text-[10px] text-gray-500">إجمالي الدقائق</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-3 text-center">
                <Coins className="w-5 h-5 text-amber-600 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-amber-700">{totalRevenue.toFixed(2)}</p>
                <p className="text-[10px] text-gray-500">إجمالي المبلغ (شيكل)</p>
              </CardContent>
            </Card>
            <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white">
              <CardContent className="p-3 text-center">
                <AlertCircle className="w-5 h-5 text-rose-600 mx-auto mb-0.5" />
                <p className="text-xl font-bold text-rose-700">{totalFamiliesOverLimit}</p>
                <p className="text-[10px] text-gray-500">تجاوزوا الحد</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-4 border-gray-200">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[150px]">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input placeholder="بحث..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="pr-8 text-right text-xs h-8" />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant={selectedLogFamily === null ? 'default' : 'outline'} size="sm" onClick={() => setSelectedLogFamily(null)} className={`text-[10px] h-7 ${selectedLogFamily === null ? 'bg-cyan-600 text-white' : ''}`}>الكل</Button>
                  {families.map((f) => (
                    <Button key={f.id} variant={selectedLogFamily === f.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedLogFamily(f.id)} className={`text-[10px] h-7 ${selectedLogFamily === f.id ? 'bg-cyan-600 text-white' : ''}`}>{f.name}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3 mb-4">
            {families.filter((f) => !selectedLogFamily || f.id === selectedLogFamily).filter((f) => !logSearch || f.name.includes(logSearch)).map((family) => {
              const { totalMinutes, freeMinutes: freeMinutesVal, paidMinutes: paidMinutesVal, cost } = calculateCost(family)
              const familySessions = family.sessions?.filter((s) => s.endTime) || []
              const overLimit = isOverFreeLimit(family)
              const isActive = !!family.activeSessionId

              return (
                <Card key={family.id} className={`overflow-hidden ${overLimit ? 'border-amber-300' : 'border-gray-200'}`}>
                  <CardHeader className="pb-2 bg-gradient-to-l from-gray-50 to-white">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${overLimit ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          <Droplets className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{family.name}</CardTitle>
                          <p className="text-[10px] text-gray-500">
                            <CalendarDays className="w-2.5 h-2.5 inline ml-0.5" />
                            {formatDate(family.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEditFamily(family)} className="gap-1 border-cyan-300 text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 hover:border-cyan-400 bg-cyan-50/50 font-semibold h-7 text-[10px]">
                          <Pencil className="w-3 h-3" />
                          <span>تعديل</span>
                        </Button>
                        {isActive && <Badge className="bg-emerald-500 text-white text-[9px] gap-0.5"><span className="w-1 h-1 rounded-full bg-white animate-pulse"></span>قيد التعبئة</Badge>}
                        {overLimit ? <Badge variant="destructive" className="text-[9px]">تجاوز</Badge> : <Badge className="bg-emerald-100 text-emerald-700 text-[9px] hover:bg-emerald-100">ضمن الحد</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div className="bg-cyan-50 rounded-lg p-2 text-center border border-cyan-100"><p className="text-[9px] text-cyan-600">إجمالي</p><p className="text-sm font-bold text-cyan-700">{totalMinutes.toFixed(1)}</p></div>
                      <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100"><p className="text-[9px] text-emerald-600">المجاني</p><p className="text-sm font-bold text-emerald-700">{freeMinutesVal.toFixed(1)}</p></div>
                      <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-100"><p className="text-[9px] text-amber-600">المدفوع</p><p className="text-sm font-bold text-amber-700">{paidMinutesVal.toFixed(1)}</p></div>
                      <div className="bg-rose-50 rounded-lg p-2 text-center border border-rose-100"><p className="text-[9px] text-rose-600">المبلغ</p><p className="text-sm font-bold text-rose-700">{cost.toFixed(2)}</p></div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-200"><p className="text-[9px] text-gray-500">الجلسات</p><p className="text-sm font-bold text-gray-700">{familySessions.length}</p></div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">استخدام الحد المجاني</span>
                        <span className={`font-medium ${overLimit ? 'text-amber-600' : 'text-gray-700'}`}>{Math.min(totalMinutes, freeMin).toFixed(1)}/{freeMin} د</span>
                      </div>
                      <Progress value={getUsagePercentage(family)} className={`h-2 ${overLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-emerald-500'}`} />
                    </div>

                    {familySessions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-cyan-600" />سجل الجلسات
                        </h4>
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="px-2 py-2 text-right font-medium text-gray-600">#</th>
                                  <th className="px-2 py-2 text-right font-medium text-gray-600">التاريخ</th>
                                  <th className="px-2 py-2 text-right font-medium text-gray-600">من</th>
                                  <th className="px-2 py-2 text-right font-medium text-gray-600">إلى</th>
                                  <th className="px-2 py-2 text-right font-medium text-gray-600">المدة</th>
                                  <th className="px-2 py-2 text-right font-medium text-gray-600">التكلفة</th>
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
                                    <tr key={session.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                                      <td className="px-2 py-1.5 text-gray-500">{idx + 1}</td>
                                      <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{formatDate(session.startTime)}</td>
                                      <td className="px-2 py-1.5 text-gray-700 font-mono">{formatTimeOfDay(session.startTime)}</td>
                                      <td className="px-2 py-1.5 text-gray-700 font-mono">{session.endTime ? formatTimeOfDay(session.endTime) : '-'}</td>
                                      <td className="px-2 py-1.5">
                                        <span className="font-mono font-medium">{formatTime(session.duration)}</span>
                                        <span className="text-gray-400 mr-0.5">({sessionMinutes.toFixed(1)}د)</span>
                                      </td>
                                      <td className="px-2 py-1.5">
                                        {sessionCost > 0 ? <Badge variant="destructive" className="text-[9px]">{sessionCost.toFixed(2)}</Badge> : <Badge className="bg-emerald-100 text-emerald-700 text-[9px] hover:bg-emerald-100">مجاني</Badge>}
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
            <div className="text-center text-[10px] text-gray-400">نظام حساب تعبئة المياه - سجل التعبئة</div>
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
