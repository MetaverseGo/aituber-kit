import React, { useState, useEffect } from 'react'
import homeStore from '@/features/stores/home'

interface MatchmakingProgressProps {
  className?: string
}

interface PersonalityCompletionData {
  personalityCategory?: string
  personalityImageUrl?: string
  profile?: {
    category: {
      id: string
      name: string
      description: string
    }
    confidence: number
    traits: string[]
    strengths: string[]
    role: 'host' | 'guest'
  }
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
  const [personalityData, setPersonalityData] = useState<PersonalityCompletionData | null>(null)
  const [showCompletionSplit, setShowCompletionSplit] = useState(false)
  
  console.log('📊 Progress Bar - Component rendered, isVisible:', isVisible, 'stepProgress:', stepProgress, 'showCompletionSplit:', showCompletionSplit)

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

  // Get personality completion data from chat log
  const getPersonalityCompletionData = (): PersonalityCompletionData | null => {
    try {
      const chatLog = homeStore.getState().chatLog
      console.log('🔍 Checking chat log for personality completion data, length:', chatLog.length)
      
      // Look for the last assistant message that contains personality data
      for (let i = chatLog.length - 1; i >= 0; i--) {
        const msg = chatLog[i]
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          // Check if this message contains personality analysis completion
          if (msg.content.includes('Your personality analysis is complete!') || 
              msg.content.includes('personality analysis is complete!')) {
            
            console.log('🎯 Found completion message at index', i, ':', msg.content.substring(0, 100))
            
            // Try to extract personality data from matchmaking result stored in localStorage
            const storedResult = localStorage.getItem('last_matchmaking_result')
            console.log('💾 Stored matchmaking result:', storedResult ? 'Found' : 'Not found')
            
            if (storedResult) {
              const result = JSON.parse(storedResult)
              console.log('📊 Parsed result:', result)
              console.log('📊 Result data:', result.data)
              
              if (result.data) {
                const extractedData = {
                  personalityCategory: result.data.personalityCategory,
                  personalityImageUrl: result.data.personalityImageUrl,
                  profile: result.data.profile
                }
                console.log('✅ Extracted personality data:', extractedData)
                return extractedData
              }
            }
            
            // Fallback: try to extract from the message content itself
            const categoryMatch = msg.content.match(/You are: \*\*([^*]+)\*\*/)
            if (categoryMatch) {
              console.log('📝 Fallback: extracted category from message:', categoryMatch[1])
              return {
                personalityCategory: categoryMatch[1],
                personalityImageUrl: undefined,
                profile: undefined
              }
            }
          }
        }
      }
      console.log('❌ No personality completion data found in chat log')
    } catch (error) {
      console.error('📊 Progress Bar - Error getting personality data:', error)
    }
    return null
  }

  // Update progress based on real step data
  const updateProgress = () => {
    console.log('📊 Progress Bar - Updating progress...')
    
    const completed = hasCompletedPersonalityAnalysis()
    console.log('📊 Progress Bar - Personality analysis completed:', completed)
    
    if (completed) {
      console.log('📊 Progress Bar - Personality analysis completed, checking for completion data')
      const completionData = getPersonalityCompletionData()
      console.log('📊 Progress Bar - Completion data:', completionData)
      
      if (completionData) {
        setPersonalityData(completionData)
        setShowCompletionSplit(true)
        setIsVisible(true)
        setStepProgress(null)
        return
      } else if (personalityData) {
        // If we already have personality data from a previous successful load, keep showing it
        console.log('📊 Progress Bar - Using existing personality data to maintain split layout')
        setShowCompletionSplit(true)
        setIsVisible(true)
        setStepProgress(null)
        return
      } else {
        // Try fallback - if analysis is marked complete, show minimal completion UI
        console.log('📊 Progress Bar - Analysis complete but no data, showing minimal completion UI')
        setPersonalityData({
          personalityCategory: 'Analysis Complete',
          personalityImageUrl: undefined,
          profile: undefined
        })
        setShowCompletionSplit(true)
        setIsVisible(true)
        setStepProgress(null)
        return
      }
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
      setShowCompletionSplit(false)
      setPersonalityData(null)
    } else {
      console.log('📊 Progress Bar - No valid step progress, hiding. Stored progress phase:', storedProgress?.phase)
      setStepProgress(null)
      setIsVisible(false)
      setShowCompletionSplit(false)
      setPersonalityData(null)
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

  if (!isVisible) {
    return null
  }

  // Show completion split layout
  if (showCompletionSplit && personalityData) {
    console.log('🎨 Rendering split layout with personality data:', personalityData)
    return (
      <div className={`fixed top-0 right-0 bottom-0 w-80 z-40 ${className}`}>
        {/* Right side - Personality Image Panel */}
        <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col items-center justify-center p-6">
          <div className="text-center">
            <div className="text-sm text-purple-600 mb-6">
              Analysis Complete! 🎉
            </div>
            
            {personalityData.personalityImageUrl ? (
              <div className="mb-6">
                <img
                  src={personalityData.personalityImageUrl}
                  alt={personalityData.personalityCategory || 'Personality'}
                  className="w-64 h-auto object-contain rounded-lg shadow-lg mx-auto"
                  onLoad={() => {
                    console.log('✅ Personality image loaded successfully:', personalityData.personalityImageUrl)
                  }}
                  onError={(e) => {
                    console.error('❌ Personality image failed to load:', personalityData.personalityImageUrl)
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            ) : (
              <div className="mb-6 text-center">
                <div className="w-64 h-64 bg-purple-100 rounded-lg shadow-lg mx-auto flex items-center justify-center">
                  <div className="text-purple-600">
                    <div className="text-4xl mb-2">👤</div>
                    <div className="text-sm">No Image Available</div>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={() => {
                // TODO: Navigate to matches view
                console.log('🎯 Show Matches clicked - implement navigation to matches')
                // For now, just log the action
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg"
            >
              Show Matches
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show normal progress bar
  const progressPercentage = (stepProgress!.current / stepProgress!.total) * 100

  return (
    <div className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg ${className}`}>
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-xs font-bold">💜</span>
            </div>
            <span className="font-semibold text-sm">
              Question {stepProgress!.current} of {stepProgress!.total}
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