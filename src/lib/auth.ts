import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'البريد الإلكتروني', type: 'email' },
        password: { label: 'كلمة المرور', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان')
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        }

        // Check if email is verified
        // - Google users have emailVerified set automatically on creation
        // - Legacy users (registered before email verification feature) may have null emailVerified
        //   They are auto-verified on first login if they don't have a VerificationToken record
        // - New users must verify their email before signing in
        if (!user.emailVerified) {
          // Auto-verify legacy users who registered before email verification was added
          // We detect them by checking if they have no pending verification tokens
          const pendingToken = await db.verificationToken.findFirst({
            where: { identifier: user.email },
          })

          if (pendingToken) {
            // New user with pending verification - must verify first
            throw new Error('EMAIL_NOT_VERIFIED')
          }

          // Legacy user (no pending token) - auto-verify them
          await db.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          })
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google OAuth: create or link user in the database
      if (account?.provider === 'google' && user.email) {
        try {
          // Check if user already exists
          const existingUser = await db.user.findUnique({
            where: { email: user.email },
          })

          if (existingUser) {
            // User exists - update their info and link Google account
            // Check if Google account is already linked
            const existingAccount = await db.account.findFirst({
              where: {
                userId: existingUser.id,
                provider: 'google',
              },
            })

            if (!existingAccount) {
              // Link Google account to existing user
              await db.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                },
              })
            } else {
              // Update the existing Google account with new tokens
              await db.account.update({
                where: { id: existingAccount.id },
                data: {
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                },
              })
            }

            // Set the user id from the database so the JWT token has the correct id
            user.id = existingUser.id
          } else {
            // New user - create user with Google info
            const newUser = await db.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split('@')[0],
                image: user.image,
                emailVerified: new Date(),
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                    session_state: account.session_state,
                  },
                },
                settings: {
                  create: {},
                },
              },
            })

            user.id = newUser.id
          }
        } catch (error) {
          console.error('Google OAuth error:', error)
          return false
        }
      }

      return true
    },
    async jwt({ token, user, account }) {
      // On first sign-in, user is provided
      if (user) {
        token.id = user.id
      }

      // For Google sign-in, we need to ensure we have the correct user id
      // because the user object from the signIn callback has the database id
      if (account?.provider === 'google' && user?.id) {
        token.id = user.id
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string
      }
      return session
    },
  },
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user as (typeof session.user & { id: string }) | undefined
}
