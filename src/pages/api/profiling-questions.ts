import { NextApiRequest, NextApiResponse } from 'next'
import { connectMongoDB } from '@/lib/mongodb'
import ProfilingQuestion from '@/models/ProfilingQuestion'
import UserQuestionHistory from '@/models/UserQuestionHistory'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await connectMongoDB()

    const {
      userId,
      category,
      difficulty,
      limit = '5',
      priorityThreshold = '5',
      excludeAsked = 'true',
    } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // Build query filter
    const filter: any = { isActive: true }

    if (category) {
      filter.category = category
    }

    if (difficulty) {
      filter.difficulty = difficulty
    }

    if (priorityThreshold) {
      filter.priority = { $gte: parseInt(priorityThreshold as string) }
    }

    // Get questions user has already been asked
    let excludedQuestionIds: string[] = []
    if (excludeAsked === 'true') {
      const askedQuestions = await UserQuestionHistory.find(
        { userId: userId as string },
        { questionId: 1 }
      )
      excludedQuestionIds = askedQuestions.map((q) => q.questionId)

      if (excludedQuestionIds.length > 0) {
        filter.questionId = { $nin: excludedQuestionIds }
      }
    }

    // Find available questions
    const questions = await ProfilingQuestion.find(filter)
      .sort({ priority: -1, createdAt: 1 })
      .limit(parseInt(limit as string))
      .lean()

    // Add metadata about question selection
    const totalAvailable = await ProfilingQuestion.countDocuments(filter)
    const totalAsked = excludedQuestionIds.length

    res.status(200).json({
      questions,
      metadata: {
        totalAvailable,
        totalAsked,
        returned: questions.length,
        filters: {
          category,
          difficulty,
          priorityThreshold,
          excludeAsked: excludeAsked === 'true',
        },
      },
    })
  } catch (error) {
    console.error('Error fetching profiling questions:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
