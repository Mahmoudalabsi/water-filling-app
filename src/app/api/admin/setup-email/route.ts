import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/admin/setup-email - Save Gmail SMTP credentials as a global settings record
 * This is needed after a database wipe to restore email functionality
 * No authentication required - only used during initial setup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gmailUser, gmailAppPassword } = body

    if (!gmailUser || !gmailAppPassword) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول' }, { status: 400 })
    }

    // Validate Gmail format
    if (!gmailUser.includes('@gmail.com')) {
      return NextResponse.json({ error: 'يرجى إدخال بريد Gmail صحيح' }, { status: 400 })
    }

    // Find any existing settings record with Gmail credentials
    const existingGlobal = await db.settings.findFirst({
      where: {
        gmailUser: { not: null },
        gmailAppPassword: { not: null },
      },
    })

    if (existingGlobal) {
      // Update existing global record
      await db.settings.update({
        where: { id: existingGlobal.id },
        data: { gmailUser, gmailAppPassword },
      })
    } else {
      // Find any settings record at all
      const anySettings = await db.settings.findFirst()
      if (anySettings) {
        // Update the first settings record with Gmail credentials
        await db.settings.update({
          where: { id: anySettings.id },
          data: { gmailUser, gmailAppPassword },
        })
      } else {
        // No settings exist at all - create a global one without a user
        // We need to use a dummy userId or handle this differently
        // Since Settings requires a userId (unique), we'll check for any user first
        const anyUser = await db.user.findFirst()
        if (anyUser) {
          const userSettings = await db.settings.findUnique({
            where: { userId: anyUser.id },
          })
          if (userSettings) {
            await db.settings.update({
              where: { id: userSettings.id },
              data: { gmailUser, gmailAppPassword },
            })
          } else {
            await db.settings.create({
              data: {
                userId: anyUser.id,
                gmailUser,
                gmailAppPassword,
                freeMinutesPerWeek: 12,
                pricePerMinute: 0.5,
                autoResetWeekly: true,
                resetDay: 6,
              },
            })
          }
        } else {
          // No users exist at all - store as env-level config
          // We'll return instructions to set env vars instead
          return NextResponse.json({
            status: 'warning',
            message: 'لا يوجد مستخدمين في قاعدة البيانات. يرجى تسجيل حساب أولاً ثم إعادة محاولة إعداد البريد.',
            hint: 'Or set GMAIL_USER and GMAIL_APP_PASSWORD as Vercel environment variables.',
          }, { status: 200 })
        }
      }
    }

    // Also propagate to ALL existing users' settings that don't have Gmail creds
    const usersWithoutGmail = await db.settings.findMany({
      where: {
        OR: [
          { gmailUser: null },
          { gmailAppPassword: null },
        ],
      },
      select: { id: true },
    })

    for (const setting of usersWithoutGmail) {
      await db.settings.update({
        where: { id: setting.id },
        data: { gmailUser, gmailAppPassword },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'تم حفظ إعدادات Gmail بنجاح لجميع المستخدمين',
      updatedRecords: usersWithoutGmail.length,
    })
  } catch (error) {
    console.error('Error saving Gmail settings:', error)
    return NextResponse.json({ error: 'حدث خطأ في حفظ الإعدادات' }, { status: 500 })
  }
}

/**
 * GET /api/admin/setup-email - Check if Gmail SMTP is configured
 */
export async function GET() {
  try {
    // Check env vars
    const envUser = process.env.GMAIL_USER
    const envPass = process.env.GMAIL_APP_PASSWORD

    // Check database
    const dbSettings = await db.settings.findFirst({
      where: {
        gmailUser: { not: null },
        gmailAppPassword: { not: null },
      },
      select: { gmailUser: true, gmailAppPassword: true, userId: true },
    })

    return NextResponse.json({
      envVars: {
        GMAIL_USER: envUser ? `${envUser.slice(0, 3)}***@gmail.com` : null,
        GMAIL_APP_PASSWORD: envPass ? '***configured***' : null,
      },
      database: {
        configured: !!dbSettings,
        gmailUser: dbSettings?.gmailUser ? `${dbSettings.gmailUser.slice(0, 3)}***@gmail.com` : null,
        gmailAppPassword: dbSettings?.gmailAppPassword ? '***configured***' : null,
        userId: dbSettings?.userId || null,
      },
      emailServiceAvailable: !!(envUser && envPass) || !!dbSettings,
    })
  } catch (error) {
    console.error('Error checking email config:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
