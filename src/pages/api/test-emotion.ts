import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { emotion } = req.body

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
    })
  }

  console.log('🎭 [Test API] Testing emotion:', emotion)

  // Return the emotion data that would normally come from the AI
  res.status(200).json({
    success: true,
    emotion,
    message: `Emotion test: ${emotion}`,
    instructions: [
      'This endpoint simulates the AI returning an emotion.',
      'In a real scenario, this would be called from the matchmaking orchestrator.',
      'The widget should receive a WIDGET_EMOTION_UPDATE message.',
      'Check the browser console for emotion flow logs.',
    ],
  })
}
