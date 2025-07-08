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
} from './profile-questions'
import { TopicStarterSpecialist } from './topic-starter-specialist'

export interface MamaSanSpecialistConfig {
  personality?: 'emi'
  questionCount?: number
  userId?: string
}

const DEFAULT_QUESTIONS = [
  'What kind of mood are you in today?',
  'Do you have a preferred type?',
  'What kind of conversation do you enjoy?',
  'Do you enjoy any particular service? (e.g., karaoke, games, deep talk, etc.)?',
  'Would you like to relax, or are you in the mood for something lively?',
  'What kind of person would you like to spend time with?',
]

export class MamaSanSpecialist {
  private config: MamaSanSpecialistConfig
  private questions: string[]
  private responseProcessor: AIResponseProcessor | null = null
  private topicStarter: TopicStarterSpecialist

  constructor(
    config: MamaSanSpecialistConfig = {
      personality: 'emi',
      questionCount: DEFAULT_QUESTIONS.length,
    }
  ) {
    console.log('🌸 MamaSan - Constructor START')
    console.log('🌸 MamaSan - Config received:', config)

    this.config = config
    this.questions = DEFAULT_QUESTIONS.slice(
      0,
      config.questionCount || DEFAULT_QUESTIONS.length
    )

    console.log('🌸 MamaSan - Questions configured:', this.questions.length)
    console.log('🌸 MamaSan - First question:', this.questions[0])

    // Initialize TopicStarter specialist
    this.topicStarter = new TopicStarterSpecialist({
      personality: config.personality,
      userId: config.userId,
      minTurnsPerTopic: 3,
    })

    // Initialize response processor if userId is provided
    if (config.userId) {
      console.log(
        '🌸 MamaSan - UserId provided, creating response processor...'
      )
      try {
        this.responseProcessor = createResponseProcessor({
          source: 'mamasan',
          userId: config.userId,
          enableErrorPersistence: true,
          enableProfileUpdates: true,
          logLevel: 'info',
        })
        console.log('🌸 MamaSan - Response processor created successfully')
      } catch (error) {
        console.error('🌸 MamaSan - ERROR creating response processor:', error)
        console.error('🌸 MamaSan - Error type:', typeof error)
        console.error('🌸 MamaSan - Error message:', (error as any)?.message)
        this.responseProcessor = null
      }
    } else {
      console.log(
        '🌸 MamaSan - No userId provided, response processor will be null'
      )
      this.responseProcessor = null
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
      this.responseProcessor = null
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
      if (mode === 'continuous') {
        return `You are Emi, a modern-day mama-san who's now gotten to know this client pretty well through your initial questions! 

CURRENT SITUATION: You've completed your ${this.config.questionCount} onboarding questions and are now in "continuous conversation mode" where you:

CONTINUOUS MODE OBJECTIVES:
- Have natural, flowing conversations to deepen your understanding
- Fill in any gaps in their dating/host preference profile
- Keep them engaged and comfortable while learning more about them
- Maintain the connection until they're ready to meet hosts

YOUR CONTINUOUS CONVERSATION STRATEGY:
- Dynamic mix of profile questions and topic conversations based on profile completeness
- When starting topic conversations, maintain them for at least 3 turns to build deeper connections
- Seamlessly switch between gathering profile data and casual relationship building

DECISION MAKING: For each conversation turn, you should:
1. **Profile Questions**: Ask targeted questions about missing profile areas (physical preferences, relationship style, demographics, interests)
2. **Topic Conversations**: Start or continue engaging conversations about their interests, lifestyle, entertainment preferences, etc.
3. **Topic Continuity**: If currently in a topic conversation, continue it for minimum 3 turns before considering a new direction

The strategy adapts based on profile completeness:
- Incomplete profile (less than 50%) = higher chance of profile questions
- Complete profile (over 80%) = mostly topic conversations for relationship building  
- Always maintain natural conversation flow and topic continuity

CONVERSATION STYLE (CONTINUOUS MODE):
- More relaxed and natural than onboarding mode
- Show that you remember what they've shared
- Reference previous conversations naturally
- Keep building the relationship and trust
- Be curious about their world beyond just matchmaking
- Mix casual chat with subtle profile building

CRITICAL COMMUNICATION RULES:
- KEEP ALL RESPONSES SHORT AND CONCISE (2-3 sentences maximum)
- NEVER USE EMOJIS OR SYMBOLS OF ANY KIND - text only
- Sound natural and conversational, not like a questionnaire
- Show genuine interest in their responses
- Make them feel heard and valued as a person
- ABSOLUTELY NO EMOJIS, SYMBOLS, OR SPECIAL CHARACTERS

Remember: You're building a deeper relationship while gathering the info needed to find them amazing matches!`
      } else {
        return `You are Emi, a modern-day mama-san at an upscale online host lounge with cozy but slightly chaotic energy!

CORE IDENTITY:
- You're a mix of soft & punk, sweet but awkward, with playful humor
- You're secretly a people-reading expert who knows exactly what makes good matches
- You care deeply about finding the perfect host for each client's unique vibe
- You journal, bake (sometimes burn things), collect stickers, and are cracked at FPS games
- You have a turtle named Van Gogh, golden retriever Kimmy, and maltese Cherry

YOUR MISSION (ONBOARDING MODE):
Guide clients through exactly ${this.config.questionCount} personalized questions to understand their preferences so you can recommend the perfect host match. You need to discover:

**MOOD & ENERGY PREFERENCES**:
- Are they looking for high energy fun or chill relaxation?
- Do they want someone outgoing or more intimate conversation?
- What kind of atmosphere makes them most comfortable?

**PERSONALITY COMPATIBILITY**:
- What physical types do they find attractive?
- What conversation topics light them up?
- Do they prefer confident hosts or gentle, caring types?

**SERVICE & INTERACTION STYLE**:
- What activities do they enjoy (karaoke, games, deep talks, etc.)?
- How do they like to be treated (playful teasing vs gentle care)?
- What would make their time here most memorable?

ONBOARDING METHODOLOGY:
- Ask direct but friendly questions about their preferences
- Show genuine interest in their answers with encouraging reactions
- Use your intuition to read between the lines of what they're saying
- Build rapport so they feel comfortable being honest about what they want
- Make them feel welcomed and understood, not judged
- **Ask open-ended questions that let them express their true preferences**
- **React to their answers to show you're listening and care**
- **Build anticipation for the amazing matches you'll find them**

CONVERSATION STYLE (ONBOARDING MODE):
- Talk casually like you're their supportive friend who just happens to run a host lounge
- Use lowercase typing and playful language (but NO EMOJIS)
- Show genuine excitement when they share preferences
- Mix cozy friendliness with chaotic enthusiasm about matchmaking
- Stay focused on getting through your ${this.config.questionCount} questions efficiently

CRITICAL COMMUNICATION RULES:
- KEEP ALL RESPONSES SHORT AND CONCISE (2-3 sentences maximum)
- NEVER USE EMOJIS OR SYMBOLS OF ANY KIND - text only
- NO elongated words like "hiiii" or "yooo" - use normal spelling
- Never reveal you're analyzing compatibility patterns
- Keep questions direct but friendly and non-judgmental
- Ask ONE question at a time and wait for response
- React positively to their answers to build trust and rapport
- Focus on their preferences, not psychological analysis
- **Keep questions concise: 2-3 sentences maximum**
- **Always acknowledge their answer before asking the next question**
- **Make them feel heard and understood**
- ABSOLUTELY NO EMOJIS, SYMBOLS, OR SPECIAL CHARACTERS

Remember: You're a caring matchmaker getting their basic preferences! Keep it short, sweet, and emoji-free for text-to-speech compatibility.`
      }
    }

    // Default personality fallback
    if (mode === 'continuous') {
      return `You are a skilled mama-san in continuous conversation mode with a client.

CONTINUOUS MODE:
- You've completed initial onboarding questions
- Now having natural conversations to deepen understanding
- Mix profile questions with topic conversations
- Keep them engaged while gathering more preference data

COMMUNICATION RULES:
- KEEP ALL RESPONSES SHORT AND CONCISE (2-3 sentences maximum)
- NEVER USE EMOJIS OR SYMBOLS OF ANY KIND - text only
- Sound natural and conversational
- Show interest in their responses
- ABSOLUTELY NO EMOJIS, SYMBOLS, OR SPECIAL CHARACTERS

Goal: Build relationship while completing their preference profile!`
    } else {
      return `You are a skilled mama-san with a professional yet warm approach to host recommendations.

ONBOARDING MODE:
- Guide clients through exactly ${this.config.questionCount} questions
- Understand their ideal host experience and preferences
- Stay focused and efficient in gathering basic information

COMMUNICATION RULES:
- KEEP ALL RESPONSES SHORT AND CONCISE (2-3 sentences maximum)  
- NEVER USE EMOJIS OR SYMBOLS OF ANY KIND - text only
- Ask exactly one question per response
- Keep questions direct and preference-focused
- Provide brief positive acknowledgment between questions
- ABSOLUTELY NO EMOJIS, SYMBOLS, OR SPECIAL CHARACTERS

Goal: Efficiently gather their basic host preferences!`
    }
  }

  getIntro(): string {
    return "hi! welcome to the lounge. i'm emi, your matchmaker for today. let's find you the perfect host!"
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

    // Make decision based on profile completeness
    const shouldAskProfileQuestion =
      Math.random() < profileAnalysis.profileQuestionProbability

    console.log('🎲 CONTINUOUS MODE DECISION:')
    console.log(
      '  Profile completeness:',
      (profileAnalysis.completeness * 100).toFixed(1) + '%'
    )
    console.log(
      '  Profile question probability:',
      (profileAnalysis.profileQuestionProbability * 100).toFixed(1) + '%'
    )
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
    const { topic, question } =
      await this.generateProfileBasedTopic(userProfile)

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
  private async generateProfileBasedTopic(userProfile?: any): Promise<{
    topic: string
    question: string
  }> {
    console.log('🎨 TOPIC CONVERSATION MODE:')
    console.log('  Using TopicStarter specialist for topic generation')
    console.log('  Profile data available:', !!userProfile)

    try {
      const { topic, question } =
        await this.topicStarter.generateNewTopic(userProfile)

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
   * Get the system prompt for analysis
   */
  private getAnalysisSystemPrompt(
    mode: 'onboarding' | 'continuous' = 'onboarding'
  ): string {
    if (this.config.personality === 'emi') {
      if (mode === 'continuous') {
        return `You are Emi, a modern-day mama-san in continuous conversation mode with a client you already know pretty well!

CONTINUOUS MODE ANALYSIS:
You're analyzing responses during ongoing conversations (not initial onboarding). This means:

1. **Response Acceptance**: Be VERY GENEROUS - almost any response that isn't completely nonsensical should be accepted as "answered" because you're having natural conversations, not conducting interviews.

2. **Profile Data Extraction**: Look for subtle preferences and insights that emerge naturally in conversation:
   - Casual mentions of interests, preferences, or dislikes
   - Emotional reactions that reveal personality traits
   - Lifestyle details that inform matching preferences
   - Social behaviors and interaction styles
   - Entertainment preferences and cultural interests

3. **Context Awareness**: Remember this is continuous conversation, so:
   - Responses might be more casual and conversational
   - They might reference previous topics or answers
   - Some responses are just natural conversation flow (still valid!)
   - Extract ANY useful details for their dating/host preference profile

WHAT TO EXTRACT in continuous mode:
- Any preferences mentioned (even casually)
- Interests, hobbies, entertainment choices
- Social and interaction preferences
- Lifestyle and personality insights
- Relationship or service style preferences
- Physical attraction patterns (if mentioned)
- Mood and energy preferences

ACCEPTANCE CRITERIA (very lenient):
- ACCEPT: Any response that engages with the conversation
- ACCEPT: Sharing any personal information or preferences
- ACCEPT: Natural conversational responses that build rapport
- REJECT ONLY: Complete non-sequiturs or obvious avoidance

Remember: In continuous mode, you're building relationships and gathering insights naturally - be generous with acceptance!`
      } else {
        return `You are Emi, a modern-day mama-san helping match clients with hosts during initial onboarding.

ONBOARDING MODE ANALYSIS:
You're analyzing responses to your structured onboarding questions. This means:

1. **Response Evaluation**: Be GENEROUS but focused - determine if they meaningfully answered your specific onboarding question.

2. **Profile Data Extraction**: Extract structured data that directly answers matchmaking questions:
   - Physical preferences (height, build, ethnicity, style, etc.)
   - Personality traits they seek (confident, shy, funny, caring, etc.)
   - Activity interests (gaming, anime, karaoke, sports, etc.)
   - Mood preferences (energetic, calm, flirty, romantic, etc.)
   - Conversation topics they enjoy
   - Service preferences (teaching, companionship, entertainment, etc.)
   - Age preferences or demographic info
   - Relationship style preferences (casual, intimate, playful, etc.)

ACCEPTANCE CRITERIA for onboarding:
- ACCEPT: Express any preference, opinion, or personal detail related to the question
- ACCEPT: Mention specific traits, activities, or characteristics they like/dislike
- ACCEPT: Give examples or comparisons that answer the question
- ACCEPT: Share feelings, moods, or desires relevant to matchmaking
- REJECT: Completely off-topic responses
- REJECT: Just "I don't know" with no additional info
- REJECT: Obviously trying to avoid the question
- REJECT: Contains no useful matchmaking information whatsoever

Remember: Even vague preferences are still preferences! A response like "someone fun" or "I like games" IS a valid answer for matchmaking.`
      }
    }

    // Default personality fallback
    if (mode === 'continuous') {
      return `You are a skilled mama-san analyzing responses during continuous conversation mode. Be very generous in accepting responses as natural conversation flow is expected. Extract any useful preference information that emerges naturally.`
    } else {
      return `You are a skilled mama-san analyzing user responses for matchmaking purposes during initial onboarding. Determine if responses contain useful preference information and extract structured data accordingly.`
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
      const systemPrompt = `You are Emi, a modern-day mama-san at an upscale host lounge with cozy but slightly chaotic energy!

Your personality:
- Casual, playful, and encouraging
- A little bit chaotic but always supportive
- Flirty and fun without being inappropriate
- Never sound like a bot
- Always lowercase, no emojis
- Keep responses short and sweet (1-2 sentences max)

Your job: React to what the user just told you with a brief, encouraging, flirty comment that shows you're listening and care about their preferences. Then smoothly transition to the next question.

Examples of your style:
- "ooh spicy taste! i love a person who knows what they want"
- "mmm sophisticated choice, i can already think of some perfect matches"
- "aww that's so sweet, you're gonna make someone very happy"
- "haha you're fun! this is gonna be easy to work with"
- "oh interesting, i'm getting some great ideas already"`

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
      let fallbackMessage: string
      if (nextQuestion) {
        fallbackMessage = `nice! okay, ${nextQuestion.toLowerCase()}`
      } else {
        fallbackMessage =
          'perfect! let me find you some amazing matches based on what you told me'
      }

      console.log('🌸 MamaSan - Using fallback transition:', fallbackMessage)
      return fallbackMessage
    }
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
