'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Droplets, CheckCircle2, AlertCircle, Loader2, ExternalLink, Copy, Check } from 'lucide-react'

export default function SetupGooglePage() {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [googleStatus, setGoogleStatus] = useState(false)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetch('/api/auth/providers-status')
      .then(res => res.json())
      .then(data => setGoogleStatus(data.google === true))
      .catch(() => setGoogleStatus(false))
  }, [])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !clientSecret) {
      setError('يرجى ملء جميع الحقول')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/setup-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'حدث خطأ في حفظ الإعدادات')
      }
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  if (googleStatus) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-200 mx-auto mb-4">
              <Droplets className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Google OAuth مُفعّل</h1>
          </div>
          <Card className="border-emerald-200 shadow-xl">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-emerald-800">تسجيل الدخول بـ Google يعمل!</h2>
              <Button
                onClick={() => window.location.href = '/signin'}
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-lg h-11 px-8"
              >
                الذهاب لتسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-200 mx-auto mb-4">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">إعداد تسجيل الدخول بـ Google</h1>
          <p className="text-sm text-gray-500 mt-1">اتبع الخطوات التالية لتفعيل تسجيل الدخول بحساب Google</p>
        </div>

        {/* Step 1 */}
        <Card className="border-blue-200 shadow-lg mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">1</span>
              إنشاء مشروع في Google Cloud
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">اذهب إلى Google Cloud Console وأنشئ مشروع جديد:</p>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 h-11 border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={() => window.open('https://console.cloud.google.com/projectcreate', '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              فتح Google Cloud Console
            </Button>
            <p className="text-xs text-gray-500">اسم المشروع: Water Filling App ← اضغط Create</p>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card className="border-amber-200 shadow-lg mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">2</span>
              إعداد شاشة الموافقة (OAuth Consent Screen)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>اذهب إلى <strong>APIs & Services</strong> ← <strong>OAuth consent screen</strong></li>
              <li>اختر <strong>External</strong> ← اضغط <strong>Create</strong></li>
              <li>اسم التطبيق: <code className="bg-gray-100 px-1 rounded">تعبئة المياه</code></li>
              <li>البريد الإلكتروني: اختر إيميلك</li>
              <li>اضغط <strong>Save and Continue</strong> حتى النهاية (تخطى باقي الخطوات)</li>
            </ol>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 h-11 border-amber-300 text-amber-600 hover:bg-amber-50"
              onClick={() => window.open('https://console.cloud.google.com/apis/credentials/consent', '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              فتح OAuth Consent Screen
            </Button>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card className="border-purple-200 shadow-lg mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">3</span>
              إنشاء مفاتيح OAuth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>اذهب إلى <strong>APIs & Services</strong> ← <strong>Credentials</strong></li>
              <li>اضغط <strong>+ CREATE CREDENTIALS</strong> ← <strong>OAuth client ID</strong></li>
              <li>نوع التطبيق: <strong>Web application</strong></li>
              <li>الاسم: <code className="bg-gray-100 px-1 rounded">Water Filling App</code></li>
              <li>
                <strong>Authorized JavaScript origins</strong> أضف:
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-green-50 border border-green-200 px-2 py-1 rounded text-green-800 text-xs flex-1">https://water-filling-app.vercel.app</code>
                  <button onClick={() => copyText('https://water-filling-app.vercel.app', 'origin')} className="p-1">
                    {copied === 'origin' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </li>
              <li>
                <strong>Authorized redirect URIs</strong> أضف:
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-green-50 border border-green-200 px-2 py-1 rounded text-green-800 text-xs flex-1 break-all">https://water-filling-app.vercel.app/api/auth/callback/google</code>
                  <button onClick={() => copyText('https://water-filling-app.vercel.app/api/auth/callback/google', 'redirect')} className="p-1">
                    {copied === 'redirect' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </li>
              <li>اضغط <strong>Create</strong> وانسخ <strong>Client ID</strong> و <strong>Client Secret</strong></li>
            </ol>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 h-11 border-purple-300 text-purple-600 hover:bg-purple-50"
              onClick={() => window.open('https://console.cloud.google.com/apis/credentials/oauthclient', '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              فتح Create OAuth Client
            </Button>
          </CardContent>
        </Card>

        {/* Step 4 - Enter credentials */}
        <Card className="border-cyan-200 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="w-7 h-7 rounded-full bg-cyan-500 text-white flex items-center justify-center text-sm font-bold">4</span>
              أدخل المفاتيح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Google Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  dir="ltr"
                  className="text-left"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Google Client Secret</Label>
                <Input
                  id="clientSecret"
                  placeholder="GOCSPX-xxxxx"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  dir="ltr"
                  className="text-left"
                  type="password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  تم حفظ الإعدادات بنجاح! سيتم تفعيل Google بعد إعادة النشر.
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-lg h-11"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الحفظ...
                  </span>
                ) : (
                  'حفظ الإعدادات'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
