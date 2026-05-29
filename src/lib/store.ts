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

export interface AppSettings {
  freeMinutesPerWeek: number
  pricePerMinute: number
  autoResetWeekly: boolean
  resetDay: number // 0=Sunday, 1=Monday, ..., 6=Saturday (default 6)
  lastAutoReset: string | null // ISO date of last auto-reset
}

const STORAGE_KEY = 'water-filling-app'
const SETTINGS_KEY = 'water-filling-settings'

const DEFAULT_SETTINGS: AppSettings = {
  freeMinutesPerWeek: 12,
  pricePerMinute: 0.5,
  autoResetWeekly: true,
  resetDay: 6, // Saturday
  lastAutoReset: null,
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

// Validate and fix a family object to ensure it has all required fields
function validateFamily(family: any): Family | null {
  try {
    if (!family || typeof family !== 'object') return null
    if (!family.id || typeof family.id !== 'string') return null
    if (!family.name || typeof family.name !== 'string') return null
    if (!family.createdAt || typeof family.createdAt !== 'string') return null

    // Ensure sessions array exists and is valid
    const sessions: Session[] = Array.isArray(family.sessions)
      ? family.sessions.filter((s: any) => {
          try {
            return s && typeof s === 'object' && s.id && s.familyId && s.startTime && typeof s.duration === 'number'
          } catch {
            return false
          }
        }).map((s: any) => ({
          id: String(s.id),
          familyId: String(s.familyId),
          startTime: String(s.startTime),
          endTime: s.endTime ? String(s.endTime) : null,
          duration: Number(s.duration) || 0,
          createdAt: s.createdAt ? String(s.createdAt) : String(s.startTime),
        }))
      : []

    return {
      id: String(family.id),
      name: String(family.name),
      createdAt: String(family.createdAt),
      sessions,
    }
  } catch {
    return null
  }
}

function loadData(): Family[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed)) {
      // Data is corrupted, clear it
      localStorage.removeItem(STORAGE_KEY)
      return []
    }
    // Validate each family and filter out invalid ones
    const validated = parsed.map(validateFamily).filter((f: Family | null): f is Family => f !== null)
    // If validation changed the data, save the cleaned version
    if (validated.length !== parsed.length || JSON.stringify(validated) !== JSON.stringify(parsed)) {
      saveData(validated)
    }
    return validated
  } catch {
    // Corrupted data, clear it
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    return []
  }
}

function saveData(families: Family[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(families))
  } catch {
    // Storage full or other error
  }
}

// ===== Settings =====

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
      return {
        freeMinutesPerWeek: typeof parsed.freeMinutesPerWeek === 'number' ? parsed.freeMinutesPerWeek : DEFAULT_SETTINGS.freeMinutesPerWeek,
        pricePerMinute: typeof parsed.pricePerMinute === 'number' ? parsed.pricePerMinute : DEFAULT_SETTINGS.pricePerMinute,
        autoResetWeekly: typeof parsed.autoResetWeekly === 'boolean' ? parsed.autoResetWeekly : DEFAULT_SETTINGS.autoResetWeekly,
        resetDay: typeof parsed.resetDay === 'number' && parsed.resetDay >= 0 && parsed.resetDay <= 6 ? parsed.resetDay : DEFAULT_SETTINGS.resetDay,
        lastAutoReset: typeof parsed.lastAutoReset === 'string' ? parsed.lastAutoReset : DEFAULT_SETTINGS.lastAutoReset,
      }
    }
    return DEFAULT_SETTINGS
  } catch {
    try { localStorage.removeItem(SETTINGS_KEY) } catch {}
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {}
}

export function resetSettings(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
  } catch {}
}

// ===== Families =====

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

export function updateFamily(id: string, name: string): boolean {
  const families = loadData()
  const family = families.find((f) => f.id === id)
  if (!family) return false
  family.name = name.trim()
  saveData(families)
  return true
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

export function resetAllWeeklyUsage(): void {
  const families = loadData()
  families.forEach((family) => {
    family.sessions = []
  })
  saveData(families)
}
