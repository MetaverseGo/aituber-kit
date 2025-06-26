import React, { useState, useEffect, useCallback } from 'react'
import homeStore from '@/features/stores/home'
import {
  hostProfiler,
  HostIntroduction,
} from '@/features/matchmaking/host-profiler'
import { CachedTTS } from '@/features/matchmaking/cached-tts'
import Image from 'next/image'

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

interface PlayFriendsProfile {
  _id: string
  uid: string
  username: string
  profilePic?: string
  bio?: string
  birthday?: string
  gender?: string
  missionProfile?: {
    chatBadgeUrl?: string
    level?: number
    fontHexColor?: string
  }
  privileges?: {
    avatarFrame?: {
      mediaUrls?: {
        web?: string
        mobile?: string
      }
    }
  }
  score?: number
}

interface PersonalityPanelProps {
  className?: string
}

export const PersonalityPanel: React.FC<PersonalityPanelProps> = ({
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [personalityData, setPersonalityData] =
    useState<PersonalityCompletionData | null>(null)
  const [showMatches, setShowMatches] = useState(false)
  const [matches, setMatches] = useState<PlayFriendsProfile[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [hostIntroductions, setHostIntroductions] = useState<
    Map<string, HostIntroduction>
  >(new Map())
  const [generatingIntro, setGeneratingIntro] = useState(false)

  // Check if user has completed personality analysis
  const hasCompletedPersonalityAnalysis = (): boolean => {
    try {
      const completed = localStorage.getItem('personality_analysis_completed')
      const stepProgress = localStorage.getItem('matchmaking_step_progress')

      if (completed === 'true') return true

      // Also check if step progress shows completed
      if (stepProgress) {
        const progress = JSON.parse(stepProgress)
        return progress.phase === 'completed'
      }

      return false
    } catch {
      return false
    }
  }

  // Get personality completion data from chat log
  const getPersonalityCompletionData = (): PersonalityCompletionData | null => {
    try {
      const chatLog = homeStore.getState().chatLog

      // Look for the last assistant message that contains personality data
      for (let i = chatLog.length - 1; i >= 0; i--) {
        const msg = chatLog[i]
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          // Check if this message contains personality analysis completion
          if (
            msg.content.includes('Your personality analysis is complete!') ||
            msg.content.includes('personality analysis is complete!')
          ) {
            // Try to extract personality data from matchmaking result stored in localStorage
            const storedResult = localStorage.getItem('last_matchmaking_result')

            if (storedResult) {
              const result = JSON.parse(storedResult)

              if (result.data) {
                return {
                  personalityCategory: result.data.personalityCategory,
                  personalityImageUrl: result.data.personalityImageUrl,
                  profile: result.data.profile,
                }
              }
            }

            // Fallback: try to extract from the message content itself
            const categoryMatch = msg.content.match(/You are: \*\*([^*]+)\*\*/)
            if (categoryMatch) {
              return {
                personalityCategory: categoryMatch[1],
                personalityImageUrl: undefined,
                profile: undefined,
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('PersonalityPanel - Error getting personality data:', error)
    }
    return null
  }

  // Fetch matches (same logic as before)
  const fetchMatches = async () => {
    setLoadingMatches(true)
    try {
      // Hardcoded PlayFriends data
      const hardcodedData = {
        d: [
          {
            _id: '6602b3f3f930877a63e432d0',
            uid: 'pXo5lvV0IsfjqhlafueQ2KmurZ93',
            username: 'makimyo',
            updatedAt: '2025-06-05T15:15:11.859Z',
            profilePic:
              'https://cdn.playfriends.gg/profile/pXo5lvV0IsfjqhlafueQ2KmurZ93/pXo5lvV01748364878765.jpeg',
            bio: "Hiya, I'm Maki, sometimes a vtuber, sometimes not (ᵔᴥᵔ) .ᐟ Streamer, Gamer, Cosplayer⋆⁺₊⋆ I suck at every game but will flirt with you so u dont realize ✦ ENG/ESP ✦ Marvel Rivals/R.E.P.O/Fortnite/Minecraft/Valorant✦ Chronically online ୨୧",
            birthday: '1998-04-03T04:00:00.000Z',
            gender: 'female',
            missionProfile: {
              chatBadgeUrl:
                'https://images.playfriends.gg/assets/icons/level/c_level_20.webp',
              level: 23,
              fontHexColor: '444444',
            },
            privileges: {
              avatarFrame: {
                mediaUrls: {
                  mobile:
                    'https://images.playfriends.gg/avatar-frames/honey/whitebera.webp',
                  web: 'https://images.playfriends.gg/avatar-frames/honey/whitebera.webp',
                },
              },
            },
            score: 6.548709869384766,
          },
          {
            _id: '66c0afc264fc566d54a9ede9',
            uid: 'vQz0h1MSLHgWHPVUYCCGfOPvG1r1',
            username: 'LulabbaeVT',
            updatedAt: '2025-06-05T22:00:24.160Z',
            bio: 'Quirky indoor blue lady  .ᐟ ᢉ𐭩 \nVtuber • ASMRist • Gamer friend .ᐟ.ᐟ \nfollow me 4 updates',
            birthday: '1998-06-21T22:00:00.000Z',
            gender: 'female',
            profilePic:
              'https://cdn.playfriends.gg/profile/vQz0h1MSLHgWHPVUYCCGfOPvG1r1/vQz0h1MS1748712698690.jpeg',
            missionProfile: {
              chatBadgeUrl:
                'https://images.playfriends.gg/assets/icons/level/c_level_10.webp',
              level: 19,
              fontHexColor: '623F3C',
            },
            privileges: {},
            score: 6.2369160652160645,
          },
          {
            _id: '65d812e5e95c49a61482b518',
            uid: 'yM6xRoc8NCN9AGL4srfFsnfxSxm2',
            username: 'Gisellestyle',
            updatedAt: '2025-06-05T22:23:01.737Z',
            profilePic:
              'https://cdn.playfriends.gg/profile/yM6xRoc8NCN9AGL4srfFsnfxSxm2/yM6xRoc81736819440988.jpeg',
            bio: 'Hi Cuties! Im Giselle, Your Favorite Latina mami ;) Im the gamer in the basament! We can have some fun talking or playing games :3',
            birthday: '2000-08-01T04:00:00.000Z',
            gender: 'female',
            missionProfile: {
              chatBadgeUrl:
                'https://images.playfriends.gg/assets/icons/level/c_level_10.webp',
              level: 12,
              fontHexColor: '623F3C',
            },
            privileges: {
              avatarFrame: {
                mediaUrls: {
                  mobile:
                    'https://images.playfriends.gg/avatar-frames/valentines-2025/heartfeltgiver.webp',
                  web: 'https://images.playfriends.gg/avatar-frames/valentines-2025/heartfeltgiver.webp',
                },
              },
            },
            score: 6.075096130371094,
          },
          {
            _id: '65cc43a2dd4a2767b322d7b2',
            uid: 'ryC4hZdKIbVHUQQHdN1HQpawQiT2',
            username: 'Eris',
            updatedAt: '2025-06-05T18:51:55.266Z',
            profilePic:
              'https://cdn.playfriends.gg/profile/ryC4hZdKIbVHUQQHdN1HQpawQiT2/ryC4hZdK1748521380695.jpeg',
            bio: 'You look lonely\nTop Host | PH & JP | I can play any games you want <3\nTwt/IG: itseriiiis',
            birthday: '2003-06-25T16:00:00.000Z',
            gender: 'female',
            missionProfile: {
              chatBadgeUrl:
                'https://images.playfriends.gg/assets/icons/level/c_level_20.webp',
              level: 21,
              fontHexColor: '444444',
            },
            privileges: {
              avatarFrame: {
                mediaUrls: {
                  mobile:
                    'https://images.playfriends.gg/avatar-frames/pudgy/pudgypenguinsama.webp',
                  web: 'https://images.playfriends.gg/avatar-frames/pudgy/pudgypenguinsama.webp',
                },
              },
            },
            score: 6.047693729400635,
          },
          {
            _id: '65cbe9661e613cefb0f15d00',
            username: 'aixaixbaby',
            profilePic:
              'https://cdn.playfriends.gg/profile/gKcWbYMX5bSiq3UBiudgfL7lqnH3/gKcWbYMX1748936202019.png',
            uid: 'gKcWbYMX5bSiq3UBiudgfL7lqnH3',
            updatedAt: '2025-06-04T17:58:49.601Z',
            bio: "it's aix, like yikes without the y ✿ professional yapper, variety streamer, gamer gremlin ✿ top host! ✿ \n\nEN/FIL ✿ Karaoke, Doodles & Tarot! ✿ League/TFT/Valorant/Rivals/Co-op games ✿ available on APAC (SG/PH/OCE etc.) & NA West servers ✿",
            birthday: '2001-01-19T16:00:00.000Z',
            gender: 'female',
            missionProfile: {
              chatBadgeUrl:
                'https://images.playfriends.gg/assets/icons/level/c_level_10.webp',
              level: 17,
              fontHexColor: '623F3C',
            },
            privileges: {},
            score: 6.114530563354492,
          },
        ],
      }

      await new Promise((resolve) => setTimeout(resolve, 800))

      setMatches(hardcodedData.d)
      setCurrentMatchIndex(0)
      setShowMatches(true)

      // Generate introduction for the first match
      if (hardcodedData.d.length > 0) {
        setTimeout(() => {
          generateAndSpeakIntroduction(hardcodedData.d[0])
        }, 1000)
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoadingMatches(false)
    }
  }

  const nextMatch = () => {
    // Stop any currently playing audio when switching matches
    CachedTTS.stopAudio()

    if (currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1)
    } else {
      setCurrentMatchIndex(0) // Loop back to first
    }
  }

  const generateAndSpeakIntroduction = async (host: PlayFriendsProfile) => {
    if (generatingIntro || hostIntroductions.has(host.uid)) return

    setGeneratingIntro(true)
    console.log(`🎤 Generating introduction for ${host.username}`)

    try {
      // Get user personality from stored result
      const storedResult = localStorage.getItem('last_matchmaking_result')
      let userPersonalityId = 'soft-angel-girl' // default fallback

      if (storedResult) {
        try {
          const result = JSON.parse(storedResult)
          userPersonalityId =
            result.data?.profile?.category?.id || userPersonalityId
        } catch (e) {
          console.error('Error parsing stored result:', e)
        }
      }

      const introduction = await hostProfiler.generateHostIntroduction(
        host,
        userPersonalityId
      )
      console.log(
        `✅ Generated introduction for ${host.username}:`,
        introduction.introduction
      )

      setHostIntroductions((prev) => new Map(prev.set(host.uid, introduction)))

      // Speak the introduction using CachedTTS with proper parameters
      await CachedTTS.speakWithCache(
        host.uid,
        userPersonalityId,
        introduction.introduction
      )
      console.log(`🔊 Speaking introduction for ${host.username}`)
    } catch (error) {
      console.error(
        `❌ Error generating introduction for ${host.username}:`,
        error
      )
    } finally {
      setGeneratingIntro(false)
    }
  }

  const connectWithMatch = (profile: PlayFriendsProfile) => {
    console.log('Connecting with match:', profile.username)
    // Navigate to PlayFriends profile page
    const profileUrl = `https://app.playfriends.gg/profile/${profile.uid}`
    window.open(profileUrl, '_blank', 'noopener,noreferrer')
  }

  const calculateAge = (birthday: string) => {
    const birthDate = new Date(birthday)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--
    }

    return age
  }

  // Update panel visibility
  const updatePanel = useCallback(() => {
    const completed = hasCompletedPersonalityAnalysis()
    const hasDismissed =
      localStorage.getItem('personality_panel_dismissed') === 'true'

    console.log('PersonalityPanel - Update panel:', { completed, hasDismissed })

    // If user has dismissed the panel, never show it again
    if (hasDismissed) {
      console.log('PersonalityPanel - Panel was dismissed, staying hidden')
      setIsVisible(false)
      return
    }

    if (completed) {
      const completionData = getPersonalityCompletionData()
      if (completionData) {
        console.log(
          'PersonalityPanel - Showing completion panel with data:',
          completionData
        )
        setPersonalityData(completionData)
        setIsVisible(true)
      }
    } else {
      console.log('PersonalityPanel - Hiding panel')
      setIsVisible(false)
    }
  }, [])

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = homeStore.subscribe((state, prevState) => {
      // Only check for updates if panel hasn't been permanently dismissed
      if (
        state.chatLog !== prevState.chatLog &&
        localStorage.getItem('personality_panel_dismissed') !== 'true'
      ) {
        updatePanel()
      }
    })

    updatePanel() // Initial check

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'personality_analysis_completed' ||
        e.key === 'matchmaking_step_progress'
      ) {
        updatePanel()
      }

      // If panel gets dismissed via storage event, immediately hide it and stop audio
      if (e.key === 'personality_panel_dismissed' && e.newValue === 'true') {
        console.log(
          'PersonalityPanel - Panel dismissed via storage, hiding immediately'
        )
        CachedTTS.stopAudio()
        setIsVisible(false)
        setPersonalityData(null)
      }
    }

    const handleShowPersonalityPanel = () => {
      console.log('PersonalityPanel - Explicit show request')
      localStorage.removeItem('personality_panel_dismissed')
      const completionData = getPersonalityCompletionData()
      if (completionData) {
        setPersonalityData(completionData)
        setIsVisible(true)
        setShowMatches(false)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('showPersonalityPanel', handleShowPersonalityPanel)

    return () => {
      unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(
        'showPersonalityPanel',
        handleShowPersonalityPanel
      )
      // Stop any playing audio when component unmounts
      CachedTTS.stopAudio()
    }
  }, [updatePanel])

  if (!isVisible || !personalityData) {
    return null
  }

  // Show matches view
  if (showMatches && matches.length > 0) {
    const currentMatch = matches[currentMatchIndex]
    const age = currentMatch.birthday
      ? calculateAge(currentMatch.birthday)
      : null

    return (
      <div className={`fixed top-0 right-0 bottom-0 w-80 z-[60] ${className}`}>
        <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col relative">
          {/* Close Button */}
          <button
            onClick={() => {
              CachedTTS.stopAudio()
              setShowMatches(false)
              setMatches([])
              setCurrentMatchIndex(0)
            }}
            className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white rounded-full shadow-md transition-colors z-10"
            title="Close matches"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-4 p-6 pb-0">
            <div className="text-lg font-semibold text-purple-600 mb-2">
              Your Matches 💜
            </div>
            <div className="text-sm text-gray-500">
              {currentMatchIndex + 1} of {matches.length}
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 scroll-hidden">
            {/* Profile Picture with Frame */}
            <div className="relative mx-auto mb-4 flex items-center justify-center">
              {currentMatch.privileges?.avatarFrame?.mediaUrls?.web && (
                <Image
                  src={currentMatch.privileges.avatarFrame.mediaUrls.web}
                  alt="Frame"
                  className="absolute w-32 h-32 object-cover"
                  width={128}
                  height={128}
                  unoptimized
                />
              )}
              <Image
                src={currentMatch.profilePic || '/default-avatar.png'}
                alt={currentMatch.username}
                className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg relative z-10"
                width={112}
                height={112}
                unoptimized
              />
            </div>

            {/* Profile Info */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-gray-800">
                  {currentMatch.username}
                </h3>
                {currentMatch.missionProfile?.chatBadgeUrl && (
                  <Image
                    src={currentMatch.missionProfile.chatBadgeUrl}
                    alt={`Level ${currentMatch.missionProfile.level}`}
                    className="w-6 h-6"
                    width={24}
                    height={24}
                    unoptimized
                  />
                )}
              </div>

              <div className="text-sm text-gray-600 mb-2">
                {age && `${age} years old`}{' '}
                {currentMatch.gender && `• ${currentMatch.gender}`}
                {currentMatch.missionProfile?.level &&
                  ` • Level ${currentMatch.missionProfile.level}`}
              </div>
            </div>

            {/* Emi's Introduction */}
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                  <span className="text-xs text-white font-bold">E</span>
                </div>
                <span className="text-sm font-semibold text-purple-700">
                  Emi&apos;s Take
                </span>
                {generatingIntro && (
                  <div className="ml-auto flex items-center gap-1 text-xs text-purple-600">
                    <div className="animate-spin w-3 h-3 border border-purple-400 border-t-transparent rounded-full"></div>
                    Thinking...
                  </div>
                )}
              </div>

              {hostIntroductions.get(currentMatch.uid) ? (
                <p className="text-sm text-gray-700 leading-relaxed">
                  {hostIntroductions.get(currentMatch.uid)!.introduction}
                </p>
              ) : generatingIntro ? (
                <p className="text-sm text-gray-500 italic">
                  Let me tell you about {currentMatch.username}...
                </p>
              ) : (
                <button
                  onClick={() => generateAndSpeakIntroduction(currentMatch)}
                  className="text-sm text-purple-600 hover:text-purple-700 underline"
                >
                  Get Emi&apos;s introduction ➤
                </button>
              )}
            </div>
          </div>

          {/* Fixed Action Buttons at Bottom */}
          <div className="p-3 pt-0">
            {/* Tinder-style action buttons */}
            <div className="flex justify-center gap-16 mb-3 mt-4">
              <button
                onClick={nextMatch}
                className="w-14 h-14 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-xl hover:border-red-400 hover:bg-red-50 transition-all shadow-lg"
                title="Pass"
              >
                ❌
              </button>
              <button
                onClick={() => connectWithMatch(currentMatch)}
                className="w-14 h-14 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-xl hover:border-green-400 hover:bg-green-50 transition-all shadow-lg"
                title="Like"
              >
                💚
              </button>
            </div>

            {/* Back to Personality Button */}
            <button
              onClick={() => {
                CachedTTS.stopAudio()
                setShowMatches(false)
              }}
              className="w-full px-3 py-1 text-sm text-purple-600 hover:text-purple-700 transition-colors"
            >
              ← Back to Personality
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show completion panel
  return (
    <div className={`fixed top-0 right-0 bottom-0 w-80 z-[60] ${className}`}>
      {/* Right side - Personality Image Panel */}
      <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col relative">
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600 mb-6">
              Analysis Complete! 🎉
            </div>

            {personalityData.personalityImageUrl ? (
              <div className="mb-6">
                <Image
                  src={personalityData.personalityImageUrl}
                  alt={personalityData.personalityCategory || 'Personality'}
                  className="w-64 h-auto object-contain rounded-lg shadow-lg mx-auto"
                  width={256}
                  height={256}
                  unoptimized
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

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={fetchMatches}
                disabled={loadingMatches}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMatches ? 'Finding Matches...' : 'Show Matches'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const tweetText = `I just discovered my personality type: ${personalityData.personalityCategory}! 🎉 Take the personality analysis and find your perfect match! #PersonalityAnalysis #MatchMaking`
                    let tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      tweetText
                    )}`

                    if (personalityData.personalityImageUrl) {
                      tweetUrl += `&url=${encodeURIComponent(
                        personalityData.personalityImageUrl
                      )}`
                    }

                    window.open(tweetUrl, '_blank', 'width=550,height=420')
                  }}
                  className="flex-1 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  title="Share on X (Twitter)"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </button>

                <button
                  onClick={() => {
                    if (personalityData.personalityImageUrl) {
                      const link = document.createElement('a')
                      link.href = personalityData.personalityImageUrl
                      link.download = `${personalityData.personalityCategory
                        ?.toLowerCase()
                        .replace(/\s+/g, '-')}-personality.jpg`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }
                  }}
                  className="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
                  title="Download Image"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-4-4m4 4l4-4m5.78 2.22l-7.07 7.07a2 2 0 01-2.83 0L4.22 10.15a2 2 0 010-2.83l7.07-7.07a2 2 0 012.83 0L20.85 7.32a2 2 0 010 2.83z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Close Link at Bottom */}
        <div className="p-3">
          <button
            onClick={() => {
              CachedTTS.stopAudio()
              setIsVisible(false)
              setPersonalityData(null)
              localStorage.setItem('personality_panel_dismissed', 'true')
              console.log('PersonalityPanel - Panel dismissed by user')
            }}
            className="w-full px-3 py-1 text-sm text-purple-600 hover:text-purple-700 transition-colors"
          >
            ← Hide Panel
          </button>
        </div>
      </div>
    </div>
  )
}

export default PersonalityPanel
