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

export default function Home() {
  const [families, setFamilies] = useState<FamilyWithUsage[]>([])
  const [newFamilyName, setNewFamilyName] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [timers, setTimers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
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

      // Initialize timers for active sessions
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const hours = Math.floor(mins / 60)
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
            <p className="text-gray-500 text-sm">اضغط على &quot;إضافة عائلة&quot; لبدء إدارة حسابات المياه</p>
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
                  {/* Active indicator bar */}
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

                    {/* Extra usage details */}
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
                                          {new Date(session.startTime).toLocaleDateString('ar', {
                                            weekday: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
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

      {/* Footer */}
      <footer className="mt-8 pb-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center text-xs text-gray-400">
            <p>نظام حساب تعبئة المياه - جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
