import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { emotion, message = 'Testing emotion system' } = req.body

  // Validate emotion
  const validEmotions = [
    'angry',
    'happy',
    'neutral',
    'relaxed',
    'sad',
    'surprised',
  ]
  if (!emotion || !validEmotions.includes(emotion)) {
    return res.status(400).json({
      error: 'Invalid emotion',
      validEmotions,
      usage:
        'POST /api/test-emotion-flow with body: { "emotion": "happy", "message": "optional test message" }',
    })
  }

  console.log('🎭 [Test Emotion Flow] Testing emotion:', emotion)
  console.log('🎭 [Test Emotion Flow] Test message:', message)

  // Simulate the emotion response that would come from the AI
  const testResponse = {
    success: true,
    emotion,
    message: `Test response with ${emotion} emotion: ${message}`,
    timestamp: new Date().toISOString(),
    testMode: true,
    instructions: [
      `1. This simulates the AI returning emotion: ${emotion}`,
      '2. The response should trigger the widget emotion update',
      '3. Check browser console for 🎭 prefixed logs',
      '4. The PNG/VID should change based on the emotion',
      '5. Look for logs in matchmaking orchestrator and widget',
    ],
  }

  res.status(200).json(testResponse)
}
