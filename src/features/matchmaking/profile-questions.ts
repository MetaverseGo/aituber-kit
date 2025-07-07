/**
 * MongoDB-based profiling questions service
 * Fetches questions from database and tracks which ones have been asked
 */

import { ProfileData } from '@/types/matchmaking'

export interface ProfilingQuestion {
  questionId: string
  text: string
  category: string
  subcategory?: string
  tags: string[]
  difficulty: 'basic' | 'intermediate' | 'advanced'
  priority: number // Priority for asking (1-10)
  isActive: boolean
}

export interface QuestionFilter {
  category?: string
  difficulty?: 'basic' | 'intermediate' | 'advanced'
  priorityThreshold?: number
  limit?: number
}

/**
 * Fetch unasked profiling questions from MongoDB
 */
export async function getAvailableQuestions(
  userId: string,
  filters: QuestionFilter = {}
): Promise<ProfilingQuestion[]> {
  try {
    const queryParams = new URLSearchParams({
      userId,
      excludeAsked: 'true',
      limit: (filters.limit || 5).toString(),
      priorityThreshold: (filters.priorityThreshold || 5).toString(),
    })

    if (filters.category) {
      queryParams.append('category', filters.category)
    }
    if (filters.difficulty) {
      queryParams.append('difficulty', filters.difficulty)
    }

    const response = await fetch(`/api/profiling-questions?${queryParams}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.statusText}`)
    }

    const data = await response.json()
    return data.questions || []
  } catch (error) {
    console.error('Error fetching available questions:', error)
    return []
  }
}

/**
 * Get random questions for profile filling, avoiding already asked ones
 */
export async function getRandomProfileQuestions(
  userId: string,
  excludeCategories: string[] = [],
  count: number = 3
): Promise<string[]> {
  try {
    const questions = await getAvailableQuestions(userId, {
      limit: count * 2, // Get more to account for filtering
    })

    // Filter out excluded categories
    const filtered = questions.filter(
      (q) =>
        !excludeCategories.includes(q.category) &&
        !excludeCategories.includes(`${q.category}.${q.subcategory}`)
    )

    // Shuffle and return random questions
    const shuffled = filtered.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map((q) => q.text)
  } catch (error) {
    console.error('Error getting random profile questions:', error)
    return []
  }
}

/**
 * Get interest-based conversation questions
 */
export async function getInterestBasedQuestions(
  userId: string,
  userProfile: ProfileData | null
): Promise<string[]> {
  try {
    // Get questions from interests and lifestyle categories
    const questions = await getAvailableQuestions(userId, {
      category: Math.random() > 0.5 ? 'interests' : 'lifestyle',
      difficulty: 'basic',
      limit: 3,
    })

    if (questions.length === 0) {
      // Fallback to any basic questions if no interest/lifestyle questions available
      const fallbackQuestions = await getAvailableQuestions(userId, {
        difficulty: 'basic',
        limit: 3,
      })
      return fallbackQuestions.map((q) => q.text)
    }

    return questions.map((q) => q.text)
  } catch (error) {
    console.error('Error getting interest-based questions:', error)
    return []
  }
}

/**
 * Analyze profile gaps and get targeted questions
 */
export async function getProfileGapQuestions(
  userId: string,
  userProfile: ProfileData | null
): Promise<string[]> {
  if (!userProfile) {
    // If no profile, get basic questions from key categories
    return await getBasicProfileQuestions(userId)
  }

  try {
    const gapCategories = analyzeProfileGaps(userProfile)

    if (gapCategories.length === 0) {
      // Profile is complete, get interest questions
      return await getInterestBasedQuestions(userId, userProfile)
    }

    // Get questions for the biggest gaps
    const targetCategory = gapCategories[0]
    const questions = await getAvailableQuestions(userId, {
      category: targetCategory,
      priorityThreshold: 6,
      limit: 3,
    })

    return questions.map((q) => q.text)
  } catch (error) {
    console.error('Error getting profile gap questions:', error)
    return await getBasicProfileQuestions(userId)
  }
}

/**
 * Get basic profiling questions for new users
 */
async function getBasicProfileQuestions(userId: string): Promise<string[]> {
  try {
    const questions = await getAvailableQuestions(userId, {
      difficulty: 'basic',
      priorityThreshold: 7,
      limit: 3,
    })

    return questions.map((q) => q.text)
  } catch (error) {
    console.error('Error getting basic profile questions:', error)
    return []
  }
}

/**
 * Analyze profile gaps to determine what categories need more information
 */
function analyzeProfileGaps(userProfile: ProfileData): string[] {
  const gaps: string[] = []

  // Check physical preferences
  if (
    !userProfile.physicalPreferences ||
    Object.keys(userProfile.physicalPreferences).length < 3
  ) {
    gaps.push('physicalPreferences')
  }

  // Check relationship style
  if (
    !userProfile.relationshipStyle ||
    Object.keys(userProfile.relationshipStyle).length < 2
  ) {
    gaps.push('relationshipStyle')
  }

  // Check intimacy comfort
  if (!userProfile.intimacyComfort || userProfile.intimacyComfort.length < 3) {
    gaps.push('intimacyComfort')
  }

  // Check demographics
  if (
    !userProfile.demographics ||
    Object.keys(userProfile.demographics).length < 2
  ) {
    gaps.push('demographics')
  }

  // Check service preferences
  if (
    !userProfile.servicePreferences ||
    Object.keys(userProfile.servicePreferences).length < 3
  ) {
    gaps.push('servicePreferences')
  }

  return gaps
}

/**
 * Record that a question was asked to a user
 */
export async function recordQuestionAsked(
  userId: string,
  questionText: string,
  responseText: string | null = null,
  isSkipped: boolean = false
): Promise<boolean> {
  try {
    // First, try to find the question by text to get its ID
    const questionsResponse = await fetch(
      `/api/profiling-questions?userId=${userId}&excludeAsked=false&limit=100`
    )

    if (!questionsResponse.ok) {
      throw new Error('Failed to fetch questions for lookup')
    }

    const questionsData = await questionsResponse.json()
    const question = questionsData.questions.find(
      (q: ProfilingQuestion) => q.text === questionText
    )

    if (!question) {
      console.warn('Question not found in database:', questionText)
      return false
    }

    // Record the question response
    const response = await fetch('/api/question-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        questionId: question.questionId,
        responseText,
        isSkipped,
        context: 'continuous_profiling',
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to record question: ${response.statusText}`)
    }

    return true
  } catch (error) {
    console.error('Error recording question asked:', error)
    return false
  }
}
