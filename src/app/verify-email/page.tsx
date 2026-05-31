'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Droplets, Mail, CheckCircle, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { ThemeLanguageToggle } from '@/components/theme-language-toggle'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale, dir } = useLanguage()
  const email = searchParams.get('email') || ''

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError(t('enterVerificationCode'))
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('invalidCode'))
        return
      }

      setSuccess(t('verifiedSuccess'))
      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        router.push('/signin')
      }, 2000)
    } catch {
      setError(t('connectionError'))
    } finally {
      setLoading(false)
    }
  }, [code, email, router, t])

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || !email) return

    setResendLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('emailSendError'))
        return
      }

      setResendCooldown(60) // 60 second cooldown
      setSuccess(t('emailSent'))
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError(t('connectionError'))
    } finally {
      setResendLoading(false)
    }
  }, [email, resendCooldown, t])

  // Auto-focus the input
  useEffect(() => {
    const input = document.getElementById('verification-code') as HTMLInputElement
    if (input) input.focus()
  }, [])

  // Handle individual digit inputs for better UX
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newDigits = [...digits]
      pastedDigits.forEach((d, i) => {
        if (index + i < 6) newDigits[index + i] = d
      })
      setDigits(newDigits)
      setCode(newDigits.join(''))

      // Focus next empty or last input
      const nextIndex = Math.min(index + pastedDigits.length, 5)
      const nextInput = document.getElementById(`digit-${nextIndex}`) as HTMLInputElement
      if (nextInput) nextInput.focus()
      return
    }

    if (!/^\d*$/.test(value)) return // Only digits

    const newDigits = [...digits]
    newDigits[index] = value
    setDigits(newDigits)
    setCode(newDigits.join(''))

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`digit-${index + 1}`) as HTMLInputElement
      if (nextInput) nextInput.focus()
    }
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prevInput = document.getElementById(`digit-${index - 1}`) as HTMLInputElement
      if (prevInput) prevInput.focus()
    }
    if (e.key === 'Enter') {
      handleVerify(e)
    }
  }

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Theme & Language Toggle */}
        <div className="flex justify-end mb-4">
          <ThemeLanguageToggle />
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-200 dark:shadow-cyan-900/30 mx-auto mb-4">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('appName')}</h1>
        </div>

        <Card className="border-cyan-200 dark:border-gray-700 shadow-xl shadow-cyan-100/50 dark:shadow-gray-900/50 bg-white dark:bg-gray-900">
          <CardHeader className="pb-4 text-center">
            <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
            </div>
            <CardTitle className="text-lg dark:text-gray-100">
              {success ? t('verifiedSuccess') : t('verifyEmailTitle')}
            </CardTitle>
            {!success && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('verifyEmailDesc')}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-green-600 dark:text-green-400 font-medium">{success}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('verifiedRedirecting')}</p>
              </div>
            ) : (
              <>
                {email && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {t('verifyEmailSentTo')} <span className="font-medium text-gray-700 dark:text-gray-300" dir="ltr">{email}</span>
                  </p>
                )}

                {/* 6-digit code input */}
                <div className="flex justify-center gap-2 mb-6" dir="ltr">
                  {digits.map((digit, index) => (
                    <Input
                      key={index}
                      id={`digit-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(index, e)}
                      className="w-12 h-14 text-center text-xl font-bold bg-white dark:bg-gray-800 border-cyan-300 dark:border-gray-600 focus:border-cyan-500 focus:ring-cyan-500 dark:text-gray-100 rounded-lg"
                    />
                  ))}
                </div>

                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-4">
                  {t('checkInbox')}
                </p>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400 text-center mb-4">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-lg h-11"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('verifying')}
                    </span>
                  ) : t('verify')}
                </Button>

                {/* Resend code */}
                <div className="mt-4 text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {t('resendCodeIn')} {resendCooldown} {t('seconds')}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading}
                      className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium inline-flex items-center gap-1"
                    >
                      {resendLoading ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : null}
                      {t('resendCode')}
                    </button>
                  )}
                </div>

                {/* Back to sign in */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/signin')}
                    className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {t('hasAccount')}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
