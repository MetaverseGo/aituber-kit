import { KokologyAnalyst } from './kokology-analyst'
import { PersonalityWriter } from './personality-writer'
import { PersonalityProfiler } from './personality-profiler'
import { MamaSanSpecialist } from './mama-san-specialist'
import { createResponseProcessor } from '@/lib/ai-response-processor'
import { ValidationError } from '@/lib/ai-validation'
import { recordQuestionAsked } from './profile-questions'
import {
  MatchmakingResult,
  MatchmakingConfig,
  MatchmakingSession,
  PersonalityCategory,
  MamaSanSessionState,
} from '@/types/matchmaking'

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

// Emi's analyzing messages (no AI inference required)
const ANALYZING_MESSAGES = [
  'give me a sec while I crunch all this data about you, also quick question: are you a boy or girl? just for the perfect match!',
  'analyzing your vibe right now, this is so fun! oh by the way are you a boy or girl? helps me pick the perfect personality pic',
  'your answers are amazing! processing, quick thing: boy or girl? need it for your custom results!',
  'running my secret personality algorithms, real quick: are you a boy or girl? want to make sure your results are perfect!',
  'analyzing your whole vibe, your brain is fascinating! oh and boy or girl? just for the aesthetic',
  'computing your personality profile, this is giving me SUCH good data! quick question: boy or girl? for your personalized image',
  'processing your answers through my ultra-advanced vibes detector, also are you a boy or girl? need it for the final touch!',
  'hold up let me decode all this personality data, you are so interesting! by the way boy or girl? makes your results even more perfect',
  'analyzing analyzing, your answers are literally perfect specimens, quick: boy or girl? for maximum customization!',
  'running diagnostics on your personality, this is so cool! oh also are you a boy or girl? helps with the visual vibes',
]

/**
 * Keywords and phrases that trigger specific modes
 */
const MODE_TRIGGERS = {
  kokology: [
    'personality analysis',
    'personality test',
    'kokology',
    'analyze my personality',
    "what's my personality",
    'personality type',
    'tell me about myself',
    'what am i like',
    'analyze me',
    'personality quiz',
    'who am i',
    'what type am i',
    'start matchmaking',
    'begin analysis',
    'personality discovery',
    'kokology analysis',
  ],
  profiling: [
    'help me find someone',
    'dating personality',
    'relationship type',
    'compatibility analysis',
    'what kind of partner',
  ],
  mamasan: [
    'recommend hosts',
    'find me a host',
    'host recommendations',
    'mama-san help',
    'match me with hosts',
  ],
}

const MAMASAN_START_TRIGGERS = [
  'start matchmaking',
  'begin analysis',
  'personality analysis',
  'kokology',
  'matchmaking',
  'analyze my personality',
  "what's my personality",
  'personality type',
  'help me find someone',
  'dating personality',
  'relationship type',
  'compatibility analysis',
  'what kind of partner',
]

function isMamaSanStartTrigger(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return MAMASAN_START_TRIGGERS.some((trigger) => lower.includes(trigger))
}

export class MatchmakingOrchestrator {
  private kokologyAnalyst: KokologyAnalyst
  private personalityWriter: PersonalityWriter
  private personalityProfiler: PersonalityProfiler
  private mamaSan: MamaSanSpecialist
  private config: MatchmakingConfig
  private userId: string

  // Core state management
  private isActive: boolean = false
  private currentSessionId: string | null = null
  private mode: 'mamasan' | 'kokology' | 'profiling' = 'mamasan'

  // Mode-specific state - will be initialized with state from MongoDB
  private mamaSanState: MamaSanSessionState
  private session: MatchmakingSession | null = null

  constructor(
    userId: string,
    config: MatchmakingConfig = {},
    initialMamaSanState?: MamaSanSessionState
  ) {
    console.log('[Orchestrator] Constructor called for userId:', userId)
    this.userId = userId
    this.config = {
      kokologyPersonality: 'emi',
      writerPersonality: 'emi',
      profilerPersonality: 'emi',
      questionCount: 1,
      ...config,
    }

    console.log('[Orchestrator] Initializing specialists...')

    this.kokologyAnalyst = new KokologyAnalyst({
      personality: this.config.kokologyPersonality!,
      questionCount: this.config.questionCount!,
    })

    this.personalityWriter = new PersonalityWriter({
      personality: this.config.writerPersonality!,
      perspective: 'first-person',
    })

    this.personalityProfiler = new PersonalityProfiler({
      personality: this.config.profilerPersonality!,
    })

    this.mamaSan = new MamaSanSpecialist({
      personality: 'emi',
      questionCount: this.config.questionCount,
      userId: userId,
    })

    // Initialize MamaSan state from provided parameter or default
    this.mamaSanState = initialMamaSanState || {
      currentQuestion: 0,
      answers: [],
      isComplete: false,
    }
    console.log('[Orchestrator] Initial mamaSanState:', this.mamaSanState)
  }

  /**
   * Check if orchestrator is currently active
   */
  isActiveSession(): boolean {
    return this.isActive
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  /**
   * Get current mode
   */
  getCurrentMode(): 'mamasan' | 'kokology' | 'profiling' {
    return this.mode
  }

  /**
   * Process kokology mode
   */
  private async processKokologyMode(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    // Initialize session if needed
    if (!this.session) {
      this.session = this.createNewSession(sessionId)
    }

    // Handle based on current status
    switch (this.session.status) {
      case 'idle':
        return await this.startKokologyAnalysis(this.session, message)
      case 'kokology_analysis':
        return await this.handleKokologyResponse(this.session, message)
      case 'personality_summary':
        return await this.generatePersonalitySummary(this.session)
      case 'awaiting_gender':
        return await this.handleGenderResponse(this.session, message)
      case 'personality_profiling':
        return await this.profilePersonality(this.session)
      case 'completed':
        // Session already completed
        this.isActive = false
        this.currentSessionId = null
        return {
          message:
            'Your personality analysis is already complete! Would you like to start a new analysis?',
          isComplete: true,
          step: 'already_completed',
        }
      default:
        return await this.handleError(this.session, 'Unknown session status')
    }
  }

  /**
   * Process profiling mode
   */
  private async processProfilingMode(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    // For now, redirect to kokology mode
    this.mode = 'kokology'
    return await this.processKokologyMode(message, sessionId)
  }

  /**
   * Force stop current session and reset state
   */
  resetSession(): void {
    this.isActive = false
    this.currentSessionId = null
    this.mode = 'mamasan'
    this.mamaSanState = { currentQuestion: 0, answers: [], isComplete: false }
    this.session = null

    // State is now managed via MongoDB, no localStorage to clear
    console.log(
      '[MamaSan] Session reset in memory, MongoDB state will be updated via API'
    )
  }

  /**
   * Set specific mode (for external control)
   */
  setMode(mode: 'mamasan' | 'kokology' | 'profiling') {
    this.mode = mode
  }

  private createNewSession(sessionId: string): MatchmakingSession {
    const session: MatchmakingSession = {
      sessionId,
      status: 'idle',
      step: 0,
      missingFields: [],
      kokologyQuestions: [],
    }

    this.saveSession(session)
    return session
  }

  private async startKokologyAnalysis(
    session: MatchmakingSession,
    message: string
  ): Promise<MatchmakingResult> {
    try {
      console.log(
        '🎭 Orchestrator - Starting kokology analysis with message:',
        message
      )

      // Update status to kokology analysis
      session.status = 'kokology_analysis'
      session.step = 1

      const currentQuestionNumber = (session.kokologyQuestions?.length || 0) + 1
      console.log(
        '🎭 Orchestrator - Calling kokology analyst for question',
        currentQuestionNumber
      )
      const result = await this.kokologyAnalyst.askQuestion(
        currentQuestionNumber,
        session.kokologyQuestions || [],
        message
      )
      console.log(
        '🎭 Orchestrator - Received result from kokology analyst:',
        result
      )

      // Store the first question in the array
      session.kokologyQuestions = [
        {
          id: 1,
          question: result.question,
          timestamp: new Date(),
        },
      ]

      this.saveSession(session)

      return {
        message: result.question,
        isComplete: false,
        step: 'kokology_question_1',
        data: {
          stepProgress: {
            current: 1,
            total: this.config.questionCount!,
            label: `Question 1 of ${this.config.questionCount}`,
            phase: 'questions',
          },
        },
      }
    } catch (error) {
      console.error('Error in startKokologyAnalysis:', error)
      // Don't reset status or throw - handle gracefully
      return await this.handleError(
        session,
        `Error starting analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async handleKokologyResponse(
    session: MatchmakingSession,
    message: string
  ): Promise<MatchmakingResult> {
    try {
      const currentStep = session.step || 1
      const questions = session.kokologyQuestions || []

      // Store the answer to the current question
      const currentQuestionIndex = currentStep - 1
      if (currentQuestionIndex >= 0) {
        if (questions[currentQuestionIndex]) {
          // Update existing question with answer
          questions[currentQuestionIndex].answer = message
          questions[currentQuestionIndex].timestamp = new Date()
        } else {
          // This shouldn't happen, but if it does, create the question entry
          console.warn(
            `Missing question at step ${currentStep}, creating entry`
          )
          questions[currentQuestionIndex] = {
            id: currentStep,
            question: 'Previous question', // This is a fallback
            answer: message,
            timestamp: new Date(),
          }
        }
      }

      // Generate next question or complete analysis
      const nextStep = currentStep + 1
      console.log(
        '🎭 Orchestrator - Asking for question',
        nextStep,
        'current questions:',
        questions.length
      )
      console.log(
        '🎭 Orchestrator - Questions array being passed to AI:',
        JSON.stringify(questions, null, 2)
      )
      console.log('🎭 Orchestrator - Current user response:', message)
      const result = await this.kokologyAnalyst.askQuestion(
        nextStep,
        questions,
        message
      )
      console.log('🎭 Orchestrator - Question result:', result)

      if (result.isComplete) {
        console.log('🎭 Orchestrator - Analysis complete, moving to summary')
        // Store final answers and update status
        session.kokologyQuestions = questions
        session.status = 'personality_summary'
        this.saveSession(session)

        // Generate personality summary immediately
        return await this.generatePersonalitySummary(session)
      } else {
        // Add new question to the array
        questions.push({
          id: nextStep,
          question: result.question,
          timestamp: new Date(),
        })

        session.step = nextStep
        session.kokologyQuestions = questions
        this.saveSession(session)

        const orchestratorResult = {
          message: result.question,
          isComplete: false,
          step: `kokology_question_${nextStep}`,
          data: {
            stepProgress: {
              current: nextStep,
              total: this.config.questionCount!,
              label: `Question ${nextStep} of ${this.config.questionCount}`,
              phase: 'questions' as const,
            },
          },
        }
        console.log(
          '🎭 Orchestrator - Returning question result with step progress:',
          orchestratorResult
        )
        return orchestratorResult
      }
    } catch (error) {
      console.error('Error in handleKokologyResponse:', error)
      return await this.handleError(
        session,
        `Error processing your answer: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async generatePersonalitySummary(
    session: MatchmakingSession
  ): Promise<MatchmakingResult> {
    try {
      const questions = session.kokologyQuestions || []

      // Validate we have enough questions completed
      if (questions.length < this.config.questionCount!) {
        console.log(
          `Not enough questions completed: ${questions.length}/${this.config.questionCount}`
        )
        return await this.handleError(
          session,
          'Insufficient kokology data - continuing analysis'
        )
      }

      // Generate insights from kokology responses
      const insights = await this.kokologyAnalyst.generateInsights(questions)

      // Skip personality writer step - go directly to awaiting gender
      session.status = 'awaiting_gender'
      this.saveSession(session)

      // Pick random analyzing message and ask for gender
      const randomMessage =
        ANALYZING_MESSAGES[
          Math.floor(Math.random() * ANALYZING_MESSAGES.length)
        ]

      return {
        message: randomMessage,
        isComplete: false,
        step: 'awaiting_gender',
        data: {
          expectingGender: true,
          showGenderButtons: true,
          disableTextInput: true,
          stepProgress: {
            current: this.config.questionCount!,
            total: this.config.questionCount!,
            label: 'Analyzing responses...',
            phase: 'analyzing',
          },
        },
      }
    } catch (error) {
      console.error('Error generating personality summary:', error)

      // Don't reset to idle - keep progress and try to continue
      session.status = 'personality_summary'
      this.saveSession(session)

      return {
        message:
          "I'm having a moment processing your amazing answers! Let me try that again real quick...",
        isComplete: false,
        step: 'retrying_summary',
      }
    }
  }

  private async profilePersonality(
    session: MatchmakingSession
  ): Promise<MatchmakingResult> {
    try {
      const questions = session.kokologyQuestions || []
      if (questions.length < this.config.questionCount!) {
        throw new Error('Insufficient kokology questions for profiling')
      }

      // Generate insights from kokology responses
      const insights = await this.kokologyAnalyst.generateInsights(questions)

      // Create a simple summary from the questions for profiling
      const questionSummary = questions
        .map(
          (q, index) =>
            `Question ${index + 1}: ${q.question}\nAnswer: ${q.answer}`
        )
        .join('\n\n')

      // Profile the personality directly from questions and insights
      const profileResult = await this.personalityProfiler.profilePersonality(
        questionSummary,
        insights
      )

      // Modify imageUrl based on gender
      const gender = session.gender || 'female' // Default to female
      const baseImageUrl = profileResult.category.imageUrl
      // Map backend gender to frontend file naming
      const fileGender = gender === 'male' ? 'boy' : 'girl'
      // Convert the personality category ID to the correct filename format
      let categoryId = profileResult.category.id.replace('_', '-')
      // Special case for himbo_bimbo_babe which maps to bimbo files
      if (profileResult.category.id === 'himbo_bimbo_babe') {
        categoryId = 'bimbo'
      }
      const genderedImageUrl = `/images/personality-types/${categoryId}-${fileGender}.jpg`

      console.log('🎨 Orchestrator - Generated personality data:', {
        categoryId: profileResult.category.id,
        categoryName: profileResult.category.name,
        gender: gender,
        fileGender: fileGender,
        genderedImageUrl: genderedImageUrl,
      })

      // Store results and complete the process
      session.personalityCategory = profileResult.category.name
      session.status = 'completed'
      this.saveSession(session)

      // Mark orchestrator as inactive
      this.isActive = false
      this.currentSessionId = null

      const resultData = {
        message: `Your personality analysis is complete! You are: **${
          profileResult.category.name
        }** ${
          profileResult.category.description
        } Here's what makes you special in relationships: ${profileResult.strengthsForMatching.join(
          ', '
        )}. I'm sending you your personality image right now!`,
        isComplete: true,
        step: 'completed',
        data: {
          personalityCategory: profileResult.category.name,
          personalityImageUrl: genderedImageUrl,
          profile: {
            category: profileResult.category,
            confidence: profileResult.confidence,
            traits: profileResult.secondaryTraits,
            strengths: profileResult.strengthsForMatching,
            role:
              profileResult.recommendedRole === 'either'
                ? 'guest'
                : profileResult.recommendedRole,
          },
          stepProgress: {
            current: this.config.questionCount!,
            total: this.config.questionCount!,
            label: 'Analysis complete!',
            phase: 'completed' as const,
          },
        },
      }

      console.log('🎨 Orchestrator - Returning complete result:', resultData)
      return resultData
    } catch (error) {
      console.error('Error profiling personality:', error)
      return await this.handleError(session, 'Failed to profile personality')
    }
  }

  private async handleGenderResponse(
    session: MatchmakingSession,
    message: string
  ): Promise<MatchmakingResult> {
    try {
      // Parse gender from message (simple keyword matching)
      const lowerMessage = message.toLowerCase().trim()
      let gender: 'female' | 'male' = 'female' // Default to female

      if (
        lowerMessage.includes('boy') ||
        lowerMessage.includes('male') ||
        lowerMessage.includes('man') ||
        lowerMessage.includes('guy')
      ) {
        gender = 'male'
      } else if (
        lowerMessage.includes('girl') ||
        lowerMessage.includes('female') ||
        lowerMessage.includes('woman') ||
        lowerMessage.includes('gal')
      ) {
        gender = 'female'
      }

      // Save gender response
      session.gender = gender
      session.status = 'personality_profiling'
      this.saveSession(session)

      // Directly proceed to personality profiling instead of just acknowledging
      return await this.profilePersonality(session)
    } catch (error) {
      console.error('Error handling gender response:', error)
      // Continue without gender if there's an error - proceed to profiling anyway
      session.status = 'personality_profiling'
      this.saveSession(session)
      return await this.profilePersonality(session)
    }
  }

  private async startBackgroundProfiling(sessionId: string): Promise<void> {
    try {
      // Wait a bit to let user potentially provide gender
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Get latest session state
      const session = this.getSession()

      if (!session || session.sessionId !== sessionId) {
        console.log(
          'Session not found or changed, skipping background profiling'
        )
        return
      }

      if (session.status !== 'awaiting_gender') {
        console.log('Status changed, skipping background profiling')
        return
      }

      // Run profiler and update session
      const profileResult = await this.profilePersonality(session)

      // Note: In the original, this would send to Firebase
      // In aituber-kit, we could potentially trigger a UI update
      // or add the result to the chat log automatically
      console.log('Background profiling completed:', profileResult)
    } catch (error) {
      console.error('Error in background profiling:', error)
    }
  }

  private async handleError(
    session: MatchmakingSession,
    errorMessage: string
  ): Promise<MatchmakingResult> {
    console.error('Matchmaking error:', errorMessage)

    // Don't reset if we have kokology questions completed
    const questions = session.kokologyQuestions || []
    const hasCompletedQuestions = questions.length >= this.config.questionCount!

    if (hasCompletedQuestions) {
      // If we have completed questions, try to continue from personality summary
      session.status = 'personality_summary'
      session.step = this.config.questionCount!
      this.saveSession(session)

      return {
        message:
          "I encountered a small hiccup! But don't worry - I saved your answers. Let me continue analyzing your personality...",
        isComplete: false,
        step: 'recovering_from_error',
      }
    } else {
      // Only reset to idle if we haven't made progress
      session.status = 'idle'
      session.step = 0
      this.saveSession(session)

      return {
        message:
          "I encountered an issue, but don't worry! Let's start fresh. Would you like to begin your personality analysis?",
        isComplete: false,
        step: 'error_reset',
      }
    }
  }

  private getPersonalityImageUrl(
    categoryName: string,
    gender?: 'female' | 'male'
  ): string {
    const category = this.personalityProfiler
      .getAllCategories()
      .find((cat) => cat.name === categoryName)

    if (!category) {
      return '/images/personality-types/default.jpg'
    }

    // Default to female if no gender specified, then map to file naming
    const backendGender = gender || 'female'
    const fileGender = backendGender === 'male' ? 'boy' : 'girl'
    // Convert the personality category ID to the correct filename format
    let categoryId = category.id.replace('_', '-')
    // Special case for himbo_bimbo_babe which maps to bimbo files
    if (category.id === 'himbo_bimbo_babe') {
      categoryId = 'bimbo'
    }
    return `/images/personality-types/${categoryId}-${fileGender}.jpg`
  }

  private getPublicProfileData(session: MatchmakingSession) {
    return {
      uid: session.sessionId || 'unknown',
      role: 'guest' as const,
      personalityCategory: session.personalityCategory,
      completedAnalysis: session.status === 'completed',
    }
  }

  // Session management methods - now using in-memory session only
  // MongoDB persistence is handled by the API endpoint that calls this orchestrator
  private getSession(): MatchmakingSession | null {
    return this.session
  }

  private saveSession(session: MatchmakingSession): void {
    this.session = session
    console.log(
      '[Orchestrator] Session updated in memory, will be persisted via API'
    )
  }

  // Helper methods for external access
  getUserSession(): MatchmakingSession | null {
    return this.session || this.getSession()
  }

  resetUserSession(): void {
    this.resetSession()
  }

  getPersonalityCategories(): PersonalityCategory[] {
    return this.personalityProfiler.getAllCategories()
  }

  // Get current MamaSan state (for external access)
  getCurrentMamaSanState(): MamaSanSessionState {
    return this.mamaSanState
  }

  // Update MamaSan state (for external updates from MongoDB)
  updateMamaSanState(newState: MamaSanSessionState): void {
    this.mamaSanState = newState
    console.log('[Orchestrator] MamaSan state updated from external source')
  }

  // Helper: Create search recommendation
  private createSearchRecommendation(searchQuery?: string) {
    return {
      id: 'search-content',
      title: `Find ${searchQuery || 'content'}`,
      description: 'Search for related content',
      action: 'custom',
      data: {
        actionType: 'search',
        searchQuery: searchQuery || 'content',
      },
      priority: 100,
      isVisible: true,
      icon: '🔍',
    }
  }

  // Helper: Convert suggestions to recommendation format
  private createResponseRecommendations(suggestions: string[]) {
    return suggestions.map((suggestion, index) => ({
      id: `response-${index + 1}`,
      title: suggestion,
      description: '',
      action: 'send_message',
      data: {
        message: suggestion,
        messageType: 'suggestion',
      },
      priority: 10 - index,
      isVisible: true,
      icon: '💬',
    }))
  }

  // Helper: Combine search + response recommendations
  private createCombinedRecommendations(
    suggestions: string[],
    searchQuery?: string
  ) {
    const searchRecommendation = this.createSearchRecommendation(searchQuery)
    const responseRecommendations =
      this.createResponseRecommendations(suggestions)
    return [searchRecommendation, ...responseRecommendations]
  }

  // Helper: Map AI analysis to MongoDB profile updates
  private mapProfileUpdates(profileUpdates: any): any {
    const updates: any = {}

    if (!profileUpdates) return updates

    if (profileUpdates.physicalPreferences) {
      updates['datingProfile.physicalPreferences'] =
        profileUpdates.physicalPreferences
    }

    if (profileUpdates.personality) {
      if (profileUpdates.personality.energyLevel) {
        updates['datingProfile.servicePreferences.mood'] =
          profileUpdates.personality.energyLevel
      }
      if (profileUpdates.personality.dominanceStyle) {
        updates['datingProfile.dominanceStyle'] =
          profileUpdates.personality.dominanceStyle
      }
      if (profileUpdates.personality.seekingTraits) {
        updates['profileData.preferences.matchingPrefs.personalityTraits'] =
          profileUpdates.personality.seekingTraits
      }
    }

    if (profileUpdates.interests) {
      if (profileUpdates.interests.categories) {
        updates['datingProfile.servicePreferences.primaryServices'] =
          profileUpdates.interests.categories
      }
      if (profileUpdates.interests.specificItems) {
        updates['datingProfile.servicePreferences.conversationTopics'] =
          profileUpdates.interests.specificItems
      }
    }

    if (profileUpdates.preferences) {
      if (profileUpdates.preferences.moodSeeking) {
        updates['datingProfile.servicePreferences.mood'] =
          profileUpdates.preferences.moodSeeking
      }
      if (profileUpdates.preferences.interactionStyle) {
        updates['datingProfile.servicePreferences.interactionStyle'] =
          profileUpdates.preferences.interactionStyle
      }
      if (profileUpdates.preferences.serviceTypes) {
        updates['datingProfile.servicePreferences.primaryServices'] =
          profileUpdates.preferences.serviceTypes
      }
      if (profileUpdates.preferences.conversationTopics) {
        updates['datingProfile.servicePreferences.conversationTopics'] =
          profileUpdates.preferences.conversationTopics
      }
    }

    if (profileUpdates.demographics) {
      if (profileUpdates.demographics.agePreference) {
        updates['datingProfile.demographics.agePreference.preference'] =
          profileUpdates.demographics.agePreference
      }
      if (profileUpdates.demographics.experienceLevel) {
        updates['datingProfile.demographics.experienceLevel'] =
          profileUpdates.demographics.experienceLevel
      }
    }

    return updates
  }

  // Helper: Fetch user profile from MongoDB
  private async fetchUserProfile(): Promise<any | null> {
    try {
      const { connectMongoDB, MatchProfile } = await getMongoDBDependencies()
      await connectMongoDB()

      const profile = await MatchProfile.findOne({ uid: this.userId })
      if (profile) {
        const userProfile = profile.toObject()
        console.log('🎯 SERVER: Fetched user profile:', {
          uid: this.userId,
          hasProfile: !!userProfile,
          profileKeys: userProfile ? Object.keys(userProfile) : [],
        })
        return userProfile
      } else {
        console.log('🎯 SERVER: No user profile found for UID:', this.userId)
        return null
      }
    } catch (error) {
      console.error('🎯 SERVER: Error fetching user profile:', error)
      return null
    }
  }

  // Helper: Analyze response and extract profile updates
  private async analyzeResponseAndExtractUpdates(
    question: string,
    message: string
  ): Promise<any> {
    try {
      const analysis = await this.mamaSan.analyzeResponse(question, message)
      return this.mapProfileUpdates(analysis.profileUpdates)
    } catch (error) {
      console.error('🚨 Error analyzing response for profile updates:', error)
      return {}
    }
  }

  // Server-friendly, stateless version for API usage
  async processMamaSanModeServer(
    message: string,
    mamasanState: MamaSanSessionState
  ): Promise<{
    message: string
    isComplete: boolean
    step: string
    updatedState: MamaSanSessionState
    profileUpdates: any
    data?: any
  }> {
    console.log('🎯 SERVER: Processing MamaSan mode server:')
    // Check if this should be handled as a greeting instead of a question response
    if (this.mamaSan.shouldHandleAsGreeting(message, mamasanState)) {
      const greetingResult = this.mamaSan.handleGreeting(message, mamasanState)

      return {
        message: greetingResult.message,
        isComplete: false,
        step: 'mamasan_greeting',
        updatedState: greetingResult.updatedState,
        profileUpdates: {},
      }
    }

    // Only treat as a new session if the message is a start trigger
    const isNewSession =
      mamasanState.currentQuestion === 0 &&
      mamasanState.answers.length === 0 &&
      isMamaSanStartTrigger(message)

    if (isNewSession) {
      // Simplify: Send intro + first question in one message
      const intro = this.mamaSan.getIntro()
      const firstQ = this.mamaSan.getCurrentQuestion(mamasanState)

      console.log('🎯 New session detected:', {
        currentQuestion: mamasanState.currentQuestion,
        answersLength: mamasanState.answers.length,
        intro: intro.substring(0, 50),
        firstQ: firstQ.substring(0, 50),
      })

      // Fetch user profile to get onboardingChoice
      let onboardingChoice: string | undefined = undefined
      try {
        const userProfile = await this.fetchUserProfile()
        onboardingChoice = userProfile?.onboardingChoice
      } catch (e) {
        console.warn('Could not fetch user profile for onboardingChoice', e)
      }

      // Hard-coded recommendations based on onboardingChoice
      let recommendations: Array<any> = []
      if (onboardingChoice === 'anime') {
        recommendations = [
          {
            id: 'anime-1',
            title: 'Anime Cosplay Chat',
            description: 'Find a host who loves anime cosplay and roleplay.',
            action: 'search',
            data: { tag: 'anime cosplay' },
            priority: 100,
            isVisible: true,
            icon: '🎭',
          },
          {
            id: 'anime-2',
            title: 'Waifu Voice Calls',
            description: 'Connect with a host who can do cute anime voices.',
            action: 'search',
            data: { tag: 'anime voice' },
            priority: 95,
            isVisible: true,
            icon: '🎤',
          },
          {
            id: 'anime-3',
            title: 'Watch Anime Together',
            description: 'Join a host for a virtual anime watch party.',
            action: 'search',
            data: { tag: 'anime watch party' },
            priority: 90,
            isVisible: true,
            icon: '📺',
          },
        ]
      } else if (onboardingChoice === 'boy') {
        recommendations = [
          {
            id: 'boy-1',
            title: 'Chill with a Bro',
            description: 'Find a laid-back male host for games or chat.',
            action: 'search',
            data: { tag: 'male host' },
            priority: 100,
            isVisible: true,
            icon: '🧑',
          },
          {
            id: 'boy-2',
            title: 'Gaming with Guys',
            description: 'Join a multiplayer game session with a male creator.',
            action: 'search',
            data: { tag: 'gaming boys' },
            priority: 95,
            isVisible: true,
            icon: '🎮',
          },
          {
            id: 'boy-3',
            title: 'Ask for Advice',
            description: 'Get a male perspective on life, dating, or anything.',
            action: 'search',
            data: { tag: 'advice boys' },
            priority: 90,
            isVisible: true,
            icon: '💬',
          },
        ]
      } else if (onboardingChoice === 'girl') {
        recommendations = [
          {
            id: 'girl-1',
            title: 'Girl Talk',
            description: 'Chat with a female host about anything you like.',
            action: 'search',
            data: { tag: 'female host' },
            priority: 100,
            isVisible: true,
            icon: '👩',
          },
          {
            id: 'girl-2',
            title: 'Makeup & Fashion',
            description: 'Get tips or do a virtual makeover with a creator.',
            action: 'search',
            data: { tag: 'makeup fashion' },
            priority: 95,
            isVisible: true,
            icon: '💄',
          },
          {
            id: 'girl-3',
            title: 'Karaoke Party',
            description: 'Sing your heart out with a fun female host.',
            action: 'search',
            data: { tag: 'karaoke girls' },
            priority: 90,
            isVisible: true,
            icon: '🎤',
          },
        ]
      } else {
        // Default: don't know gender/content preference
        recommendations = [
          {
            id: 'default-1',
            title: 'Surprise Me!',
            description: 'Let Emi pick a fun host for you based on your mood.',
            action: 'search',
            data: { tag: 'surprise' },
            priority: 100,
            isVisible: true,
            icon: '✨',
          },
          {
            id: 'default-2',
            title: 'Browse All Creators',
            description: 'See everyone available right now and pick your vibe.',
            action: 'search',
            data: { tag: 'all creators' },
            priority: 95,
            isVisible: true,
            icon: '🌐',
          },
          {
            id: 'default-3',
            title: 'Tell Me What You Like',
            description: 'Share your interests and Emi will recommend someone.',
            action: 'input',
            data: {},
            priority: 90,
            isVisible: true,
            icon: '📝',
          },
        ]
      }

      return {
        message: intro + ' ' + firstQ,
        isComplete: false,
        step: 'mamasan_0',
        updatedState: {
          currentQuestion: 0,
          answers: [],
          isComplete: false,
        },
        profileUpdates: {},
        data: {
          recommendations,
        },
      }
    }

    // Check if onboarding is already complete BEFORE analyzing response
    if (this.mamaSan.isOnboardingComplete(mamasanState)) {
      // STILL ANALYZE THE RESPONSE for profile updates in continuous mode!
      const previousQuestion =
        mamasanState.topicConversation?.lastQuestion ||
        'What are your interests, preferences, or thoughts?'

      const profileUpdates = await this.analyzeResponseAndExtractUpdates(
        previousQuestion,
        message
      )

      const userProfile = await this.fetchUserProfile()

      // Generate continuous question for existing continuous session
      const {
        message: continuousQuestion,
        suggestions,
        searchQuery,
        emotion,
      } = await this.mamaSan.generateContinuousQuestion(
        userProfile,
        mamasanState,
        message
      )

      const recommendations = this.createCombinedRecommendations(
        suggestions,
        searchQuery
      )

      console.log('🎭 ORCHESTRATOR - Early continuous path emotion:', {
        emotion: emotion,
        emotionType: typeof emotion,
        hasEmotion: !!emotion,
        fullDataObject: {
          emotion,
          mode: 'continuous',
          onboardingComplete: true,
        },
      })

      return {
        message: continuousQuestion,
        isComplete: false, // Keep session active for continuous mode
        step: 'mamasan_continuous',
        updatedState: mamasanState, // Don't increment question count in continuous mode
        profileUpdates, // Now includes actual profile updates from analysis!
        data: {
          mamasan: {
            searchQuery: this.mamaSan.buildSearchQuery(mamasanState),
            answers: mamasanState.answers,
          },
          mode: 'continuous',
          onboardingComplete: true,
          topicConversation: mamasanState.topicConversation,
          recommendations: recommendations,
          emotion: emotion,
        },
      }
    }

    // Analyze user response to current question (onboarding mode only)
    const question = this.mamaSan.getCurrentQuestion(mamasanState)
    const analysis = await this.mamaSan.analyzeResponse(question, message)

    // if (!analysis.answered) {
    //   // User didn't really answer the question, ask again with guidance
    //   const transitionResponse = await this.mamaSan.getResponseWithTransition(
    //     mamasanState,
    //     message
    //   )

    //   console.log('🎭 ORCHESTRATOR - Not answered path emotion:', {
    //     emotion: 'neutral',
    //     emotionType: 'string',
    //     reason: 'User did not answer properly',
    //   })

    //   return {
    //     message: transitionResponse,
    //     isComplete: false,
    //     step: `mamasan_${mamasanState.currentQuestion}`,
    //     updatedState: { ...mamasanState },
    //     profileUpdates: {},
    //     data: {
    //       emotion: 'neutral',
    //     },
    //   }
    // }

    // Save answer and move to next question
    const newAnswers = [...mamasanState.answers]
    newAnswers[mamasanState.currentQuestion] = message
    const nextQuestion = mamasanState.currentQuestion + 1
    const updatedState: MamaSanSessionState = {
      ...mamasanState,
      answers: newAnswers,
      currentQuestion: nextQuestion,
    }

    // Prepare profile updates from AI analysis
    const profileUpdates = this.mapProfileUpdates(analysis.profileUpdates)

    // Check if onboarding is complete (use configured question count)
    if (!this.mamaSan.isOnboardingComplete(updatedState)) {
      // Still in onboarding mode - generate recommendations for this branch only
      const currentQ = this.mamaSan.getCurrentQuestion(updatedState)
      const recommendations = await this.mamaSan.getRecommendations(
        updatedState,
        currentQ
      )

      const transitionResponse = await this.mamaSan.getResponseWithTransition(
        mamasanState, // Use the previous state to get current question
        message
      )

      // For onboarding mode, use default emotion (since getResponseWithTransition returns string)
      const emotion = 'neutral' // Default emotion for onboarding

      console.log('🎭 ORCHESTRATOR - Onboarding path emotion:', {
        emotion: emotion,
        emotionType: typeof emotion,
        transitionResponseType: typeof transitionResponse,
      })

      return {
        message: transitionResponse,
        isComplete: false,
        step: `mamasan_${updatedState.currentQuestion}`,
        updatedState,
        profileUpdates,
        data: {
          recommendations: recommendations,
          emotion: emotion,
        },
      }
    } else {
      // Onboarding complete, enter continuous mode
      const userProfile = await this.fetchUserProfile()

      // Generate continuous question instead of completing
      const {
        message: continuousMessage,
        suggestions,
        searchQuery,
        emotion,
      } = await this.mamaSan.generateContinuousQuestion(
        userProfile,
        updatedState,
        message // Pass user's last answer for context
      )

      console.log('🎭 ORCHESTRATOR - Emotion received from MamaSan:', {
        emotion: emotion,
        emotionType: typeof emotion,
        hasEmotion: !!emotion,
      })

      const recommendations = this.createCombinedRecommendations(
        suggestions,
        searchQuery
      )

      const finalUpdatedState = {
        ...updatedState,
        isComplete: false, // Ensure session stays active
      }

      console.log('🎭 ORCHESTRATOR - Returning data with emotion:', {
        emotion: emotion,
        dataEmotion: emotion,
        fullDataObject: {
          emotion,
          mode: 'continuous',
          onboardingComplete: true,
        },
        returnObject: {
          mamasan: {
            searchQuery: this.mamaSan.buildSearchQuery(finalUpdatedState),
            answers: finalUpdatedState.answers,
          },
          mode: 'continuous',
          onboardingComplete: true,
          topicConversation: finalUpdatedState.topicConversation,
          recommendations: recommendations,
          emotion,
        },
      })

      return {
        message: continuousMessage,
        isComplete: false, // Keep session active for continuous mode
        step: 'mamasan_continuous',
        updatedState: finalUpdatedState,
        profileUpdates,
        data: {
          mamasan: {
            searchQuery: this.mamaSan.buildSearchQuery(finalUpdatedState),
            answers: finalUpdatedState.answers,
          },
          mode: 'continuous',
          onboardingComplete: true,
          topicConversation: finalUpdatedState.topicConversation,
          recommendations: recommendations,
          emotion,
        },
      }
    }
  }
}
