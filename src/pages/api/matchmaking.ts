import type { NextApiRequest, NextApiResponse } from 'next'
import MatchProfile from '@/models/MatchProfile'
import { MatchmakingOrchestrator } from '@/features/matchmaking/matchmaking-orchestrator'
import { MamaSanState } from '@/models/MatchProfile'
import { getFirebaseAdmin } from '@/lib/firebase-admin'

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
    const decoded = await admin.auth().verifyIdToken(token)
    const uid = decoded.uid

    // Get or create user profile
    const profile = await getOrCreateProfile(uid)
    const mamasanState: MamaSanState = profile.mamasanState || {
      currentQuestion: 0,
      answers: [],
      isComplete: false,
    }

    // --- Stamina and Intimacy Logic ---
    // Decrement stamina if above 0
    if (typeof profile.stamina !== 'number') profile.stamina = 10
    if (profile.stamina > 0) {
      profile.stamina -= 1
    }
    // Increment intimacyLevel up to max 100
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

    // Save updated state
    profile.mamasanState = result.updatedState
    await profile.save()

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
    console.error('Matchmaking API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
