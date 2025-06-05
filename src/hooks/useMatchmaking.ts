import { useState, useCallback, useRef } from 'react'
import { MatchmakingOrchestrator } from '@/features/matchmaking/matchmaking-orchestrator'
import { MatchmakingResult, MatchmakingConfig } from '@/types/matchmaking'
import { v4 as uuidv4 } from 'uuid'

export interface MatchmakingHookOptions {
  userId?: string
  config?: MatchmakingConfig
  onComplete?: (result: MatchmakingResult) => void
  onProgress?: (result: MatchmakingResult) => void
}

export function useMatchmaking(options: MatchmakingHookOptions = {}) {
  const {
    userId = 'default-user',
    config = {},
    onComplete,
    onProgress,
  } = options

  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentResult, setCurrentResult] = useState<MatchmakingResult | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  // Create a stable orchestrator instance
  const orchestratorRef = useRef<MatchmakingOrchestrator | null>(null)
  const sessionIdRef = useRef<string>(uuidv4())

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) {
      orchestratorRef.current = new MatchmakingOrchestrator(userId, config)
    }
    return orchestratorRef.current
  }, [userId, config])

  const startMatchmaking = useCallback(
    async (message: string = "I'd like to start personality analysis") => {
      try {
        setIsActive(true)
        setIsLoading(true)
        setError(null)

        // Generate new session ID for fresh start
        sessionIdRef.current = uuidv4()

        const orchestrator = getOrchestrator()
        const result = await orchestrator.processMessage(
          message,
          sessionIdRef.current
        )

        setCurrentResult(result)

        if (result.isComplete) {
          setIsActive(false)
          onComplete?.(result)
        } else {
          onProgress?.(result)
        }

        return result
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred'
        setError(errorMessage)
        setIsActive(false)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [getOrchestrator, onComplete, onProgress]
  )

  const sendMessage = useCallback(
    async (message: string) => {
      if (!isActive) {
        throw new Error(
          'Matchmaking is not active. Call startMatchmaking() first.'
        )
      }

      try {
        setIsLoading(true)
        setError(null)

        const orchestrator = getOrchestrator()
        const result = await orchestrator.processMessage(
          message,
          sessionIdRef.current
        )

        setCurrentResult(result)

        if (result.isComplete) {
          setIsActive(false)
          onComplete?.(result)
        } else {
          onProgress?.(result)
        }

        return result
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred'
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [isActive, getOrchestrator, onComplete, onProgress]
  )

  const reset = useCallback(() => {
    const orchestrator = getOrchestrator()
    orchestrator.resetUserSession()

    setIsActive(false)
    setIsLoading(false)
    setCurrentResult(null)
    setError(null)

    // Generate new session ID for next session
    sessionIdRef.current = uuidv4()
  }, [getOrchestrator])

  const getCurrentSession = useCallback(() => {
    const orchestrator = getOrchestrator()
    return orchestrator.getUserSession()
  }, [getOrchestrator])

  const getPersonalityCategories = useCallback(() => {
    const orchestrator = getOrchestrator()
    return orchestrator.getPersonalityCategories()
  }, [getOrchestrator])

  return {
    // State
    isActive,
    isLoading,
    currentResult,
    error,
    sessionId: sessionIdRef.current,

    // Actions
    startMatchmaking,
    sendMessage,
    reset,

    // Utilities
    getCurrentSession,
    getPersonalityCategories,

    // Computed
    isAwaitingGender: currentResult?.data?.expectingGender ?? false,
    showGenderButtons: currentResult?.data?.showGenderButtons ?? false,
    disableTextInput: currentResult?.data?.disableTextInput ?? false,
    stepProgress: currentResult?.data?.stepProgress,
    personalityResult: currentResult?.isComplete
      ? {
          category: currentResult.data?.personalityCategory,
          imageUrl: currentResult.data?.personalityImageUrl,
          profile: currentResult.data?.profile,
        }
      : null,
  }
}
