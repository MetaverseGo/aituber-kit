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
  private sessionKey: string
  private userId: string

  // Core state management
  private isActive: boolean = false
  private currentSessionId: string | null = null
  private mode: 'mamasan' | 'kokology' | 'profiling' = 'mamasan'

  // Mode-specific state
  private mamaSanState: MamaSanSessionState
  private session: MatchmakingSession | null = null

  constructor(userId: string, config: MatchmakingConfig = {}) {
    console.log('[Orchestrator] Constructor called for userId:', userId)
    this.userId = userId
    this.config = {
      kokologyPersonality: 'emi',
      writerPersonality: 'emi',
      profilerPersonality: 'emi',
      questionCount: 5,
      ...config,
    }

    this.sessionKey = `matchmaking_session_${userId}`
    console.log('[Orchestrator] Session key:', this.sessionKey)

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

    // Initialize MamaSan state
    this.mamaSanState = { currentQuestion: 0, answers: [], isComplete: false }
    console.log('[Orchestrator] Initial mamaSanState:', this.mamaSanState)
    // Only restore from localStorage in the browser
    if (typeof window !== 'undefined') {
      this.restoreMamaSanState()
      console.log(
        '[Orchestrator] mamaSanState after restoration:',
        this.mamaSanState
      )
    }
  }

  /**
   * Determine user intent and activate appropriate mode
   */
  private determineIntent(
    message: string
  ): 'mamasan' | 'kokology' | 'profiling' | null {
    const lowerMessage = message.toLowerCase().trim()

    // Check for kokology triggers
    if (
      MODE_TRIGGERS.kokology.some((trigger) =>
        lowerMessage.includes(trigger.toLowerCase())
      )
    ) {
      return 'kokology'
    }

    // Check for profiling triggers
    if (
      MODE_TRIGGERS.profiling.some((trigger) =>
        lowerMessage.includes(trigger.toLowerCase())
      )
    ) {
      return 'profiling'
    }

    // Check for mama-san triggers
    if (
      MODE_TRIGGERS.mamasan.some((trigger) =>
        lowerMessage.includes(trigger.toLowerCase())
      )
    ) {
      return 'mamasan'
    }

    // Default to mama-san for general conversation
    return 'mamasan'
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
   * Main processing method - handles all conversational flow and state management
   */
  async processMessage(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    console.log('[Orchestrator] processMessage called:', {
      message,
      sessionId,
      isActive: this.isActive,
      currentSessionId: this.currentSessionId,
      mode: this.mode,
    })

    // If not active, activate and determine intent
    if (!this.isActive) {
      this.isActive = true
      this.currentSessionId = sessionId

      // Restore MamaSan state when activating
      if (this.mode === 'mamasan') {
        this.restoreMamaSanState()
      }

      // Determine intent from message
      const intent = this.determineIntent(message)
      if (intent) {
        this.mode = intent
        // If mode changed to mamasan, restore state
        if (this.mode === 'mamasan') {
          this.restoreMamaSanState()
        }
      }

      console.log('[Orchestrator] Activated with mode:', this.mode)
    }

    // For MamaSan mode, we don't need strict session ID matching
    // because MamaSan conversations can span multiple sessions
    if (this.mode === 'mamasan') {
      // Update current session ID for MamaSan mode
      this.currentSessionId = sessionId
      console.log(
        '[Orchestrator] Updated sessionId for MamaSan mode:',
        sessionId
      )
    } else {
      // For kokology/profiling modes, validate session continuity strictly
      if (this.currentSessionId !== sessionId) {
        console.log('[Orchestrator] Session mismatch, resetting')
        this.resetSession()
        this.isActive = true
        this.currentSessionId = sessionId

        // Re-determine intent for new session
        const intent = this.determineIntent(message)
        if (intent) {
          this.mode = intent
        }
      }
    }

    // Process based on current mode
    switch (this.mode) {
      case 'mamasan':
        return await this.processMamaSanMode(message, sessionId)
      case 'kokology':
        return await this.processKokologyMode(message, sessionId)
      case 'profiling':
        return await this.processProfilingMode(message, sessionId)
      default:
        return {
          message:
            "I need to determine what you want to do. Please tell me what you're looking for!",
          isComplete: false,
          step: 'intent_unclear',
        }
    }
  }

  /**
   * Process mama-san mode (default conversational flow)
   */
  private async processMamaSanMode(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    console.log('🎭 Orchestrator - processMamaSanMode START')
    console.log('🎭 Orchestrator - Message:', message)
    console.log('🎭 Orchestrator - SessionId:', sessionId)

    try {
      // Always restore the latest MamaSan state from localStorage to ensure correct progression
      console.log('🎭 Orchestrator - Restoring MamaSan state...')
      this.restoreMamaSanState()
      console.log('🎭 Orchestrator - MamaSan state restored')

      console.log('[MamaSan] Processing message:', { message, sessionId })
      console.log('[MamaSan] Current state before processing:', {
        currentQuestion: this.mamaSanState.currentQuestion,
        answersLength: this.mamaSanState.answers.length,
        isComplete: this.mamaSanState.isComplete,
        answers: this.mamaSanState.answers,
      })

      // Only treat as a new session if the message is a start trigger
      const isNewSession =
        this.mamaSanState.currentQuestion === 0 &&
        this.mamaSanState.answers.length === 0 &&
        isMamaSanStartTrigger(message)

      console.log('🎭 Orchestrator - Is new session:', isNewSession)

      // If session is just starting, greet and ask first question
      if (isNewSession) {
        console.log(
          '[MamaSan] Detected new session - currentQuestion=0, answers.length=0, and start trigger message'
        )
        this.mamaSanState.currentQuestion = 0
        this.mamaSanState.answers = []
        this.mamaSanState.isComplete = false

        console.log('🎭 Orchestrator - Saving initial MamaSan state...')
        // Save initial state
        this.saveMamaSanState()
        console.log('🎭 Orchestrator - Initial state saved')

        console.log('🎭 Orchestrator - Getting intro and first question...')
        const intro = this.mamaSan.getIntro()
        const firstQ = this.mamaSan.getCurrentQuestion(this.mamaSanState)
        console.log('[MamaSan] New session started. Greeting:', intro)
        console.log('[MamaSan] Asking first question:', firstQ)

        const result = {
          message: intro + '\n' + firstQ,
          isComplete: false,
          step: 'mamasan_0',
        }
        console.log('🎭 Orchestrator - Returning new session result:', result)
        return result
      }

      console.log('[MamaSan] Continuing existing session')

      // Check if we're in continuous profiling mode
      const isInContinuousMode = this.mamaSan.isInContinuousMode(
        this.mamaSanState
      )
      const isOnboardingComplete = this.mamaSan.isOnboardingComplete(
        this.mamaSanState
      )

      console.log('🎯 MATCHMAKING MODE DETECTION:')
      console.log(
        '  Current question index:',
        this.mamaSanState.currentQuestion
      )
      console.log('  Total answers given:', this.mamaSanState.answers.length)
      console.log('  Is onboarding complete:', isOnboardingComplete)
      console.log('  Is in continuous mode:', isInContinuousMode)
      console.log('  Session marked complete:', this.mamaSanState.isComplete)
      console.log(
        '  Configured question count:',
        this.mamaSan.getQuestionCount()
      )
      console.log('  User message:', message.substring(0, 50) + '...')

      if (isInContinuousMode) {
        console.log('[MamaSan] Processing continuous profiling response')

        // Record the previous question and response if available
        try {
          const lastQuestion = localStorage.getItem('mamasan_last_question')
          if (lastQuestion && lastQuestion !== 'undefined') {
            console.log(
              '🎭 Orchestrator - Recording previous question response:',
              lastQuestion
            )
            await recordQuestionAsked(this.userId, lastQuestion, message, false)
            console.log(
              '🎭 Orchestrator - Question response recorded successfully'
            )
          }
        } catch (error) {
          console.error(
            '🎭 Orchestrator - Error recording question response:',
            error
          )
        }

        // Always analyze response for profile updates in continuous mode
        console.log(
          '🎭 Orchestrator - Analyzing continuous response for profile updates...'
        )
        const analysis = await this.mamaSan.analyzeResponse(
          'continuous conversation',
          message
        )
        console.log('🎭 Orchestrator - Continuous analysis result:', analysis)

        // Get user profile for question generation (if available)
        let userProfile = null
        try {
          const profileData = localStorage.getItem('user_profile')
          if (profileData) {
            userProfile = JSON.parse(profileData)
          }
        } catch (error) {
          console.log(
            '🎭 Orchestrator - No user profile available for continuous mode:',
            error
          )
        }

        // Generate next continuous question
        console.log('🎭 Orchestrator - Generating next continuous question...')
        const continuousQuestion =
          await this.mamaSan.generateContinuousQuestion(userProfile)

        console.log('🎯 FINAL CONTINUOUS QUESTION GENERATED:')
        console.log('  Question:', continuousQuestion)
        console.log('  Mode: CONTINUOUS PROFILING')
        console.log('  Will track this question for next response')

        // Store the question for next response tracking
        localStorage.setItem('mamasan_last_question', continuousQuestion)

        const result = {
          message: continuousQuestion,
          isComplete: false,
          step: 'mamasan_continuous',
          data: {
            mamasan: {
              searchQuery: this.mamaSan.buildSearchQuery(this.mamaSanState),
              answers: this.mamaSanState.answers,
            },
            mode: 'continuous',
            onboardingComplete: true,
          },
        }
        console.log(
          '🎭 Orchestrator - Returning continuous conversation result:',
          result
        )
        return result
      }

      // Analyze user response to current question (onboarding mode)
      const question = this.mamaSan.getCurrentQuestion(this.mamaSanState)
      console.log('[MamaSan] Analyzing user response to onboarding question:', {
        question,
        userMessage: message,
        currentQuestionIndex: this.mamaSanState.currentQuestion,
      })

      console.log('🎭 Orchestrator - Calling MamaSan analyzeResponse...')
      const analysis = await this.mamaSan.analyzeResponse(question, message)
      console.log('🎭 Orchestrator - Analysis received from MamaSan')

      console.log('[MamaSan] Analysis result:', analysis)

      if (!analysis.answered) {
        // If not answered, repeat the question
        console.log(
          '[MamaSan] User response did not answer the question. Re-asking:',
          question
        )
        const result = {
          message: `hmm, i didn't quite get that! ${question}`,
          isComplete: false,
          step: `mamasan_${this.mamaSanState.currentQuestion}`,
        }
        console.log('🎭 Orchestrator - Returning re-ask result:', result)
        return result
      }

      console.log('[MamaSan] User answered the question, moving to next...')
      console.log('[MamaSan] State before updating:', {
        currentQuestion: this.mamaSanState.currentQuestion,
        answersLength: this.mamaSanState.answers.length,
        answers: this.mamaSanState.answers,
      })

      // Save answer and move to next question
      this.mamaSanState.answers[this.mamaSanState.currentQuestion] = message
      this.mamaSanState.currentQuestion++

      console.log('[MamaSan] State after updating:', {
        currentQuestion: this.mamaSanState.currentQuestion,
        answersLength: this.mamaSanState.answers.length,
        answers: this.mamaSanState.answers,
      })

      console.log('🎭 Orchestrator - Saving updated MamaSan state...')
      // Save state after updating
      this.saveMamaSanState()
      console.log('🎭 Orchestrator - Updated state saved')

      // If more questions, ask next
      if (!this.mamaSan.isSessionComplete(this.mamaSanState)) {
        console.log(
          '🎭 Orchestrator - More questions remain, generating transition...'
        )
        // Use the new transition method for smooth conversational flow
        const prevState = {
          ...this.mamaSanState,
          currentQuestion: this.mamaSanState.currentQuestion - 1, // Get previous state for transition
          answers: this.mamaSanState.answers.slice(0, -1), // Remove the last answer to get previous state
        }

        console.log('🎭 Orchestrator - Calling getResponseWithTransition...')
        const transitionResponse = await this.mamaSan.getResponseWithTransition(
          prevState,
          message
        )
        console.log(
          '[MamaSan] Generated transition response:',
          transitionResponse
        )

        const result = {
          message: transitionResponse,
          isComplete: false,
          step: `mamasan_${this.mamaSanState.currentQuestion}`,
        }
        console.log('🎭 Orchestrator - Returning transition result:', result)
        return result
      } else {
        console.log(
          '🎭 Orchestrator - Initial questions completed, entering continuous profiling mode...'
        )

        // Switch to continuous profiling mode
        this.mamaSanState.isComplete = false // Keep session active for continuous profiling
        this.saveMamaSanState()

        // Mark onboarding completion in localStorage but keep session active
        console.log(
          '🎭 Orchestrator - Setting localStorage onboarding completion...'
        )
        localStorage.setItem('mamasan_onboarding_completed', 'true')

        console.log('🎭 Orchestrator - Generating continuous question...')

        // Get user profile for question generation (if available)
        let userProfile = null
        try {
          const profileData = localStorage.getItem('user_profile')
          if (profileData) {
            userProfile = JSON.parse(profileData)
          }
        } catch (error) {
          console.log('🎭 Orchestrator - No user profile available:', error)
        }

        // Generate next continuous question
        const continuousQuestion =
          await this.mamaSan.generateContinuousQuestion(userProfile)

        // Store the question for next response tracking
        localStorage.setItem('mamasan_last_question', continuousQuestion)

        const result = {
          message: continuousQuestion,
          isComplete: false, // Keep session active
          step: 'mamasan_continuous',
          data: {
            mamasan: {
              searchQuery: this.mamaSan.buildSearchQuery(this.mamaSanState),
              answers: this.mamaSanState.answers,
            },
            stepProgress: {
              current: this.mamaSanState.currentQuestion,
              total: this.mamaSan.getQuestionCount(),
              label: 'Continuous Profiling',
              phase: 'questions' as const,
            },
            mode: 'continuous',
            onboardingComplete: true,
          },
        }
        console.log(
          '🎭 Orchestrator - Returning continuous profiling result:',
          result
        )
        return result
      }
    } catch (error) {
      console.error(
        '🎭 Orchestrator - CRITICAL ERROR in processMamaSanMode:',
        error
      )
      console.error('🎭 Orchestrator - Error type:', typeof error)
      console.error(
        '🎭 Orchestrator - Error constructor:',
        error?.constructor?.name
      )
      console.error('🎭 Orchestrator - Error message:', (error as any)?.message)
      console.error('🎭 Orchestrator - Error stack:', (error as any)?.stack)
      console.error('🎭 Orchestrator - Current state when error occurred:', {
        message,
        sessionId,
        mamaSanState: this.mamaSanState,
        isActive: this.isActive,
        currentSessionId: this.currentSessionId,
        mode: this.mode,
      })

      // Return error result
      const errorResult = {
        message: "Sorry, I had a technical issue. Let's try that again!",
        isComplete: false,
        step: 'error_recovery',
      }
      console.log(
        '🎭 Orchestrator - Returning error recovery result:',
        errorResult
      )
      return errorResult
    }
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

    // Clear localStorage
    try {
      localStorage.removeItem(this.sessionKey)
      console.log('[MamaSan] Cleared session from localStorage')
    } catch (error) {
      console.error('Error clearing session:', error)
    }
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

  // Session management methods using localStorage
  private getSession(): MatchmakingSession | null {
    try {
      const sessionData = localStorage.getItem(this.sessionKey)
      if (!sessionData) return null

      const session = JSON.parse(sessionData)
      // Convert timestamp strings back to Date objects
      if (session.kokologyQuestions) {
        session.kokologyQuestions = session.kokologyQuestions.map((q: any) => ({
          ...q,
          timestamp: new Date(q.timestamp),
        }))
      }
      return session
    } catch (error) {
      console.error('Error getting session from localStorage:', error)
      return null
    }
  }

  private saveSession(session: MatchmakingSession): void {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(session))
      this.session = session
    } catch (error) {
      console.error('Error saving session to localStorage:', error)
    }
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

  // New method to restore MamaSan state from localStorage
  private restoreMamaSanState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      // Server environment: skip restoring from localStorage
      return
    }
    try {
      console.log('[MamaSan] Attempting to restore state from localStorage...')
      const sessionData = localStorage.getItem(this.sessionKey)
      console.log('[MamaSan] Raw session data from localStorage:', sessionData)
      if (sessionData) {
        const session = JSON.parse(sessionData)
        console.log('[MamaSan] Parsed session from localStorage:', session)
        if (session.mamasan) {
          if (
            !session.mamasan.isComplete &&
            (session.mamasan.currentQuestion > 0 ||
              session.mamasan.answers.length > 0)
          ) {
            this.mamaSanState = session.mamasan
            console.log(
              '[MamaSan] Successfully restored active MamaSan state from localStorage:',
              this.mamaSanState
            )
          } else {
            console.log(
              '[MamaSan] Found mamasan state but it was completed or empty, starting fresh'
            )
          }
        } else {
          console.log('[MamaSan] No mamasan state found in session data')
        }
      } else {
        console.log('[MamaSan] No session data found in localStorage')
      }
    } catch (error) {
      console.error('Error restoring MamaSan state:', error)
    }
  }

  // New method to save MamaSan state to localStorage
  private saveMamaSanState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      // Server environment: skip saving to localStorage
      return
    }
    try {
      console.log('[MamaSan] Attempting to save state to localStorage...')
      let session = this.getSession()
      if (!session) {
        console.log('[MamaSan] No existing session found, creating new one')
        session = {
          sessionId: this.currentSessionId || 'unknown',
          status: 'idle' as const,
          step: this.mamaSanState.currentQuestion,
          missingFields: [],
          kokologyQuestions: [],
        }
      } else {
        console.log('[MamaSan] Found existing session, updating MamaSan state')
        session.sessionId = this.currentSessionId || session.sessionId
        session.step = this.mamaSanState.currentQuestion
      }
      session.mamasan = this.mamaSanState
      console.log(
        '[MamaSan] Saving session with updated MamaSan state:',
        session
      )
      this.saveSession(session)
      console.log(
        '[MamaSan] Successfully saved state to localStorage:',
        this.mamaSanState
      )
    } catch (error) {
      console.error('Error saving MamaSan state:', error)
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
    // Only treat as a new session if the message is a start trigger
    const isNewSession =
      mamasanState.currentQuestion === 0 &&
      mamasanState.answers.length === 0 &&
      isMamaSanStartTrigger(message)

    if (isNewSession) {
      const intro = this.mamaSan.getIntro()
      const firstQ = this.mamaSan.getCurrentQuestion(mamasanState)
      return {
        message: intro + '\n' + firstQ,
        isComplete: false,
        step: 'mamasan_0',
        updatedState: { currentQuestion: 0, answers: [], isComplete: false },
        profileUpdates: {},
      }
    }

    // Analyze user response to current question
    const question = this.mamaSan.getCurrentQuestion(mamasanState)
    const analysis = await this.mamaSan.analyzeResponse(question, message)

    console.log('📋 Orchestrator - MamaSan Analysis Result:')
    console.log('  Answered:', analysis.answered)
    console.log('  Profile Updates:', analysis.profileUpdates)
    console.log('  Validation Errors:', analysis.validationErrors?.length || 0)
    console.log('  Used Fallback:', analysis.usedFallback || false)

    if (!analysis.answered) {
      // User didn't really answer the question, ask again with guidance
      const transitionResponse = await this.mamaSan.getResponseWithTransition(
        mamasanState,
        message
      )
      return {
        message: transitionResponse,
        isComplete: false,
        step: `mamasan_${mamasanState.currentQuestion}`,
        updatedState: { ...mamasanState },
        profileUpdates: {},
      }
    }

    // Note: Validation errors and profile updates are now handled automatically
    // by the MamaSan specialist's response processor

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
    const profileUpdates: any = {}
    if (analysis.profileUpdates) {
      console.log(
        '🌸 MamaSan - Processing profile updates:',
        analysis.profileUpdates
      )

      // Map the AI analysis to MongoDB structure
      if (analysis.profileUpdates.physicalPreferences) {
        profileUpdates['datingProfile.physicalPreferences'] =
          analysis.profileUpdates.physicalPreferences
      }

      if (analysis.profileUpdates.personality) {
        if (analysis.profileUpdates.personality.energyLevel) {
          profileUpdates['datingProfile.servicePreferences.mood'] =
            analysis.profileUpdates.personality.energyLevel
        }
        if (analysis.profileUpdates.personality.dominanceStyle) {
          profileUpdates['datingProfile.dominanceStyle'] =
            analysis.profileUpdates.personality.dominanceStyle
        }
        if (analysis.profileUpdates.personality.seekingTraits) {
          profileUpdates[
            'profileData.preferences.matchingPrefs.personalityTraits'
          ] = analysis.profileUpdates.personality.seekingTraits
        }
      }

      if (analysis.profileUpdates.interests) {
        if (analysis.profileUpdates.interests.categories) {
          profileUpdates['datingProfile.servicePreferences.primaryServices'] =
            analysis.profileUpdates.interests.categories
        }
        if (analysis.profileUpdates.interests.specificItems) {
          profileUpdates[
            'datingProfile.servicePreferences.conversationTopics'
          ] = analysis.profileUpdates.interests.specificItems
        }
      }

      if (analysis.profileUpdates.preferences) {
        if (analysis.profileUpdates.preferences.moodSeeking) {
          profileUpdates['datingProfile.servicePreferences.mood'] =
            analysis.profileUpdates.preferences.moodSeeking
        }
        if (analysis.profileUpdates.preferences.interactionStyle) {
          profileUpdates['datingProfile.servicePreferences.interactionStyle'] =
            analysis.profileUpdates.preferences.interactionStyle
        }
        if (analysis.profileUpdates.preferences.serviceTypes) {
          profileUpdates['datingProfile.servicePreferences.primaryServices'] =
            analysis.profileUpdates.preferences.serviceTypes
        }
        if (analysis.profileUpdates.preferences.conversationTopics) {
          profileUpdates[
            'datingProfile.servicePreferences.conversationTopics'
          ] = analysis.profileUpdates.preferences.conversationTopics
        }
      }

      if (analysis.profileUpdates.demographics) {
        if (analysis.profileUpdates.demographics.agePreference) {
          profileUpdates[
            'datingProfile.demographics.agePreference.preference'
          ] = analysis.profileUpdates.demographics.agePreference
        }
        if (analysis.profileUpdates.demographics.experienceLevel) {
          profileUpdates['datingProfile.demographics.experienceLevel'] =
            analysis.profileUpdates.demographics.experienceLevel
        }
      }
    }

    // If more questions, ask next
    if (!this.mamaSan.isSessionComplete(updatedState)) {
      // Use the new transition method for smooth conversational flow
      const transitionResponse = await this.mamaSan.getResponseWithTransition(
        mamasanState, // Use the previous state to get current question
        message
      )
      return {
        message: transitionResponse,
        isComplete: false,
        step: `mamasan_${updatedState.currentQuestion}`,
        updatedState,
        profileUpdates,
      }
    } else {
      // All questions answered, recommend hosts
      updatedState.isComplete = true
      const searchQuery = this.mamaSan.buildSearchQuery(updatedState)
      // Use transition for final response too
      const finalTransition = await this.mamaSan.getResponseWithTransition(
        mamasanState,
        message
      )
      return {
        message: finalTransition,
        isComplete: true,
        step: 'mamasan_recommend',
        updatedState,
        profileUpdates,
        data: {
          mamasan: {
            searchQuery,
            answers: updatedState.answers,
          },
        },
      }
    }
  }
}
