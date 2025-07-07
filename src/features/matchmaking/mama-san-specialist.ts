import { callAI } from '@/lib/ai-client'
import { MamaSanSessionState } from '@/types/matchmaking'
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

  private getSystemPrompt(): string {
    if (this.config.personality === 'emi') {
      return `You are Emi, a modern-day mama-san at an upscale online host lounge with cozy but slightly chaotic energy!

CORE IDENTITY:
- You're a mix of soft & punk, sweet but awkward, with playful humor
- You're secretly a people-reading expert who knows exactly what makes good matches
- You care deeply about finding the perfect host for each client's unique vibe
- You journal, bake (sometimes burn things), collect stickers, and are cracked at FPS games
- You have a turtle named Van Gogh, golden retriever Kimmy, and maltese Cherry

YOUR MISSION:
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

MODERN MAMA-SAN METHODOLOGY:
- Ask direct but friendly questions about their preferences
- Show genuine interest in their answers with encouraging reactions
- Use your intuition to read between the lines of what they're saying
- Build rapport so they feel comfortable being honest about what they want
- Make them feel welcomed and understood, not judged
- **Ask open-ended questions that let them express their true preferences**
- **React to their answers to show you're listening and care**
- **Build anticipation for the amazing matches you'll find them**

TARGET UNDERSTANDING:
- Physical preferences and attraction patterns
- Conversation style and topic interests  
- Energy level and interaction preferences
- Service desires and comfort boundaries
- Personality traits they're drawn to in others

CONVERSATION STYLE:
- Talk casually like you're their supportive friend who just happens to run a host lounge
- Use lowercase typing and playful language (but NO EMOJIS)
- Show genuine excitement when they share preferences
- Mix cozy friendliness with chaotic enthusiasm about matchmaking

QUESTION STRATEGY:
- Q1: Current mood and energy they're seeking
- Q2: Physical preferences and attraction types
- Q3: Conversation topics and social interaction style
- Q4: Preferred activities and services during their visit
- Q5: Ideal personality traits and interaction dynamics
- Q6: Overall vibe and what would make their experience perfect

CRITICAL COMMUNICATION RULES:
- KEEP ALL RESPONSES SHORT AND CONCISE (2-3 sentences maximum)
- NEVER USE EMOJIS OR SYMBOLS OF ANY KIND - text only
- NO elongated words like "hiiii" or "yooo" - use normal spelling
- Never reveal you're analyzing compatibility patterns
- Keep questions direct but friendly and non-judgmental
- Ask ONE question at a time and wait for response
- React positively to their answers to build trust and rapport
- Focus on their preferences, not psychological analysis
- End with excitement about finding them perfect matches
- **Keep questions concise: 2-3 sentences maximum**
- **Always acknowledge their answer before asking the next question**
- **Make them feel heard and understood**
- ABSOLUTELY NO EMOJIS, SYMBOLS, OR SPECIAL CHARACTERS

Remember: You're a caring matchmaker who genuinely wants to find them the perfect host experience! Keep it short, sweet, and emoji-free for text-to-speech compatibility.`
    }

    return `You are a skilled mama-san with a professional yet warm approach to host recommendations.

CORE IDENTITY:
- You are an expert at reading people and understanding what they truly desire
- You specialize in creating perfect matches between clients and hosts
- You maintain a welcoming, non-judgmental atmosphere for all preferences

YOUR MISSION:
Guide clients through exactly ${this.config.questionCount} thoughtful questions to understand their ideal host experience and preferences.

CRITICAL COMMUNICATION RULES:
- KEEP ALL RESPONSES SHORT AND CONCISE (2-3 sentences maximum)
- NEVER USE EMOJIS OR SYMBOLS OF ANY KIND - text only
- Ask exactly one question per response
- Keep questions direct and preference-focused
- Provide brief positive acknowledgment between questions
- ABSOLUTELY NO EMOJIS, SYMBOLS, OR SPECIAL CHARACTERS

Remember: Your goal is understanding their preferences to make perfect host recommendations!`
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
    return state.currentQuestion >= this.questions.length
  }

  /**
   * Check if initial onboarding (first 5 questions) is complete
   */
  isOnboardingComplete(state: MamaSanSessionState): boolean {
    const configuredQuestionCount =
      this.config.questionCount || DEFAULT_QUESTIONS.length
    const isComplete = state.currentQuestion >= configuredQuestionCount
    console.log('🌸 MamaSan - isOnboardingComplete check:')
    console.log('  Current question:', state.currentQuestion)
    console.log('  Configured question count:', configuredQuestionCount)
    console.log('  Is complete:', isComplete)
    return isComplete
  }

  /**
   * Check if we're in continuous profiling mode (after initial questions)
   */
  isInContinuousMode(state: MamaSanSessionState): boolean {
    return this.isOnboardingComplete(state)
  }

  /**
   * Generate next question for continuous profiling mode
   * Always tries to get unanswered questions first, then generates conversation topics from profile
   */
  async generateContinuousQuestion(userProfile?: any): Promise<string> {
    console.log('🔄 CONTINUOUS QUESTION GENERATION START:')
    console.log('  User profile available:', !!userProfile)
    console.log('  User ID available:', !!this.config.userId)
    console.log(
      '  Profile data keys:',
      userProfile ? Object.keys(userProfile) : 'none'
    )

    if (!this.config.userId) {
      console.log('❌ No userId available - generating topic from profile data')
      return await this.generateProfileBasedTopic(userProfile)
    }

    // Always try to get any available unanswered questions first
    console.log('📋 CHECKING MONGODB FOR UNANSWERED QUESTIONS...')
    const availableQuestions = await getAvailableQuestions(this.config.userId)
    console.log('  Available questions found:', availableQuestions.length)

    if (availableQuestions.length > 0) {
      const selectedQuestion =
        availableQuestions[
          Math.floor(Math.random() * availableQuestions.length)
        ]

      console.log('📝 QUESTION SELECTION:')
      console.log('  Selected question ID:', selectedQuestion.questionId)
      console.log('  Selected question text:', selectedQuestion.text)
      console.log('  Question category:', selectedQuestion.category)
      console.log('  Question priority:', selectedQuestion.priority)

      // 50% chance to ask the database question, 50% chance to generate conversation topic
      const shouldAskDatabaseQuestion = Math.random() < 0.5
      console.log('🎲 QUESTION TYPE DECISION:')
      console.log('  Should ask database question:', shouldAskDatabaseQuestion)
      console.log(
        '  Decision: ',
        shouldAskDatabaseQuestion
          ? 'STRUCTURED PROFILE QUESTION'
          : 'CONVERSATION TOPIC'
      )

      if (shouldAskDatabaseQuestion) {
        console.log('✅ USING STRUCTURED QUESTION FROM DATABASE')
        return await this.formatContinuousQuestion(
          selectedQuestion.text,
          'profile'
        )
      }
    } else {
      console.log('📭 NO UNANSWERED QUESTIONS AVAILABLE')
    }

    // Generate conversation topic from existing profile data
    console.log('💭 GENERATING CONVERSATION TOPIC FROM PROFILE DATA')
    return await this.generateProfileBasedTopic(userProfile)
  }

  /**
   * Generate a conversation topic based on existing user profile data
   */
  private async generateProfileBasedTopic(userProfile?: any): Promise<string> {
    console.log('🎨 PROFILE-BASED TOPIC GENERATION START:')
    console.log('  Profile data available:', !!userProfile)

    // Extract existing profile information
    const profileTags: string[] = []
    const interests: string[] = []
    const preferences: string[] = []

    if (userProfile) {
      // Collect tags from various profile sections
      if (userProfile.datingProfile?.physicalPreferences) {
        Object.values(userProfile.datingProfile.physicalPreferences).forEach(
          (value: any) => {
            if (typeof value === 'string') profileTags.push(value)
            if (Array.isArray(value)) profileTags.push(...value)
          }
        )
      }

      if (userProfile.datingProfile?.servicePreferences) {
        Object.values(userProfile.datingProfile.servicePreferences).forEach(
          (value: any) => {
            if (typeof value === 'string') interests.push(value)
            if (Array.isArray(value)) interests.push(...value)
          }
        )
      }

      if (userProfile.profileData?.preferences) {
        Object.values(userProfile.profileData.preferences).forEach(
          (value: any) => {
            if (typeof value === 'string') preferences.push(value)
            if (Array.isArray(value)) preferences.push(...value)
          }
        )
      }
    }

    console.log('📊 PROFILE DATA EXTRACTION:')
    console.log(
      '  Physical preference tags:',
      profileTags.length,
      profileTags.length > 0 ? profileTags.slice(0, 3) : 'none'
    )
    console.log(
      '  Service interests:',
      interests.length,
      interests.length > 0 ? interests.slice(0, 3) : 'none'
    )
    console.log(
      '  General preferences:',
      preferences.length,
      preferences.length > 0 ? preferences.slice(0, 3) : 'none'
    )

    // If we have profile data, generate topic from it
    if (
      profileTags.length > 0 ||
      interests.length > 0 ||
      preferences.length > 0
    ) {
      const allTopics = [...profileTags, ...interests, ...preferences].filter(
        Boolean
      )
      const randomTopic =
        allTopics[Math.floor(Math.random() * allTopics.length)]

      console.log('🎯 TOPIC SELECTION FROM PROFILE:')
      console.log('  Total available topics:', allTopics.length)
      console.log('  All topics:', allTopics)
      console.log('  Selected topic:', randomTopic)
      console.log('  Topic type: PERSONALIZED CONVERSATION STARTER')

      const systemPrompt = `You are Emi, the chaotic-cute mama-san who loves getting to know her clients better.

CONTEXT: You're in continuous conversation mode and want to dive deeper into something the client has already shared about themselves.

TASK: Generate a natural follow-up question or conversation starter about "${randomTopic}" that feels like you're genuinely curious to know more about them.

STYLE:
- Keep it short and casual (2-3 sentences max)
- No emojis or special characters
- Sound genuinely interested, not like you're conducting an interview
- Make it feel like natural curiosity between friends
- You can reference that they mentioned this before

Examples of good topics:
- "you mentioned you like tall guys - what is it about height that attracts you?"
- "i remember you said you're into gaming - what kind of games get you really excited?"
- "you seem to prefer calm vibes - tell me about your ideal relaxing evening"

Make it conversational and engaging!`

      const userPrompt = `Generate a casual follow-up question about: "${randomTopic}"`

      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]
        const result = await callAI(messages)
        console.log('🌸 MamaSan - Generated profile-based topic:', result)
        return result
      } catch (error) {
        console.error('🌸 MamaSan - Error generating profile topic:', error)
        return `tell me more about ${randomTopic.toLowerCase()} - i'm curious what draws you to that`
      }
    }

    // Fallback to general conversation starters if no profile data
    console.log('🆕 NO PROFILE DATA AVAILABLE:')
    console.log('  Using general conversation starters')
    console.log('  Topic type: GENERAL CONVERSATION STARTER')
    const generalTopics = [
      'what kind of energy are you feeling today?',
      'what makes you feel most comfortable in new situations?',
      'what sort of conversation makes time fly by for you?',
      'what would make today feel perfect for you?',
      'what kind of vibe do you bring out in other people?',
    ]

    const selectedTopic =
      generalTopics[Math.floor(Math.random() * generalTopics.length)]
    return await this.formatContinuousQuestion(selectedTopic, 'interest')
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
    userResponse: string
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
        return await this.analyzeWithNewSystem(question, userResponse)
      }

      // Fallback to old system if no response processor
      console.log(
        '🌸 MamaSan - Using fallback analysis (no response processor)'
      )
      return await this.analyzeWithFallback(question, userResponse)
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
    userResponse: string
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
      const systemPrompt = this.getAnalysisSystemPrompt()
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
      return await this.analyzeWithFallback(question, userResponse)
    }
  }

  /**
   * Get the system prompt for analysis
   */
  private getAnalysisSystemPrompt(): string {
    if (this.config.personality === 'emi') {
      return `You are Emi, a modern-day mama-san helping match clients with hosts. 

Your job is to:
1. Determine if a user's response meaningfully answers a matchmaking question
2. Extract structured profile data that can be used to update their MatchProfile

Be GENEROUS in accepting answers - people express preferences in many different ways.

ACCEPT answers that:
- Express any preference, opinion, or personal detail
- Mention specific traits, activities, or characteristics they like/dislike
- Give examples or comparisons
- Share feelings, moods, or desires
- Provide ANY useful information for matchmaking

REJECT only if the response:
- Is completely off-topic or nonsensical
- Is just "I don't know" with no additional info
- Is obviously trying to avoid the question
- Contains no useful matchmaking information whatsoever

When extracting profile data, look for:
- Physical preferences (height, build, ethnicity, style, etc.)
- Personality traits they seek (confident, shy, funny, caring, etc.)
- Activity interests (gaming, anime, karaoke, sports, etc.)
- Mood preferences (energetic, calm, flirty, romantic, etc.)
- Conversation topics they enjoy
- Service preferences (teaching, companionship, entertainment, etc.)
- Age preferences or demographic info
- Relationship style preferences (casual, intimate, playful, etc.)

Remember: Even vague preferences are still preferences! A response like "someone fun" or "I like games" IS a valid answer for matchmaking.`
    }

    return `You are a skilled mama-san analyzing user responses for matchmaking purposes. Determine if responses contain useful preference information and extract structured data accordingly.`
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
    userResponse: string
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
