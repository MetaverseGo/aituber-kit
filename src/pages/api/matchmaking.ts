import type { NextApiRequest, NextApiResponse } from 'next'
import MatchProfile from '@/models/MatchProfile'
import { MatchmakingOrchestrator } from '@/features/matchmaking/matchmaking-orchestrator'
import { MamaSanState } from '@/models/MatchProfile'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { connectMongoDB } from '@/lib/mongodb'
import settingsStore from '@/features/stores/settings'

// Helper to get or create a MatchProfile for a UID
async function getOrCreateProfile(uid: string) {
  let profile = await MatchProfile.findOne({ uid })
  if (!profile) {
    profile = await MatchProfile.create({
      uid,
      role: 'guest',
      status: 'OFFLINE',
      mamasanState: { currentQuestion: 0, answers: [], isComplete: false },
    })
  }
  return profile
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await connectMongoDB()
  // Log AI service environment and settings
  console.log(
    '[Matchmaking API] ENV NEXT_PUBLIC_SELECT_AI_SERVICE:',
    process.env.NEXT_PUBLIC_SELECT_AI_SERVICE
  )
  console.log(
    '[Matchmaking API] settingsStore.getState().selectAIService:',
    settingsStore.getState().selectAIService
  )

  // Log request method and headers (masking sensitive info)
  console.log('[Matchmaking API] Incoming request:', {
    method: req.method,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? '***' : undefined,
    },
    url: req.url,
  })

  if (req.method !== 'POST') {
    console.log('[Matchmaking API] Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Log request body (mask token)
  const { message, token } = req.body
  console.log('[Matchmaking API] Request body:', {
    message:
      typeof message === 'string' ? message.slice(0, 100) : typeof message,
    token: token ? '***' : undefined,
  })
  if (!message || !token) {
    console.log('[Matchmaking API] Missing message or token', {
      message,
      token: !!token,
    })
    return res.status(400).json({ error: 'Missing message or token' })
  }

  try {
    // Verify Firebase token
    console.log('[Matchmaking API] Verifying Firebase token...')
    const admin = getFirebaseAdmin()
    let decoded
    try {
      decoded = await admin.auth().verifyIdToken(token)
      console.log('[Matchmaking API] Token verified. Decoded token:', {
        uid: decoded.uid,
        email: decoded.email,
        provider: decoded.firebase?.sign_in_provider,
        auth_time: decoded.auth_time,
        exp: decoded.exp,
      })
    } catch (verifyError) {
      const err = verifyError as Error
      console.error('[Matchmaking API] Token verification failed:', err)
      return res
        .status(401)
        .json({ error: 'Invalid or expired token', details: err.message })
    }
    const uid = decoded.uid

    // Get or create user profile
    console.log('[Matchmaking API] Fetching or creating profile for UID:', uid)
    const profile = await getOrCreateProfile(uid)
    const mamasanState: MamaSanState = profile.mamasanState || {
      currentQuestion: 0,
      answers: [],
      isComplete: false,
    }
    console.log('[Matchmaking API] Loaded profile:', {
      uid: profile.uid,
      stamina: profile.stamina,
      intimacyLevel: profile.intimacyLevel,
      mamasanState,
    })

    // --- Stamina and Intimacy Logic ---
    if (typeof profile.stamina !== 'number') profile.stamina = 10
    if (profile.stamina > 0) {
      profile.stamina -= 1
    }
    if (typeof profile.intimacyLevel !== 'number') profile.intimacyLevel = 0
    if (profile.intimacyLevel < 100) {
      profile.intimacyLevel += 1
    }
    // --- End Stamina and Intimacy Logic ---

    // Create orchestrator instance (stateless)
    const orchestrator = new MatchmakingOrchestrator(uid)
    console.log('[Matchmaking API] Created orchestrator for UID:', uid)

    // Process message using current mamasanState
    const result = await orchestrator.processMamaSanModeServer(
      message,
      mamasanState
    )
    console.log('[Matchmaking API] Orchestrator result:', {
      message:
        result && typeof result.message === 'string'
          ? result.message.slice(0, 100)
          : undefined,
      isComplete: result?.isComplete,
      step: result?.step,
      data: result?.data ? '[present]' : null,
    })

    // Save updated state
    profile.mamasanState = result.updatedState

    // Save profile updates if any
    if (
      result.profileUpdates &&
      Object.keys(result.profileUpdates).length > 0
    ) {
      console.log(
        '[Matchmaking API] Applying profile updates:',
        result.profileUpdates
      )

      // Apply the profile updates to the profile document
      Object.keys(result.profileUpdates).forEach((key) => {
        // Use dot notation to set nested properties
        profile.set(key, result.profileUpdates[key])
      })

      console.log('[Matchmaking API] Profile updates applied')
    }

    await profile.save()
    console.log('[Matchmaking API] Profile updated and saved for UID:', uid)

    return res.status(200).json({
      message: result.message,
      isComplete: result.isComplete,
      step: result.step,
      mamasanState: result.updatedState,
      data: result.data || null,
      stamina: profile.stamina,
      intimacyLevel: profile.intimacyLevel,
    })
  } catch (error) {
    const err = error as Error
    console.error('[Matchmaking API] Unhandled error:', err.stack || err)
    return res
      .status(500)
      .json({ error: 'Internal server error', details: err.message })
  }
}
