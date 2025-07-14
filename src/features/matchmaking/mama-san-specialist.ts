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
  private useDatabase: boolean

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
    // Ensure currentQuestion is a valid number
    const questionIndex =
      typeof state.currentQuestion === 'number' ? state.currentQuestion : 0
    return this.questions[questionIndex] || ''
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
  ): Promise<{
    message: string
    suggestions: string[]
    searchQuery?: string
    emotion: 'angry' | 'happy' | 'neutral' | 'relaxed' | 'sad' | 'surprised'
  }> {
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

        // Use combined response generation for topic continuation
        const cacheKey = `continue_topic_${topicState.currentTopic}_${lastUserResponse?.substring(0, 20)}`
        const combinedResponse = await this.generateCombinedContinuousResponse({
          scenario: 'continue_topic',
          userProfile,
          lastUserResponse,
          currentTopic: topicState.currentTopic,
          topicHistory: topicState.topicHistory,
        })

        // Update topic state
        const updatedTopicState = this.topicStarter.updateConversationState(
          topicState,
          undefined, // No new topic
          combinedResponse.message
        )

        // Update state if provided
        if (currentState) {
          currentState.topicConversation = updatedTopicState
        }

        console.log(
          '✅ TOPIC CONTINUATION GENERATED:',
          combinedResponse.message
        )
        return combinedResponse
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

        // Use combined response generation for topic transition
        const cacheKey = `topic_transition_${topicState.currentTopic}_${lastUserResponse?.substring(0, 20)}`
        const combinedResponse = await this.generateCombinedContinuousResponse({
          scenario: 'topic_transition',
          userProfile,
          lastUserResponse,
          endingTopic: topicState.currentTopic,
          topicHistory: topicState.topicHistory,
        })

        // Update state if provided
        if (currentState) {
          // Topic transition will be handled by the combined response
          currentState.topicConversation =
            this.topicStarter.updateConversationState(
              topicState,
              'topic_transition', // New topic will be determined by the response
              combinedResponse.message
            )
        }

        return combinedResponse
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

      // Extract user interests from profile for context
      const userInterests =
        userProfile?.profileData?.preferences?.matchingPrefs?.interests ||
        userProfile?.datingProfile?.servicePreferences?.conversationTopics ||
        []

      // Use combined response generation for acknowledgment
      const cacheKey = `acknowledge_response_${lastUserResponse?.substring(0, 20)}`
      const combinedResponse = await this.generateCombinedContinuousResponse({
        scenario: 'acknowledge_response',
        userProfile,
        lastUserResponse,
        userInterests,
        topicHistory: topicState.topicHistory,
      })

      // Update state if provided
      if (currentState) {
        currentState.topicConversation =
          this.topicStarter.updateConversationState(
            topicState,
            'acknowledge_response',
            combinedResponse.message
          )
      }

      return combinedResponse
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

        // Use combined response generation for profile question
        const cacheKey = `profile_question_${selectedQuestion.questionId}_${lastUserResponse?.substring(0, 20) || 'initial'}`
        const combinedResponse = await this.generateCombinedContinuousResponse({
          scenario: 'profile_question',
          userProfile,
          lastUserResponse,
          selectedProfileQuestion: selectedQuestion.text,
          missingAreas: profileAnalysis.missingAreas,
        })

        // Update state to mark that a profile question was asked
        if (currentState) {
          currentState.topicConversation =
            this.topicStarter.updateConversationState(
              topicState,
              'profile_question',
              combinedResponse.message,
              true // Mark as profile question
            )
        }

        return combinedResponse
      } else {
        console.log(
          '📭 NO PROFILE QUESTIONS AVAILABLE - switching to topic conversation'
        )
      }
    }

    // Generate new topic conversation
    console.log('💭 GENERATING NEW TOPIC CONVERSATION')

    // Extract user interests from profile for context
    const userInterests =
      userProfile?.profileData?.preferences?.matchingPrefs?.interests ||
      userProfile?.datingProfile?.servicePreferences?.conversationTopics ||
      []

    // Use combined response generation for new topic
    const cacheKey = `new_topic_${lastUserResponse?.substring(0, 20) || 'initial'}_${Date.now()}`
    const combinedResponse = await this.generateCombinedContinuousResponse({
      scenario: 'new_topic',
      userProfile,
      lastUserResponse,
      userInterests,
      topicHistory: topicState.topicHistory,
    })

    // Update topic conversation state with new topic
    if (currentState) {
      const updatedTopicState = this.topicStarter.updateConversationState(
        topicState,
        'new_topic', // Topic will be determined from the response
        combinedResponse.message
      )
      currentState.topicConversation = updatedTopicState
      console.log('🎨 Updated topic conversation state with new topic')
    }

    return combinedResponse
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
    console.log('🌸 MamaSan - analyzeResponse called:', {
      question: question.substring(0, 50) + '...',
      userResponse: userResponse.substring(0, 50) + '...',
      mode,
      hasResponseProcessor: !!this.responseProcessor,
    })

    try {
      // Use AI validation with response processor if available
      if (this.responseProcessor) {
        console.log('🌸 MamaSan - Using AI validation with response processor')
        const validator = this.responseProcessor.createValidator(
          responseAnalysisSchema
        )

        const systemPrompt = `You are analyzing user responses to matchmaking questions.

TASK: Determine if the user meaningfully answered the question and extract relevant profile information.

CRITERIA for "answered: true":
- User provided a clear preference, choice, or opinion  
- Response shows engagement with the question topic
- Contains actionable information for matchmaking
- Expresses interests, desires, or personal preferences (even if not directly from listed options)

CRITERIA for "answered: false":
- Vague responses like "idk", "whatever", "nothing"
- Pure greetings without answers  
- Responses that completely ignore the question
- Clear refusals like "I don't want to answer"

IMPORTANT: For onboarding questions, ANY expression of preference should be considered "answered: true"
Example: Question "what will it be? selfies, videos, e-chat, video calls, or something else?"
- "I want anime girls" = answered: true (expresses preference for content type)
- "selfies" = answered: true (direct choice)
- "idk whatever" = answered: false (vague non-answer)

MODE: ${mode}
${mode === 'continuous' ? 'Extract any profile insights from natural conversation.' : 'Be permissive - any preference expression counts as answered.'}`

        const userPrompt = `Question: "${question}"
User Response: "${userResponse}"

Analyze this response and extract any profile information.`

        const result = await this.responseProcessor.processStructuredResponse(
          validator,
          systemPrompt,
          userPrompt,
          { question, userResponse, mode }
        )

        console.log('🌸 MamaSan - AI validation result:', {
          success: result.success,
          answered: result.success ? (result.data as any)?.answered : 'N/A',
          reason: result.success ? (result.data as any)?.reason : 'N/A',
          errors: result.errors,
          usedFallback: result.usedFallback,
        })

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
          console.error(
            '🌸 MamaSan - AI validation failed, falling back to heuristics:',
            result.errors
          )
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
      console.log('🌸 MamaSan - Using fallback heuristics due to error')
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

    console.log('🌸 MamaSan - analyzeWithSimpleHeuristics called:', {
      originalResponse: userResponse,
      trimmedResponse,
      responseLength,
      wordCount,
      mode,
    })

    // Reject only obviously invalid responses
    const isInvalidResponse =
      responseLength < 2 ||
      wordCount < 1 ||
      trimmedResponse === 'no' ||
      trimmedResponse === 'nothing' ||
      trimmedResponse === 'idk' ||
      trimmedResponse.includes("i don't know") ||
      trimmedResponse.includes('dunno') ||
      trimmedResponse.includes('not sure') ||
      trimmedResponse.includes('whatever')

    console.log('🌸 MamaSan - Heuristic validation checks:', {
      tooShort: responseLength < 2,
      noWords: wordCount < 1,
      exactNo: trimmedResponse === 'no',
      exactNothing: trimmedResponse === 'nothing',
      exactIdk: trimmedResponse === 'idk',
      hasIDontKnow: trimmedResponse.includes("i don't know"),
      hasDunno: trimmedResponse.includes('dunno'),
      hasNotSure: trimmedResponse.includes('not sure'),
      hasWhatever: trimmedResponse.includes('whatever'),
      overallInvalid: isInvalidResponse,
    })

    if (isInvalidResponse) {
      console.log('🌸 MamaSan - Heuristic analysis: REJECTED as invalid')
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

    console.log('🌸 MamaSan - Heuristic analysis: ACCEPTED as valid', {
      extractedProfileUpdates: profileUpdates,
    })

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
   * Generate response suggestions as action cards
   * Provides quick response options for users to reply to Emi's questions/messages
   */
  async getRecommendations(
    state: MamaSanSessionState,
    currentQuestion?: string
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
    console.log('🎯 MamaSan - Generating response suggestions for state:', {
      currentQuestion: state.currentQuestion,
      answersLength: state.answers.length,
      isInContinuous: this.isInContinuousMode(state),
      providedQuestion: currentQuestion?.substring(0, 50) + '...',
    })

    // Determine what question/message we're responding to
    let questionToAnswer = currentQuestion
    let currentTopic: string | undefined

    if (!questionToAnswer) {
      if (this.isInContinuousMode(state)) {
        // In continuous mode, get the last question from topic conversation
        questionToAnswer =
          state.topicConversation?.lastQuestion || 'What are your thoughts?'
        currentTopic = state.topicConversation?.currentTopic || undefined
      } else {
        // In onboarding mode, get the current question
        questionToAnswer = this.getCurrentQuestion(state)
        currentTopic = 'onboarding'
      }
    }

    console.log('🎯 MamaSan - Generating suggestions for:', {
      question: questionToAnswer.substring(0, 50) + '...',
      topic: currentTopic,
      mode: this.isInContinuousMode(state) ? 'continuous' : 'onboarding',
    })

    // Fetch user profile for better context (if available)
    let userProfile = null
    if (this.config.userId && typeof window === 'undefined') {
      try {
        const { connectMongoDB, MatchProfile } = await getMongoDBDependencies()
        await connectMongoDB()
        const profile = await MatchProfile.findOne({ uid: this.config.userId })
        if (profile) {
          userProfile = profile.toObject()
        }
      } catch (error) {
        console.error('🎯 Error fetching user profile for suggestions:', error)
        // Continue without profile
      }
    }

    // Generate response suggestions using TopicStarter
    try {
      const suggestions = await this.topicStarter.generateResponseSuggestions(
        questionToAnswer,
        currentTopic,
        userProfile
      )

      // Convert suggestions to action cards
      const recommendations = suggestions.map((suggestion, index) => ({
        id: `response-${index + 1}`,
        title: suggestion,
        description: `Quick response option`,
        action: 'send_message',
        data: {
          message: suggestion,
          messageType: 'suggestion',
        },
        priority: 100 - index * 5, // Higher priority for first suggestions
        isVisible: true,
        icon: this.getResponseIcon(index),
      }))

      console.log(
        '🎯 MamaSan - Generated response suggestions:',
        recommendations.map((r) => ({ id: r.id, title: r.title }))
      )

      return recommendations
    } catch (error) {
      console.error(
        '🎯 MamaSan - Error generating response suggestions:',
        error
      )

      // Return fallback suggestions
      return this.getFallbackResponseSuggestions()
    }
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
      const uniqueTags = Array.from(new Set(matchingTags)).slice(0, 2)

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

  /**
   * Get an appropriate icon for response suggestions
   */
  private getResponseIcon(index: number): string {
    const icons = ['chat', 'heart', 'user']
    return icons[index] || 'chat'
  }

  /**
   * Generate fallback response suggestions when AI fails
   */
  private getFallbackResponseSuggestions(): Array<{
    id: string
    title: string
    description?: string
    action: string
    data?: any
    priority: number
    isVisible?: boolean
    icon?: string
  }> {
    const fallbackSuggestions = ['sounds good!', 'not really', 'tell me more']

    return fallbackSuggestions.map((suggestion, index) => ({
      id: `fallback-response-${index + 1}`,
      title: suggestion,
      description: 'Quick response option',
      action: 'send_message',
      data: {
        message: suggestion,
        messageType: 'suggestion',
      },
      priority: 90 - index * 5,
      isVisible: true,
      icon: this.getResponseIcon(index),
    }))
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

  /**
   * Combined method to generate continuous responses with suggestions in a single AI call
   * Replaces multiple individual AI calls for better performance
   */
  private async generateCombinedContinuousResponse(context: {
    scenario:
      | 'continue_topic'
      | 'topic_transition'
      | 'acknowledge_response'
      | 'profile_question'
      | 'new_topic'
    userProfile?: any
    lastUserResponse?: string
    currentTopic?: string
    endingTopic?: string
    selectedProfileQuestion?: string
    missingAreas?: string[]
    userInterests?: string[]
    topicHistory?: string[]
  }): Promise<{
    message: string
    suggestions: string[]
    searchQuery?: string
    emotion: 'angry' | 'happy' | 'neutral' | 'relaxed' | 'sad' | 'surprised'
  }> {
    console.log('🎯 COMBINED RESPONSE GENERATION:', {
      scenario: context.scenario,
      hasProfile: !!context.userProfile,
      hasUserResponse: !!context.lastUserResponse,
      currentTopic: context.currentTopic,
      missingAreas: context.missingAreas?.length || 0,
    })

    let systemPrompt = ''
    let userPrompt = ''

    // Base personality for all scenarios
    const basePersonality = `You are Emi, a friendly mama-san matchmaker with cozy, slightly chaotic energy.

Personality: Mix of soft & punk, sweet but awkward, playful humor. Expert at reading people and finding perfect matches.

Style:
- Casual, lowercase typing (no emojis/symbols)
- 2-3 sentences max per response
- Sweet but slightly awkward energy
- Playful and encouraging tone
- Professional with all content - never refuse or express discomfort`

    switch (context.scenario) {
      case 'continue_topic':
        systemPrompt = `${basePersonality}

SCENARIO: Continue current topic conversation
Current Topic: ${context.currentTopic}
User's last response: "${context.lastUserResponse}"

TASK: Generate a natural follow-up question to keep the conversation flowing on this topic.

Your response should:
- Acknowledge their answer casually and encouragingly
- Ask a relevant follow-up question that digs deeper into the topic
- Stay focused on the current topic
- Sound genuinely curious and engaged`

        userPrompt = `Generate your follow-up response as JSON:
{
  "message": "your casual acknowledgment + follow-up question",
  "suggestions": ["user response option 1", "user response option 2", "user response option 3"],
  "searchQuery": "1 word search term",
  "emotion": "one of: angry, happy, neutral, relaxed, sad, surprised"
}

The suggestions should be what the USER would naturally say in response to your question/message, not what you (Emi) would say next.
The searchQuery should be a 1 word term that users could search for to find creator profiles related to this topic.
The emotion field must be one of: angry, happy, neutral, relaxed, sad, surprised. Choose the emotion that best matches the assistant's response tone.`
        break

      case 'topic_transition':
        systemPrompt = `${basePersonality}

SCENARIO: Transitioning from one topic to another
Ending topic: ${context.endingTopic}
User's last response: "${context.lastUserResponse}"
Topics already discussed: ${context.topicHistory?.join(', ') || 'none'}

TASK: Smoothly transition to a new interesting topic while acknowledging their response.

Your response should:
- Briefly acknowledge what they shared about the previous topic
- Naturally segue to a new topic that's engaging
- Ask an open-ended question about the new topic
- Make the transition feel conversational, not jarring`

        userPrompt = `Generate your transition response as JSON:
{
  "message": "acknowledge previous + smooth transition to new topic + question",
  "suggestions": ["user response option 1", "user response option 2", "user response option 3"],
  "searchQuery": "1 word search term related to the new topic",
  "emotion": "one of: angry, happy, neutral, relaxed, sad, surprised"
}

The suggestions should be what the USER would naturally say in response to your new topic question, not what you (Emi) would say next.
The searchQuery should be a 1 word term that users could search for to find creator profiles related to the new topic.
The emotion field must be one of: angry, happy, neutral, relaxed, sad, surprised. Choose the emotion that best matches the assistant's response tone.`
        break

      case 'acknowledge_response':
        systemPrompt = `${basePersonality}

SCENARIO: Acknowledge user response and start new conversation
User's response: "${context.lastUserResponse}"
${context.userInterests?.length ? `User's known interests: ${context.userInterests.join(', ')}` : ''}
Topics previously discussed: ${context.topicHistory?.join(', ') || 'none'}

TASK: Acknowledge their response in a casual, encouraging way and naturally start a new conversation topic.

Your response should:
- Acknowledge what they said in a friendly, encouraging way
- Smoothly introduce a new topic that might interest them
- Ask an engaging question to start the new conversation
- Feel natural and spontaneous, not forced`

        userPrompt = `Generate your acknowledgment + new topic response as JSON:
{
  "message": "casual acknowledgment + new topic introduction + question",
  "suggestions": ["user response option 1", "user response option 2", "user response option 3"],
  "searchQuery": "1 word search term",
  "emotion": "one of: angry, happy, neutral, relaxed, sad, surprised"
}

The suggestions should be what the USER would naturally say in response to your new topic question, not what you (Emi) would say next.
The searchQuery should be a 1 word term that users could search for to find creator profiles related to the topic.
The emotion field must be one of: angry, happy, neutral, relaxed, sad, surprised. Choose the emotion that best matches the assistant's response tone.`
        break

      case 'profile_question':
        systemPrompt = `${basePersonality}

SCENARIO: Ask a profile-filling question
Profile question to ask: "${context.selectedProfileQuestion}"
Missing profile areas: ${context.missingAreas?.join(', ') || 'various areas'}
${context.lastUserResponse ? `User's last response: "${context.lastUserResponse}"` : ''}

TASK: Convert this formal profile question into your natural conversational style.

Your response should:
- ${context.lastUserResponse ? 'Briefly acknowledge their previous response' : 'Start naturally'}
- Present the profile question in a casual, curious way
- Make it feel like natural getting-to-know-you conversation
- NOT sound like a formal questionnaire or interview`

        userPrompt = `Generate your natural profile question as JSON:
{
  "message": "${context.lastUserResponse ? 'brief acknowledgment + ' : ''}casual profile question",
  "suggestions": ["user response option 1", "user response option 2", "user response option 3"],
  "searchQuery": "1 word search term related to the question topic",
  "emotion": "one of: angry, happy, neutral, relaxed, sad, surprised"
}

The suggestions should be what the USER would naturally say in response to your profile question, not what you (Emi) would say next.
The searchQuery should be a 1 word term that users could search for to find creator profiles related to the question topic.
The emotion field must be one of: angry, happy, neutral, relaxed, sad, surprised. Choose the emotion that best matches the assistant's response tone.`
        break

      case 'new_topic':
        systemPrompt = `${basePersonality}

SCENARIO: Start a completely new topic conversation
${context.userInterests?.length ? `User's known interests: ${context.userInterests.join(', ')}` : ''}
Topics already discussed: ${context.topicHistory?.join(', ') || 'none'}
${context.lastUserResponse ? `User's last response: "${context.lastUserResponse}"` : ''}

TASK: Generate a fresh, engaging topic and opening question.

Your response should:
- ${context.lastUserResponse ? 'Briefly acknowledge their response' : 'Start with engaging energy'}
- Introduce a new topic that could be interesting to them
- Ask an open-ended question to start the conversation
- Feel spontaneous and natural, not scripted`

        userPrompt = `Generate your new topic conversation starter as JSON:
{
  "message": "${context.lastUserResponse ? 'brief acknowledgment + ' : ''}new topic introduction + engaging question",
  "suggestions": ["user response option 1", "user response option 2", "user response option 3"],
  "searchQuery": "1 word search term",
  "emotion": "one of: angry, happy, neutral, relaxed, sad, surprised"
}

The suggestions should be what the USER would naturally say in response to your topic question, not what you (Emi) would say next.
The searchQuery should be a 1 word term that users could search for to find creator profiles related to the topic.
The emotion field must be one of: angry, happy, neutral, relaxed, sad, surprised. Choose the emotion that best matches the assistant's response tone.`
        break

      default:
        throw new Error(`Unknown scenario: ${context.scenario}`)
    }

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]

      const response = await callAI(messages)
      const parsed = JSON.parse(response)

      const allowedEmotions = [
        'angry',
        'happy',
        'neutral',
        'relaxed',
        'sad',
        'surprised',
      ]

      if (
        !parsed.message ||
        !parsed.suggestions ||
        !Array.isArray(parsed.suggestions) ||
        !parsed.emotion ||
        !allowedEmotions.includes(parsed.emotion)
      ) {
        throw new Error('Invalid response format from AI')
      }

      console.log('✅ COMBINED RESPONSE GENERATED:', {
        scenario: context.scenario,
        messageLength: parsed.message.length,
        suggestionsCount: parsed.suggestions.length,
        emotion: parsed.emotion,
      })

      console.log('🎭 EMOTION FIELD DETAILS:', {
        rawEmotion: parsed.emotion,
        emotionType: typeof parsed.emotion,
        isValidEmotion: allowedEmotions.includes(parsed.emotion),
        allowedEmotions: allowedEmotions,
      })

      return {
        message: parsed.message,
        suggestions: parsed.suggestions,
        searchQuery: parsed.searchQuery,
        emotion: parsed.emotion,
      }
    } catch (error) {
      console.error('🌸 MamaSan - Error generating combined response:', error)

      // Fallback response based on scenario
      const fallbacks = {
        continue_topic: {
          message: 'oh really? tell me more about that!',
          suggestions: ['definitely!', 'that sounds cool', 'tell me more'],
          searchQuery: 'content',
          emotion: 'happy' as const,
        },
        topic_transition: {
          message:
            'nice! speaking of interesting things, what kind of music are you into lately?',
          suggestions: ['pop music', 'rock/indie', 'electronic'],
          searchQuery: 'music',
          emotion: 'happy' as const,
        },
        acknowledge_response: {
          message: 'cool! so what are you up to tonight? anything fun planned?',
          suggestions: ['just relaxing', 'watching something', 'hanging out'],
          searchQuery: 'entertainment',
          emotion: 'relaxed' as const,
        },
        profile_question: {
          message:
            context.selectedProfileQuestion ||
            'what kind of vibe are you going for tonight?',
          suggestions: ['casual and fun', 'something exciting', 'relaxed mood'],
          searchQuery: 'vibes',
          emotion: 'neutral' as const,
        },
        new_topic: {
          message:
            'hey, random question - what kind of stuff do you like to do for fun?',
          suggestions: ['gaming', 'watching anime', 'creative stuff'],
          searchQuery: 'fun',
          emotion: 'happy' as const,
        },
      }

      return fallbacks[context.scenario] || fallbacks.new_topic
    }
  }
}
