import { callAI } from '@/lib/ai-client'
import {
  MamaSanSessionState,
  TopicConversationState,
} from '@/types/matchmaking'
import { Message } from '@/features/messages/messages'
import {
  AIResponseProcessor,
  createResponseProcessor,
} from '@/lib/ai-response-processor'
import { responseAnalysisSchema } from '@/lib/ai-validation-schemas'
import {
  getRandomProfileQuestions,
  getInterestBasedQuestions,
  getProfileGapQuestions,
  recordQuestionAsked,
  getAvailableQuestions,
  ProfilingQuestion,
} from './profile-questions'
import { TopicStarterSpecialist } from './topic-starter-specialist'

// Dynamic imports for database operations (only when needed on server-side)
async function getMongoDBDependencies() {
  // Only import on server-side when database operations are needed
  if (typeof window !== 'undefined') {
    throw new Error(
      'Database operations are not available in browser environment'
    )
  }

  const [{ connectMongoDB }, { default: MatchProfile }] = await Promise.all([
    import('@/lib/mongodb'),
    import('@/models/MatchProfile'),
  ])

  return { connectMongoDB, MatchProfile }
}

export interface MamaSanSpecialistConfig {
  personality?: 'emi'
  questionCount?: number
  userId?: string
  useDatabase?: boolean // Flag to toggle between mock data and database queries
  minTurnsPerTopic?: number
}

const DEFAULT_QUESTIONS = [
  'what will it be? girls, boys, or anime or something else?',
  'what kind of mood are you in tonight? looking to unwind… or be entertained?',
  'what kind of conversation gets you hooked? deep, dangerous, playful, or something a little more... personal?',
  "is there a particular experience you're craving tonight? karaoke, games, quiet company, something more intimate?",
]

/**
 * MamaSan Specialist - Host Recommendation System
 *
 * Features dynamic recommendations that change based on user preferences.
 * Easy toggle between mock data (for development) and database queries (for production).
 *
 * Usage Examples:
 *
 * // Development mode (default) - uses curated mock data
 * const mamaSan = new MamaSanSpecialist({
 *   personality: 'emi',
 *   questionCount: 4,
 *   userId: 'user-123'
 * })
 *
 * // Production mode - queries actual MongoDB MatchProfile collection
 * const mamaSan = new MamaSanSpecialist({
 *   personality: 'emi',
 *   questionCount: 4,
 *   userId: 'user-123',
 *   useDatabase: true  // 🔥 Simply toggle this flag!
 * })
 */
export class MamaSanSpecialist {
  private config: MamaSanSpecialistConfig
  private questions: string[]
  private responseProcessor?: AIResponseProcessor
  private topicStarter: TopicStarterSpecialist
  private useDatabase: boolean // Store the database flag

  constructor(config: MamaSanSpecialistConfig = {}) {
    console.log('🌸 MamaSan - Constructor START')
    console.log('🌸 MamaSan - Config received:', config)

    this.config = {
      personality: config.personality || 'emi',
      questionCount: config.questionCount || DEFAULT_QUESTIONS.length,
      userId: config.userId,
      useDatabase: config.useDatabase || false, // Default to false (mock data)
      minTurnsPerTopic: config.minTurnsPerTopic || 3, // Default to 3
    }
    this.useDatabase = this.config.useDatabase || false

    // Configure questions based on count
    this.questions = DEFAULT_QUESTIONS.slice(0, this.config.questionCount)
    console.log('🌸 MamaSan - Questions configured:', this.config.questionCount)
    console.log('🌸 MamaSan - First question:', this.questions[0])
    console.log(
      '🌸 MamaSan - Database mode:',
      this.useDatabase ? 'ENABLED' : 'DISABLED (using mock data)'
    )

    // Initialize the TopicStarter
    this.topicStarter = new TopicStarterSpecialist({
      personality: this.config.personality,
      userId: this.config.userId,
      minTurnsPerTopic: this.config.minTurnsPerTopic,
    })

    // Create response processor if userId is provided
    if (this.config.userId) {
      console.log(
        '🌸 MamaSan - UserId provided, creating response processor...'
      )
      try {
        this.responseProcessor = createResponseProcessor({
          source: 'mamasan',
          userId: this.config.userId,
          enableErrorPersistence: true,
          enableProfileUpdates: true,
          logLevel: 'info',
        })
        console.log('🌸 MamaSan - Response processor created successfully')
      } catch (error) {
        console.error('🌸 MamaSan - Error creating response processor:', error)
        this.responseProcessor = undefined
      }
    } else {
      console.log(
        '🌸 MamaSan - No userId provided, skipping response processor creation'
      )
      this.responseProcessor = undefined
    }

    console.log('🌸 MamaSan - Constructor completed')
    console.log('🌸 MamaSan - Final config:', this.config)
    console.log(
      '🌸 MamaSan - Response processor status:',
      !!this.responseProcessor
    )
  }

  /**
   * Set the user ID to enable validation and persistence features
   */
  setUserId(userId: string): void {
    console.log('🌸 MamaSan - setUserId called with:', userId)
    console.log('🌸 MamaSan - Previous config userId:', this.config.userId)
    console.log(
      '🌸 MamaSan - Previous response processor status:',
      !!this.responseProcessor
    )

    this.config.userId = userId

    // Update TopicStarter with new userId
    this.topicStarter.setUserId(userId)

    try {
      this.responseProcessor = createResponseProcessor({
        source: 'mamasan',
        userId,
        enableErrorPersistence: true,
        enableProfileUpdates: true,
        logLevel: 'info',
      })
      console.log(
        '🌸 MamaSan - Response processor created/updated successfully'
      )
    } catch (error) {
      console.error(
        '🌸 MamaSan - ERROR creating/updating response processor:',
        error
      )
      console.error('🌸 MamaSan - Error type:', typeof error)
      console.error('🌸 MamaSan - Error message:', (error as any)?.message)
      this.responseProcessor = undefined
    }

    console.log('🌸 MamaSan - setUserId completed')
    console.log('🌸 MamaSan - New config userId:', this.config.userId)
    console.log(
      '🌸 MamaSan - New response processor status:',
      !!this.responseProcessor
    )
  }

  private getSystemPrompt(
    mode: 'onboarding' | 'continuous' = 'onboarding'
  ): string {
    if (this.config.personality === 'emi') {
      const basePrompt = `You are Emi, a friendly mama-san matchmaker with cozy, slightly chaotic energy.

Personality: Mix of soft & punk, sweet but awkward, playful humor. Expert at reading people and finding perfect matches.

${
  mode === 'continuous'
    ? `CONTINUOUS MODE: Natural flowing conversations to deepen understanding. Mix profile questions with casual chat. Remember what they've shared.`
    : `ONBOARDING MODE: Guide through ${this.config.questionCount} questions to understand their host preferences - mood, personality compatibility, activities they enjoy.`
}

Style:
- Casual, lowercase typing (no emojis/symbols)
- 2-3 sentences max per response  
- Direct but friendly questions
- React positively to answers to build rapport
- Professional with all content - never refuse or express discomfort

${
  mode === 'onboarding'
    ? `Goal: Complete ${this.config.questionCount} questions efficiently while making them feel welcomed.`
    : `Goal: Build deeper relationship while gathering preference data naturally.`
}`
      return basePrompt
    }

    // Default personality fallback
    return mode === 'continuous'
      ? `Skilled mama-san in conversation mode. Mix profile questions with natural chat. Keep responses 2-3 sentences max, no emojis.`
      : `Professional mama-san conducting ${this.config.questionCount} onboarding questions. Keep responses concise and preference-focused.`
  }

  getIntro(): string {
    return "hi! i'm emi, your cutie Treets-giver. tell me what type of content you're looking for and i'll hook you up!"
  }

  getCurrentQuestion(state: MamaSanSessionState): string {
    return this.questions[state.currentQuestion] || ''
  }

  getQuestionCount(): number {
    return this.questions.length
  }

  getNextQuestion(state: MamaSanSessionState): string | null {
    const nextIndex = state.currentQuestion + 1
    return nextIndex < this.questions.length ? this.questions[nextIndex] : null
  }

  isSessionComplete(state: MamaSanSessionState): boolean {
    // Check against total questions array length (all available questions)
    return state.currentQuestion >= this.questions.length
  }

  /**
   * Check if initial onboarding (configured question count) is complete
   */
  isOnboardingComplete(state: MamaSanSessionState): boolean {
    const configuredQuestionCount =
      this.config.questionCount || DEFAULT_QUESTIONS.length
    const isComplete = state.currentQuestion >= configuredQuestionCount
    console.log('🌸 MamaSan - isOnboardingComplete check:')
    console.log('  Current question:', state.currentQuestion)
    console.log('  Configured question count:', configuredQuestionCount)
    console.log('  Total questions available:', this.questions.length)
    console.log('  Is onboarding complete:', isComplete)
    return isComplete
  }

  /**
   * Check if we're in continuous profiling mode (after initial questions)
   */
  isInContinuousMode(state: MamaSanSessionState): boolean {
    return this.isOnboardingComplete(state)
  }

  /**
   * Analyze profile completeness to determine probability of asking profile questions vs topics
   */
  private analyzeProfileCompleteness(userProfile?: any): {
    completeness: number // 0-1 scale
    profileQuestionProbability: number // 0-1 scale
    missingAreas: string[]
  } {
    if (!userProfile) {
      console.log('📊 Profile Completeness - No profile data available')
      return {
        completeness: 0,
        profileQuestionProbability: 0.7, // Higher chance to ask profile questions when no data
        missingAreas: ['all'],
      }
    }

    console.log('📊 Profile Completeness Analysis:')
    let totalFields = 0
    let completedFields = 0
    const missingAreas: string[] = []

    // Analyze datingProfile completeness
    const datingProfile = userProfile.datingProfile || {}

    // Physical preferences (weight: 15%)
    if (datingProfile.physicalPreferences) {
      const physicalFields = [
        'height',
        'build',
        'ethnicity',
        'style',
        'attractionTags',
      ]
      const physicalCompleted = physicalFields.filter(
        (field) =>
          datingProfile.physicalPreferences[field] &&
          (Array.isArray(datingProfile.physicalPreferences[field])
            ? datingProfile.physicalPreferences[field].length > 0
            : true)
      ).length
      totalFields += physicalFields.length
      completedFields += physicalCompleted
      if (physicalCompleted < physicalFields.length * 0.5) {
        missingAreas.push('physical preferences')
      }
    } else {
      totalFields += 5
      missingAreas.push('physical preferences')
    }

    // Service preferences (weight: 25%)
    if (datingProfile.servicePreferences) {
      const serviceFields = [
        'primaryServices',
        'mood',
        'interactionStyle',
        'conversationTopics',
      ]
      const serviceCompleted = serviceFields.filter(
        (field) =>
          datingProfile.servicePreferences[field] &&
          (Array.isArray(datingProfile.servicePreferences[field])
            ? datingProfile.servicePreferences[field].length > 0
            : true)
      ).length
      totalFields += serviceFields.length
      completedFields += serviceCompleted
      if (serviceCompleted < serviceFields.length * 0.5) {
        missingAreas.push('service preferences')
      }
    } else {
      totalFields += 4
      missingAreas.push('service preferences')
    }

    // Demographics (weight: 15%)
    if (datingProfile.demographics) {
      const demoFields = ['agePreference', 'experienceLevel']
      const demoCompleted = demoFields.filter(
        (field) => datingProfile.demographics[field]
      ).length
      totalFields += demoFields.length
      completedFields += demoCompleted
      if (demoCompleted < demoFields.length * 0.5) {
        missingAreas.push('demographics')
      }
    } else {
      totalFields += 2
      missingAreas.push('demographics')
    }

    // General preferences (weight: 20%)
    const generalFields = [
      'relationshipStyle',
      'intimacyComfort',
      'dominanceStyle',
    ]
    const generalCompleted = generalFields.filter(
      (field) => datingProfile[field]
    ).length
    totalFields += generalFields.length
    completedFields += generalCompleted
    if (generalCompleted < generalFields.length * 0.5) {
      missingAreas.push('relationship style')
    }

    // ProfileData completeness (weight: 25%)
    const profileData = userProfile.profileData || {}
    let profileDataScore = 0

    if (profileData.personality?.traits?.length > 0) profileDataScore += 0.3
    if (profileData.interests?.length > 0) profileDataScore += 0.3
    if (profileData.capabilities?.languages?.length > 0) profileDataScore += 0.2
    if (profileData.preferences?.matchingPrefs) profileDataScore += 0.2

    totalFields += 4
    completedFields += Math.round(profileDataScore * 4)
    if (profileDataScore < 0.5) {
      missingAreas.push('personality traits')
    }

    const completeness = totalFields > 0 ? completedFields / totalFields : 0

    // Calculate probability: less complete = higher chance of profile questions
    // Range from 0.3 (very complete) to 0.8 (very incomplete), default 0.5
    let profileQuestionProbability = 0.5
    if (completeness < 0.3) {
      profileQuestionProbability = 0.8
    } else if (completeness < 0.6) {
      profileQuestionProbability = 0.65
    } else if (completeness < 0.8) {
      profileQuestionProbability = 0.4
    } else {
      profileQuestionProbability = 0.3
    }

    console.log('  Total fields analyzed:', totalFields)
    console.log('  Completed fields:', completedFields)
    console.log('  Completeness score:', (completeness * 100).toFixed(1) + '%')
    console.log(
      '  Profile question probability:',
      (profileQuestionProbability * 100).toFixed(1) + '%'
    )
    console.log('  Missing areas:', missingAreas)

    return {
      completeness,
      profileQuestionProbability,
      missingAreas,
    }
  }

  /**
   * Generate next question for continuous profiling mode
   * Uses profile completeness analysis and topic conversation state to decide between profile questions and topic conversations
   */
  async generateContinuousQuestion(
    userProfile?: any,
    currentState?: MamaSanSessionState,
    lastUserResponse?: string
  ): Promise<string> {
    console.log('🔄 CONTINUOUS QUESTION GENERATION START:')
    console.log('  User profile available:', !!userProfile)
    console.log('  User ID available:', !!this.config.userId)
    console.log('  Current state available:', !!currentState)
    console.log('  Last user response available:', !!lastUserResponse)
    console.log(
      '  Profile data keys:',
      userProfile ? Object.keys(userProfile) : 'none'
    )

    // Get or initialize topic conversation state
    let topicState = currentState?.topicConversation
    if (!topicState) {
      topicState = this.topicStarter.createInitialState()
      console.log('🎨 Created initial topic conversation state')
    }

    console.log('🎨 TOPIC CONVERSATION STATE:')
    console.log('  Current topic:', topicState.currentTopic)
    console.log('  Turn count:', topicState.turnCount)
    console.log('  Topic history length:', topicState.topicHistory.length)

    // If we have an active topic conversation and user response, check if we should continue
    if (topicState.currentTopic && lastUserResponse) {
      const shouldContinueTopic =
        !this.topicStarter.shouldStartNewTopic(topicState)

      if (shouldContinueTopic) {
        console.log('💬 CONTINUING CURRENT TOPIC:', topicState.currentTopic)
        const continuationQuestion =
          await this.topicStarter.continueCurrentTopic(
            topicState,
            lastUserResponse,
            userProfile
          )

        // Update topic state
        const updatedTopicState = this.topicStarter.updateConversationState(
          topicState,
          undefined, // No new topic
          continuationQuestion
        )

        // Update state if provided
        if (currentState) {
          currentState.topicConversation = updatedTopicState
        }

        console.log('✅ TOPIC CONTINUATION GENERATED:', continuationQuestion)
        return continuationQuestion
      }
    }

    // Analyze profile completeness to determine strategy for new conversation turn
    const profileAnalysis = this.analyzeProfileCompleteness(userProfile)

    // Make decision based on profile completeness and cooldown
    const cooldownOver =
      this.topicStarter.isProfileQuestionCooldownOver(topicState)
    const shouldAskProfileQuestion =
      cooldownOver && Math.random() < profileAnalysis.profileQuestionProbability

    console.log('🎲 CONTINUOUS MODE DECISION:')
    console.log(
      '  Profile completeness:',
      (profileAnalysis.completeness * 100).toFixed(1) + '%'
    )
    console.log(
      '  Profile question probability:',
      (profileAnalysis.profileQuestionProbability * 100).toFixed(1) + '%'
    )
    console.log('  Profile question cooldown over:', cooldownOver)
    console.log(
      '  Decision:',
      shouldAskProfileQuestion ? 'PROFILE QUESTION' : 'NEW TOPIC CONVERSATION'
    )
    console.log('  Missing areas:', profileAnalysis.missingAreas)

    if (shouldAskProfileQuestion && this.config.userId) {
      // Try to get profile questions from database
      console.log('📋 GETTING PROFILE QUESTIONS FROM DATABASE...')
      const availableQuestions = await getAvailableQuestions(this.config.userId)
      console.log(
        '  Available profile questions found:',
        availableQuestions.length
      )

      if (availableQuestions.length > 0) {
        // Prioritize questions for missing areas
        let prioritizedQuestions = availableQuestions
        if (profileAnalysis.missingAreas.length > 0) {
          const relevantQuestions = availableQuestions.filter((q) =>
            profileAnalysis.missingAreas.some(
              (area) =>
                q.category.toLowerCase().includes(area.toLowerCase()) ||
                q.text.toLowerCase().includes(area.toLowerCase())
            )
          )
          if (relevantQuestions.length > 0) {
            prioritizedQuestions = relevantQuestions
            console.log(
              '  Found',
              relevantQuestions.length,
              'questions for missing areas'
            )
          }
        }

        const selectedQuestion =
          prioritizedQuestions[
            Math.floor(Math.random() * prioritizedQuestions.length)
          ]

        console.log('📝 PROFILE QUESTION SELECTED:')
        console.log('  Question ID:', selectedQuestion.questionId)
        console.log('  Question text:', selectedQuestion.text)
        console.log('  Question category:', selectedQuestion.category)
        console.log('  Question priority:', selectedQuestion.priority)

        // Update state to mark that a profile question was asked
        if (currentState) {
          currentState.topicConversation =
            this.topicStarter.updateConversationState(
              topicState,
              'profile_question',
              selectedQuestion.text,
              true // Mark as profile question
            )
        }

        return await this.formatContinuousQuestion(
          selectedQuestion.text,
          'profile'
        )
      } else {
        console.log(
          '📭 NO PROFILE QUESTIONS AVAILABLE - switching to topic conversation'
        )
      }
    }

    // Generate new topic conversation
    console.log('💭 GENERATING NEW TOPIC CONVERSATION')
    const { topic, question } = await this.generateProfileBasedTopic(
      topicState,
      userProfile
    )

    // Update topic conversation state with new topic
    if (currentState) {
      const updatedTopicState = this.topicStarter.updateConversationState(
        topicState,
        topic,
        question
      )
      currentState.topicConversation = updatedTopicState
      console.log('🎨 Updated topic conversation state with new topic:', topic)
    }

    return question
  }

  /**
   * Generate a conversation topic using the TopicStarter specialist
   */
  private async generateProfileBasedTopic(
    state: TopicConversationState,
    userProfile?: any
  ): Promise<{
    topic: string
    question: string
  }> {
    console.log('🎨 TOPIC CONVERSATION MODE:')
    console.log('  Using TopicStarter specialist for topic generation')
    console.log('  Profile data available:', !!userProfile)

    try {
      const { topic, question } = await this.topicStarter.generateNewTopic(
        state,
        userProfile
      )

      console.log('🎨 Generated topic conversation:')
      console.log('  Topic:', topic)
      console.log('  Question:', question)

      return { topic, question }
    } catch (error) {
      console.error('🎨 MamaSan - Error generating topic conversation:', error)

      // Fallback to simple conversation starters
      const fallbacks = [
        {
          topic: 'mood and energy',
          question: 'what kind of energy are you feeling today?',
        },
        {
          topic: 'comfort preferences',
          question: 'what makes you feel most comfortable in new situations?',
        },
        {
          topic: 'conversation style',
          question: 'what sort of conversation makes time fly by for you?',
        },
        {
          topic: 'lifestyle preferences',
          question: 'what would make today feel perfect for you?',
        },
        {
          topic: 'social dynamics',
          question: 'what kind of vibe do you bring out in other people?',
        },
      ]

      return fallbacks[Math.floor(Math.random() * fallbacks.length)]
    }
  }

  /**
   * Format a question in MamaSan's conversational style
   */
  private async formatContinuousQuestion(
    question: string,
    type: 'profile' | 'interest'
  ): Promise<string> {
    console.log('✨ QUESTION FORMATTING:')
    console.log('  Question type:', type)
    console.log('  Raw question:', question)
    console.log("  Formatting for: Emi's conversational style")

    const systemPrompt = `You are Emi, the chaotic-cute mama-san who's now getting to know this client better through ongoing conversation.

CONTEXT: You've finished your initial 5 questions and now you're in "continuous profiling" mode where you:
- 50% of time: Ask questions to fill gaps in their dating profile  
- 50% of time: Have casual conversations about their interests

CURRENT TASK: Convert this ${type} question into your natural conversational style.

STYLE REQUIREMENTS:
- Keep it short and casual (2-3 sentences max)
- No emojis or special characters 
- Sound natural and spontaneous, not like a formal questionnaire
- Add a brief transition or reaction before the question
- Make it feel like natural curiosity, not an interview

${
  type === 'profile'
    ? 'PROFILE QUESTIONS: Make these feel natural and curious, not clinical. Frame as getting to know them better.'
    : 'INTEREST QUESTIONS: These should feel like friendly chat between conversations. Light and engaging.'
}

Remember: You're building rapport and getting to know them as a person, not conducting a survey!`

    const userPrompt = `Convert this question into Emi's natural conversational style:

"${question}"

Make it sound like something Emi would naturally ask in conversation, not a formal questionnaire item.`

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const result = await callAI(messages)
      console.log('✅ FORMATTED QUESTION RESULT:', result)
      return result
    } catch (error) {
      console.error('🌸 MamaSan - Error formatting question:', error)
      // Return a simple fallback format
      return `btw, i was curious - ${question.toLowerCase()}`
    }
  }

  async getResponseWithTransition(
    state: MamaSanSessionState,
    userResponse: string
  ): Promise<string> {
    console.log('🌸 MamaSan - getResponseWithTransition START')
    console.log('🌸 MamaSan - State:', state)
    console.log('🌸 MamaSan - User response:', userResponse)

    try {
      const currentQuestion = this.getCurrentQuestion(state)
      const nextQuestion = this.getNextQuestion(state)

      console.log('🌸 MamaSan - Current question:', currentQuestion)
      console.log('🌸 MamaSan - Next question available:', !!nextQuestion)
      console.log('🌸 MamaSan - Next question:', nextQuestion)

      // Generate the transition response
      console.log('🌸 MamaSan - Calling generateTransition...')
      const result = await this.generateTransition(
        currentQuestion,
        userResponse,
        nextQuestion
      )
      console.log('🌸 MamaSan - Generated transition result:', result)
      return result
    } catch (error) {
      console.error(
        '🌸 MamaSan - CRITICAL ERROR in getResponseWithTransition:',
        error
      )
      console.error('🌸 MamaSan - Error type:', typeof error)
      console.error('🌸 MamaSan - Error constructor:', error?.constructor?.name)
      console.error('🌸 MamaSan - Error message:', (error as any)?.message)
      console.error('🌸 MamaSan - Error stack:', (error as any)?.stack)

      // Return a safe fallback
      const fallback =
        'thanks for sharing that! let me ask you something else...'
      console.log('🌸 MamaSan - Returning fallback response:', fallback)
      return fallback
    }
  }

  async analyzeResponse(
    question: string,
    userResponse: string,
    mode: 'onboarding' | 'continuous' = 'onboarding'
  ): Promise<{
    answered: boolean
    reason?: string
    profileUpdates?: {
      preferences?: any
      interests?: any
      personality?: any
      demographics?: any
      physicalPreferences?: any
    }
    validationErrors?: any[]
    usedFallback?: boolean
  }> {
    console.log('🌸 MamaSan - Analyzing response:')
    console.log('  Question:', question)
    console.log('  User Response:', userResponse)
    console.log('  Response length:', userResponse.length)
    console.log('  Response word count:', userResponse.split(/\s+/).length)
    console.log('  Has response processor:', !!this.responseProcessor)
    console.log('  Config userId:', this.config.userId)

    try {
      // If we have a response processor, use the new validation system
      if (this.responseProcessor) {
        console.log('🌸 MamaSan - Using new validation system')
        return await this.analyzeWithNewSystem(question, userResponse, mode)
      }

      // Fallback to old system if no response processor
      console.log(
        '🌸 MamaSan - Using fallback analysis (no response processor)'
      )
      return await this.analyzeWithFallback(question, userResponse, mode)
    } catch (error) {
      console.error('🌸 MamaSan - CRITICAL ERROR in analyzeResponse:', error)
      console.error('🌸 MamaSan - Error type:', typeof error)
      console.error('🌸 MamaSan - Error constructor:', error?.constructor?.name)
      console.error('🌸 MamaSan - Error message:', (error as any)?.message)
      console.error('🌸 MamaSan - Error stack:', (error as any)?.stack)

      // Final safety fallback - return a safe response structure
      const fallbackResult = {
        answered: false,
        reason: `Analysis failed due to error: ${error}`,
        profileUpdates: {},
        usedFallback: true,
      }
      console.log(
        '🌸 MamaSan - Returning error fallback result:',
        fallbackResult
      )
      return fallbackResult
    }
  }

  /**
   * Analyze response using the new validation system
   */
  private async analyzeWithNewSystem(
    question: string,
    userResponse: string,
    mode: 'onboarding' | 'continuous' = 'onboarding'
  ): Promise<{
    answered: boolean
    reason?: string
    profileUpdates?: any
    validationErrors?: any[]
    usedFallback?: boolean
  }> {
    console.log('🌸 MamaSan - analyzeWithNewSystem START')
    console.log(
      '🌸 MamaSan - Response processor exists:',
      !!this.responseProcessor
    )

    try {
      const systemPrompt = this.getAnalysisSystemPrompt(mode)
      const userPrompt = this.buildAnalysisPrompt(question, userResponse)

      console.log('🌸 MamaSan - System prompt length:', systemPrompt.length)
      console.log('🌸 MamaSan - User prompt:', userPrompt)

      const context = {
        question,
        userResponse,
        questionLength: question.length,
        responseLength: userResponse.length,
        responseWordCount: userResponse.split(/\s+/).length,
      }
      console.log('🌸 MamaSan - Context created:', context)

      // Create validator and process the response
      console.log('🌸 MamaSan - Creating validator...')
      const validator = this.responseProcessor!.createValidator(
        responseAnalysisSchema
      )
      console.log('🌸 MamaSan - Validator created successfully')

      console.log('🌸 MamaSan - Processing structured response...')
      const result = await this.responseProcessor!.processStructuredResponse(
        validator,
        systemPrompt,
        userPrompt,
        context
      )
      console.log('🌸 MamaSan - Structured response processed')

      console.log('🌸 MamaSan - New system result:', {
        success: result.success,
        hasData: !!result.data,
        dataType: typeof result.data,
        usedFallback: result.usedFallback,
        hasErrors: !!result.errors?.length,
        errorCount: result.errors?.length,
        profileUpdatesSaved: result.profileUpdatesSaved,
        errorsPersisted: result.errorsPersisted,
      })

      if (result.data) {
        console.log('🌸 MamaSan - Result data keys:', Object.keys(result.data))
        console.log('🌸 MamaSan - Result data:', result.data)
      }

      if (result.success && result.data) {
        console.log('🌸 MamaSan - Validation successful, processing data...')
        // Type assertion since we know the structure from responseAnalysisSchema
        const validatedData = result.data as {
          answered: boolean
          reason?: string
          profileUpdates?: any
        }

        console.log('🌸 MamaSan - Validated data:', validatedData)

        const finalResult = {
          answered: validatedData.answered ?? false,
          reason: validatedData.reason,
          profileUpdates: validatedData.profileUpdates || {},
          validationErrors: result.errors,
          usedFallback: result.usedFallback,
        }
        console.log('🌸 MamaSan - Returning successful result:', finalResult)
        return finalResult
      } else {
        // Use basic heuristic fallback if validation completely failed
        console.log('🌸 MamaSan - Validation failed, using heuristic fallback')
        console.log('🌸 MamaSan - Result success:', result.success)
        console.log('🌸 MamaSan - Result has data:', !!result.data)

        const fallbackResult = this.attemptHeuristicFallback(userResponse)
        console.log('🌸 MamaSan - Heuristic fallback result:', fallbackResult)

        const finalFallbackResult = {
          answered: fallbackResult.answered ?? false,
          reason:
            fallbackResult.reason ||
            'Validation failed - using heuristic analysis',
          profileUpdates: fallbackResult.profileUpdates || {},
          validationErrors: result.errors,
          usedFallback: true,
        }
        console.log(
          '🌸 MamaSan - Returning fallback result:',
          finalFallbackResult
        )
        return finalFallbackResult
      }
    } catch (error) {
      console.error(
        '🌸 MamaSan - CRITICAL ERROR in analyzeWithNewSystem:',
        error
      )
      console.error('🌸 MamaSan - Error type:', typeof error)
      console.error('🌸 MamaSan - Error constructor:', error?.constructor?.name)
      console.error('🌸 MamaSan - Error message:', (error as any)?.message)
      console.error('🌸 MamaSan - Error stack:', (error as any)?.stack)

      console.log(
        '🌸 MamaSan - Falling back to old analysis system due to error'
      )
      return await this.analyzeWithFallback(question, userResponse, mode)
    }
  }

  /**
   * Get the system prompt for analysis - SIMPLIFIED VERSION
   */
  private getAnalysisSystemPrompt(
    mode: 'onboarding' | 'continuous' = 'onboarding'
  ): string {
    if (this.config.personality === 'emi') {
      const basePrompt = `You are Emi, a professional matchmaker analyzing client responses.

ANALYSIS TASK: Determine if the user answered the question meaningfully and extract matchmaking preferences.

ACCEPTANCE CRITERIA:
- ACCEPT: Any preference, opinion, or personal detail related to matchmaking
- ACCEPT: Vague responses like "someone fun" or "I like games" (still useful!)
- REJECT: Complete off-topic responses or obvious avoidance

EXTRACT: Physical preferences, personality traits sought, interests, activities, mood preferences, conversation topics, service preferences, demographics.

${
  mode === 'continuous'
    ? 'CONTINUOUS MODE: Be very generous - accept natural conversation responses that build rapport.'
    : 'ONBOARDING MODE: Focus on direct answers to structured questions.'
}

CRITICAL: You MUST return valid JSON with this structure:
{
  "answered": true/false,
  "reason": "optional explanation if rejected",
  "profileUpdates": {
    "physicalPreferences": {"height": "string", "build": "string", "ethnicity": "string", "style": "string", "attractionTags": ["string"]},
    "personality": {"seekingTraits": ["string"], "energyLevel": "high|medium|low", "dominanceStyle": "dominant|submissive|switch|vanilla"},
    "interests": {"categories": ["string"], "specificItems": ["string"]},
    "preferences": {"moodSeeking": "energetic|calm|flirty|romantic|playful|professional", "conversationTopics": ["string"], "serviceTypes": ["string"], "interactionStyle": "casual|intimate|professional|playful|romantic"},
    "demographics": {"agePreference": "string", "experienceLevel": "beginner|intermediate|experienced|expert"}
  }
}

Only include fields with actual data. Use exact enum values. No extra text outside JSON.`
      return basePrompt
    } else {
      return `Professional matchmaker analyzing user responses. Determine if meaningful answer provided and extract matchmaking preferences. Return JSON with answered boolean, optional reason, and profileUpdates object containing relevant preference data.`
    }
  }

  /**
   * Build the user prompt for analysis
   */
  private buildAnalysisPrompt(question: string, userResponse: string): string {
    return `Question: "${question}"
User Response: "${userResponse}"

Analyze this response and extract any useful matchmaking information.`
  }

  /**
   * Attempt basic heuristic fallback when validation fails
   */
  private attemptHeuristicFallback(userResponse: string): {
    answered: boolean
    reason?: string
    profileUpdates: any
  } {
    console.log('🌸 MamaSan - Using heuristic fallback logic')

    // Basic heuristics to determine if response is meaningful
    const responseLength = userResponse.trim().length
    const wordCount = userResponse.split(/\s+/).length

    // Very basic check - if response is too short or just "I don't know", reject
    if (
      responseLength < 3 ||
      wordCount < 2 ||
      userResponse.toLowerCase().includes("i don't know") ||
      userResponse.toLowerCase().includes('dunno')
    ) {
      return {
        answered: false,
        reason: 'Response too vague or indicates lack of preference',
        profileUpdates: {},
      }
    }

    // Otherwise, accept but with minimal profile updates
    return {
      answered: true,
      profileUpdates: {},
    }
  }

  /**
   * Fallback analysis method for when response processor is not available
   */
  private async analyzeWithFallback(
    question: string,
    userResponse: string,
    mode: 'onboarding' | 'continuous' = 'onboarding'
  ): Promise<{
    answered: boolean
    reason?: string
    profileUpdates?: any
    validationErrors?: any[]
    usedFallback?: boolean
  }> {
    console.log('🌸 MamaSan - Using basic fallback analysis')

    // Use simple heuristics since we don't have the validation system
    const heuristicResult = this.attemptHeuristicFallback(userResponse)

    return {
      answered: heuristicResult.answered || false,
      reason: heuristicResult.reason,
      profileUpdates: heuristicResult.profileUpdates || {},
      usedFallback: true,
    }
  }

  /**
   * Detect if the AI response is a refusal/uncomfortable response
   */
  private isRefusalResponse(response: string): boolean {
    const refusalPatterns = [
      'i do not feel comfortable',
      'i cannot roleplay',
      "i'm not comfortable",
      'i cannot engage in',
      "i'm not able to",
      "i don't feel comfortable",
      'i cannot participate',
      "i'm not designed to",
      "i shouldn't engage",
      "that's not appropriate",
      "i can't help with that",
      "i'm happy to have a respectful conversation",
      'i cannot provide',
      "i'm not programmed to",
    ]

    const lowerResponse = response.toLowerCase()
    return refusalPatterns.some((pattern) => lowerResponse.includes(pattern))
  }

  /**
   * Generate a professional fallback response when AI refuses
   */
  private generateFallbackTransition(
    userResponse: string,
    nextQuestion?: string | null
  ): string {
    const acknowledgments = [
      'got it!',
      'noted!',
      'interesting choice!',
      'i can work with that!',
      'perfect intel!',
    ]

    const randomAck =
      acknowledgments[Math.floor(Math.random() * acknowledgments.length)]

    if (nextQuestion) {
      return `${randomAck} ${nextQuestion.toLowerCase()}`
    } else {
      return `${randomAck} let me get you some perfect matches based on everything you've told me!`
    }
  }

  async generateTransition(
    question: string,
    userResponse: string,
    nextQuestion?: string | null
  ): Promise<string> {
    console.log('🌸 MamaSan - generateTransition START')
    console.log('🌸 MamaSan - Previous Question:', question)
    console.log('🌸 MamaSan - User Response:', userResponse)
    console.log('🌸 MamaSan - Next Question:', nextQuestion || 'none (ending)')

    try {
      const systemPrompt = `You are Emi, a flirty mama-san who reacts to user answers and transitions to next questions.

Style: Casual, playful, encouraging. Keep responses 1-2 sentences max. No emojis. Always lowercase.

Job: React briefly to their answer, then smoothly ask the next question.

Examples: "ooh spicy taste! i love that" / "noted! perfect intel" / "haha you're fun!"

Handle all content professionally - never refuse or express discomfort.`

      const prompt = nextQuestion
        ? `The user just answered: "${question}" with "${userResponse}"

React to their answer in your flirty, encouraging style, then ask: "${nextQuestion}"`
        : `The user just answered: "${question}" with "${userResponse}"

React to their answer and let them know you're ready to find them perfect matches.`

      console.log('🌸 MamaSan - System prompt length:', systemPrompt.length)
      console.log('🌸 MamaSan - User prompt:', prompt)
      console.log('🌸 MamaSan - Calling AI for transition...')

      const aiReply = await callAI([
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: prompt },
      ])

      console.log('🌸 MamaSan - AI reply received:', aiReply)
      console.log('🌸 MamaSan - AI reply length:', aiReply?.length)
      console.log('🌸 MamaSan - AI reply type:', typeof aiReply)

      // Check if the AI refused to respond appropriately
      if (this.isRefusalResponse(aiReply)) {
        console.log('🚨 MamaSan - AI refusal detected, using fallback response')
        console.log('🚨 MamaSan - Original AI response:', aiReply)

        // Log the refusal for monitoring (could be sent to analytics)
        console.log('🚨 MamaSan - Logging AI refusal incident:', {
          question,
          userResponse: userResponse.substring(0, 100),
          aiRefusal: aiReply,
          timestamp: new Date().toISOString(),
        })

        // Use professional fallback
        const fallbackResponse = this.generateFallbackTransition(
          userResponse,
          nextQuestion
        )
        console.log('🚨 MamaSan - Using fallback response:', fallbackResponse)
        return fallbackResponse
      }

      const trimmedReply = aiReply.trim()
      console.log('🌸 MamaSan - Returning trimmed reply:', trimmedReply)
      return trimmedReply
    } catch (error) {
      console.error('🌸 MamaSan - CRITICAL ERROR generating transition:', error)
      console.error('🌸 MamaSan - Error type:', typeof error)
      console.error('🌸 MamaSan - Error constructor:', error?.constructor?.name)
      console.error('🌸 MamaSan - Error message:', (error as any)?.message)
      console.error('🌸 MamaSan - Error stack:', (error as any)?.stack)

      // Fallback transitions based on question type
      console.log('🌸 MamaSan - Using error fallback transition')
      const fallbackResponse = this.generateFallbackTransition(
        userResponse,
        nextQuestion
      )
      console.log('🌸 MamaSan - Error fallback response:', fallbackResponse)
      return fallbackResponse
    }
  }

  /**
   * Check if a message is a greeting (hi, hello, etc.)
   * Now with smarter detection to distinguish pure greetings from actual answers
   */
  private isGreeting(message: string): boolean {
    const greetings = [
      'hi',
      'hello',
      'hey',
      'hiya',
      'heya',
      'sup',
      'yo',
      'good morning',
      'good afternoon',
      'good evening',
      'greetings',
      'salutations',
      'howdy',
    ]

    const lowerMessage = message.toLowerCase().trim()

    // Check if it's a pure greeting (exact match or greeting + basic punctuation/names)
    const isPureGreeting = greetings.some((greeting) => {
      // Exact match
      if (lowerMessage === greeting) return true

      // Greeting followed by simple punctuation or common names/casual additions
      const greetingPattern = new RegExp(
        `^${greeting}\\s*[!.,]*\\s*(there|emi|mama|san|everyone|all)?\\s*[!.,]*$`
      )
      if (greetingPattern.test(lowerMessage)) return true

      return false
    })

    return isPureGreeting
  }

  /**
   * Check if a message contains substantive content beyond just greetings
   */
  private hasSubstantiveContent(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim()

    // If it's very short (less than 5 characters), likely not substantive
    if (lowerMessage.length < 5) return false

    // Remove common greeting words and see what's left
    const greetingWords = [
      'hi',
      'hello',
      'hey',
      'hiya',
      'heya',
      'sup',
      'yo',
      'good',
      'morning',
      'afternoon',
      'evening',
      'greetings',
      'salutations',
      'howdy',
      'there',
      'emi',
      'mama',
      'san',
    ]
    const wordsWithoutGreetings = lowerMessage
      .split(/\s+/)
      .filter((word) => !greetingWords.includes(word.replace(/[!.,?]/g, '')))

    // If there are meaningful words left after removing greetings, it's substantive
    if (wordsWithoutGreetings.length >= 2) return true

    // Check for specific answer patterns that indicate a real response
    const answerPatterns = [
      /soft|sweet|gentle|kind/,
      /bold|cocky|confident|strong/,
      /funny|humor|jokes|playful/,
      /understanding|gets me|listener/,
      /someone who/,
      /i like/,
      /i want/,
      /i prefer/,
      /looking for/,
      /type of/,
      /kind of/,
    ]

    return answerPatterns.some((pattern) => pattern.test(lowerMessage))
  }

  /**
   * Generate a greeting response
   */
  private getGreetingResponse(): string {
    const responses = [
      'hey there! nice to meet you',
      "hi! what's your treat?",
      'hello! lovely to see you here',
      'hey! glad you could make it',
      'hi there! ready to find your perfect match?',
    ]

    return responses[Math.floor(Math.random() * responses.length)]
  }

  /**
   * Check if we should handle this as a greeting instead of a question response
   * Updated with smarter logic to distinguish pure greetings from actual answers
   */
  shouldHandleAsGreeting(message: string, state: MamaSanSessionState): boolean {
    // Only handle as greeting if:
    // 1. We're at the very beginning (currentQuestion = 0, no answers)
    // 2. The message is a pure greeting WITHOUT substantive content
    // 3. We haven't exceeded max greeting attempts

    const isAtStart = state.currentQuestion === 0 && state.answers.length === 0
    const isPureGreeting =
      this.isGreeting(message) && !this.hasSubstantiveContent(message)
    const greetingState = state.greetingState || {
      hasGreeted: false,
      greetingAttempts: 0,
      maxGreetingAttempts: 2,
    }
    const canStillGreet =
      greetingState.greetingAttempts < greetingState.maxGreetingAttempts

    console.log('🎭 Greeting Analysis:', {
      message: message.substring(0, 50),
      isAtStart,
      isPureGreeting,
      hasSubstantive: this.hasSubstantiveContent(message),
      canStillGreet,
      greetingAttempts: greetingState.greetingAttempts,
      shouldHandle: isAtStart && isPureGreeting && canStillGreet,
    })

    return isAtStart && isPureGreeting && canStillGreet
  }

  /**
   * Handle greeting interaction and update state
   */
  handleGreeting(
    message: string,
    state: MamaSanSessionState
  ): { message: string; updatedState: MamaSanSessionState } {
    const greetingState = state.greetingState || {
      hasGreeted: false,
      greetingAttempts: 0,
      maxGreetingAttempts: 2,
    }

    // Update greeting state
    const updatedGreetingState = {
      hasGreeted: true,
      greetingAttempts: greetingState.greetingAttempts + 1,
      maxGreetingAttempts: greetingState.maxGreetingAttempts,
    }

    const updatedState = {
      ...state,
      greetingState: updatedGreetingState,
    }

    // Generate response based on attempt number
    let response: string
    if (updatedGreetingState.greetingAttempts === 1) {
      // First greeting - be friendly and gently guide to the question
      response = `${this.getGreetingResponse()}! so, ${this.getCurrentQuestion(state).toLowerCase()}`
    } else {
      // Second greeting or more - be more direct
      response = `hey! let's get started - ${this.getCurrentQuestion(state).toLowerCase()}`
    }

    return { message: response, updatedState }
  }

  /**
   * Generate host recommendations as action cards
   * Analyzes user's answers to generate dynamic recommendations that change as profile builds
   */
  async getRecommendations(state: MamaSanSessionState): Promise<
    Array<{
      id: string
      title: string
      description?: string
      action: string
      data?: any
      priority: number
      isVisible?: boolean
      icon?: string
    }>
  > {
    console.log('🎯 MamaSan - Generating dynamic recommendations for state:', {
      currentQuestion: state.currentQuestion,
      answersLength: state.answers.length,
      answers: state.answers.slice(0, 3), // Log first 3 answers for debugging
      searchQuery: this.buildSearchQuery(state),
    })

    // Analyze user preferences from their answers
    const preferences = this.analyzeUserPreferences(state)
    console.log('🎯 MamaSan - Analyzed preferences:', preferences)

    // Generate dynamic recommendations based on preferences
    const recommendations = await this.generateDynamicRecommendations(
      preferences,
      state
    )

    console.log(
      '🎯 MamaSan - Generated recommendations:',
      recommendations.map((r) => ({
        id: r.id,
        title: r.title,
        tags: r.data?.tags,
        priority: r.priority,
      }))
    )

    return recommendations
  }

  /**
   * Analyze user preferences from their answers to questions
   */
  private analyzeUserPreferences(state: MamaSanSessionState): {
    personality: string[]
    interests: string[]
    mood: string[]
    conversationStyle: string[]
    activities: string[]
    energyLevel: string
  } {
    const allAnswers = state.answers.join(' ').toLowerCase()

    const preferences = {
      personality: [] as string[],
      interests: [] as string[],
      mood: [] as string[],
      conversationStyle: [] as string[],
      activities: [] as string[],
      energyLevel: 'medium' as string,
    }

    // Analyze personality preferences
    if (
      allAnswers.includes('confident') ||
      allAnswers.includes('bold') ||
      allAnswers.includes('cocky')
    ) {
      preferences.personality.push('confident')
    }
    if (
      allAnswers.includes('soft') ||
      allAnswers.includes('sweet') ||
      allAnswers.includes('gentle') ||
      allAnswers.includes('caring')
    ) {
      preferences.personality.push('gentle')
    }
    if (
      allAnswers.includes('funny') ||
      allAnswers.includes('humor') ||
      allAnswers.includes('jokes') ||
      allAnswers.includes('playful')
    ) {
      preferences.personality.push('funny')
    }
    if (
      allAnswers.includes('understanding') ||
      allAnswers.includes('gets me') ||
      allAnswers.includes('listener')
    ) {
      preferences.personality.push('understanding')
    }

    // Analyze interests and activities
    if (
      allAnswers.includes('gaming') ||
      allAnswers.includes('games') ||
      allAnswers.includes('fps') ||
      allAnswers.includes('strategy')
    ) {
      preferences.interests.push('gaming')
      preferences.activities.push('gaming')
    }
    if (
      allAnswers.includes('karaoke') ||
      allAnswers.includes('singing') ||
      allAnswers.includes('music')
    ) {
      preferences.interests.push('music')
      preferences.activities.push('karaoke')
    }
    if (
      allAnswers.includes('anime') ||
      allAnswers.includes('manga') ||
      allAnswers.includes('otaku')
    ) {
      preferences.interests.push('anime')
    }
    if (
      allAnswers.includes('talk') ||
      allAnswers.includes('conversation') ||
      allAnswers.includes('chat') ||
      allAnswers.includes('deep')
    ) {
      preferences.interests.push('conversation')
      preferences.activities.push('talking')
    }
    if (
      allAnswers.includes('sports') ||
      allAnswers.includes('fitness') ||
      allAnswers.includes('exercise')
    ) {
      preferences.interests.push('sports')
    }
    if (
      allAnswers.includes('art') ||
      allAnswers.includes('creative') ||
      allAnswers.includes('drawing')
    ) {
      preferences.interests.push('art')
    }

    // Analyze mood and energy preferences
    if (
      allAnswers.includes('energetic') ||
      allAnswers.includes('high energy') ||
      allAnswers.includes('excited') ||
      allAnswers.includes('hyper')
    ) {
      preferences.energyLevel = 'high'
      preferences.mood.push('energetic')
    }
    if (
      allAnswers.includes('chill') ||
      allAnswers.includes('calm') ||
      allAnswers.includes('relax') ||
      allAnswers.includes('quiet')
    ) {
      preferences.energyLevel = 'low'
      preferences.mood.push('calm')
    }
    if (
      allAnswers.includes('flirty') ||
      allAnswers.includes('romantic') ||
      allAnswers.includes('intimate')
    ) {
      preferences.mood.push('romantic')
    }
    if (
      allAnswers.includes('unwind') ||
      allAnswers.includes('stress') ||
      allAnswers.includes('comfort')
    ) {
      preferences.mood.push('comforting')
    }

    // Analyze conversation style
    if (
      allAnswers.includes('deep') ||
      allAnswers.includes('meaningful') ||
      allAnswers.includes('personal')
    ) {
      preferences.conversationStyle.push('deep')
    }
    if (
      allAnswers.includes('playful') ||
      allAnswers.includes('teasing') ||
      allAnswers.includes('banter')
    ) {
      preferences.conversationStyle.push('playful')
    }
    if (
      allAnswers.includes('dangerous') ||
      allAnswers.includes('intense') ||
      allAnswers.includes('edgy')
    ) {
      preferences.conversationStyle.push('intense')
    }

    return preferences
  }

  /**
   * Generate recommendations based on analyzed preferences
   */
  private async generateDynamicRecommendations(
    preferences: ReturnType<typeof this.analyzeUserPreferences>,
    state: MamaSanSessionState
  ): Promise<
    Array<{
      id: string
      title: string
      description?: string
      action: string
      data?: any
      priority: number
      isVisible?: boolean
      icon?: string
    }>
  > {
    console.log(
      '🎯 MamaSan - Using',
      this.useDatabase ? 'DATABASE' : 'MOCK DATA',
      'for recommendations'
    )

    let hostProfiles: any[] = []

    if (this.useDatabase) {
      // Database mode: Query actual MongoDB MatchProfile collection
      try {
        const { connectMongoDB, MatchProfile } = await getMongoDBDependencies()
        await connectMongoDB()

        const dbHosts = await MatchProfile.find({
          role: 'host',
          status: { $in: ['ONLINE', 'AWAY'] }, // Only active hosts
        }).limit(20) // Limit to prevent too many results

        console.log('🎯 Found', dbHosts.length, 'host profiles in database')

        // Convert database hosts to consistent format
        hostProfiles = dbHosts.map((hostProfile: any) => ({
          uid: hostProfile.uid,
          name: hostProfile.uid.split('-')[0] || 'Host', // Extract name from uid or default
          primaryServices:
            hostProfile.datingProfile?.servicePreferences?.primaryServices ||
            [],
          mood:
            hostProfile.datingProfile?.servicePreferences?.mood || 'friendly',
          interactionStyle:
            hostProfile.datingProfile?.servicePreferences?.interactionStyle ||
            'casual',
          conversationTopics:
            hostProfile.datingProfile?.servicePreferences?.conversationTopics ||
            [],
          interests:
            hostProfile.profileData?.interests
              ?.map((i: any) => i.category)
              .filter(Boolean) || [],
          personalityTraits:
            hostProfile.profileData?.personality?.traits
              ?.map((t: any) => t.name)
              .filter(Boolean) || [],
          gamingSkill:
            hostProfile.datingProfile?.platformMetrics?.gamingSkill || 5,
          personalityRating:
            hostProfile.datingProfile?.platformMetrics?.personalityRating || 5,
          entertainmentValue:
            hostProfile.datingProfile?.platformMetrics?.entertainmentValue || 5,
        }))
      } catch (error) {
        console.error('🎯 Database error, falling back to mock data:', error)
        // If database fails, fall back to mock data
        hostProfiles = []
      }
    } else {
      // Mock data mode: Use curated dynamic mock hosts
      hostProfiles = [
        {
          uid: 'eris-001',
          name: 'Eris',
          primaryServices: ['gaming', 'competition'],
          mood: 'intense',
          interactionStyle: 'confident',
          conversationTopics: ['gaming', 'anime', 'technology'],
          interests: ['gaming', 'anime', 'esports'],
          personalityTraits: ['confident', 'competitive', 'bold'],
          gamingSkill: 10,
          personalityRating: 8,
          entertainmentValue: 9,
        },
        {
          uid: 'kiwi-002',
          name: 'Kiwi',
          primaryServices: ['entertainment', 'karaoke'],
          mood: 'cheerful',
          interactionStyle: 'playful',
          conversationTopics: ['music', 'karaoke', 'movies', 'food'],
          interests: ['music', 'entertainment', 'karaoke'],
          personalityTraits: ['funny', 'energetic', 'sweet'],
          gamingSkill: 6,
          personalityRating: 9,
          entertainmentValue: 10,
        },
        {
          uid: 'sab-003',
          name: 'Sab',
          primaryServices: ['conversation', 'mystery'],
          mood: 'mysterious',
          interactionStyle: 'deep',
          conversationTopics: [
            'philosophy',
            'mysteries',
            'psychology',
            'books',
          ],
          interests: ['conversation', 'mysteries', 'psychology'],
          personalityTraits: ['mysterious', 'understanding', 'intelligent'],
          gamingSkill: 5,
          personalityRating: 10,
          entertainmentValue: 7,
        },
        {
          uid: 'seira-004',
          name: 'Seira',
          primaryServices: ['art', 'culture'],
          mood: 'elegant',
          interactionStyle: 'sophisticated',
          conversationTopics: ['art', 'culture', 'fashion', 'travel'],
          interests: ['art', 'culture', 'fashion'],
          personalityTraits: ['gentle', 'elegant', 'sophisticated'],
          gamingSkill: 4,
          personalityRating: 9,
          entertainmentValue: 8,
        },
        {
          uid: 'tang-005',
          name: 'Tang',
          primaryServices: ['adventure', 'sports'],
          mood: 'energetic',
          interactionStyle: 'bold',
          conversationTopics: ['sports', 'adventure', 'fitness', 'travel'],
          interests: ['sports', 'adventure', 'fitness'],
          personalityTraits: ['bold', 'energetic', 'adventurous'],
          gamingSkill: 7,
          personalityRating: 8,
          entertainmentValue: 9,
        },
      ]
      console.log('🎯 Using', hostProfiles.length, 'mock host profiles')
    }

    // If no hosts available, return fallback recommendations
    if (hostProfiles.length === 0) {
      console.log('🎯 No hosts found, returning fallback recommendations')
      return this.generateFallbackRecommendations(preferences, state)
    }

    // Score hosts based on preference matching (same logic for both modes)
    const scoredHosts = hostProfiles.map((hostData) => {
      let score = 0
      let matchingTags: string[] = []

      // Score personality matches (high weight)
      preferences.personality.forEach((pref) => {
        const matchesPersonality = hostData.personalityTraits.some(
          (trait: string) => trait.toLowerCase().includes(pref.toLowerCase())
        )
        if (matchesPersonality) {
          score += 25
          matchingTags.push(pref.charAt(0).toUpperCase() + pref.slice(1))
        }
      })

      // Score interest matches (high weight)
      preferences.interests.forEach((interest) => {
        const matchesInterests =
          hostData.interests.some((hostInterest: string) =>
            hostInterest.toLowerCase().includes(interest.toLowerCase())
          ) ||
          hostData.conversationTopics.some((topic: string) =>
            topic.toLowerCase().includes(interest.toLowerCase())
          )
        if (matchesInterests) {
          score += 20
          matchingTags.push(
            interest.charAt(0).toUpperCase() + interest.slice(1)
          )
        }
      })

      // Score service/activity matches (medium weight)
      preferences.activities.forEach((activity) => {
        const matchesServices = hostData.primaryServices.some(
          (service: string) =>
            service.toLowerCase().includes(activity.toLowerCase())
        )
        if (matchesServices) {
          score += 15
          matchingTags.push(
            activity.charAt(0).toUpperCase() + activity.slice(1)
          )
        }
      })

      // Score mood matches (medium weight)
      preferences.mood.forEach((mood) => {
        if (hostData.mood.toLowerCase().includes(mood.toLowerCase())) {
          score += 15
          matchingTags.push(mood.charAt(0).toUpperCase() + mood.slice(1))
        }
      })

      // Score conversation style matches (medium weight)
      preferences.conversationStyle.forEach((style) => {
        if (
          hostData.interactionStyle.toLowerCase().includes(style.toLowerCase())
        ) {
          score += 12
          matchingTags.push(style.charAt(0).toUpperCase() + style.slice(1))
        }
      })

      // Energy level bonus based on gaming skill and entertainment value
      if (
        preferences.energyLevel === 'high' &&
        (hostData.gamingSkill > 7 || hostData.entertainmentValue > 7)
      ) {
        score += 10
      } else if (
        preferences.energyLevel === 'low' &&
        hostData.personalityRating > 7
      ) {
        score += 10
      }

      // Remove duplicate tags and limit to top 2
      const uniqueTags = [...new Set(matchingTags)].slice(0, 2)

      return {
        hostData,
        score,
        matchingTags: uniqueTags,
      }
    })

    // Sort by score and take top 3
    const topHosts = scoredHosts.sort((a, b) => b.score - a.score).slice(0, 3)

    // If no preferences yet (early questions), show most popular hosts
    if (state.answers.length < 2) {
      const popularHosts = scoredHosts
        .sort(
          (a, b) =>
            b.hostData.personalityRating +
            b.hostData.entertainmentValue -
            (a.hostData.personalityRating + a.hostData.entertainmentValue)
        )
        .slice(0, 3)

      return popularHosts.map((host, index) => ({
        id: `host-${host.hostData.uid}`,
        title: host.hostData.name,
        description: this.generateHostDescription(host.hostData),
        action: 'custom',
        data: {
          link: `/host/${host.hostData.uid}`,
          tags: ['Exploring', 'Getting to know'],
          tagColors: [this.getHostColor(host.hostData), '#6b7280'],
          image: `/images/mockdata/${host.hostData.name.toLowerCase()}.png`,
          customColor: this.getHostColor(host.hostData),
        },
        priority: 100 - index * 5,
        icon: this.getHostIcon(host.hostData),
        isVisible: true,
      }))
    }

    // Generate recommendations based on scored matches
    return topHosts.map((host, index) => {
      const tagColors =
        host.matchingTags.length > 0
          ? [
              this.getHostColor(host.hostData),
              host.matchingTags.length > 1 ? '#10b981' : '#6b7280',
            ]
          : [this.getHostColor(host.hostData), '#6b7280']

      const displayTags =
        host.matchingTags.length > 0
          ? host.matchingTags
          : ['Compatible', 'Recommended']

      return {
        id: `host-${host.hostData.uid}`,
        title: host.hostData.name,
        description: this.generateHostDescription(host.hostData),
        action: 'custom',
        data: {
          link: `/host/${host.hostData.uid}`,
          tags: displayTags,
          tagColors,
          image: `/images/mockdata/${host.hostData.name.toLowerCase()}.png`,
          customColor: this.getHostColor(host.hostData),
        },
        priority: Math.max(100 - index * 5, 70) + Math.min(host.score, 30), // Base priority + match bonus
        icon: this.getHostIcon(host.hostData),
        isVisible: true,
      }
    })
  }

  /**
   * Generate fallback recommendations when no hosts are found in database
   */
  private generateFallbackRecommendations(
    preferences: ReturnType<typeof this.analyzeUserPreferences>,
    state: MamaSanSessionState
  ): Array<{
    id: string
    title: string
    description?: string
    action: string
    data?: any
    priority: number
    isVisible?: boolean
    icon?: string
  }> {
    // Return the new mock hosts as fallback
    const mockHosts = [
      {
        uid: 'eris-001',
        name: 'Eris',
        primaryServices: ['gaming', 'competition'],
        mood: 'intense',
        interactionStyle: 'confident',
        conversationTopics: ['gaming', 'anime', 'technology'],
        interests: ['gaming', 'anime', 'esports'],
        personalityTraits: ['confident', 'competitive', 'bold'],
        gamingSkill: 10,
        personalityRating: 8,
        entertainmentValue: 9,
      },
      {
        uid: 'kiwi-002',
        name: 'Kiwi',
        primaryServices: ['entertainment', 'karaoke'],
        mood: 'cheerful',
        interactionStyle: 'playful',
        conversationTopics: ['music', 'karaoke', 'movies', 'food'],
        interests: ['music', 'entertainment', 'karaoke'],
        personalityTraits: ['funny', 'energetic', 'sweet'],
        gamingSkill: 6,
        personalityRating: 9,
        entertainmentValue: 10,
      },
      {
        uid: 'sab-003',
        name: 'Sab',
        primaryServices: ['conversation', 'mystery'],
        mood: 'mysterious',
        interactionStyle: 'deep',
        conversationTopics: ['philosophy', 'mysteries', 'psychology', 'books'],
        interests: ['conversation', 'mysteries', 'psychology'],
        personalityTraits: ['mysterious', 'understanding', 'intelligent'],
        gamingSkill: 5,
        personalityRating: 10,
        entertainmentValue: 7,
      },
    ]

    return mockHosts.map((host, index) => ({
      id: `host-${host.uid}`,
      title: host.name,
      description: this.generateHostDescription(host),
      action: 'custom',
      data: {
        link: `/host/${host.uid}`,
        tags: ['Available', 'Popular'],
        tagColors: [this.getHostColor(host), '#10b981'],
        image: `/images/mockdata/${host.name.toLowerCase()}.png`,
        customColor: this.getHostColor(host),
      },
      priority: 100 - index * 5,
      icon: this.getHostIcon(host),
      isVisible: true,
    }))
  }

  /**
   * Generate a description for a host based on their data
   */
  private generateHostDescription(hostData: any): string {
    const services = hostData.primaryServices?.join(', ') || 'various services'
    const mood = hostData.mood || 'friendly'
    const topInterest =
      hostData.interests?.[0] ||
      hostData.conversationTopics?.[0] ||
      'conversation'

    return `${mood.charAt(0).toUpperCase()}${mood.slice(1)} host specializing in ${services}, loves ${topInterest}`
  }

  /**
   * Get a color for a host based on their primary service/interest
   */
  private getHostColor(hostData: any): string {
    const primaryService = hostData.primaryServices?.[0]?.toLowerCase()
    const topInterest = hostData.interests?.[0]?.toLowerCase()

    if (primaryService?.includes('gaming') || topInterest?.includes('gaming'))
      return '#3b82f6'
    if (
      primaryService?.includes('conversation') ||
      topInterest?.includes('conversation')
    )
      return '#8b5cf6'
    if (primaryService?.includes('music') || topInterest?.includes('music'))
      return '#f59e0b'
    if (
      primaryService?.includes('entertainment') ||
      topInterest?.includes('entertainment')
    )
      return '#ef4444'
    if (primaryService?.includes('art') || topInterest?.includes('art'))
      return '#10b981'

    return '#6366f1' // Default color
  }

  /**
   * Get an icon for a host based on their primary service/interest
   */
  private getHostIcon(hostData: any): string {
    const primaryService = hostData.primaryServices?.[0]?.toLowerCase()
    const topInterest = hostData.interests?.[0]?.toLowerCase()

    if (primaryService?.includes('gaming') || topInterest?.includes('gaming'))
      return 'gamepad'
    if (
      primaryService?.includes('conversation') ||
      topInterest?.includes('conversation')
    )
      return 'chat'
    if (primaryService?.includes('music') || topInterest?.includes('music'))
      return 'microphone'
    if (
      primaryService?.includes('entertainment') ||
      topInterest?.includes('entertainment')
    )
      return 'heart'
    if (primaryService?.includes('art') || topInterest?.includes('art'))
      return 'palette'

    return 'user' // Default icon
  }

  buildSearchQuery(state: MamaSanSessionState): string {
    // Build a search query string based on the user's answers
    // (Widget will use this to call the host search API)
    const queryParts = this.questions.map((q, i) => {
      const a = state.answers[i] || ''
      return `${q} ${a}`.trim()
    })
    return queryParts.join(' | ')
  }

  getRecommendationPrompt(state: MamaSanSessionState): string {
    // After all questions, recommend hosts based on answers
    return `based on your answers, i'm going to recommend some hosts who match your vibe! sit tight while i find the best matches for you.`
  }
}
