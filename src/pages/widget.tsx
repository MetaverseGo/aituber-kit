import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { WidgetForm } from '@/components/widgetForm'
import VrmViewer from '@/components/vrmViewer'
import Live2DViewer from '@/components/live2DViewer'
import { Toasts } from '@/components/toasts'
import MatchmakingProgress from '@/components/MatchmakingProgress'
import PersonalityPanel from '@/components/PersonalityPanel'

import VrmExpressionTester from '@/components/ui/VrmExpressionTester'
import ProfileOverlay from '@/components/ui/ProfileOverlay'
import PngEmotionDisplay from '@/components/ui/PngEmotionDisplay'
import VidBackgroundDisplay from '@/components/ui/VidBackgroundDisplay'
import { useEmotionImage } from '@/hooks/useEmotionImage'
import { useVideoSource } from '@/hooks/useVideoSource'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/lib/i18n'
import { buildUrl } from '@/utils/buildUrl'
import { MamaSanSpecialist } from '@/features/matchmaking/mama-san-specialist'
import {
  handleWidgetChatFn,
  getCurrentWidgetAuthToken,
} from '@/features/chat/handlers'
import {
  playfriendsClient,
  type ProfileCardData,
} from '@/lib/playfriendsClient'
import Image from 'next/image'

// Check if TTS is disabled via URL parameter
const isTTSDisabled = (): boolean => {
  if (typeof window === 'undefined') return false
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('disableTTS') === 'true'
}

/**
 * CHAT_ACTION_CARD_CLICK Handler Documentation
 * ===========================================
 *
 * This widget handles action card clicks and supports multiple action types:
 * 1. Profile recommendations using mock host recommendation logic
 * 2. Response suggestions that send user messages directly to chat
 *
 * ## Input Payload Structure
 *
 * The parent should send this message when a user clicks an action card:
 *
 * ```typescript
 * {
 *   type: 'CHAT_ACTION_CARD_CLICK',
 *   data: {
 *     actionId?: string,    // ID of the action card (for profile recommendations)
 *     actionType: string,   // Type of action (send_message, follow, subscribe, etc.)
 *     actionData?: any,     // Action-specific data
 *     timestamp: number,    // Unix timestamp
 *     userId: string        // ID of the user performing the action
 *   }
 * }
 * ```
 *
 * ## Supported Action Types
 *
 * ### 1. send_message Action
 * For response suggestion buttons that send messages as if the user typed them:
 *
 * ```typescript
 * {
 *   type: 'CHAT_ACTION_CARD_CLICK',
 *   data: {
 *     actionType: 'send_message',
 *     actionData: {
 *       message: string,        // The message to send (e.g., "sounds good!")
 *       messageType?: string    // Optional type (e.g., "suggestion")
 *     },
 *     timestamp: number,
 *     userId: string
 *   }
 * }
 * ```
 *
 * This will process the message through the normal chat flow as if the user typed it.
 *
 * ### 2. Profile Recommendation Actions
 * For cards that trigger host profile recommendations, use actionId:
 *
 * #### Supported Action IDs:
 * - `"cute-anime"` - Anime and kawaii culture enthusiasts
 * - `"gaming-creators"` - Gaming streamers and content creators
 * - `"vtuber-recs"` - VTuber recommendation specialists
 * - `"kawaii-content"` - Kawaii lifestyle and content creators
 *
 * ## Output Payload Structure
 *
 * The widget responds by sending 1 `CHAT_MESSAGE_RECEIVE` message with a randomly selected profile:
 *
 * ```typescript
 * {
 *   type: 'CHAT_MESSAGE_RECEIVE',
 *   data: {
 *     role: 'assistant',
 *     content: string,           // Personalized greeting message
 *     timestamp: string,         // ISO timestamp
 *     metadata: {
 *       profileCard: true,       // Indicates this is a profile card
 *       profileData: {
 *         id: string,            // Unique profile ID
 *         name: string,          // Character name
 *         message: string,       // Same as content
 *         description: string,   // Profile summary
 *         interests: string[],   // Array of interest tags
 *         personality: string[], // Array of personality traits
 *         profileImage?: string  // Path to character image
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * ## Parent Consumption Guide
 *
 * ### 1. Detecting Profile Cards
 * ```typescript
 * window.addEventListener('message', (event) => {
 *   if (event.data.type === 'CHAT_MESSAGE_RECEIVE') {
 *     const isProfileCard = event.data.data?.metadata?.profileCard === true
 *
 *     if (isProfileCard) {
 *       // Handle as profile card
 *       const profileData = event.data.data.metadata.profileData
 *       renderProfileCard(profileData)
 *     } else {
 *       // Handle as regular chat message
 *       renderChatMessage(event.data.data)
 *     }
 *   }
 * })
 * ```
 *
 * ### 2. Profile Data Structure
 * ```typescript
 * interface ProfileData {
 *   id: string              // "seira-001", "eris-001", etc.
 *   name: string            // "Seira", "Eris", etc.
 *   message: string         // Personalized greeting
 *   description: string     // Short bio/description
 *   interests: string[]     // ["anime", "kawaii", "art"]
 *   personality: string[]   // ["gentle", "sweet", "creative"]
 *   profileImage?: string   // "https://localhost:3000/images/mockdata/seira.png"
 * }
 * ```
 *
 * ### 3. Example Implementation
 * ```typescript
 * function handleProfileCard(profileData: ProfileData) {
 *   // Create profile card UI
 *   const cardElement = document.createElement('div')
 *   cardElement.className = 'profile-card'
 *
 *   cardElement.innerHTML = `
 *     <img src="${profileData.profileImage}" alt="${profileData.name}" />
 *     <h3>${profileData.name}</h3>
 *     <p>${profileData.description}</p>
 *     <div class="interests">
 *       ${profileData.interests.map(i => `<span class="tag">${i}</span>`).join('')}
 *     </div>
 *     <div class="personality">
 *       ${profileData.personality.map(p => `<span class="trait">${p}</span>`).join('')}
 *     </div>
 *   `
 *
 *   // Add click handler for profile interaction
 *   cardElement.addEventListener('click', () => {
 *     // Send message to widget to start conversation with this profile
 *     widget.postMessage({
 *       type: 'CHAT_MESSAGE_SEND',
 *       data: {
 *         content: `I'd like to chat with ${profileData.name}!`,
 *         timestamp: Date.now(),
 *         userId: currentUserId
 *       }
 *     }, '*')
 *   })
 *
 *   // Append to profile container
 *   document.getElementById('profile-cards-container').appendChild(cardElement)
 * }
 * ```
 *
 * ### 4. Message Timing
 * - Single message sent immediately upon action card click
 * - No delays or multiple messages to handle
 * - Instant delivery of one randomly selected profile
 *
 * ### 5. Error Handling
 * If actionId validation fails, no messages will be sent.
 * Check browser console for detailed error logs starting with `🔥 [Widget]`
 */

interface WidgetConfig {
  // Display options
  width?: string
  height?: string
  theme?: 'light' | 'dark' | 'minimal'
  showBackground?: boolean
  showCharacter?: boolean
  backgroundColor?: string

  // Character options
  characterModel?: string
  characterName?: string
  systemPrompt?: string

  // UI options
  showInput?: boolean
  showChatLog?: boolean
  showSettingsButton?: boolean

  // Functional options
  apiKey?: string
  aiService?: string
  model?: string
  autoFocus?: boolean

  // Parent communication
  postMessages?: boolean
  allowFullscreen?: boolean

  // New config options
  showVrmExpressionTester?: boolean
  disableTTS?: boolean
  showProfileOverlay?: boolean
}

// Profile card generator using Playfriends API
const generateProfileCards = async (
  actionId: string
): Promise<ProfileCardData[]> => {
  console.log('🔥 [Widget] ===== GENERATE PROFILE CARDS START =====')
  console.log('🔥 [Widget] ActionId received:', actionId)

  try {
    // Map actionId to search keywords
    const searchKeywords: Record<string, string> = {
      'cute-anime': 'anime',
      'gaming-creators': 'gaming',
      'vtuber-recs': 'vtuber',
      'kawaii-content': 'kawaii',
    }

    const searchQuery = searchKeywords[actionId] || 'anime'
    console.log('🔥 [Widget] Mapped to search query:', searchQuery)
    console.log('🔥 [Widget] About to call playfriendsClient.search...')

    // Fetch users from Playfriends API
    const users = await playfriendsClient.search(searchQuery)
    console.log(
      '🔥 [Widget] ✅ Playfriends API SUCCESS! Returned:',
      users.length,
      'users'
    )
    console.log(
      '🔥 [Widget] First user sample:',
      users[0]
        ? { name: users[0].username, bio: users[0].bio?.substring(0, 50) }
        : 'No users'
    )

    if (users.length === 0) {
      console.log('🔥 [Widget] ❌ No users found, falling back to mock data')
      const mockCards = getMockProfileCards(actionId)
      console.log(
        '🔥 [Widget] Returning',
        mockCards.length,
        'mock profile cards'
      )
      return mockCards
    }

    // Transform Playfriends users to profile cards
    console.log('🔥 [Widget] 🔄 Transforming users to profile cards...')
    const profileCards = users
      .slice(0, 10) // Limit to first 10 results
      .map(user => {
        console.log('🔥 [Widget] Transforming user:', user.username)
        return playfriendsClient.transformToProfileCard(user, actionId)
      })

    console.log(
      '🔥 [Widget] ✅ Transformed',
      profileCards.length,
      'profile cards'
    )
    console.log('🔥 [Widget] Sample profile card:', {
      name: profileCards[0]?.name,
      message: profileCards[0]?.message?.substring(0, 50),
      interests: profileCards[0]?.interests,
    })
    console.log('🔥 [Widget] ===== RETURNING REAL API DATA =====')
    return profileCards
  } catch (error) {
    console.error('🔥 [Widget] ❌ CAUGHT ERROR in generateProfileCards:', error)
    console.error('🔥 [Widget] Error type:', (error as Error).constructor.name)
    console.error('🔥 [Widget] Error message:', (error as Error).message)
    console.error('🔥 [Widget] Full error object:', error)
    console.error(
      '🔥 [Widget] ===== FALLING BACK TO MOCK DATA DUE TO ERROR ====='
    )

    // Fallback to mock data on error
    const mockCards = getMockProfileCards(actionId)
    console.log(
      '🔥 [Widget] Returning',
      mockCards.length,
      'mock profile cards as fallback'
    )
    return mockCards
  }
}

// Fallback mock data for when API is unavailable
const getMockProfileCards = (actionId: string): ProfileCardData[] => {
  // Get the base URL for the widget
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`
    }
    return 'https://localhost:3000' // Fallback for SSR
  }

  const baseUrl = getBaseUrl()

  const profiles: Record<string, ProfileCardData[]> = {
    'cute-anime': [
      {
        id: 'seira-001',
        name: 'Seira',
        message:
          'Hi! I love cute anime and kawaii culture! 🌸 Want to chat about magical girls or cozy slice-of-life series? I know all the best hidden gems! ✨',
        description:
          'Sweet anime enthusiast who loves discussing magical girl series and kawaii culture',
        interests: ['anime', 'kawaii', 'magical-girls', 'art'],
        personality: ['gentle', 'sweet', 'creative'],
        profileImage: `${baseUrl}/images/mockdata/seira.png`,
      },
    ],
    'gaming-creators': [
      {
        id: 'eris-001',
        name: 'Eris',
        message:
          "A fellow gamer, I see! 🎮 I stream competitive FPS and love strategy games. Want to team up for some matches or talk game development? I'm always down for a challenge!",
        description:
          'Competitive gaming streamer with expertise in FPS and strategy games',
        interests: ['gaming', 'streaming', 'esports', 'game-development'],
        personality: ['competitive', 'confident', 'strategic'],
        profileImage: `${baseUrl}/images/mockdata/eris.png`,
      },
    ],
    'vtuber-recs': [
      {
        id: 'kiwi-vt-001',
        name: 'Kiwi',
        message:
          'Ooh, VTuber recommendations! Want to discover amazing creators? I know tons of VTubers with different vibes - what kind of content do you like? I can recommend the perfect ones for you!',
        description:
          'VTuber enthusiast with encyclopedic knowledge of streamers and content styles',
        interests: ['vtubers', 'streaming', 'entertainment', 'community'],
        personality: ['enthusiastic', 'knowledgeable', 'helpful'],
        profileImage: `${baseUrl}/images/mockdata/kiwi.png`,
      },
    ],
    'kawaii-content': [
      {
        id: 'seira-kawaii-001',
        name: 'Seira',
        message:
          'Kawaii content! (^_^) You have excellent taste! I love everything kawaii - from fashion to room decor to the cutest accessories. Want to share kawaii finds together?',
        description:
          'Kawaii culture enthusiast with a passion for cute fashion and lifestyle',
        interests: ['kawaii', 'fashion', 'lifestyle', 'decor'],
        personality: ['cute', 'stylish', 'trend-aware'],
        profileImage: `${baseUrl}/images/mockdata/seira.png`,
      },
    ],
  }

  return profiles[actionId] || profiles['cute-anime'] // Default fallback
}

// Move getModelType outside the component to prevent re-renders
const getModelType = () => {
  // Force 'vid' mode for testing
  return 'vid'
  // If you want to use the env variable:
  // return process.env.NEXT_PUBLIC_MODEL_TYPE || 'vrm'
}

// Define modelType outside the component
const modelType = getModelType()

const Widget = () => {
  console.log('🔧 Widget component mounting...')

  // Global message listener that's always active - for debugging
  if (typeof window !== 'undefined') {
    const globalListener = (event: MessageEvent) => {
      console.log('🌍 GLOBAL LISTENER: Message received!', {
        type: event.data?.type,
        origin: event.origin,
        hasData: !!event.data,
        timestamp: Date.now(),
      })
    }

    // Only add if not already added
    if (!(window as any).globalListenerAdded) {
      window.addEventListener('message', globalListener)
      ;(window as any).globalListenerAdded = true
      console.log('🌍 Global message listener added')
    }
  }

  const router = useRouter()
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatScrollRefHidden = useRef<HTMLDivElement>(null)
  const [config, setConfig] = useState<WidgetConfig>({
    width: '800px',
    height: '600px',
    theme: 'light',
    showBackground: true,
    showCharacter: true,
    showInput: true,
    showChatLog: true,
    showSettingsButton: false,
    autoFocus: true,
    postMessages: true,
    allowFullscreen: false,
    showVrmExpressionTester: false,
    disableTTS: false,
    showProfileOverlay: false,
  })

  console.log('🔧 Widget initial config:', config)

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Model loaded state and fade-out (moved below authChecked/isAuthenticated)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [showEmiScreen, setShowEmiScreen] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  // Model loading detection
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (!modelLoaded && authChecked && isAuthenticated) {
      if (modelType === 'vrm') {
        interval = setInterval(() => {
          const viewer = homeStore.getState().viewer
          const hasModel = !!(viewer && viewer.model && viewer.model.vrm)
          console.log(
            '[DEBUG] VRM model loaded check:',
            hasModel,
            viewer?.model
          )
          if (hasModel) {
            setModelLoaded(true)
            if (interval) clearInterval(interval)
          }
        }, 200)
      } else if (modelType === 'live2d') {
        interval = setInterval(() => {
          const isCubismCoreLoaded = homeStore.getState().isCubismCoreLoaded
          const live2dViewer = homeStore.getState().live2dViewer
          const hasModel = !!(isCubismCoreLoaded && live2dViewer)
          console.log(
            '[DEBUG] Live2D model loaded check:',
            hasModel,
            isCubismCoreLoaded,
            live2dViewer
          )
          if (hasModel) {
            setModelLoaded(true)
            if (interval) clearInterval(interval)
          }
        }, 200)
      }
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [modelLoaded, authChecked, isAuthenticated])

  // Fade out Emi screen after model loads
  useEffect(() => {
    if (modelLoaded && showEmiScreen) {
      setFadeOut(true)
      const timeout = setTimeout(() => {
        setShowEmiScreen(false)
      }, 700) // 700ms fade duration
      return () => clearTimeout(timeout)
    }
  }, [modelLoaded, showEmiScreen])

  // Zustand store subscriptions (moved inside component to prevent re-render loops)
  const backgroundImageUrl = homeStore(s => s.backgroundImageUrl)
  const chatLog = homeStore(s => s.chatLog)

  console.log('🔧 Widget auth state:', {
    isAuthenticated,
    authChecked,
    authError,
  })

  // Function to send chat history to parent
  const sendChatHistoryToParent = useCallback(() => {
    if (!config.postMessages) return

    const currentChatLog = homeStore.getState().chatLog
    console.log(
      '🎪 Widget - Sending chat history to parent. Total messages:',
      currentChatLog.length
    )

    if (currentChatLog.length === 0) {
      console.log('🎪 Widget - No chat history to send')
      return
    }

    // Get last 2 messages for context
    const recentMessages = currentChatLog.slice(-2).map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }))

    console.log(
      '🎪 Widget - Sending recent messages to parent:',
      recentMessages
    )

    window.parent.postMessage(
      {
        type: 'WIDGET_CHAT_HISTORY',
        messages: recentMessages,
        totalMessages: currentChatLog.length,
      },
      '*'
    )
  }, [config.postMessages])

  // Send chat history when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && authChecked && config.postMessages) {
      console.log('🎪 Widget - User authenticated, sending chat history...')
      sendChatHistoryToParent()
    }
  }, [
    isAuthenticated,
    authChecked,
    sendChatHistoryToParent,
    config.postMessages,
  ])

  // PNG mode integration
  const [emotionImage, setEmotion, emotion] = useEmotionImage('neutral')
  // VID mode integration
  const [videoSrc, setVideoSrc, videoLabel] = useVideoSource(
    '/vids/emigg/neutral.mp4',
    'neutral'
  )

  // Add this handler function inside the Widget component:
  const handleMatchmakingResponse = useCallback(
    (data: any) => {
      console.log('🎭 [Widget] handleMatchmakingResponse called with:', {
        data,
        hasData: !!data,
        emotion: data?.emotion,
        modelType,
      })

      if (!data) {
        console.log('🎭 [Widget] No data provided to handleMatchmakingResponse')
        return
      }

      if (modelType === 'png' && data.emotion) {
        console.log('🎭 [Widget] PNG mode - setting emotion:', data.emotion)
        setEmotion(data.emotion)
      } else if (modelType === 'vid' && data.emotion) {
        console.log(
          '🎭 [Widget] VID mode - setting video:',
          `/vids/emigg/${data.emotion}.mp4`
        )
        setVideoSrc(`/vids/emigg/${data.emotion}.mp4`, data.emotion)
      } else {
        console.log(
          '🎭 [Widget] No emotion handling - modelType:',
          modelType,
          'emotion:',
          data.emotion
        )
      }
    },
    [setEmotion, setVideoSrc]
  )

  // Memoize postMessages to prevent unnecessary re-renders
  const postMessagesEnabled = useMemo(
    () => config.postMessages,
    [config.postMessages]
  )

  // Listen for all widget events (auth, chat, config, etc.)
  useEffect(() => {
    const effectId = Math.random().toString(36).substr(2, 9)
    console.log(`🔧 Widget message listener useEffect #${effectId} running...`)

    function handleAllMessages (event: MessageEvent) {
      if (!event.data) {
        return
      }

      // Handle WIDGET_AUTH
      if (event.data.type === 'WIDGET_AUTH' && event.data.token) {
        console.log('🔥 [Widget] Processing WIDGET_AUTH event')
        setIsAuthenticated(true)
        setAuthChecked(true)
        setAuthError(null)
        return
      }

      // Only handle other message types if postMessages is enabled
      if (!postMessagesEnabled) {
        return
      }

      // Handle WIDGET_CONFIG
      if (event.data.type === 'WIDGET_CONFIG') {
        console.log('[Widget] Processing WIDGET_CONFIG event')
        setConfig(prev => ({ ...prev, ...event.data.config }))
        return
      }

      // Handle SEND_MESSAGE (legacy)
      if (event.data.type === 'SEND_MESSAGE') {
        console.log('[Widget] Processing SEND_MESSAGE event (legacy)')
        const form = document.querySelector('form')
        const input = form?.querySelector(
          'input[type="text"]'
        ) as HTMLInputElement
        if (input) {
          input.value = event.data.message
          form?.dispatchEvent(new Event('submit'))
        }
        return
      }

      // Handle CHAT_MESSAGE_SEND
      if (event.data.type === 'CHAT_MESSAGE_SEND') {
        console.log('🔥 [Widget] === PROCESSING CHAT_MESSAGE_SEND ===')

        const { content, media, timestamp, userId } = event.data.data || {}

        if (content && typeof content === 'string') {
          console.log('🔥 [Widget] ✅ Content validation passed!')

          // Check if we have an auth token before processing
          const currentToken = getCurrentWidgetAuthToken()

          if (!currentToken) {
            console.error(
              '🔥 [Widget] ❌ No auth token - cannot process message'
            )
            window.parent.postMessage(
              { type: 'WIDGET_ERROR', reason: 'no_auth_token' },
              '*'
            )
            return
          }

          // Process through the widget chat handler
          console.log(
            '🔥 [Widget] ✅ Auth check passed - calling widget chat handler...'
          )

          const widgetChatHandler = handleWidgetChatFn()
          widgetChatHandler(content).catch(error => {
            console.error('🔥 [Widget] ❌ Chat handler error:', error)
            window.parent.postMessage(
              {
                type: 'WIDGET_ERROR',
                reason: 'chat_handler_error',
                error: String(error),
              },
              '*'
            )
          })
        } else {
          console.error('🔥 [Widget] ❌ Content validation failed!')
        }
        return
      }

      // Handle CLEAR_CHAT
      if (event.data.type === 'CLEAR_CHAT') {
        console.log('[Widget] Processing CLEAR_CHAT event')
        homeStore.setState({ chatLog: [] })
        return
      }

      // Handle WIDGET_EMOTION_UPDATE
      if (event.data.type === 'WIDGET_EMOTION_UPDATE') {
        console.log('🎭 [Widget] Processing WIDGET_EMOTION_UPDATE event')
        console.log('🎭 [Widget] Emotion data:', event.data.data)

        const emotion = event.data.data?.emotion
        if (emotion) {
          console.log(
            '🎭 [Widget] Calling handleMatchmakingResponse with emotion:',
            emotion
          )
          console.log('🎭 [Widget] Current modelType:', modelType)
          handleMatchmakingResponse({ emotion })
        } else {
          console.log(
            '🎭 [Widget] No emotion found in WIDGET_EMOTION_UPDATE event'
          )
        }
        return
      }

      // Handle CHAT_ACTION_CARD_CLICK
      if (event.data.type === 'CHAT_ACTION_CARD_CLICK') {
        console.log('🔥 [Widget] === PROCESSING CHAT_ACTION_CARD_CLICK ===')

        const { actionId, actionType, actionData, timestamp, userId } =
          event.data.data || {}

        // Handle send_message action type
        if (actionType === 'send_message') {
          console.log('🔥 [Widget] ✅ Send message action detected!')

          // Extract message from actionData
          const messageToSend =
            actionData?.message || actionData?.text || actionData?.content

          if (messageToSend && typeof messageToSend === 'string') {
            console.log('🔥 [Widget] ✅ Message validation passed!')

            // Check if we have an auth token before processing
            const currentToken = getCurrentWidgetAuthToken()

            if (!currentToken) {
              console.error(
                '🔥 [Widget] ❌ No auth token - cannot process message'
              )
              window.parent.postMessage(
                { type: 'WIDGET_ERROR', reason: 'no_auth_token' },
                '*'
              )
              return
            }

            // Process through the widget chat handler (same as regular user messages)
            console.log(
              '🔥 [Widget] ✅ Auth check passed - calling widget chat handler...'
            )

            const widgetChatHandler = handleWidgetChatFn()
            widgetChatHandler(messageToSend).catch(error => {
              console.error('🔥 [Widget] ❌ Chat handler error:', error)
              window.parent.postMessage(
                {
                  type: 'WIDGET_ERROR',
                  reason: 'chat_handler_error',
                  error: String(error),
                },
                '*'
              )
            })
          } else {
            console.error('🔥 [Widget] ❌ Message validation failed!')
          }
        } else if (actionId && typeof actionId === 'string') {
          console.log('🔥 [Widget] ✅ ActionId validation passed!')

          // Generate profile cards based on actionId (async)
          generateProfileCards(actionId)
            .then(profileCards => {
              console.log(
                '🔥 [Widget] Generated profile cards:',
                profileCards.length
              )

              if (profileCards.length === 0) {
                console.error('🔥 [Widget] No profile cards generated')
                return
              }

              // Select one random profile card to send
              const selectedProfile =
                profileCards[Math.floor(Math.random() * profileCards.length)]
              console.log(
                '🔥 [Widget] Selected profile card:',
                selectedProfile.name
              )

              // Send single CHAT_MESSAGE_RECEIVE message
              window.parent.postMessage(
                {
                  type: 'CHAT_MESSAGE_RECEIVE',
                  data: {
                    role: 'assistant',
                    content: selectedProfile.message,
                    timestamp: new Date().toISOString(),
                    metadata: {
                      profileCard: true,
                      profileData: selectedProfile,
                    },
                  },
                },
                '*'
              )

              console.log('🔥 [Widget] Profile card sent successfully')
            })
            .catch(error => {
              console.error(
                '🔥 [Widget] ❌ Error generating profile cards:',
                error
              )
              window.parent.postMessage(
                {
                  type: 'WIDGET_ERROR',
                  reason: 'profile_generation_error',
                  error: String(error),
                },
                '*'
              )
            })
        } else {
          console.error('🔥 [Widget] ❌ ActionId validation failed!')
        }
        return
      }

      // Handle parent's actual message format: {message: {...}}
      if (event.data.message && !event.data.type) {
        console.log(
          '🔥 [Widget] === PROCESSING ACTUAL PARENT MESSAGE FORMAT ==='
        )

        // Try to extract content from the message object
        const messageObj = event.data.message

        // Filter out system messages
        if (messageObj && typeof messageObj === 'object' && messageObj.type) {
          const systemMessages = [
            'initialize-post-message-connection',
            'post-message-connection-established',
            'connection-ack',
            'heartbeat',
            'ping',
            'pong',
          ]

          if (systemMessages.includes(messageObj.type)) {
            console.log(
              '🔥 [Widget] 📡 Ignoring system message:',
              messageObj.type
            )
            return
          }
        }

        let content = null

        // Try different possible content fields
        if (typeof messageObj === 'string') {
          content = messageObj
        } else if (messageObj && typeof messageObj === 'object') {
          content =
            messageObj.content ||
            messageObj.text ||
            messageObj.message ||
            messageObj.data
        }

        if (content && typeof content === 'string') {
          console.log('🔥 [Widget] ✅ Content validation passed!')

          // Check if we have an auth token before processing
          const currentToken = getCurrentWidgetAuthToken()

          if (!currentToken) {
            console.error(
              '🔥 [Widget] ❌ No auth token - cannot process message'
            )
            window.parent.postMessage(
              { type: 'WIDGET_ERROR', reason: 'no_auth_token' },
              '*'
            )
            return
          }

          // Process through the widget chat handler
          console.log(
            '🔥 [Widget] ✅ Auth check passed - calling widget chat handler...'
          )

          const widgetChatHandler = handleWidgetChatFn()
          widgetChatHandler(content).catch(error => {
            console.error('🔥 [Widget] ❌ Chat handler error:', error)
            window.parent.postMessage(
              {
                type: 'WIDGET_ERROR',
                reason: 'chat_handler_error',
                error: String(error),
              },
              '*'
            )
          })
        } else {
          console.error('🔥 [Widget] ❌ Content validation failed!')
        }
        return
      }

      // Handle unknown message types
      console.log('[Widget] Unhandled message type:', event.data.type)
    }

    window.addEventListener('message', handleAllMessages)
    console.log('🔧 Widget message listener added successfully')

    // Notify parent that widget is ready
    console.log('🔧 Widget sending WIDGET_READY to parent...')
    window.parent.postMessage({ type: 'WIDGET_READY' }, '*')

    // Auth timeout
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        console.log('[Widget] Auth timeout - marking as unauthenticated')
        setAuthChecked(true)
        setAuthError(
          'You are not authenticated. Please sign in to use the widget.'
        )
      }
    }, 1500)

    return () => {
      console.log('🔧 Widget removing message listener...')
      window.removeEventListener('message', handleAllMessages)
      clearTimeout(timeout)
    }
  }, [postMessagesEnabled, isAuthenticated]) // Removed handleMatchmakingResponse to prevent re-mounting loop

  // Debug: Status logger to show current widget state (disabled to prevent remounting)
  // useEffect(() => {
  //   const statusLogger = setInterval(() => {
  //     console.log('🔧 Widget Status Check:')
  //     console.log('🔧   postMessages enabled:', config.postMessages)
  //     console.log('🔧   authenticated:', isAuthenticated)
  //     console.log('🔧   authChecked:', authChecked)
  //     console.log('🔧   authError:', authError)
  //     console.log('🔧   current token:', !!getCurrentWidgetAuthToken())
  //   }, 10000) // Every 10 seconds

  //   return () => clearInterval(statusLogger)
  // }, [config.postMessages, isAuthenticated, authChecked, authError])

  // Clear all persisted state if not authenticated
  useEffect(() => {
    if (authChecked && !isAuthenticated) {
      try {
        localStorage.clear()
        sessionStorage.clear()
        if (homeStore.persist?.clearStorage) homeStore.persist.clearStorage()
        if (settingsStore.persist?.clearStorage)
          settingsStore.persist.clearStorage()
      } catch (e) {
        // ignore
      }
    }
  }, [authChecked, isAuthenticated])

  // Detect if personality analysis is completed for split layout
  const [isPersonalityCompleted, setIsPersonalityCompleted] = useState(false)

  // Check for personality completion status
  const checkCompletionStatus = useCallback(() => {
    try {
      const completed =
        localStorage.getItem('personality_analysis_completed') === 'true'
      const hasResult = localStorage.getItem('last_matchmaking_result') !== null
      const hasDismissed =
        localStorage.getItem('personality_panel_dismissed') === 'true'
      // Personality is completed if analysis is done and has result, regardless of dismissal
      const isCompleted = completed && hasResult
      const shouldShow = isCompleted && !hasDismissed
      // Only adjust layout when panel should actually be visible
      setIsPersonalityCompleted(shouldShow)
    } catch (error) {
      setIsPersonalityCompleted(false)
    }
  }, [])

  useEffect(() => {
    // Initial check
    checkCompletionStatus()

    // Listen for localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'personality_analysis_completed' ||
        e.key === 'last_matchmaking_result' ||
        e.key === 'personality_panel_dismissed'
      ) {
        checkCompletionStatus()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [checkCompletionStatus])

  // Separate useEffect for chat log subscription to prevent infinite loops
  useEffect(() => {
    const unsubscribe = homeStore.subscribe((state, prevState) => {
      if (state.chatLog !== prevState.chatLog) {
        // Small delay to allow localStorage to be updated
        setTimeout(checkCompletionStatus, 100)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [checkCompletionStatus])

  // Parse URL parameters and PostMessage config
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlConfig: Partial<WidgetConfig> = {}

    // Parse all URL parameters
    Object.keys(config).forEach(key => {
      const value = urlParams.get(key)
      if (value !== null) {
        if (typeof config[key as keyof WidgetConfig] === 'boolean') {
          ;(urlConfig as any)[key] = value === 'true'
        } else if (typeof config[key as keyof WidgetConfig] === 'number') {
          urlConfig[key as keyof WidgetConfig] = parseInt(value) as any
        } else {
          urlConfig[key as keyof WidgetConfig] = value as any
        }
      }
    })

    // Also parse backgroundColor if present (not in default config)
    if (urlParams.get('backgroundColor')) {
      urlConfig.backgroundColor = urlParams.get('backgroundColor') || undefined
    }

    // Force TTS enabled
    urlConfig.disableTTS = false

    setConfig(prev => ({ ...prev, ...urlConfig, disableTTS: false }))

    // Apply settings from URL
    if (urlConfig.characterModel) {
      if (urlConfig.characterModel.endsWith('.vrm')) {
        settingsStore.setState({
          modelType: 'vrm',
          selectedVrmPath: urlConfig.characterModel,
        })
      } else if (urlConfig.characterModel.includes('.model3.json')) {
        settingsStore.setState({
          modelType: 'live2d',
          selectedLive2DPath: urlConfig.characterModel,
        })
      }
    }

    if (urlConfig.characterName) {
      settingsStore.setState({ characterName: urlConfig.characterName })
    }

    if (urlConfig.systemPrompt) {
      settingsStore.setState({ systemPrompt: urlConfig.systemPrompt })
    }

    if (urlConfig.apiKey && urlConfig.aiService) {
      const keyMap: Record<string, string> = {
        openai: 'openaiKey',
        anthropic: 'anthropicKey',
        google: 'googleKey',
        azure: 'azureKey',
        groq: 'groqKey',
      }

      const keyField = keyMap[urlConfig.aiService]
      if (keyField) {
        settingsStore.setState({
          [keyField]: urlConfig.apiKey,
          selectAIService: urlConfig.aiService as any,
        })
      }
    }

    if (urlConfig.model) {
      settingsStore.setState({ selectAIModel: urlConfig.model })
    }
  }, []) // Fixed: Only run once on mount, not when config changes

  // Send chat updates to parent
  useEffect(() => {
    if (!config.postMessages) return

    window.parent.postMessage(
      {
        type: 'CHAT_UPDATE',
        chatLog: chatLog,
      },
      '*'
    )
  }, [chatLog, config.postMessages])

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    const scrollToBottom = () => {
      // Scroll the visible chat container (when input is shown)
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
      }
      // Scroll the hidden input chat container
      if (chatScrollRefHidden.current) {
        chatScrollRefHidden.current.scrollTop =
          chatScrollRefHidden.current.scrollHeight
      }
    }

    // Add a small delay to ensure the new message elements are fully rendered
    const timeoutId = setTimeout(scrollToBottom, 50)

    return () => clearTimeout(timeoutId)
  }, [chatLog])

  useEffect(() => {
    // On initial load, if chat log is empty and user is authenticated, send a synthetic 'start matchmaking' message to trigger onboarding
    if (
      homeStore.getState().chatLog.length === 0 &&
      isAuthenticated &&
      authChecked
    ) {
      // Prevent duplicate trigger by setting a flag in sessionStorage
      if (!sessionStorage.getItem('mamasanOnboardingStarted')) {
        sessionStorage.setItem('mamasanOnboardingStarted', 'true')
        // Call matchmaking API directly without adding to chat log or sending to parent
        const triggerOnboarding = async () => {
          try {
            const token = getCurrentWidgetAuthToken()
            if (!token) {
              console.error(
                '🎪 Widget - No auth token available for onboarding trigger'
              )
              return
            }

            console.log(
              '🎪 Widget - Triggering onboarding without chat bubble...'
            )
            const response = await fetch('/api/matchmaking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: 'start matchmaking', token }),
            })

            if (response.ok) {
              const data = await response.json()
              console.log(
                '🎪 Widget - Onboarding triggered successfully:',
                data.step
              )

              // Add only the assistant response to chat log (not the synthetic user message)
              homeStore.getState().upsertMessage({
                role: 'assistant',
                content: data.message,
                timestamp: new Date().toISOString(),
              })

              // Send the assistant response to parent window (same as regular chat)
              if (config.postMessages) {
                window.parent.postMessage(
                  { type: 'WIDGET_CHAT_DONE', message: data.message },
                  '*'
                )
              }

              // Check if TTS is disabled
              const disableTTS = isTTSDisabled()
              if (!disableTTS) {
                // Import here to avoid circular dependency
                const { speakMessageHandler } = await import(
                  '@/features/chat/handlers'
                )
                await speakMessageHandler(data.message)
              }
            }
          } catch (error) {
            console.error('🎪 Widget - Error triggering onboarding:', error)
          }
        }
        triggerOnboarding()
      }
    } else if (homeStore.getState().chatLog.length > 0) {
      // If there's existing chat history, send it to parent
      console.log(
        '🎪 Widget - Found existing chat history, sending to parent...'
      )
      // Call sendChatHistoryToParent directly without dependency
      if (config.postMessages) {
        const currentChatLog = homeStore.getState().chatLog
        if (currentChatLog.length > 0) {
          const recentMessages = currentChatLog.slice(-2).map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          }))
          window.parent.postMessage(
            {
              type: 'WIDGET_CHAT_HISTORY',
              messages: recentMessages,
              totalMessages: currentChatLog.length,
            },
            '*'
          )
        }
      }
    }
  }, [isAuthenticated, authChecked, config.postMessages])

  // Make the handler available globally for the chat handler
  useEffect(() => {
    ;(window as any).handleMatchmakingResponse = handleMatchmakingResponse
  }, [handleMatchmakingResponse])

  const getThemeClasses = () => {
    if (config.backgroundColor) return ''
    switch (config.theme) {
      case 'dark':
        return 'bg-gray-900 text-white'
      case 'minimal':
        return 'bg-white border border-gray-200'
      default:
        return 'bg-gradient-to-br from-blue-50 to-purple-50'
    }
  }

  // Determine if width/height are set to fill the viewport or container
  const isFullWidth = ['100vw', '100%'].includes(config.width || '')
  const isFullHeight = ['100vh', '100%'].includes(config.height || '')

  const containerStyle = {
    width: isPersonalityCompleted ? 'calc(100% - 320px)' : config.width,
    height: config.height,
    ...(isFullWidth || isPersonalityCompleted
      ? {}
      : { maxWidth: isPersonalityCompleted ? 'calc(800px - 320px)' : '800px' }),
    ...(isFullHeight ? {} : { maxHeight: '600px' }),
  }

  const backgroundStyle = config.backgroundColor
    ? { backgroundColor: config.backgroundColor }
    : config.showBackground && backgroundImageUrl
    ? {
        backgroundImage: `url(${buildUrl(backgroundImageUrl)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  return (
    <>
      {/* PNG mode: overlay with emotion-based PNG */}
      {modelType === 'png' && (
        <PngEmotionDisplay emotionImage={emotionImage} emotionLabel={emotion} />
      )}
      {/* VID mode: fullscreen video background with overlay */}
      {modelType === 'vid' && (
        <VidBackgroundDisplay videoSrc={videoSrc}>
          <div
            className='flex flex-col items-center justify-center'
            style={{ marginTop: '-150px' }} // Move content up by 150px like PNG mode
          >
            <span
              className='text-pink-500 font-bold text-2xl mb-2'
              style={{ textShadow: '0 2px 8px #18181b, 0 0 2px #000' }}
            >
              Hey there! I&apos;m Emi
            </span>
            <span
              className='text-white text-lg'
              style={{ textShadow: '0 2px 8px #18181b, 0 0 2px #000' }}
            >
              Ask me for amazing creators and content
            </span>
          </div>
        </VidBackgroundDisplay>
      )}
      {/* Existing widget/model area for other modes */}
      {modelType !== 'png' && modelType !== 'vid' && (
        <div className='relative w-full h-full'>
          {/* Always render the main widget/model area */}
          <div className='relative w-full h-full'>
            {/* Emi overlay: only overlays when not loaded/authenticated */}
            {(showEmiScreen ||
              !authChecked ||
              !isAuthenticated ||
              !modelLoaded) && (
              <div
                className={`fixed inset-0 flex flex-col items-center justify-center w-screen h-screen transition-opacity duration-700 ${
                  fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
                style={{
                  backgroundColor: '#18181b',
                  zIndex: 9999,
                  marginTop: '-100px', // Move overlay up by 100px
                }}
              >
                <Image
                  src='/emi_gif.gif'
                  alt="Emi's avatar"
                  width={160}
                  height={160}
                  className='w-40 h-40 rounded-full border-4 border-pink-400 shadow-lg mb-6 object-cover bg-black'
                  style={{ boxShadow: '0 4px 24px #18181b' }}
                  priority
                  unoptimized
                />
                <span
                  className='text-pink-500 font-bold text-2xl mb-2'
                  style={{ textShadow: '0 2px 8px #18181b, 0 0 2px #000' }}
                >
                  Hey there! I&apos;m Emi
                </span>
                <span
                  className='text-white text-lg'
                  style={{ textShadow: '0 2px 8px #18181b, 0 0 2px #000' }}
                >
                  Ask me for amazing creators and content
                </span>
              </div>
            )}
            {/* Main widget content (was previously inside the else) */}
            {/* Matchmaking Progress Bar */}
            <MatchmakingProgress forceHidden={true} />
            <PersonalityPanel />

            {/* Main content */}
            <div className='absolute inset-0'>
              {/* Character Display */}
              {config.showCharacter && (
                <div
                  className='absolute top-0 left-0 bottom-0 right-0 pointer-events-none z-0'
                  style={{ paddingBottom: config.showInput ? '80px' : '0' }}
                  key={`character-${isPersonalityCompleted}`}
                >
                  {modelType === 'vrm' ? <VrmViewer /> : <Live2DViewer />}
                </div>
              )}

              {/* VrmExpressionTester */}
              {modelType === 'vrm' && config.showVrmExpressionTester && (
                <VrmExpressionTester />
              )}
            </div>

            {/* Profile Overlay - Show only when explicitly enabled */}
            {config.showProfileOverlay && <ProfileOverlay />}

            {/* Fullscreen Button */}
            {config.allowFullscreen && (
              <button
                onClick={() => {
                  if (config.postMessages) {
                    window.parent.postMessage(
                      { type: 'TOGGLE_FULLSCREEN' },
                      '*'
                    )
                  }
                }}
                className='absolute top-2 right-2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg z-30'
                title='Toggle Fullscreen'
              >
                <svg
                  className='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
                  />
                </svg>
              </button>
            )}

            <Toasts />
          </div>
        </div>
      )}
    </>
  )
}

export default Widget
