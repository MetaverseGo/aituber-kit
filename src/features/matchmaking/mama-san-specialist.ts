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
  'what will it be? selfies, videos, e-chat, video calls, or something else?',
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

    // Initialize the TopicStarter
    this.topicStarter = new TopicStarterSpecialist({
      personality: this.config.personality,
      userId: this.config.userId,
      minTurnsPerTopic: this.config.minTurnsPerTopic,
    })

    // Create response processor if userId is provided
    if (this.config.userId) {
      try {
        this.responseProcessor = createResponseProcessor({
          source: 'mamasan',
          userId: this.config.userId,
          enableErrorPersistence: true,
          enableProfileUpdates: true,
          logLevel: 'info',
        })
      } catch (error) {
        console.error('🌸 MamaSan - Error creating response processor:', error)
        this.responseProcessor = undefined
      }
    } else {
      this.responseProcessor = undefined
    }
  }

  /**
   * Set the user ID to enable validation and persistence features
   */
  setUserId(userId: string): void {
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
    } catch (error) {
      console.error('🌸 MamaSan - Error creating response processor:', error)
      this.responseProcessor = undefined
    }
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
    console.log(
      '  Turns since last profile question:',
      topicState.turnsSinceLastProfileQuestion
    )
    console.log('  Min turns per topic:', this.config.minTurnsPerTopic || 3)

    // If we have an active topic conversation and user response, check if we should continue
    if (topicState.currentTopic && lastUserResponse) {
      const shouldStartNewTopic =
        this.topicStarter.shouldStartNewTopic(topicState)
      const shouldContinueTopic = !shouldStartNewTopic

      console.log('🕰️ TOPIC COOLDOWN ANALYSIS:')
      console.log('  Should start new topic:', shouldStartNewTopic)
      console.log('  Should continue current topic:', shouldContinueTopic)
      console.log('  Current topic turn count:', topicState.turnCount)
      console.log(
        '  Minimum turns required:',
        this.config.minTurnsPerTopic || 3
      )

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
      } else {
        // Topic cooldown is over, need to transition to new topic/question with acknowledgment
        console.log(
          '🔄 TOPIC CHANGE DETECTED - generating transition with acknowledgment'
        )
        console.log(
          "  User's last response:",
          lastUserResponse?.substring(0, 50) + '...'
        )
        console.log('  Current topic ending:', topicState.currentTopic)

        return await this.generateTopicTransition(
          topicState,
          lastUserResponse,
          userProfile,
          currentState
        )
      }
    }

    // Handle case where user responded but no active topic (previous topic ended)
    if (lastUserResponse && !topicState.currentTopic) {
      console.log(
        '🔄 USER RESPONSE WITHOUT ACTIVE TOPIC - generating acknowledgment transition'
      )
      console.log(
        "  User's response:",
        lastUserResponse?.substring(0, 50) + '...'
      )
      console.log('  Need to acknowledge response before continuing')

      return await this.generateResponseAcknowledgmentTransition(
        lastUserResponse,
        userProfile,
        topicState,
        currentState
      )
    }

    // No active topic conversation and no user response - analyze profile completeness for initial decision
    const profileAnalysis = this.analyzeProfileCompleteness(userProfile)

    // Make decision based on profile completeness and cooldown
    const cooldownOver =
      this.topicStarter.isProfileQuestionCooldownOver(topicState)
    const shouldAskProfileQuestion =
      cooldownOver && Math.random() < profileAnalysis.profileQuestionProbability

    console.log('🎲 CONTINUOUS MODE DECISION (No active topic):')
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
      '  Turns since last profile question:',
      topicState.turnsSinceLastProfileQuestion
    )
    console.log('  Profile question cooldown required:', 4) // PROFILE_QUESTION_COOLDOWN
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
   * Generate a smooth transition when changing topics/questions
   * Acknowledges the user's response to the current topic before moving to the next
   */
  private async generateTopicTransition(
    topicState: TopicConversationState,
    lastUserResponse: string,
    userProfile?: any,
    currentState?: MamaSanSessionState
  ): Promise<string> {
    console.log('🔄 GENERATING TOPIC TRANSITION:')
    console.log('  Current topic:', topicState.currentTopic)
    console.log('  User response:', lastUserResponse?.substring(0, 50) + '...')

    // Analyze profile completeness to decide next step
    const profileAnalysis = this.analyzeProfileCompleteness(userProfile)
    const cooldownOver =
      this.topicStarter.isProfileQuestionCooldownOver(topicState)
    const shouldAskProfileQuestion =
      cooldownOver && Math.random() < profileAnalysis.profileQuestionProbability

    console.log('🎲 TOPIC TRANSITION DECISION:')
    console.log('  Profile question cooldown over:', cooldownOver)
    console.log('  Should ask profile question:', shouldAskProfileQuestion)
    console.log(
      '  Profile completeness:',
      (profileAnalysis.completeness * 100).toFixed(1) + '%'
    )

    // Generate acknowledgment + transition using AI with Emi's personality
    const systemPrompt = `You are Emi, a casual and friendly AI. The user just responded to a conversation topic, and you need to acknowledge their response before moving to something new.

Current conversation context:
- Topic that just ended: ${topicState.currentTopic}
- User's response: ${lastUserResponse}

Your response should:
1. Acknowledge what they said in a casual, friendly way (use lowercase, casual language)
2. ${shouldAskProfileQuestion ? 'Ask a profile question to learn more about them' : 'Start a new conversation topic'}
3. Keep it conversational and natural - like talking to a friend
4. Use Emi's casual style: lowercase, friendly, relatable

Example acknowledgments:
- "oh that's cool!"
- "haha that sounds fun"
- "aww that's sweet"
- "ooh interesting!"

${shouldAskProfileQuestion ? 'Then ask a question to learn more about their preferences, personality, or background.' : 'Then naturally transition to a new topic of conversation.'}

Respond in one message that flows naturally from acknowledgment to new question.`

    try {
      let nextContent: string

      if (shouldAskProfileQuestion && this.config.userId) {
        // Try to get a profile question
        const availableQuestions = await getAvailableQuestions(
          this.config.userId
        )
        if (availableQuestions.length > 0) {
          const selectedQuestion =
            availableQuestions[
              Math.floor(Math.random() * availableQuestions.length)
            ]
          nextContent = selectedQuestion.text

          // Update state for profile question
          if (currentState) {
            currentState.topicConversation =
              this.topicStarter.updateConversationState(
                topicState,
                'profile_question',
                nextContent,
                true
              )
          }
        } else {
          // Fallback to topic conversation
          const { topic, question } = await this.generateProfileBasedTopic(
            topicState,
            userProfile
          )
          nextContent = question

          // Update state for new topic
          if (currentState) {
            currentState.topicConversation =
              this.topicStarter.updateConversationState(
                topicState,
                topic,
                nextContent
              )
          }
        }
      } else {
        // Generate new topic conversation
        const { topic, question } = await this.generateProfileBasedTopic(
          topicState,
          userProfile
        )
        nextContent = question

        // Update state for new topic
        if (currentState) {
          currentState.topicConversation =
            this.topicStarter.updateConversationState(
              topicState,
              topic,
              nextContent
            )
        }
      }

      // Use AI to create the acknowledgment + transition
      const prompt = `${systemPrompt}\n\nNext question/topic to transition to: ${nextContent}`

      try {
        const response = await callAI([
          {
            role: 'system',
            content: prompt,
          },
        ])

        if (response && !this.isRefusalResponse(response)) {
          console.log('✅ TOPIC TRANSITION GENERATED:', response)
          return response.trim()
        } else {
          throw new Error('AI response was empty or refused')
        }
      } catch (aiError) {
        console.error('❌ AI call failed for topic transition:', aiError)
        // Fallback to simple format
        const acknowledgments = [
          "oh that's cool!",
          'haha nice',
          'ooh interesting!',
          'aww that sounds fun',
        ]
        const randomAck =
          acknowledgments[Math.floor(Math.random() * acknowledgments.length)]
        const result = `${randomAck} ${nextContent}`
        console.log('✅ TOPIC TRANSITION GENERATED (fallback):', result)
        return result
      }
    } catch (error) {
      console.error('❌ Error generating topic transition:', error)
      // Fallback
      const acknowledgments = [
        "oh that's cool!",
        'haha nice',
        'ooh interesting!',
      ]
      const randomAck =
        acknowledgments[Math.floor(Math.random() * acknowledgments.length)]
      return `${randomAck} anyway, what's something you're passionate about?`
    }
  }

  /**
   * Generate acknowledgment when user responds but no active topic exists
   * This handles the case where a previous topic/question ended but user still responded
   */
  private async generateResponseAcknowledgmentTransition(
    lastUserResponse: string,
    userProfile?: any,
    topicState?: TopicConversationState,
    currentState?: MamaSanSessionState
  ): Promise<string> {
    console.log('🔄 GENERATING RESPONSE ACKNOWLEDGMENT TRANSITION:')
    console.log('  User response:', lastUserResponse?.substring(0, 50) + '...')

    // Analyze profile completeness to decide next step
    const profileAnalysis = this.analyzeProfileCompleteness(userProfile)
    const cooldownOver = topicState
      ? this.topicStarter.isProfileQuestionCooldownOver(topicState)
      : true
    const shouldAskProfileQuestion =
      cooldownOver && Math.random() < profileAnalysis.profileQuestionProbability

    console.log('🎲 ACKNOWLEDGMENT TRANSITION DECISION:')
    console.log('  Profile question cooldown over:', cooldownOver)
    console.log('  Should ask profile question:', shouldAskProfileQuestion)
    console.log(
      '  Profile completeness:',
      (profileAnalysis.completeness * 100).toFixed(1) + '%'
    )

    // Generate acknowledgment + transition using AI with Emi's personality
    const systemPrompt = `You are Emi, a casual and friendly AI. The user just responded to something, and you need to acknowledge their response before moving to something new.

User's response: ${lastUserResponse}

Your response should:
1. Acknowledge what they said in a casual, friendly way (use lowercase, casual language)
2. ${shouldAskProfileQuestion ? 'Ask a profile question to learn more about them' : 'Start a new conversation topic'}
3. Keep it conversational and natural - like talking to a friend
4. Use Emi's casual style: lowercase, friendly, relatable

Example acknowledgments:
- "oh that's cool!"
- "haha that sounds fun"
- "aww that's sweet"
- "ooh interesting!"

${shouldAskProfileQuestion ? 'Then ask a question to learn more about their preferences, personality, or background.' : 'Then naturally transition to a new topic of conversation.'}

Respond in one message that flows naturally from acknowledgment to new question.`

    try {
      let nextContent: string
      const defaultTopicState =
        topicState || this.topicStarter.createInitialState()

      if (shouldAskProfileQuestion && this.config.userId) {
        // Try to get a profile question
        const availableQuestions = await getAvailableQuestions(
          this.config.userId
        )
        if (availableQuestions.length > 0) {
          const selectedQuestion =
            availableQuestions[
              Math.floor(Math.random() * availableQuestions.length)
            ]
          nextContent = selectedQuestion.text

          // Update state for profile question
          if (currentState) {
            currentState.topicConversation =
              this.topicStarter.updateConversationState(
                defaultTopicState,
                'profile_question',
                nextContent,
                true
              )
          }
        } else {
          // Fallback to topic conversation
          const { topic, question } = await this.generateProfileBasedTopic(
            defaultTopicState,
            userProfile
          )
          nextContent = question

          // Update state for new topic
          if (currentState) {
            currentState.topicConversation =
              this.topicStarter.updateConversationState(
                defaultTopicState,
                topic,
                nextContent
              )
          }
        }
      } else {
        // Generate new topic conversation
        const { topic, question } = await this.generateProfileBasedTopic(
          defaultTopicState,
          userProfile
        )
        nextContent = question

        // Update state for new topic
        if (currentState) {
          currentState.topicConversation =
            this.topicStarter.updateConversationState(
              defaultTopicState,
              topic,
              nextContent
            )
        }
      }

      // Use AI to create the acknowledgment + transition
      const prompt = `${systemPrompt}\n\nNext question/topic to transition to: ${nextContent}`

      try {
        const response = await callAI([
          {
            role: 'system',
            content: prompt,
          },
        ])

        if (response && !this.isRefusalResponse(response)) {
          console.log('✅ ACKNOWLEDGMENT TRANSITION GENERATED:', response)
          return response.trim()
        } else {
          throw new Error('AI response was empty or refused')
        }
      } catch (aiError) {
        console.error(
          '❌ AI call failed for acknowledgment transition:',
          aiError
        )
        // Fallback to simple format
        const acknowledgments = [
          "oh that's cool!",
          'haha nice',
          'ooh interesting!',
          'aww that sounds fun',
        ]
        const randomAck =
          acknowledgments[Math.floor(Math.random() * acknowledgments.length)]
        const result = `${randomAck} ${nextContent}`
        console.log(
          '✅ ACKNOWLEDGMENT TRANSITION GENERATED (fallback):',
          result
        )
        return result
      }
    } catch (error) {
      console.error('❌ Error generating acknowledgment transition:', error)
      // Fallback
      const acknowledgments = [
        "oh that's cool!",
        'haha nice',
        'ooh interesting!',
      ]
      const randomAck =
        acknowledgments[Math.floor(Math.random() * acknowledgments.length)]
      return `${randomAck} anyway, what's something you're passionate about?`
    }
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
    try {
      const currentQuestion = this.getCurrentQuestion(state)
      const nextQuestion = this.getNextQuestion(state)

      // Generate the transition response
      const result = await this.generateTransition(
        currentQuestion,
        userResponse,
        nextQuestion
      )
      return result
    } catch (error) {
      console.error('🌸 MamaSan - Error in getResponseWithTransition:', error)

      // Return a safe fallback
      return 'thanks for sharing that! let me ask you something else...'
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
    try {
      // Use AI validation with response processor if available
      if (this.responseProcessor) {
        const validator = this.responseProcessor.createValidator(
          responseAnalysisSchema
        )

        const systemPrompt = `You are analyzing user responses to matchmaking questions.

TASK: Determine if the user meaningfully answered the question and extract relevant profile information.

CRITERIA for "answered: true":
- User provided a clear preference, choice, or opinion
- Response shows engagement with the question topic
- Contains actionable information for matchmaking

CRITERIA for "answered: false":
- Vague responses like "idk", "whatever", "nothing"
- Pure greetings without answers
- Responses that don't address the question

MODE: ${mode}
${mode === 'continuous' ? 'Extract any profile insights from natural conversation.' : 'Focus on the specific onboarding question.'}

Always extract relevant profile information when available, even from brief answers.`

        const userPrompt = `Question: "${question}"
User Response: "${userResponse}"

Analyze this response and extract any profile information.`

        const result = await this.responseProcessor.processStructuredResponse(
          validator,
          systemPrompt,
          userPrompt,
          { question, userResponse, mode }
        )

        if (result.success && result.data) {
          const validatedData = result.data as any
          return {
            answered: validatedData.answered || false,
            reason: validatedData.reason,
            profileUpdates: validatedData.profileUpdates,
            validationErrors: result.errors,
            usedFallback: result.usedFallback,
          }
        } else {
          console.error('🌸 MamaSan - AI validation failed:', result.errors)
          // Fall back to heuristics only if AI fails
          return this.analyzeWithSimpleHeuristics(question, userResponse, mode)
        }
      } else {
        // No response processor available, use heuristics
        console.log(
          '🌸 MamaSan - No response processor available, using heuristics'
        )
        return this.analyzeWithSimpleHeuristics(question, userResponse, mode)
      }
    } catch (error) {
      console.error('🌸 MamaSan - Error in analyzeResponse:', error)

      // Final safety fallback
      return this.analyzeWithSimpleHeuristics(question, userResponse, mode)
    }
  }

  /**
   * Simple, reliable heuristic analysis to avoid AI validation failures
   */
  private analyzeWithSimpleHeuristics(
    question: string,
    userResponse: string,
    mode: 'onboarding' | 'continuous' = 'onboarding'
  ): {
    answered: boolean
    reason?: string
    profileUpdates?: any
    validationErrors?: any[]
    usedFallback?: boolean
  } {
    const trimmedResponse = userResponse.trim().toLowerCase()
    const responseLength = trimmedResponse.length
    const wordCount = userResponse.split(/\s+/).length

    // Reject only obviously invalid responses
    if (
      responseLength < 2 ||
      wordCount < 1 ||
      trimmedResponse === 'no' ||
      trimmedResponse === 'nothing' ||
      trimmedResponse === 'idk' ||
      trimmedResponse.includes("i don't know") ||
      trimmedResponse.includes('dunno') ||
      trimmedResponse.includes('not sure') ||
      trimmedResponse.includes('whatever')
    ) {
      return {
        answered: false,
        reason: 'Response too vague or indicates lack of preference',
        profileUpdates: {},
        usedFallback: true,
      }
    }

    // Accept everything else as a valid response
    // Extract basic profile information based on keywords
    const profileUpdates = this.extractBasicProfileInfo(
      trimmedResponse,
      question
    )

    return {
      answered: true,
      profileUpdates: profileUpdates,
      usedFallback: true,
    }
  }

  /**
   * Extract basic profile information from user response using keyword matching
   */
  private extractBasicProfileInfo(response: string, question: string): any {
    const profileUpdates: any = {}

    // Basic interest/service extraction
    if (question.includes('selfies') || question.includes('videos')) {
      const interests = []
      if (response.includes('selfie') || response.includes('photo'))
        interests.push('photos')
      if (response.includes('video') || response.includes('call'))
        interests.push('video-calls')
      if (response.includes('chat') || response.includes('talk'))
        interests.push('conversation')
      if (response.includes('entertain') || response.includes('fun'))
        interests.push('entertainment')
      if (response.includes('game') || response.includes('play'))
        interests.push('gaming')

      if (interests.length > 0) {
        profileUpdates.preferences = { serviceTypes: interests }
      }
    }

    // Basic mood extraction
    if (question.includes('mood') || question.includes('unwind')) {
      if (
        response.includes('relax') ||
        response.includes('unwind') ||
        response.includes('calm')
      ) {
        profileUpdates.preferences = { moodSeeking: 'calm' }
      } else if (
        response.includes('entertain') ||
        response.includes('fun') ||
        response.includes('energy')
      ) {
        profileUpdates.preferences = { moodSeeking: 'energetic' }
      }
    }

    // Basic conversation style
    if (question.includes('conversation') || question.includes('talk')) {
      if (response.includes('deep') || response.includes('personal')) {
        profileUpdates.preferences = { interactionStyle: 'intimate' }
      } else if (response.includes('fun') || response.includes('playful')) {
        profileUpdates.preferences = { interactionStyle: 'playful' }
      }
    }

    return profileUpdates
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

      const aiReply = await callAI([
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: prompt },
      ])

      // Check if the AI refused to respond appropriately
      if (this.isRefusalResponse(aiReply)) {
        console.log('🚨 MamaSan - AI refusal detected, using fallback response')

        // Use professional fallback
        return this.generateFallbackTransition(userResponse, nextQuestion)
      }

      return aiReply.trim()
    } catch (error) {
      console.error('🌸 MamaSan - Error generating transition:', error)

      // Fallback transitions based on question type
      return this.generateFallbackTransition(userResponse, nextQuestion)
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
