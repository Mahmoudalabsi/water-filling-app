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
  FileBarChart,
  Database,
} from 'lucide-react'

const FREE_MINUTES_PER_WEEK = 12
const PRICE_PER_MINUTE = 0.5 // Shekel

interface Family {
  id: string
  name: string
  createdAt: string
  sessions: Session[]
}

interface Session {
  id: string
  familyId: string
  startTime: string
  endTime: string | null
  duration: number
  createdAt: string
}

interface FamilyWithUsage extends Family {
  weeklySeconds: number
  activeSessionId: string | null
  activeSessionStart: string | null
}

type ViewMode = 'dashboard' | 'log'

export default function Home() {
  const [families, setFamilies] = useState<FamilyWithUsage[]>([])
  const [newFamilyName, setNewFamilyName] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [timers, setTimers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard')
  const [logSearch, setLogSearch] = useState('')
  const [selectedLogFamily, setSelectedLogFamily] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const timerIntervals = useRef<Record<string, NodeJS.Timeout>>({})

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families')
      const data: Family[] = await res.json()

      const familiesWithUsage: FamilyWithUsage[] = await Promise.all(
        data.map(async (family) => {
          const sessionRes = await fetch(`/api/sessions?familyId=${family.id}`)
          const sessionData = await sessionRes.json()

          const activeSession = family.sessions?.find((s) => !s.endTime)

          return {
            ...family,
            weeklySeconds: sessionData.totalSeconds || 0,
            activeSessionId: activeSession?.id || null,
            activeSessionStart: activeSession?.startTime || null,
          }
        })
      )

      setFamilies(familiesWithUsage)

      familiesWithUsage.forEach((family) => {
        if (family.activeSessionId && family.activeSessionStart) {
          const elapsed = Math.floor(
            (Date.now() - new Date(family.activeSessionStart).getTime()) / 1000
          )
          setTimers((prev) => ({
            ...prev,
            [family.id]: elapsed,
          }))
          startTimerInterval(family.id)
        }
      })
    } catch (error) {
      console.error('Error fetching families:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFamilies()
    return () => {
      Object.values(timerIntervals.current).forEach(clearInterval)
    }
  }, [fetchFamilies])

  const startTimerInterval = (familyId: string) => {
    if (timerIntervals.current[familyId]) return
    timerIntervals.current[familyId] = setInterval(() => {
      setTimers((prev) => ({
        ...prev,
        [familyId]: (prev[familyId] || 0) + 1,
      }))
    }, 1000)
  }

  const stopTimerInterval = (familyId: string) => {
    if (timerIntervals.current[familyId]) {
      clearInterval(timerIntervals.current[familyId])
      delete timerIntervals.current[familyId]
    }
  }

  const addFamily = async () => {
    if (!newFamilyName.trim()) return
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFamilyName.trim() }),
      })
      if (res.ok) {
        setNewFamilyName('')
        setAddDialogOpen(false)
        await fetchFamilies()
      }
    } catch (error) {
      console.error('Error adding family:', error)
    }
  }

  const deleteFamily = async (id: string) => {
    try {
      await fetch(`/api/families?id=${id}`, { method: 'DELETE' })
      stopTimerInterval(id)
      setTimers((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await fetchFamilies()
    } catch (error) {
      console.error('Error deleting family:', error)
    }
  }

  const startSession = async (familyId: string) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId }),
      })
      if (res.ok) {
        setTimers((prev) => ({ ...prev, [familyId]: 0 }))
        startTimerInterval(familyId)
        await fetchFamilies()
      } else {
        const data = await res.json()
        alert(data.error || 'حدث خطأ')
      }
    } catch (error) {
      console.error('Error starting session:', error)
    }
  }

  const stopSession = async (familyId: string, sessionId: string) => {
    try {
      const elapsed = timers[familyId] || 0
      await fetch('/api/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, duration: elapsed }),
      })
      stopTimerInterval(familyId)
      await fetchFamilies()
    } catch (error) {
      console.error('Error stopping session:', error)
    }
  }

  const resetWeeklyUsage = async (familyId: string) => {
    if (!confirm('هل أنت متأكد من إعادة تعيين الاستخدام الأسبوعي؟')) return
    try {
      await fetch(`/api/sessions?familyId=${familyId}`, { method: 'PATCH' })
      stopTimerInterval(familyId)
      setTimers((prev) => {
        const next = { ...prev }
        delete next[familyId]
        return next
      })
      await fetchFamilies()
    } catch (error) {
      console.error('Error resetting usage:', error)
    }
  }

  const seedData = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (res.ok) {
        await fetchFamilies()
      }
    } catch (error) {
      console.error('Error seeding data:', error)
    } finally {
      setSeeding(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const hours = Math.floor(mins / 60)
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTimeOfDay = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const calculateCost = (family: FamilyWithUsage) => {
    const totalSeconds = family.weeklySeconds + (timers[family.id] || 0)
    const totalMinutes = totalSeconds / 60
    const freeMinutes = Math.min(totalMinutes, FREE_MINUTES_PER_WEEK)
    const paidMinutes = Math.max(0, totalMinutes - FREE_MINUTES_PER_WEEK)
    const cost = paidMinutes * PRICE_PER_MINUTE
    return { totalMinutes, freeMinutes, paidMinutes, cost }
  }

  const getUsagePercentage = (family: FamilyWithUsage) => {
    const totalSeconds = family.weeklySeconds + (timers[family.id] || 0)
    const totalMinutes = totalSeconds / 60
    return Math.min((totalMinutes / FREE_MINUTES_PER_WEEK) * 100, 100)
  }

  const isOverFreeLimit = (family: FamilyWithUsage) => {
    const totalSeconds = family.weeklySeconds + (timers[family.id] || 0)
    return totalSeconds / 60 > FREE_MINUTES_PER_WEEK
  }

  const activeFamilyCount = families.filter((f) => f.activeSessionId).length

  // Log page calculations
  const allSessions = families.flatMap((family) =>
    (family.sessions || [])
      .filter((s) => s.endTime)
      .map((s) => ({
        ...s,
        familyName: family.name,
        familyId: family.id,
      }))
  )

  const filteredSessions = allSessions
    .filter((s) => {
      const matchesSearch =
        !logSearch ||
        s.familyName.includes(logSearch) ||
        formatDateTime(s.startTime).includes(logSearch)
      const matchesFamily = !selectedLogFamily || s.familyId === selectedLogFamily
      return matchesSearch && matchesFamily
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

  const totalRevenue = families.reduce((acc, f) => {
    const { cost } = calculateCost(f)
    return acc + cost
  }, 0)

  const totalFamiliesOverLimit = families.filter((f) => isOverFreeLimit(f)).length
  const totalMinutesUsed = families.reduce((acc, f) => acc + f.weeklySeconds / 60, 0)

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-cyan-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-200">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">نظام حساب تعبئة المياه</h1>
              <p className="text-xs text-gray-500">إدارة وتتبع استهلاك المياه للعائلات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeFamilyCount > 0 && (
              <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                {activeFamilyCount} نشط
              </Badge>
            )}

            {/* Navigation Buttons */}
            <Button
              variant={currentView === 'log' ? 'default' : 'outline'}
              className={`gap-2 ${currentView === 'log' ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-50'}`}
              onClick={() => setCurrentView(currentView === 'log' ? 'dashboard' : 'log')}
            >
              <History className="w-4 h-4" />
              سجل التعبئة
            </Button>

            {families.length === 0 && (
              <Button
                onClick={seedData}
                disabled={seeding}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
              >
                {seeding ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                بيانات تجريبية
              </Button>
            )}

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-md shadow-cyan-200">
                  <Plus className="w-4 h-4" />
                  إضافة عائلة
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
                    <label className="text-sm font-medium text-gray-700">اسم العائلة</label>
                    <Input
                      placeholder="أدخل اسم العائلة..."
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addFamily()}
                      className="text-right"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <DialogClose asChild>
                    <Button variant="outline">إلغاء</Button>
                  </DialogClose>
                  <Button
                    onClick={addFamily}
                    disabled={!newFamilyName.trim()}
                    className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white"
                  >
                    إضافة
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* =========== DASHBOARD VIEW =========== */}
      {currentView === 'dashboard' && (
        <>
          {/* Info Banner */}
          <div className="max-w-6xl mx-auto px-4 mt-4">
            <div className="bg-gradient-to-r from-cyan-50 to-emerald-50 border border-cyan-200 rounded-xl p-4 flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-cyan-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-cyan-800">الحد المجاني الأسبوعي: {FREE_MINUTES_PER_WEEK} دقيقة</p>
                  <p className="text-xs text-cyan-600">سعر الدقيقة الإضافية: {PRICE_PER_MINUTE} شيكل</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                  <span className="text-gray-600">مجاني</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                  <span className="text-gray-600">مدفوع</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <main className="max-w-6xl mx-auto px-4 py-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-600 animate-spin"></div>
                <p className="text-gray-500">جاري التحميل...</p>
              </div>
            ) : families.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-20 h-20 rounded-full bg-cyan-50 flex items-center justify-center">
                  <Users className="w-10 h-10 text-cyan-300" />
                </div>
                <h2 className="text-lg font-semibold text-gray-700">لا توجد عائلات بعد</h2>
                <p className="text-gray-500 text-sm">اضغط على &quot;إضافة عائلة&quot; أو &quot;بيانات تجريبية&quot; لبدء الاستخدام</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {families.map((family) => {
                  const isActive = !!family.activeSessionId
                  const timerSeconds = timers[family.id] || 0
                  const totalUsedSeconds = family.weeklySeconds + timerSeconds
                  const totalUsedMinutes = totalUsedSeconds / 60
                  const { freeMinutes, paidMinutes, cost } = calculateCost(family)
                  const usagePercent = getUsagePercentage(family)
                  const overLimit = isOverFreeLimit(family)
                  const freeRemaining = Math.max(0, FREE_MINUTES_PER_WEEK - totalUsedMinutes)

                  return (
                    <Card
                      key={family.id}
                      className={`overflow-hidden transition-all duration-300 border-2 ${
                        isActive
                          ? 'border-emerald-400 shadow-lg shadow-emerald-100 ring-1 ring-emerald-200'
                          : overLimit
                          ? 'border-amber-300 shadow-md shadow-amber-50'
                          : 'border-gray-200 hover:border-cyan-300 hover:shadow-md hover:shadow-cyan-50'
                      }`}
                    >
                      {isActive && (
                        <div className="h-1 bg-gradient-to-r from-cyan-500 to-emerald-500 animate-pulse" />
                      )}

                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : overLimit
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-cyan-100 text-cyan-600'
                              }`}
                            >
                              <Droplets className="w-4 h-4" />
                            </div>
                            <span className="truncate max-w-[150px]">{family.name}</span>
                          </CardTitle>
                          <div className="flex items-center gap-1">
                            {isActive && (
                              <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-1"></span>
                                نشط
                              </Badge>
                            )}
                            {overLimit && !isActive && (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0">
                                تجاوز الحد
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Timer Display */}
                        <div
                          className={`text-center py-4 rounded-xl ${
                            isActive
                              ? 'bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="text-3xl font-mono font-bold tracking-wider">
                            <span className={isActive ? 'text-emerald-700' : 'text-gray-700'}>
                              {formatTime(timerSeconds)}
                            </span>
                          </div>
                          {isActive && (
                            <p className="text-xs text-emerald-600 mt-1">جاري التعبئة...</p>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">الاستخدام المجاني</span>
                            <span className={`font-medium ${overLimit ? 'text-amber-600' : 'text-gray-700'}`}>
                              {Math.min(totalUsedMinutes, FREE_MINUTES_PER_WEEK).toFixed(1)} / {FREE_MINUTES_PER_WEEK} دقيقة
                            </span>
                          </div>
                          <Progress
                            value={usagePercent}
                            className={`h-2.5 ${overLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-emerald-500'}`}
                          />
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white rounded-lg p-2.5 border border-gray-100 text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">المتبقي مجاناً</p>
                            <p className={`text-sm font-bold ${freeRemaining > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {freeRemaining > 0 ? `${freeRemaining.toFixed(1)} د` : 'انتهى'}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-gray-100 text-center">
                            <p className="text-[10px] text-gray-500 mb-0.5">المبلغ المستحق</p>
                            <p className={`text-sm font-bold ${cost > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {cost.toFixed(2)} شيكل
                            </p>
                          </div>
                        </div>

                        {paidMinutes > 0 && (
                          <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-200 text-center">
                            <p className="text-xs text-amber-700">
                              <AlertCircle className="w-3 h-3 inline ml-1" />
                              دقائق إضافية: <span className="font-bold">{paidMinutes.toFixed(1)}</span> دقيقة × {PRICE_PER_MINUTE} شيكل
                            </p>
                          </div>
                        )}

                        <Separator />

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {isActive ? (
                            <Button
                              onClick={() => stopSession(family.id, family.activeSessionId!)}
                              className="flex-1 gap-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-sm"
                            >
                              <Pause className="w-4 h-4" />
                              إيقاف
                            </Button>
                          ) : (
                            <Button
                              onClick={() => startSession(family.id)}
                              className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-sm"
                            >
                              <Play className="w-4 h-4" />
                              تشغيل
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setExpandedFamily(expandedFamily === family.id ? null : family.id)
                            }
                            className="border-gray-200"
                          >
                            {expandedFamily === family.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => resetWeeklyUsage(family.id)}
                            className="border-gray-200 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="إعادة تعيين الأسبوع"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف عائلة "${family.name}"؟`))
                                deleteFamily(family.id)
                            }}
                            className="border-gray-200 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Expanded Details */}
                        {expandedFamily === family.id && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Separator />
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                تفاصيل الاستخدام الأسبوعي
                              </p>
                              <ScrollArea className="max-h-40">
                                {family.sessions && family.sessions.length > 0 ? (
                                  <div className="space-y-1">
                                    {family.sessions
                                      .filter((s) => s.endTime)
                                      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                                      .map((session) => (
                                        <div
                                          key={session.id}
                                          className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2"
                                        >
                                          <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                            <span className="text-gray-600">
                                              {formatDateTime(session.startTime)}
                                            </span>
                                          </div>
                                          <span className="font-medium text-gray-700">
                                            {formatTime(session.duration)}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 text-center py-2">لا توجد جلسات سابقة</p>
                                )}
                              </ScrollArea>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                              <span>إجمالي هذا الأسبوع:</span>
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

          <footer className="mt-8 pb-6">
            <div className="max-w-6xl mx-auto px-4">
              <div className="text-center text-xs text-gray-400">
                <p>نظام حساب تعبئة المياه - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* =========== LOG VIEW =========== */}
      {currentView === 'log' && (
        <main className="max-w-6xl mx-auto px-4 py-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-white">
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 text-cyan-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-cyan-700">{families.length}</p>
                <p className="text-xs text-gray-500">عدد العائلات</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-4 text-center">
                <Timer className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700">{totalMinutesUsed.toFixed(1)}</p>
                <p className="text-xs text-gray-500">إجمالي الدقائق</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-4 text-center">
                <Coins className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-gray-500">إجمالي المبلغ (شيكل)</p>
              </CardContent>
            </Card>
            <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white">
              <CardContent className="p-4 text-center">
                <AlertCircle className="w-6 h-6 text-rose-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-rose-700">{totalFamiliesOverLimit}</p>
                <p className="text-xs text-gray-500">تجاوزوا الحد</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <Card className="mb-6 border-gray-200">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث بالاسم أو التاريخ..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="pr-9 text-right"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={selectedLogFamily === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLogFamily(null)}
                    className={selectedLogFamily === null ? 'bg-cyan-600 text-white' : ''}
                  >
                    الكل
                  </Button>
                  {families.map((f) => (
                    <Button
                      key={f.id}
                      variant={selectedLogFamily === f.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedLogFamily(f.id)}
                      className={selectedLogFamily === f.id ? 'bg-cyan-600 text-white' : ''}
                    >
                      {f.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Family Detailed Cards */}
          <div className="space-y-4 mb-6">
            {families
              .filter((f) => !selectedLogFamily || f.id === selectedLogFamily)
              .filter((f) => !logSearch || f.name.includes(logSearch))
              .map((family) => {
                const { totalMinutes, freeMinutes, paidMinutes, cost } = calculateCost(family)
                const familySessions = family.sessions?.filter((s) => s.endTime) || []
                const overLimit = isOverFreeLimit(family)
                const isActive = !!family.activeSessionId

                return (
                  <Card
                    key={family.id}
                    className={`overflow-hidden ${overLimit ? 'border-amber-300' : 'border-gray-200'}`}
                  >
                    <CardHeader className="pb-3 bg-gradient-to-l from-gray-50 to-white">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              overLimit
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-emerald-100 text-emerald-600'
                            }`}
                          >
                            <Droplets className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{family.name}</CardTitle>
                            <p className="text-xs text-gray-500">
                              <CalendarDays className="w-3 h-3 inline ml-1" />
                              أضيفت: {formatDate(family.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isActive && (
                            <Badge className="bg-emerald-500 text-white gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                              قيد التعبئة
                            </Badge>
                          )}
                          {overLimit && (
                            <Badge variant="destructive">تجاوز الحد المجاني</Badge>
                          )}
                          {!overLimit && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              ضمن الحد المجاني
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Family Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                          <p className="text-[10px] text-cyan-600 mb-1">إجمالي الدقائق</p>
                          <p className="text-lg font-bold text-cyan-700">{totalMinutes.toFixed(1)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
                          <p className="text-[10px] text-emerald-600 mb-1">المجاني</p>
                          <p className="text-lg font-bold text-emerald-700">{freeMinutes.toFixed(1)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                          <p className="text-[10px] text-amber-600 mb-1">المدفوع</p>
                          <p className="text-lg font-bold text-amber-700">{paidMinutes.toFixed(1)}</p>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                          <p className="text-[10px] text-rose-600 mb-1">المبلغ المستحق</p>
                          <p className="text-lg font-bold text-rose-700">{cost.toFixed(2)} شيكل</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                          <p className="text-[10px] text-gray-500 mb-1">عدد الجلسات</p>
                          <p className="text-lg font-bold text-gray-700">{familySessions.length}</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">استخدام الحد المجاني</span>
                          <span className={`font-medium ${overLimit ? 'text-amber-600' : 'text-gray-700'}`}>
                            {Math.min(totalMinutes, FREE_MINUTES_PER_WEEK).toFixed(1)} / {FREE_MINUTES_PER_WEEK} دقيقة
                          </span>
                        </div>
                        <Progress
                          value={getUsagePercentage(family)}
                          className={`h-3 ${overLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-emerald-500'}`}
                        />
                      </div>

                      {/* Session History Table */}
                      {familySessions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                            <History className="w-4 h-4 text-cyan-600" />
                            سجل جلسات التعبئة
                          </h4>
                          <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">#</th>
                                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">التاريخ</th>
                                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">وقت البدء</th>
                                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">وقت الانتهاء</th>
                                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">المدة</th>
                                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">التكلفة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {familySessions
                                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                                  .map((session, idx) => {
                                    const sessionMinutes = session.duration / 60
                                    // Calculate this session's cost based on cumulative usage
                                    const sessionsBefore = familySessions
                                      .filter((s) => new Date(s.startTime).getTime() > new Date(session.startTime).getTime())
                                      .reduce((acc, s) => acc + s.duration / 60, 0)
                                    const cumulativeBefore = sessionsBefore
                                    const freeUsedBefore = Math.min(cumulativeBefore, FREE_MINUTES_PER_WEEK)
                                    const freeRemainingBefore = Math.max(0, FREE_MINUTES_PER_WEEK - freeUsedBefore)
                                    const freeInSession = Math.min(sessionMinutes, freeRemainingBefore)
                                    const paidInSession = Math.max(0, sessionMinutes - freeRemainingBefore)
                                    const sessionCost = paidInSession * PRICE_PER_MINUTE

                                    return (
                                      <tr
                                        key={session.id}
                                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                                      >
                                        <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-gray-700">{formatDate(session.startTime)}</td>
                                        <td className="px-4 py-2.5 text-gray-700 font-mono">
                                          {formatTimeOfDay(session.startTime)}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-700 font-mono">
                                          {session.endTime ? formatTimeOfDay(session.endTime) : '-'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className="font-mono font-medium text-gray-800">
                                            {formatTime(session.duration)}
                                          </span>
                                          <span className="text-xs text-gray-400 mr-1">
                                            ({sessionMinutes.toFixed(1)} د)
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                          {sessionCost > 0 ? (
                                            <Badge variant="destructive" className="text-xs">
                                              {sessionCost.toFixed(2)} شيكل
                                            </Badge>
                                          ) : (
                                            <Badge className="bg-emerald-100 text-emerald-700 text-xs hover:bg-emerald-100">
                                              مجاني
                                            </Badge>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
          </div>

          {/* All Sessions Table */}
          {filteredSessions.length > 0 && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileBarChart className="w-5 h-5 text-cyan-600" />
                  جميع جلسات التعبئة ({filteredSessions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <ScrollArea className="max-h-[500px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-200">
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">#</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">العائلة</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">التاريخ</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">من</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">إلى</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">المدة</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">الدقائق</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSessions.map((session, idx) => {
                          const sessionMinutes = session.duration / 60
                          return (
                            <tr
                              key={session.id}
                              className="border-b border-gray-100 last:border-b-0 hover:bg-cyan-50/50 transition-colors"
                            >
                              <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Droplets className="w-3.5 h-3.5 text-cyan-500" />
                                  <span className="font-medium text-gray-800">{session.familyName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-gray-600">{formatDateTime(session.startTime)}</td>
                              <td className="px-4 py-2.5 text-gray-700 font-mono">
                                {formatTimeOfDay(session.startTime)}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700 font-mono">
                                {session.endTime ? formatTimeOfDay(session.endTime) : '-'}
                              </td>
                              <td className="px-4 py-2.5 font-mono font-medium text-gray-800">
                                {formatTime(session.duration)}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge
                                  variant={sessionMinutes > FREE_MINUTES_PER_WEEK ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {sessionMinutes.toFixed(1)} د
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredSessions.length === 0 && families.length > 0 && (
            <div className="text-center py-12">
              <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">لا توجد جلسات تطابق البحث</p>
            </div>
          )}

          <footer className="mt-8 pb-6">
            <div className="text-center text-xs text-gray-400">
              <p>نظام حساب تعبئة المياه - سجل التعبئة</p>
            </div>
          </footer>
        </main>
      )}
    </div>
  )
}
