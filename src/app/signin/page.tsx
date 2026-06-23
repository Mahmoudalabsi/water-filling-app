'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Droplets, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { ThemeLanguageToggle } from '@/components/theme-language-toggle'
import { useLocalAuth } from '@/components/auth-provider'
import { isCapacitorApp, apiUrl, authFetch } from '@/lib/api-config'

export default function SignInPage() {
  const router = useRouter()
  const { t, locale, dir } = useLanguage()
  const { localSignIn, localRegister, localAuth } = useLocalAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  // Email verification state
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')

  const isApp = isCapacitorApp()

  // Redirect if already authenticated via local auth
  useEffect(() => {
    if (localAuth.isAuthenticated && localAuth.loginMethod === 'local') {
      router.push('/')
    }
  }, [localAuth.isAuthenticated, localAuth.loginMethod, router])

  useEffect(() => {
    authFetch(apiUrl('/api/auth/providers-status'))
      .then(res => res.json())
      .then(data => setGoogleEnabled(data.google === true))
      .catch(() => setGoogleEnabled(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setShowVerifyPrompt(false)
    setLoading(true)

    try {
      if (isRegister) {
        // Use local register for Capacitor, NextAuth for web
        if (isApp) {
          const result = await localRegister(name, email, password)
          if (!result.success) {
            setError(result.error || t('registrationError'))
            return
          }
          if (result.requiresVerification) {
            router.push(`/verify-email?email=${encodeURIComponent(email)}`)
            return
          }
          router.push('/')
          return
        }

        // Web: NextAuth flow
        const res = await authFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || t('registrationError'))
          return
        }

        // Check if this was a "link password" action (existing Google account)
        if (data.message && data.message.includes('ربط')) {
          setSuccess(t('passwordLinked'))
          const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
          })
          if (result?.ok) {
            router.push('/')
          } else {
            setIsRegister(false)
            setSuccess(t('passwordLinked'))
          }
          return
        }

        // New registration - redirect to verification page
        if (data.requiresVerification) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`)
          return
        }

        // Fallback: try to sign in directly
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })
        if (result?.ok) {
          router.push('/')
        } else {
          setError(locale === 'ar' ? 'تم إنشاء الحساب، يرجى تسجيل الدخول' : 'Account created, please sign in')
          setIsRegister(false)
        }
      } else {
        // Login
        if (isApp) {
          // Use local sign in for Capacitor
          const result = await localSignIn(email, password)
          if (!result.success) {
            if (result.error === 'EMAIL_NOT_VERIFIED') {
              setUnverifiedEmail(email)
              setShowVerifyPrompt(true)
              setError('')
            } else {
              setError(t('invalidCredentials'))
            }
            return
          }
          router.push('/')
          return
        }

        // Web: NextAuth flow
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (result?.error === 'EMAIL_NOT_VERIFIED' || result?.error === 'يحتاج تأكيد البريد الإلكتروني') {
          // Email not verified - show verification prompt
          setUnverifiedEmail(email)
          setShowVerifyPrompt(true)
          setError('')
        } else if (result?.error) {
          setError(t('invalidCredentials'))
        } else {
          router.push('/')
        }
      }
    } catch {
      setError(t('connectionError'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' })
  }

  const handleGoToVerify = () => {
    router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)
  }

  const handleResendForLogin = async () => {
    if (!unverifiedEmail) return
    setLoading(true)
    try {
      const res = await authFetch(apiUrl('/api/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(t('emailSent'))
        // Redirect to verification page
        setTimeout(() => {
          router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)
        }, 1500)
      } else {
        setError(data.error || t('emailSendError'))
      }
    } catch {
      setError(t('connectionError'))
    } finally {
      setLoading(false)
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('appDesc')}</p>
        </div>

        {/* Email Not Verified Banner */}
        {showVerifyPrompt && (
          <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 mb-4 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    {t('emailNotVerified')}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                    {t('emailNotVerifiedDesc')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleGoToVerify}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {t('goToVerify')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleResendForLogin}
                      disabled={loading}
                      className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400"
                    >
                      {t('resendCode')}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-cyan-200 dark:border-gray-700 shadow-xl shadow-cyan-100/50 dark:shadow-gray-900/50 bg-white dark:bg-gray-900">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg dark:text-gray-100">
              {isRegister ? t('signUp') : t('signIn')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="dark:text-gray-300">{t('name')}</Label>
                  <div className="relative">
                    <User className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                    <Input
                      id="name"
                      placeholder={t('enterName')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} ${dir === 'rtl' ? 'text-right' : 'text-left'} dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100`}
                      required={isRegister}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="dark:text-gray-300">{t('email')}</Label>
                <div className="relative">
                  <Mail className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setShowVerifyPrompt(false) }}
                    className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} ${dir === 'rtl' ? 'text-right' : 'text-left'} dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100`}
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="dark:text-gray-300">{t('password')}</Label>
                <div className="relative">
                  <Lock className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isRegister ? t('passwordMin') : t('enterPassword')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${dir === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'} ${dir === 'rtl' ? 'text-right' : 'text-left'} dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100`}
                    dir="ltr"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400 text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-3 text-sm text-green-700 dark:text-green-400 text-center">
                  {success}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-lg h-11"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('processing')}
                  </span>
                ) : isRegister ? t('signUp') : t('signIn')}
              </Button>
            </form>

            {/* Google Sign In - only show in web browser, not in Capacitor app */}
            {googleEnabled && !isApp && (
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-gray-900 px-2 text-gray-400">{t('or')}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  className="w-full mt-4 h-11 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 gap-2 dark:text-gray-200"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>{t('signInWithGoogle')}</span>
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); setShowVerifyPrompt(false) }}
                className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
              >
                {isRegister ? t('hasAccount') : t('noAccount')}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          {t('dataSafe')}
        </p>
      </div>
    </div>
  )
}
