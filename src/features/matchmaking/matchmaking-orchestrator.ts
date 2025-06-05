import { KokologyAnalyst } from './kokology-analyst'
import { PersonalityWriter } from './personality-writer'
import { PersonalityProfiler } from './personality-profiler'
import {
  MatchmakingResult,
  MatchmakingConfig,
  MatchmakingSession,
  PersonalityCategory,
} from '@/types/matchmaking'

// Emi's analyzing messages (no AI inference required)
const ANALYZING_MESSAGES = [
  'give me a sec while I crunch all this data about you, also quick question: are you a boy or girl? just for the perfect match!',
  'analyzing your vibe right now, this is so fun! oh by the way are you a boy or girl? helps me pick the perfect personality pic',
  "your answers are amazing! processing, quick thing: boy or girl? need it for your custom results!",
  'running my secret personality algorithms, real quick: are you a boy or girl? want to make sure your results are perfect!',
  'analyzing your whole vibe, your brain is fascinating! oh and boy or girl? just for the aesthetic',
  'computing your personality profile, this is giving me SUCH good data! quick question: boy or girl? for your personalized image',
  'processing your answers through my ultra-advanced vibes detector, also are you a boy or girl? need it for the final touch!',
  'hold up let me decode all this personality data, you are so interesting! by the way boy or girl? makes your results even more perfect',
  'analyzing analyzing, your answers are literally perfect specimens, quick: boy or girl? for maximum customization!',
  'running diagnostics on your personality, this is so cool! oh also are you a boy or girl? helps with the visual vibes',
]

export class MatchmakingOrchestrator {
  private kokologyAnalyst: KokologyAnalyst
  private personalityWriter: PersonalityWriter
  private personalityProfiler: PersonalityProfiler
  private config: MatchmakingConfig
  private sessionKey: string

  constructor(userId: string, config: MatchmakingConfig = {}) {
    this.config = {
      kokologyPersonality: 'emi',
      writerPersonality: 'emi',
      profilerPersonality: 'emi',
      questionCount: 5,
      ...config,
    }

    this.sessionKey = `matchmaking_session_${userId}`

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
  }

  async processMessage(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    try {
      console.log('🎭 Orchestrator - Processing message:', { message, sessionId })
      
      // Get or create session
      let session = this.getSession()
      console.log('🎭 Orchestrator - Current session:', session)

      if (!session || session.sessionId !== sessionId) {
        // Reset session for new sessionId
        session = this.createNewSession(sessionId)
        console.log(`🎭 Orchestrator - Created new matchmaking session: ${sessionId}`)
      }

      console.log(
        `🎭 Orchestrator - Processing message in status: ${session.status}, step: ${session.step}`
      )

      // Route to appropriate handler based on current status
      console.log('🎭 Orchestrator - Routing to handler for status:', session.status)
      switch (session.status) {
        case 'idle':
        case 'kokology_analysis': {
          console.log('🎭 Orchestrator - In idle/kokology_analysis branch')
          const questions = session.kokologyQuestions || []

          // If there is an unanswered question, handle reloads defensively
          if (questions.length > 0 && !questions[questions.length - 1].answer) {
            console.log('🎭 Orchestrator - Found unanswered question, last question:', questions[questions.length - 1])
            // If the incoming message is empty (likely a reload), return no new message
            if (!message || message.trim() === '') {
              console.log('🎭 Orchestrator - Empty message, returning no new message')
              return {
                message: '', // No new message
                isComplete: false,
                step: `kokology_question_${questions.length}`,
                data: {
                  stepProgress: {
                    current: questions.length,
                    total: this.config.questionCount!,
                    label: `Question ${questions.length} of ${this.config.questionCount}`,
                    phase: 'questions',
                  },
                },
              }
            }
            // If the incoming message is NOT empty, treat it as an answer and process it
            console.log('🎭 Orchestrator - Non-empty message, handling as kokology response')
            return await this.handleKokologyResponse(session, message)
          }

          // If all questions are answered, check if complete
          if (
            questions.length >= this.config.questionCount! &&
            questions[questions.length - 1]?.answer
          ) {
            console.log('🎭 Orchestrator - All questions answered, generating personality summary')
            return await this.generatePersonalitySummary(session)
          }

          // Otherwise, generate a new question as usual
          console.log('🎭 Orchestrator - Starting new kokology analysis question')
          return await this.startKokologyAnalysis(session, message)
        }

        case 'personality_summary':
          return await this.generatePersonalitySummary(session)

        case 'awaiting_gender':
          return await this.handleGenderResponse(session, message)

        case 'personality_profiling':
          return await this.profilePersonality(session)

        case 'completed':
          return {
            message: `Your personality analysis is complete! You've been categorized as "${session.personalityCategory}". Feel free to ask me anything else or let's start finding you some amazing connections!`,
            isComplete: true,
            step: 'completed',
            data: {
              personalityCategory: session.personalityCategory,
              personalityImageUrl: this.getPersonalityImageUrl(
                session.personalityCategory || '',
                session.gender
              ),
              profile: this.getPublicProfileData(session),
              stepProgress: {
                current: this.config.questionCount!,
                total: this.config.questionCount!,
                label: 'Analysis complete!',
                phase: 'completed' as const,
              },
            },
          }

        default:
          return await this.handleError(session, 'Unknown session status')
      }
    } catch (error) {
      console.error('Error in matchmaking orchestrator:', error)
      
      // Check if it's an API key error
      if (error instanceof Error && error.message.includes('API key is not configured')) {
        return {
          message: 'I need an API key to analyze your personality! Please configure it in Settings → Model Provider, then try again!',
          isComplete: false,
          step: 'api_key_error',
        }
      }
      
      return {
        message:
          'Oh no! I encountered an error. Let me reset and we can start fresh!',
        isComplete: false,
        step: 'error',
      }
    }
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
      console.log('🎭 Orchestrator - Starting kokology analysis with message:', message)
      
      // Update status to kokology analysis
      session.status = 'kokology_analysis'
      session.step = 1

      const currentQuestionNumber = (session.kokologyQuestions?.length || 0) + 1
      console.log('🎭 Orchestrator - Calling kokology analyst for question', currentQuestionNumber)
      const result = await this.kokologyAnalyst.askQuestion(currentQuestionNumber, session.kokologyQuestions || [], message)
      console.log('🎭 Orchestrator - Received result from kokology analyst:', result)

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
      return await this.handleError(session, `Error starting analysis: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
          console.warn(`Missing question at step ${currentStep}, creating entry`)
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
      console.log('🎭 Orchestrator - Asking for question', nextStep, 'current questions:', questions.length)
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
        console.log('🎭 Orchestrator - Returning question result with step progress:', orchestratorResult)
        return orchestratorResult
      }
    } catch (error) {
      console.error('Error in handleKokologyResponse:', error)
      return await this.handleError(session, `Error processing your answer: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        .map((q, index) => `Question ${index + 1}: ${q.question}\nAnswer: ${q.answer}`)
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
        genderedImageUrl: genderedImageUrl
      })

      // Store results and complete the process
      session.personalityCategory = profileResult.category.name
      session.status = 'completed'
      this.saveSession(session)

      const resultData = {
        message: `Your personality analysis is complete! You are: **${
          profileResult.category.name
        }** ${
          profileResult.category.description
        } Here's what makes you special in relationships: ${profileResult.strengthsForMatching
          .join(', ')
        }. I'm sending you your personality image right now!`,
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
      uid: session.sessionId,
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
    } catch (error) {
      console.error('Error saving session to localStorage:', error)
    }
  }

  // Helper methods for external access
  getUserSession(): MatchmakingSession | null {
    return this.getSession()
  }

  resetUserSession(): void {
    try {
      localStorage.removeItem(this.sessionKey)
    } catch (error) {
      console.error('Error resetting session:', error)
    }
  }

  getPersonalityCategories(): PersonalityCategory[] {
    return this.personalityProfiler.getAllCategories()
  }
}
