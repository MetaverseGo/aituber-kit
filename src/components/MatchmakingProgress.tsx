import React, { useState, useEffect } from 'react'
import homeStore from '@/features/stores/home'

interface MatchmakingProgressProps {
  className?: string
}

export const MatchmakingProgress: React.FC<MatchmakingProgressProps> = ({ 
  className = "" 
}) => {
  const [stepProgress, setStepProgress] = useState<{
    current: number
    total: number
    label: string
    phase: string
  } | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  
  console.log('📊 Progress Bar - Component rendered, isVisible:', isVisible, 'stepProgress:', stepProgress)

  // Check if user has completed personality analysis
  const hasCompletedPersonalityAnalysis = (): boolean => {
    try {
      const completed = localStorage.getItem('personality_analysis_completed')
      return completed === 'true'
    } catch {
      return false
    }
  }

  // Get step progress from localStorage (stored by matchmaking handler)
  const getStoredStepProgress = () => {
    try {
      const stored = localStorage.getItem('matchmaking_step_progress')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('📊 Progress Bar - Error parsing step progress:', error)
    }
    return null
  }

  // Update progress based on real step data
  const updateProgress = () => {
    console.log('📊 Progress Bar - Updating progress...')
    
    const completed = hasCompletedPersonalityAnalysis()
    console.log('📊 Progress Bar - Personality analysis completed:', completed)
    
    if (completed) {
      console.log('📊 Progress Bar - Personality analysis completed, hiding')
      setIsVisible(false)
      setStepProgress(null)
      return
    }

    // Get real step progress from stored data
    const storedProgress = getStoredStepProgress()
    console.log('📊 Progress Bar - Stored step progress:', storedProgress)
    
    // Check what's in localStorage
    try {
      const rawStored = localStorage.getItem('matchmaking_step_progress')
      console.log('📊 Progress Bar - Raw localStorage data:', rawStored)
      const completedFlag = localStorage.getItem('personality_analysis_completed')
      console.log('📊 Progress Bar - Completed flag:', completedFlag)
    } catch (e) {
      console.log('📊 Progress Bar - Error reading localStorage:', e)
    }
    
    if (storedProgress && (storedProgress.phase === 'questions' || storedProgress.phase === 'analyzing')) {
      console.log('📊 Progress Bar - Using real step data:', storedProgress)
      setStepProgress(storedProgress)
      setIsVisible(true)
    } else {
      console.log('📊 Progress Bar - No valid step progress, hiding. Stored progress phase:', storedProgress?.phase)
      setStepProgress(null)
      setIsVisible(false)
    }
  }

  // Subscribe to chat log updates
  useEffect(() => {
    const unsubscribe = homeStore.subscribe((state, prevState) => {
      if (state.chatLog !== prevState.chatLog) {
        console.log('📊 Progress Bar - Chat log changed, updating progress...')
        updateProgress()
      }
    })

    // Initial update
    console.log('📊 Progress Bar - Initial update...')
    updateProgress()

    // Also update when localStorage changes (in case another tab updates it)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'matchmaking_step_progress' || e.key === 'personality_analysis_completed') {
        console.log('📊 Progress Bar - localStorage changed, updating progress...')
        updateProgress()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)

    return () => {
      unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  if (!isVisible || !stepProgress) {
    return null
  }

  const progressPercentage = (stepProgress.current / stepProgress.total) * 100

  return (
    <div className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg ${className}`}>
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

export default MatchmakingProgress 