// LocalStorage-based data store for the Water Filling app
// Works offline - no server needed!

export interface Session {
  id: string
  familyId: string
  startTime: string
  endTime: string | null
  duration: number // in seconds
  createdAt: string
}

export interface Family {
  id: string
  name: string
  createdAt: string
  sessions: Session[]
}

const STORAGE_KEY = 'water-filling-app'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

function loadData(): Family[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveData(families: Family[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(families))
}

export function getFamilies(): Family[] {
  return loadData()
}

export function addFamily(name: string): Family {
  const families = loadData()
  const newFamily: Family = {
    id: generateId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    sessions: [],
  }
  families.unshift(newFamily)
  saveData(families)
  return newFamily
}

export function deleteFamily(id: string): void {
  const families = loadData().filter((f) => f.id !== id)
  saveData(families)
}

export function startSession(familyId: string): { success: boolean; error?: string; session?: Session } {
  const families = loadData()
  const family = families.find((f) => f.id === familyId)
  if (!family) return { success: false, error: 'العائلة غير موجودة' }

  // Check for active session
  const activeSession = family.sessions.find((s) => !s.endTime)
  if (activeSession) return { success: false, error: 'يوجد جلسة نشطة بالفعل لهذه العائلة' }

  const session: Session = {
    id: generateId(),
    familyId,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: 0,
    createdAt: new Date().toISOString(),
  }
  family.sessions.push(session)
  saveData(families)
  return { success: true, session }
}

export function stopSession(familyId: string, sessionId: string, duration: number): void {
  const families = loadData()
  const family = families.find((f) => f.id === familyId)
  if (!family) return

  const session = family.sessions.find((s) => s.id === sessionId)
  if (!session) return

  session.endTime = new Date().toISOString()
  session.duration = duration
  saveData(families)
}

export function resetWeeklyUsage(familyId: string): void {
  const families = loadData()
  const family = families.find((f) => f.id === familyId)
  if (!family) return

  family.sessions = []
  saveData(families)
}

export function seedDemoData(): void {
  const now = new Date()

  const daysAgo = (days: number, hour = 10, minute = 0) => {
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }

  const families: Family[] = [
    {
      id: generateId(),
      name: 'عائلة الأغا',
      createdAt: daysAgo(20),
      sessions: [
        { id: generateId(), familyId: '', startTime: daysAgo(1, 8, 30), endTime: daysAgo(1, 8, 35), duration: 300, createdAt: daysAgo(1, 8, 30) },
        { id: generateId(), familyId: '', startTime: daysAgo(3, 14, 0), endTime: daysAgo(3, 14, 7), duration: 420, createdAt: daysAgo(3, 14, 0) },
      ],
    },
    {
      id: generateId(),
      name: 'عائلة الشريف',
      createdAt: daysAgo(15),
      sessions: [
        { id: generateId(), familyId: '', startTime: daysAgo(0, 9, 0), endTime: daysAgo(0, 9, 6), duration: 360, createdAt: daysAgo(0, 9, 0) },
        { id: generateId(), familyId: '', startTime: daysAgo(2, 11, 15), endTime: daysAgo(2, 11, 21), duration: 360, createdAt: daysAgo(2, 11, 15) },
        { id: generateId(), familyId: '', startTime: daysAgo(4, 16, 0), endTime: daysAgo(4, 16, 4), duration: 240, createdAt: daysAgo(4, 16, 0) },
      ],
    },
    {
      id: generateId(),
      name: 'عائلة الحسيني',
      createdAt: daysAgo(30),
      sessions: [
        { id: generateId(), familyId: '', startTime: daysAgo(1, 7, 0), endTime: daysAgo(1, 7, 10), duration: 600, createdAt: daysAgo(1, 7, 0) },
        { id: generateId(), familyId: '', startTime: daysAgo(5, 13, 30), endTime: daysAgo(5, 13, 32), duration: 120, createdAt: daysAgo(5, 13, 30) },
      ],
    },
    {
      id: generateId(),
      name: 'عائلة النابلسي',
      createdAt: daysAgo(25),
      sessions: [
        { id: generateId(), familyId: '', startTime: daysAgo(0, 6, 0), endTime: daysAgo(0, 6, 8), duration: 480, createdAt: daysAgo(0, 6, 0) },
        { id: generateId(), familyId: '', startTime: daysAgo(1, 10, 0), endTime: daysAgo(1, 10, 17), duration: 420, createdAt: daysAgo(1, 10, 0) },
        { id: generateId(), familyId: '', startTime: daysAgo(3, 15, 0), endTime: daysAgo(3, 15, 17), duration: 600, createdAt: daysAgo(3, 15, 0) },
        { id: generateId(), familyId: '', startTime: daysAgo(9, 8, 0), endTime: daysAgo(9, 8, 15), duration: 900, createdAt: daysAgo(9, 8, 0) },
        { id: generateId(), familyId: '', startTime: daysAgo(10, 12, 0), endTime: daysAgo(10, 12, 22), duration: 1200, createdAt: daysAgo(10, 12, 0) },
      ],
    },
    {
      id: generateId(),
      name: 'عائلة القاسم',
      createdAt: daysAgo(10),
      sessions: [
        { id: generateId(), familyId: '', startTime: daysAgo(2, 9, 0), endTime: daysAgo(2, 9, 3), duration: 180, createdAt: daysAgo(2, 9, 0) },
      ],
    },
    {
      id: generateId(),
      name: 'عائلة المصري',
      createdAt: daysAgo(12),
      sessions: [
        { id: generateId(), familyId: '', startTime: daysAgo(1, 11, 0), endTime: daysAgo(1, 11, 6), duration: 360, createdAt: daysAgo(1, 11, 0) },
        { id: generateId(), familyId: '', startTime: daysAgo(4, 14, 30), endTime: daysAgo(4, 14, 34), duration: 240, createdAt: daysAgo(4, 14, 30) },
        { id: generateId(), familyId: '', startTime: daysAgo(8, 10, 0), endTime: daysAgo(8, 10, 18), duration: 1080, createdAt: daysAgo(8, 10, 0) },
      ],
    },
  ]

  // Fix familyId references
  families.forEach((f) => {
    f.sessions.forEach((s) => {
      s.familyId = f.id
    })
  })

  saveData(families)
}
