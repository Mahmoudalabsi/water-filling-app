import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/init-email - One-time initialization of Gmail SMTP credentials
 * This endpoint is needed because no user can login to set up email
 * (chicken-and-egg problem: need email to verify account, need account to set up email)
 * 
 * Protected by NEXTAUTH_SECRET to ensure only the app owner can use this.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gmailUser, gmailAppPassword, secret } = body

    // Simple protection: require the NEXTAUTH_SECRET
    if (secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    if (!gmailUser || !gmailAppPassword) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول' }, { status: 400 })
    }

    // Update ALL settings records to share the email service globally
    const allSettings = await db.settings.findMany()
    
    for (const s of allSettings) {
      await db.settings.update({
        where: { id: s.id },
        data: {
          gmailUser,
          gmailAppPassword,
        },
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message: `تم حفظ إعدادات Gmail لحساب ${allSettings.length} مستخدم`,
      updatedCount: allSettings.length,
    })
  } catch (error) {
    console.error('Error initializing email:', error)
    return NextResponse.json({ error: 'حدث خطأ في حفظ الإعدادات' }, { status: 500 })
  }
}
