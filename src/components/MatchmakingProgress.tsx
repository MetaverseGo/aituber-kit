import React, { useState, useEffect, useCallback } from 'react'
import homeStore from '@/features/stores/home'
import {
  getChatStats,
  DAILY_MESSAGE_LIMIT,
  getTimeUntilNextRefill,
} from '@/utils/chatLimits'

interface MatchmakingProgressProps {
  className?: string
  defaultVisible?: boolean
  forceHidden?: boolean
}

export const MatchmakingProgress: React.FC<MatchmakingProgressProps> = ({
  className = '',
  defaultVisible = true,
  forceHidden = false,
}) => {
  const [isVisible, setIsVisible] = useState(defaultVisible)
  const [stepProgress, setStepProgress] = useState<{
    current: number
    total: number
    label: string
    phase: string
  } | null>(null)
  const [chatStats, setChatStats] = useState(() => getChatStats())
  const [timeUntilRefill, setTimeUntilRefill] = useState(() =>
    getTimeUntilNextRefill()
  )

  // Check if user has completed personality analysis
  const hasCompletedPersonalityAnalysis = useCallback(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('personality_analysis_completed') === 'true'
    } catch {
      return false
    }
  }, [])

  // Get step progress from localStorage
  const getStoredStepProgress = () => {
    try {
      const stored = localStorage.getItem('matchmaking_step_progress')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Progress Bar - Error parsing step progress:', error)
    }
    return null
  }

  // Update progress based on step data
  const updateProgress = useCallback(() => {
    const stepData = getStoredStepProgress()
    const completed = hasCompletedPersonalityAnalysis()

    console.log('Progress Bar - Update:', { stepData, completed })

    if (
      stepData &&
      (stepData.phase === 'questions' || stepData.phase === 'analyzing')
    ) {
      // Show question progress bar during personality analysis
      console.log('Progress Bar - Showing questions progress')
      setStepProgress(stepData)
      setIsVisible(true)
    } else {
      // Show stamina/familiarity bars by default (when NOT doing personality analysis)
      console.log('Progress Bar - Showing stamina progress (default)')
      setStepProgress(null)
      setIsVisible(true)
    }
  }, [hasCompletedPersonalityAnalysis])

  // Subscribe to chat log updates
  useEffect(() => {
    const unsubscribe = homeStore.subscribe((state, prevState) => {
      if (state.chatLog !== prevState.chatLog) {
        updateProgress()
      }
    })

    updateProgress() // Initial check

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'matchmaking_step_progress' ||
        e.key === 'personality_analysis_completed'
      ) {
        updateProgress()
      }
      if (e.key === 'chat_stats') {
        setChatStats(getChatStats())
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [updateProgress])

  // Update stamina stats and refill timer every 10 seconds
  useEffect(() => {
    const updateStaminaTimer = setInterval(() => {
      const newStats = getChatStats()
      const newTimeUntilRefill = getTimeUntilNextRefill()

      // Only update if something changed to avoid unnecessary re-renders
      if (
        JSON.stringify(newStats) !== JSON.stringify(chatStats) ||
        newTimeUntilRefill !== timeUntilRefill
      ) {
        setChatStats(newStats)
        setTimeUntilRefill(newTimeUntilRefill)
      }
    }, 10000) // Update every 10 seconds

    return () => clearInterval(updateStaminaTimer)
  }, [chatStats, timeUntilRefill])

  // Now check forceHidden after all hooks
  if (forceHidden) return null

  if (!isVisible) {
    return null
  }

  // Show normal progress bar during personality analysis
  if (stepProgress) {
    const progressPercentage = (stepProgress.current / stepProgress.total) * 100

    return (
      <div
        className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg ${className}`}
      >
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-xs font-bold">💜</span>
              </div>
              <span className="font-semibold text-sm">
                Question {stepProgress.current} of {stepProgress.total}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/20 rounded-full h-1.5">
            <div
              className="bg-white rounded-full h-1.5 transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Show chat limits by default (always show when not doing personality analysis)
  const remainingMessages = Math.max(
    0,
    DAILY_MESSAGE_LIMIT - chatStats.dailyMessages
  )
  const dailyPercentage = Math.min(
    (remainingMessages / DAILY_MESSAGE_LIMIT) * 100,
    100
  )
  const intimacyPercentage = Math.min(
    (chatStats.intimacyLevel / 100) * 100,
    100
  )

  const formatTimeUntilRefill = (ms: number): string => {
    if (ms === 0 || remainingMessages === DAILY_MESSAGE_LIMIT) return ''
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getIntimacyLevel = (points: number): string => {
    if (points >= 75) return 'Best Friend'
    if (points >= 50) return 'Close Friend'
    if (points >= 25) return 'Friend'
    if (points >= 10) return 'Acquaintance'
    return 'Stranger'
  }

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg ${className}`}
    >
      <div className="px-4 py-2">
        {/* Daily Messages */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-xs font-bold">💬</span>
            </div>
            <span className="font-semibold text-sm">
              Stamina: {remainingMessages}/{DAILY_MESSAGE_LIMIT}
              {formatTimeUntilRefill(timeUntilRefill) && (
                <span className="text-xs opacity-75 ml-2">
                  +1 in {formatTimeUntilRefill(timeUntilRefill)}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Daily Progress Bar */}
        <div className="w-full bg-white/20 rounded-full h-1.5 mb-2">
          <div
            className="bg-white rounded-full h-1.5 transition-all duration-300 ease-out"
            style={{ width: `${dailyPercentage}%` }}
          />
        </div>

        {/* Intimacy Level */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-xs font-bold">💜</span>
            </div>
            <span className="font-semibold text-sm">
              {getIntimacyLevel(chatStats.intimacyLevel)}:{' '}
              {Math.floor(chatStats.intimacyLevel)}/100
            </span>
          </div>
        </div>

        {/* Intimacy Progress Bar */}
        <div className="w-full bg-white/20 rounded-full h-1.5">
          <div
            className="bg-white rounded-full h-1.5 transition-all duration-300 ease-out"
            style={{ width: `${intimacyPercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default MatchmakingProgress
