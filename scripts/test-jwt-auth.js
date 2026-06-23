/**
 * Test script for JWT Bearer token authentication system
 * Tests both token generation/verification and API endpoint access
 */

const jwt = require('jsonwebtoken')

const JWT_SECRET = 'water-filling-app-secret-key-2026-very-secure'
const BASE_URL = 'https://water-filling-app.vercel.app'

// Known user ID from registration
const TEST_USER_ID = 'cmqqjgvxf0000l404k2ygp7aa'
const TEST_USER_EMAIL = 'test@waterfilling.com'

async function test() {
  console.log('=== JWT Token Authentication Test ===\n')

  // Test 1: Generate a JWT token locally
  console.log('1. Generating JWT token...')
  const token = jwt.sign(
    {
      userId: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      name: 'Test User',
    },
    JWT_SECRET,
    {
      expiresIn: '30d',
      issuer: 'water-filling-app',
      audience: 'water-filling-api',
    }
  )
  console.log(`   Token: ${token.substring(0, 50)}...`)
  console.log('   ✅ Token generated successfully\n')

  // Test 2: Verify the token
  console.log('2. Verifying JWT token...')
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'water-filling-app',
      audience: 'water-filling-api',
    })
    console.log(`   Decoded: userId=${decoded.userId}, email=${decoded.email}`)
    console.log('   ✅ Token verification passed\n')
  } catch (err) {
    console.log(`   ❌ Token verification failed: ${err.message}\n`)
    process.exit(1)
  }

  // Test 3: Test API without token (should fail with 401)
  console.log('3. Testing API without token (should return 401)...')
  try {
    const res = await fetch(`${BASE_URL}/api/families`)
    const data = await res.json()
    if (res.status === 401) {
      console.log(`   Response: ${JSON.stringify(data)}`)
      console.log('   ✅ Correctly returns 401 without token\n')
    } else {
      console.log(`   ❌ Expected 401, got ${res.status}: ${JSON.stringify(data)}\n`)
    }
  } catch (err) {
    console.log(`   ❌ Request failed: ${err.message}\n`)
  }

  // Test 4: Test API with Bearer token (should work)
  console.log('4. Testing API with Bearer token...')
  try {
    const res = await fetch(`${BASE_URL}/api/families`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    const data = await res.json()
    console.log(`   Status: ${res.status}`)
    console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`)
    if (res.status === 200) {
      console.log('   ✅ API authenticated successfully with Bearer token!\n')
    } else if (res.status === 401) {
      console.log('   ❌ Token rejected (401). The new code might not be deployed yet.\n')
    } else {
      console.log(`   ⚠️ Got status ${res.status} (not 401, so token was accepted)\n`)
    }
  } catch (err) {
    console.log(`   ❌ Request failed: ${err.message}\n`)
  }

  // Test 5: Test API with invalid token (should fail with 401)
  console.log('5. Testing API with invalid token (should return 401)...')
  try {
    const res = await fetch(`${BASE_URL}/api/families`, {
      headers: {
        'Authorization': 'Bearer invalid-token-here',
      },
    })
    const data = await res.json()
    if (res.status === 401) {
      console.log(`   Response: ${JSON.stringify(data)}`)
      console.log('   ✅ Correctly rejects invalid token\n')
    } else {
      console.log(`   ❌ Expected 401, got ${res.status}: ${JSON.stringify(data)}\n`)
    }
  } catch (err) {
    console.log(`   ❌ Request failed: ${err.message}\n`)
  }

  // Test 6: Test settings API with Bearer token
  console.log('6. Testing settings API with Bearer token...')
  try {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    const data = await res.json()
    console.log(`   Status: ${res.status}`)
    if (res.status === 200) {
      console.log(`   Settings: freeMin=${data.freeMinutesPerWeek}, priceMin=${data.pricePerMinute}`)
      console.log('   ✅ Settings API works with Bearer token!\n')
    } else {
      console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}\n`)
    }
  } catch (err) {
    console.log(`   ❌ Request failed: ${err.message}\n`)
  }

  // Test 7: Test credentials-login endpoint
  console.log('7. Testing credentials-login endpoint...')
  try {
    const res = await fetch(`${BASE_URL}/api/auth/credentials-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER_EMAIL, password: 'test123456' }),
    })
    const data = await res.json()
    console.log(`   Status: ${res.status}`)
    console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`)
    if (data.token) {
      console.log(`   ✅ JWT token returned from credentials-login: ${data.token.substring(0, 50)}...\n`)
    } else if (data.error === 'EMAIL_NOT_VERIFIED') {
      console.log('   ⚠️ User email not verified (expected for test user)\n')
    } else {
      console.log(`   ⚠️ No token returned: ${JSON.stringify(data)}\n`)
    }
  } catch (err) {
    console.log(`   ❌ Request failed: ${err.message}\n`)
  }

  console.log('=== Test Complete ===')
}

test().catch(console.error)
