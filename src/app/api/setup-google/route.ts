import { NextResponse } from 'next/server'

// POST /api/setup-google - Validate and save Google OAuth credentials
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientId, clientSecret } = body

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول' }, { status: 400 })
    }

    // Validate the format
    if (!clientId.includes('.apps.googleusercontent.com')) {
      return NextResponse.json({
        error: 'Client ID غير صالح. يجب أن ينتهي بـ .apps.googleusercontent.com'
      }, { status: 400 })
    }

    if (!clientSecret.startsWith('GOCSPX-')) {
      return NextResponse.json({
        error: 'Client Secret غير صالح. يجب أن يبدأ بـ GOCSPX-'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'تم التحقق من المفاتيح بنجاح',
      envVars: {
        GOOGLE_CLIENT_ID: clientId,
        GOOGLE_CLIENT_SECRET: clientSecret,
      }
    })
  } catch (error) {
    console.error('Error saving Google OAuth:', error)
    return NextResponse.json({ error: 'حدث خطأ في حفظ الإعدادات' }, { status: 500 })
  }
}
