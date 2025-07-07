import React, { useState, useEffect } from 'react'

interface ProfileData {
  physicalPreferences?: {
    height?: string[]
    build?: string[]
    ethnicity?: string[]
    style?: string[]
    attractionTags?: string[]
    dealBreakers?: string[]
  }
  relationshipStyle?: {
    type?: string[]
  }
  intimacyComfort?: string[]
  dominanceStyle?: string[]
  demographics?: {
    agePreference?: string[]
    locationImportance?: string[]
    experienceLevel?: string[]
  }
  servicePreferences?: {
    primaryServices?: string[]
    mood?: string[]
    interactionStyle?: string[]
    conversationTopics?: string[]
    sessionLength?: string[]
  }
}

interface ProfileOverlayProps {
  isVisible: boolean
  onClose: () => void
}

export const ProfileOverlay: React.FC<ProfileOverlayProps> = ({
  isVisible,
  onClose,
}) => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isVisible) {
      loadProfileData()
    }
  }, [isVisible])

  const loadProfileData = async () => {
    setIsLoading(true)
    try {
      // Try to load from localStorage first
      const localProfile = localStorage.getItem('user_profile')
      if (localProfile) {
        setProfileData(JSON.parse(localProfile))
      } else {
        // Load empty profile structure
        setProfileData({})
      }
    } catch (error) {
      console.error('Error loading profile data:', error)
      setProfileData({})
    } finally {
      setIsLoading(false)
    }
  }

  const renderProfileSection = (title: string, data: any, isArray = false) => {
    if (!data) return null

    const hasData = isArray
      ? Array.isArray(data) && data.length > 0
      : typeof data === 'object' && Object.keys(data).length > 0

    if (!hasData) return null

    return (
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
        {isArray ? (
          <div className="flex flex-wrap gap-1">
            {data.map((item: string, index: number) => (
              <span
                key={index}
                className="px-2 py-1 bg-pink-100 text-pink-800 rounded text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(data).map(([key, value]) => {
              if (Array.isArray(value) && value.length > 0) {
                return (
                  <div key={key}>
                    <h4 className="text-sm font-medium text-gray-700 mb-1 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {value.map((item: string, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              }
              return null
            })}
          </div>
        )}
      </div>
    )
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto m-4 w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Your Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            <span className="ml-2 text-gray-600">Loading your profile...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-6 p-4 bg-pink-50 rounded-lg border border-pink-200">
              <h3 className="font-semibold text-pink-800 mb-2">
                🌸 What MamaSan Knows About You
              </h3>
              <p className="text-sm text-pink-700">
                This shows the preferences and interests that MamaSan has
                learned through your conversations. The more you chat, the
                better she gets to know you!
              </p>
            </div>

            {!profileData || Object.keys(profileData).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">🎭 No profile data yet!</p>
                <p className="text-sm">
                  Start chatting with MamaSan to build your profile.
                </p>
              </div>
            ) : (
              <>
                {renderProfileSection(
                  'Physical Preferences',
                  profileData.physicalPreferences
                )}
                {renderProfileSection(
                  'Relationship Style',
                  profileData.relationshipStyle
                )}
                {renderProfileSection(
                  'Intimacy Comfort',
                  profileData.intimacyComfort,
                  true
                )}
                {renderProfileSection(
                  'Dominance Style',
                  profileData.dominanceStyle,
                  true
                )}
                {renderProfileSection('Demographics', profileData.demographics)}
                {renderProfileSection(
                  'Service Preferences',
                  profileData.servicePreferences
                )}
              </>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                This data is stored locally and helps MamaSan provide better
                recommendations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
