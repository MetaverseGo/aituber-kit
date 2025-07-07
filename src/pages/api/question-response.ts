import { NextApiRequest, NextApiResponse } from 'next'
import { connectMongoDB } from '@/lib/mongodb'
import UserQuestionHistory from '@/models/UserQuestionHistory'
import { callAI } from '@/lib/ai-client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await connectMongoDB()

    const {
      userId,
      questionId,
      responseText,
      isSkipped = false,
      context = 'continuous_profiling',
    } = req.body

    if (!userId || !questionId) {
      return res
        .status(400)
        .json({ error: 'userId and questionId are required' })
    }

    // Extract profile tags from response using AI
    let extractedTags: string[] = []
    if (responseText && !isSkipped) {
      try {
        const extractionPrompt = `Analyze this user response to a dating/matchmaking question and extract relevant profile tags. Focus on preferences, personality traits, and characteristics that would be useful for matching.

Question ID: ${questionId}
User Response: "${responseText}"

Extract 3-7 relevant tags in lowercase, separated by commas. Be specific and useful for matching purposes.
Examples: "casual-dating", "serious-relationship", "tall-preference", "outdoorsy", "introverted", "physical-touch", "adventure-seeking"

Tags:`

        const aiResponse = await callAI([
          {
            role: 'user',
            content: extractionPrompt,
          },
        ])

        const tagString = aiResponse.trim()
        extractedTags = tagString
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0)
      } catch (error) {
        console.error('Error extracting tags:', error)
        // Continue without tags if extraction fails
      }
    }

    // Record or update the question response
    const questionResponse = await UserQuestionHistory.findOneAndUpdate(
      { userId, questionId },
      {
        userId,
        questionId,
        askedAt: new Date(),
        answeredAt: isSkipped ? undefined : new Date(),
        responseText: isSkipped ? undefined : responseText,
        profileTagsExtracted: extractedTags,
        isSkipped,
        context,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    )

    res.status(200).json({
      success: true,
      questionResponse: {
        questionId: questionResponse.questionId,
        askedAt: questionResponse.askedAt,
        answeredAt: questionResponse.answeredAt,
        isSkipped: questionResponse.isSkipped,
        extractedTags: questionResponse.profileTagsExtracted,
        context: questionResponse.context,
      },
    })
  } catch (error) {
    console.error('Error recording question response:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
