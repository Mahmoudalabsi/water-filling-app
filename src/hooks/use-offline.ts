'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  syncPendingOperations,
  getPendingCount,
  startAutoSync,
  stopAutoSync,
} from '@/lib/offline-db'

function getInitialOnlineStatus(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

export function useOffline() {
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Update pending count
    const updateCount = async () => {
      try {
        const count = await getPendingCount()
        setPendingCount(count)
      } catch {
        // IndexedDB might not be available
      }
    }
    updateCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Start auto-sync
  useEffect(() => {
    const handleSync = async (result: { synced: number; failed: number }) => {
      setIsSyncing(false)
      setLastSyncResult(result)
      try {
        const count = await getPendingCount()
        setPendingCount(count)
      } catch {
        // ignore
      }
    }

    startAutoSync(handleSync)
    return () => stopAutoSync()
  }, [])

  const syncNow = useCallback(async () => {
    setIsSyncing(true)
    try {
      const result = await syncPendingOperations()
      setLastSyncResult(result)
      try {
        const count = await getPendingCount()
        setPendingCount(count)
      } catch {
        // ignore
      }
      return result
    } catch {
      setIsSyncing(false)
      return { synced: 0, failed: 0 }
    }
  }, [])

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {
      // ignore
    }
  }, [])

  return { isOnline, pendingCount, isSyncing, lastSyncResult, syncNow, refreshPendingCount }
}
