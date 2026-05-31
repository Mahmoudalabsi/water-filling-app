'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Droplets, CheckCircle2, AlertCircle, Loader2, Database, Key, Globe } from 'lucide-react'

type Step = 'connect' | 'migrate' | 'done'

export default function SetupPage() {
  const [step, setStep] = useState<Step>('connect')
  const [databaseUrl, setDatabaseUrl] = useState('')
  const [directUrl, setDirectUrl] = useState('')
  const [nextauthSecret, setNextauthSecret] = useState('water-filling-app-secret-key-2026-very-secure-production')
  const [nextauthUrl, setNextauthUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const testAndMigrate = async () => {
    setLoading(true)
    setError('')

    try {
      // Step 1: Test database connection
      const migrateRes = await fetch('/api/migrate', { method: 'POST' })
      const migrateData = await migrateRes.json()

      if (migrateRes.ok) {
        setSuccess('تم إنشاء جداول قاعدة البيانات بنجاح!')
        setStep('done')
      } else {
        setError(migrateData.message || migrateData.error || 'فشل في إنشاء الجداول')
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بقاعدة البيانات')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-200 mx-auto mb-4">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">إعداد قاعدة البيانات</h1>
          <p className="text-sm text-gray-500 mt-1">تطبيق تعبئة المياه - خطوة الإعداد الأولى</p>
        </div>

        {step === 'connect' && (
          <Card className="border-cyan-200 shadow-xl shadow-cyan-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="w-5 h-5 text-cyan-600" />
                الاتصال بقاعدة البيانات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  خطوات الإعداد المطلوبة
                </h3>
                <ol className="text-sm text-amber-700 space-y-2 list-decimal list-inside">
                  <li>اذهب إلى <strong>Vercel Dashboard</strong> ← مشروعك ← تبويب <strong>Storage</strong></li>
                  <li>اضغط <strong>Create Database</strong> ← اختر <strong>Postgres (Neon)</strong></li>
                  <li>بعد إنشاء القاعدة، اضغط <strong>Connect</strong> لربطها بالمشروع تلقائياً</li>
                  <li>ستتم إضافة المتغيرات تلقائياً (<code className="bg-amber-100 px-1 rounded">POSTGRES_PRISMA_URL</code> و <code className="bg-amber-100 px-1 rounded">POSTGRES_URL_NON_POOLING</code>)</li>
                  <li>أضف أيضاً متغير <code className="bg-amber-100 px-1 rounded">NEXTAUTH_SECRET</code> بمفتاح سري عشوائي</li>
                  <li>أضف متغير <code className="bg-amber-100 px-1 rounded">NEXTAUTH_URL</code> برابط موقعك (https://xxx.vercel.app)</li>
                  <li>اضغط <strong>Redeploy</strong> من تبويب Deployments</li>
                </ol>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                <h3 className="font-semibold text-cyan-800 mb-2">متغيرات البيئة المطلوبة في Vercel:</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <code className="bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-mono whitespace-nowrap">POSTGRES_PRISMA_URL</code>
                    <span className="text-cyan-700">يُضاف تلقائياً عند ربط Postgres</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-mono whitespace-nowrap">POSTGRES_URL_NON_POOLING</code>
                    <span className="text-cyan-700">يُضاف تلقائياً عند ربط Postgres</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="bg-cyan-100 px-2 py-0.5 rounded text-cyan-800 font-mono whitespace-nowrap">NEXTAUTH_SECRET</code>
                    <span className="text-cyan-700">مفتاح سري عشوائي (أضفه يدوياً)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="bg-cyan-100 px-2 py-0.5 rounded text-cyan-800 font-mono whitespace-nowrap">NEXTAUTH_URL</code>
                    <span className="text-cyan-700">رابط موقعك (أضفه يدوياً)</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h3 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  بعد إعداد المتغيرات و Redeploy:
                </h3>
                <p className="text-sm text-emerald-700">
                  عد إلى هذه الصفحة واضغط الزر أدناه لإنشاء جداول قاعدة البيانات تلقائياً.
                </p>
              </div>

              <Button
                onClick={testAndMigrate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-lg h-12 text-base"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري إنشاء الجداول...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    إنشاء جداول قاعدة البيانات
                  </span>
                )}
              </Button>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card className="border-emerald-200 shadow-xl shadow-emerald-100/50">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-800">تم الإعداد بنجاح!</h2>
              <p className="text-gray-600">تم إنشاء جداول قاعدة البيانات. يمكنك الآن استخدام التطبيق.</p>
              <Button
                onClick={() => window.location.href = '/'}
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white shadow-lg h-11 px-8"
              >
                الذهاب إلى التطبيق
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
