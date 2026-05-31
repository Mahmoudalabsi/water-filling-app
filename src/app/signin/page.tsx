'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Droplets, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    fetch('/api/auth/providers-status')
      .then(res => res.json())
      .then(data => setGoogleEnabled(data.google === true))
      .catch(() => setGoogleEnabled(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isRegister) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'حدث خطأ في إنشاء الحساب')
          return
        }

        // Check if this was a password-linking operation (Google account existed)
        if (data.message && data.message.includes('ربط')) {
          setSuccess(data.message)
          // Auto sign in after linking password
          const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
          })
          if (result?.ok) {
            router.push('/')
          } else {
            setIsRegister(false)
            setSuccess('تم ربط كلمة المرور! يمكنك الآن تسجيل الدخول')
          }
          return
        }

        // After registration, sign in automatically
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })
        if (result?.ok) {
          router.push('/')
        } else {
          setError('تم إنشاء الحساب، يرجى تسجيل الدخول')
          setIsRegister(false)
        }
      } else {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })
        if (result?.error) {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        } else {
          router.push('/')
        }
      }
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' })
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-200 mx-auto mb-4">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">تعبئة المياه</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة استهلاك المياه للعائلات</p>
        </div>

        <Card className="border-cyan-200 shadow-xl shadow-cyan-100/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg">
              {isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="name"
                      placeholder="أدخل اسمك"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pr-10 text-right"
                      required={isRegister}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-10 text-right"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isRegister ? '6 أحرف على الأقل' : 'أدخل كلمة المرور'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10 text-right"
                    dir="ltr"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 text-center">
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
                    جاري المعالجة...
                  </span>
                ) : isRegister ? 'إنشاء حساب' : 'تسجيل الدخول'}
              </Button>
            </form>

            {googleEnabled && (
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-gray-400">أو</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  className="w-full mt-4 h-11 border-gray-300 hover:bg-gray-50 gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>تسجيل الدخول بحساب Google</span>
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess('') }}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
              >
                {isRegister ? 'لديك حساب؟ تسجيل الدخول' : 'ليس لديك حساب؟ إنشاء حساب جديد'}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          بياناتك محفوظة بأمان ومتاحة من أي جهاز
        </p>
      </div>
    </div>
  )
}
