import React, { useState, useEffect } from 'react'
import { getCurrentWidgetAuthToken } from '@/features/chat/handlers'

interface ProfileData {
  datingProfile?: {
    physicalPreferences?: Record<string, any>
    servicePreferences?: Record<string, any>
    dominanceStyle?: string
  }
  profileData?: {
    preferences?: Record<string, any>
    personality?: {
      traits?: string[]
      insights?: string[]
    }
  }
  currentSession?: {
    personalityCategory?: string
    personalitySummary?: string
  }
}

export default function ProfileOverlay() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)

  console.log('🎭 ProfileOverlay - Component rendered')
  console.log('🎭 ProfileOverlay - Profile data state:', profileData)

  // Use the exported function to get the auth token
  const getWidgetAuthToken = (): string => {
    return getCurrentWidgetAuthToken()
  }

  // Fetch profile data on mount and periodically
  useEffect(() => {
    console.log('🎭 ProfileOverlay - useEffect triggered')

    const fetchProfile = async () => {
      try {
        // Get authentication token like the widget chat does
        const token = getWidgetAuthToken()
        console.log('🎭 ProfileOverlay - Got auth token:', !!token)

        if (!token) {
          console.log('🎭 ProfileOverlay - No authentication token available')
          return
        }

        const response = await fetch('/api/match-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getProfile',
            token,
          }),
        })
        console.log(
          '🎭 ProfileOverlay - Fetch response status:',
          response.status
        )

        if (response.ok) {
          const result = await response.json()
          console.log('🎭 ProfileOverlay - Fetch result:', result)

          if (result.success && result.profile) {
            console.log(
              '🎭 ProfileOverlay - Setting profile data:',
              result.profile
            )
            console.log(
              '🎭 ProfileOverlay - Dating profile:',
              result.profile.datingProfile
            )
            console.log(
              '🎭 ProfileOverlay - Service preferences:',
              result.profile.datingProfile?.servicePreferences
            )
            console.log(
              '🎭 ProfileOverlay - Conversation topics:',
              result.profile.datingProfile?.servicePreferences
                ?.conversationTopics
            )
            setProfileData(result.profile)
          } else {
            console.log(
              '🎭 ProfileOverlay - No profile data found or fetch unsuccessful'
            )
          }
        } else {
          console.log(
            '🎭 ProfileOverlay - Fetch failed with status:',
            response.status
          )
        }
      } catch (error) {
        console.error('🎭 ProfileOverlay - Error fetching profile data:', error)
      }
    }

    fetchProfile()

    // Refresh every 10 seconds
    const interval = setInterval(fetchProfile, 10000)

    return () => clearInterval(interval)
  }, [])

  // Always render the component for debugging
  console.log(
    '🎭 ProfileOverlay - About to render, profileData exists:',
    !!profileData
  )

  const renderSection = (
    title: string,
    data: Record<string, any> | undefined
  ) => {
    if (!data || Object.keys(data).length === 0) return null

    return (
      <div className="mb-3">
        <div className="font-semibold text-sm text-gray-700 mb-1">{title}:</div>
        <div className="text-xs space-y-1">
          {Object.entries(data).map(([key, value]) => {
            const displayValue = Array.isArray(value)
              ? value.join(', ')
              : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value)

            return (
              <div key={key} className="flex">
                <span className="font-medium text-gray-600 mr-2">{key}:</span>
                <span className="text-gray-800">{displayValue}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderArraySection = (title: string, data: string[] | undefined) => {
    if (!data || data.length === 0) return null

    return (
      <div className="mb-3">
        <div className="font-semibold text-sm text-gray-700 mb-1">{title}:</div>
        <div className="text-xs">
          {data.map((item, idx) => (
            <div key={idx} className="text-gray-800">
              • {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed top-4 right-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg z-50 max-w-sm">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="font-bold text-gray-800">User Profile</div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {!isMinimized && (
        <div className="p-3 max-h-80 overflow-y-auto">
          {!profileData ? (
            <div className="text-xs text-gray-500 italic">
              Loading profile data...
            </div>
          ) : (
            <>
              {/* Current Session */}
              {profileData.currentSession?.personalityCategory && (
                <div className="mb-3">
                  <div className="font-semibold text-sm text-gray-700 mb-1">
                    Personality:
                  </div>
                  <div className="text-xs text-gray-800">
                    {profileData.currentSession.personalityCategory}
                  </div>
                  {profileData.currentSession.personalitySummary && (
                    <div className="text-xs text-gray-600 mt-1">
                      {profileData.currentSession.personalitySummary}
                    </div>
                  )}
                </div>
              )}

              {/* Physical Preferences */}
              {renderSection(
                'Physical Preferences',
                profileData.datingProfile?.physicalPreferences
              )}

              {/* Service Preferences */}
              {renderSection(
                'Service Preferences',
                profileData.datingProfile?.servicePreferences
              )}

              {/* Dominance Style */}
              {profileData.datingProfile?.dominanceStyle && (
                <div className="mb-3">
                  <div className="font-semibold text-sm text-gray-700 mb-1">
                    Dominance Style:
                  </div>
                  <div className="text-xs text-gray-800">
                    {profileData.datingProfile.dominanceStyle}
                  </div>
                </div>
              )}

              {/* Personality Traits */}
              {renderArraySection(
                'Personality Traits',
                profileData.profileData?.personality?.traits
              )}

              {/* Insights */}
              {renderArraySection(
                'Insights',
                profileData.profileData?.personality?.insights
              )}

              {/* General Preferences */}
              {renderSection(
                'Preferences',
                profileData.profileData?.preferences
              )}

              {/* Empty state */}
              {!profileData.datingProfile &&
                !profileData.profileData &&
                !profileData.currentSession && (
                  <div className="text-xs text-gray-500 italic">
                    No profile data available yet. Start chatting to build your
                    profile!
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
