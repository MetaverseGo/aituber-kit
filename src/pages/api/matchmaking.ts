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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, token } = req.body
  if (!message || !token) {
    return res.status(400).json({ error: 'Missing message or token' })
  }

  try {
    // Verify Firebase token
    const admin = getFirebaseAdmin()
    let decoded
    try {
      decoded = await admin.auth().verifyIdToken(token)
    } catch (verifyError) {
      const err = verifyError as Error
      console.error('[Matchmaking API] Token verification failed:', err)
      return res
        .status(401)
        .json({ error: 'Invalid or expired token', details: err.message })
    }
    const uid = decoded.uid

    // Get or create user profile
    const profile = await getOrCreateProfile(uid)
    const mamasanState: MamaSanState = profile.mamasanState || {
      currentQuestion: 0,
      answers: [],
      isComplete: false,
    }

    // Debug: Log state before processing
    console.log(
      `[${uid.slice(-4)}] Before - Q${mamasanState.currentQuestion}: "${message.slice(0, 30)}..."`
    )

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

    // Process message using current mamasanState
    const result = await orchestrator.processMamaSanModeServer(
      message,
      mamasanState
    )

    // Debug: Log state after processing
    console.log(
      `[${uid.slice(-4)}] After  - Q${result.updatedState.currentQuestion} -> "${result.step}" (answered: ${result.updatedState.currentQuestion > mamasanState.currentQuestion})`
    )

    // Save updated state
    profile.mamasanState = result.updatedState

    // Save profile updates if any
    if (
      result.profileUpdates &&
      Object.keys(result.profileUpdates).length > 0
    ) {
      // Apply the profile updates to the profile document
      Object.keys(result.profileUpdates).forEach((key) => {
        // Use dot notation to set nested properties
        profile.set(key, result.profileUpdates[key])
      })
    }

    await profile.save()

    console.log('🎭 [Matchmaking API] Response data:', {
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : [],
      emotion: result.data?.emotion,
      emotionType: typeof result.data?.emotion,
      fullDataObject: result.data,
    })

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
