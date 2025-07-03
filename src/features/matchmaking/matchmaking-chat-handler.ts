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
 * Chat handler focused on input/output processing
 * All conversational flow and state management is handled by the orchestrator
 */
export class MatchmakingChatHandler {
  private orchestrator: MatchmakingOrchestrator

  constructor(
    private userId: string,
    private config: MatchmakingConfig = {}
  ) {
    this.orchestrator = new MatchmakingOrchestrator(this.userId, this.config)
  }

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
   * Main method to process chat messages
   * Handles input/output processing and delegates state management to orchestrator
   */
  async processChatMessage(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult | null> {
    console.log('🎪 Chat Handler - processChatMessage called:', {
      message,
      sessionId,
    })

    try {
      // Delegate all processing to orchestrator
      const result = await this.orchestrator.processMessage(message, sessionId)
      console.log('🎪 Chat Handler - Orchestrator returned result:', result)

      return result
    } catch (error) {
      console.error('🎪 Chat Handler - Error processing message:', error)

      // Handle specific API key errors
      if (
        error instanceof Error &&
        error.message.includes('API key is not configured')
      ) {
        return {
          message:
            'I need an API key to continue! Please configure it in Settings → Model Provider, then try again!',
          isComplete: false,
          step: 'api_key_error',
        }
      }

      // For other errors, provide helpful message
      return {
        message:
          "I had a small hiccup there! Please send your response again and I'll continue.",
        isComplete: false,
        step: 'error_retry',
      }
    }
  }

  /**
   * Check if orchestrator is currently active
   */
  isInMatchmakingMode(): boolean {
    return this.orchestrator.isActiveSession()
  }

  /**
   * Get the current matchmaking session if active
   */
  getCurrentMatchmakingSession() {
    return this.orchestrator.getUserSession()
  }

  /**
   * Get current session ID from orchestrator
   */
  getCurrentSessionId(): string | null {
    return this.orchestrator.getCurrentSessionId()
  }

  /**
   * Get current mode from orchestrator
   */
  getCurrentMode(): 'mamasan' | 'kokology' | 'profiling' {
    return this.orchestrator.getCurrentMode()
  }

  /**
   * Start a new matchmaking session (legacy method for compatibility)
   */
  async startMatchmaking(
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    console.log('🎪 Chat Handler - startMatchmaking called (legacy):', {
      message,
      sessionId,
    })

    // Just delegate to processChatMessage since orchestrator handles activation
    const result = await this.processChatMessage(message, sessionId)
    if (result) {
      return result
    }

    // Fallback if null returned
    return {
      message: 'Unable to start matchmaking session. Please try again.',
      isComplete: false,
      step: 'startup_failed',
    }
  }

  /**
   * Force stop matchmaking and reset (delegates to orchestrator)
   */
  stopMatchmaking(): void {
    this.orchestrator.resetSession()
  }

  /**
   * Get available personality categories (delegates to orchestrator)
   */
  getPersonalityCategories() {
    return this.orchestrator.getPersonalityCategories()
  }

  /**
   * Check if current message should use gender buttons instead of text input
   */
  shouldShowGenderButtons(): boolean {
    if (!this.orchestrator.isActiveSession()) return false

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
    const genderMessage = gender === 'male' ? 'boy' : 'girl'
    return await this.processChatMessage(genderMessage, sessionId)
  }

  /**
   * Get step progress for UI display (delegates to orchestrator session)
   */
  getStepProgress() {
    if (!this.orchestrator.isActiveSession()) return null

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

  /**
   * Set mode on orchestrator (for external control)
   */
  setMode(mode: 'mamasan' | 'kokology' | 'profiling'): void {
    this.orchestrator.setMode(mode)
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
