import { Message } from '@/features/messages/messages'
import { MatchmakingOrchestrator } from './matchmaking-orchestrator'
import { MatchmakingResult, MatchmakingConfig } from '@/types/matchmaking'

/**
 * Keywords and phrases that trigger matchmaking mode
 */
const MATCHMAKING_TRIGGERS = [
  // Direct requests
  'personality analysis',
  'personality test',
  'kokology',
  'matchmaking',
  'analyze my personality',
  "what's my personality",
  'personality type',

  // Casual requests
  'tell me about myself',
  'what am i like',
  'analyze me',
  'personality quiz',
  'who am i',
  'what type am i',

  // Relationship focused
  'help me find someone',
  'dating personality',
  'relationship type',
  'compatibility analysis',
  'what kind of partner',

  // Specific system prompts
  'start matchmaking',
  'begin analysis',
  'personality discovery',
  'kokology analysis',
]

/**
 * Enhanced chat handler that can route between regular AI chat and matchmaking
 */
export class MatchmakingChatHandler {
  private orchestrator: MatchmakingOrchestrator | null = null
  private isMatchmakingActive = false
  private currentSessionId: string | null = null

  constructor(
    private userId: string,
    private config: MatchmakingConfig = {}
  ) {}

  /**
   * Check if a message should trigger matchmaking mode
   */
  private shouldTriggerMatchmaking(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim()

    return MATCHMAKING_TRIGGERS.some((trigger) =>
      lowerMessage.includes(trigger.toLowerCase())
    )
  }

  /**
   * Check if we're currently in an active matchmaking session
   */
  isInMatchmakingMode(): boolean {
    return this.isMatchmakingActive
  }

  /**
   * Get the current matchmaking session if active
   */
  getCurrentMatchmakingSession() {
    return this.orchestrator?.getUserSession() || null
  }

  /**
   * Main method to process chat messages with matchmaking integration
   */
  async processChatMessage(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult | null> {
    console.log('🎪 Chat Handler - processChatMessage called:', { message, sessionId, isActive: this.isMatchmakingActive })
    
    // If matchmaking is not active, auto-start it (for mandatory personality analysis)
    if (!this.isMatchmakingActive) {
      console.log('🎪 Chat Handler - Matchmaking not active, auto-starting...')
      this.orchestrator = new MatchmakingOrchestrator(this.userId, this.config)
      this.isMatchmakingActive = true
      this.currentSessionId = sessionId

      try {
        console.log('🎪 Chat Handler - Starting orchestrator with message:', message)
        
        // Start the orchestrator with the user's message
        const result = await this.orchestrator.processMessage(message, sessionId)
        console.log('🎪 Chat Handler - Orchestrator returned result:', result)

        return result
      } catch (error) {
        console.error('Error starting matchmaking:', error)
        
        // Don't immediately give up - provide helpful error message instead
        if (error instanceof Error && error.message.includes('API key is not configured')) {
          this.isMatchmakingActive = false
          this.currentSessionId = null
          return {
            message: 'I need an API key to start your personality analysis! Please configure it in Settings → Model Provider, then try again!',
            isComplete: false,
            step: 'api_key_error',
          }
        }
        
        // For other errors, still try to stay active but show error
        return {
          message: 'I had a small hiccup starting your personality analysis! Please try sending a message again.',
          isComplete: false,
          step: 'startup_error',
        }
      }
    }

    // If matchmaking is active, process through orchestrator
    if (this.orchestrator && this.currentSessionId === sessionId) {
      console.log('🎪 Chat Handler - Matchmaking active, processing through orchestrator...')
      try {
        const result = await this.orchestrator.processMessage(
          message,
          sessionId
        )
        console.log('🎪 Chat Handler - Orchestrator result for active session:', result)

        // Step progress is now stored earlier in handlers.ts before speaking
        console.log('🎪 Chat Handler - Step progress will be stored by main handler before speaking')

        // Check if matchmaking is complete
        if (result.isComplete) {
          console.log('🎪 Chat Handler - Matchmaking complete, deactivating')
          this.isMatchmakingActive = false
          this.currentSessionId = null
          // Step progress clearing is now handled in handlers.ts
        }

        return result
      } catch (error) {
        console.error('Error in matchmaking processing:', error)
        
        // Don't immediately give up on matchmaking - try to continue with a helpful error message
        // Only deactivate if it's a persistent configuration issue
        if (error instanceof Error && error.message.includes('API key is not configured')) {
          this.isMatchmakingActive = false
          this.currentSessionId = null
          return {
            message: 'I need an API key to continue your personality analysis! Please configure it in Settings → Model Provider, then try again!',
            isComplete: false,
            step: 'api_key_error',
          }
        }
        
        // For other errors, stay in matchmaking mode but show a helpful message
        return {
          message: 'I had a small hiccup there! Please send your response again and I\'ll continue with your personality analysis.',
          isComplete: false,
          step: 'error_retry',
        }
      }
    }

    // Session mismatch, deactivate matchmaking
    console.log('🎪 Chat Handler - Session mismatch or no orchestrator! Current:', this.currentSessionId, 'Incoming:', sessionId, 'Has orchestrator:', !!this.orchestrator)
    this.isMatchmakingActive = false
    this.currentSessionId = null
    return null
  }

  /**
   * Start a new matchmaking session
   */
  async startMatchmaking(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    this.orchestrator = new MatchmakingOrchestrator(this.userId, this.config)
    this.isMatchmakingActive = true
    this.currentSessionId = sessionId

    try {
      const result = await this.orchestrator.processMessage(message, sessionId)

      if (result.isComplete) {
        this.isMatchmakingActive = false
        this.currentSessionId = null
      }

      return result
    } catch (error) {
      console.error('Error starting matchmaking:', error)
      this.isMatchmakingActive = false
      this.currentSessionId = null
      throw error
    }
  }

  /**
   * Force stop matchmaking and reset
   */
  stopMatchmaking(): void {
    if (this.orchestrator) {
      this.orchestrator.resetUserSession()
    }
    this.isMatchmakingActive = false
    this.currentSessionId = null
    this.orchestrator = null
  }

  /**
   * Get available personality categories
   */
  getPersonalityCategories() {
    if (!this.orchestrator) {
      // Create temporary orchestrator to get categories
      const tempOrchestrator = new MatchmakingOrchestrator(
        this.userId,
        this.config
      )
      return tempOrchestrator.getPersonalityCategories()
    }
    return this.orchestrator.getPersonalityCategories()
  }

  /**
   * Check if current message should use gender buttons instead of text input
   */
  shouldShowGenderButtons(): boolean {
    if (!this.isMatchmakingActive || !this.orchestrator) return false

    const session = this.orchestrator.getUserSession()
    return session?.status === 'awaiting_gender'
  }

  /**
   * Send a gender response directly
   */
  async sendGenderResponse(
    gender: 'male' | 'female',
    sessionId: string
  ): Promise<MatchmakingResult | null> {
    if (
      !this.isMatchmakingActive ||
      !this.orchestrator ||
      this.currentSessionId !== sessionId
    ) {
      return null
    }

    const genderMessage = gender === 'male' ? 'boy' : 'girl'
    return await this.processChatMessage(genderMessage, sessionId)
  }

  /**
   * Get step progress for UI display
   */
  getStepProgress() {
    if (!this.isMatchmakingActive || !this.orchestrator) return null

    const session = this.orchestrator.getUserSession()
    if (!session) return null

    const totalSteps = this.config.questionCount || 5

    return {
      current: session.step,
      total: totalSteps,
      status: session.status,
      phase:
        session.status === 'completed'
          ? ('completed' as const)
          : session.status === 'awaiting_gender' ||
              session.status === 'personality_profiling'
            ? ('analyzing' as const)
            : ('questions' as const),
    }
  }
}

/**
 * Utility function to create a matchmaking-enhanced message
 */
export function createMatchmakingMessage(
  content: string,
  data?: MatchmakingResult['data']
): Message {
  return {
    role: 'assistant',
    content,
    ...(data && {
      // Add any special data for UI handling
      metadata: {
        isMatchmaking: true,
        matchmakingData: data,
      },
    }),
  }
}

/**
 * Utility function to detect if a message contains matchmaking data
 */
export function isMatchmakingMessage(message: Message): boolean {
  return !!(message as any).metadata?.isMatchmaking
}

/**
 * Extract matchmaking data from a message
 */
export function getMatchmakingData(
  message: Message
): MatchmakingResult['data'] | null {
  return (message as any).metadata?.matchmakingData || null
}
