import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { WidgetForm } from '@/components/widgetForm'
import VrmViewer from '@/components/vrmViewer'
import Live2DViewer from '@/components/live2DViewer'
import { Toasts } from '@/components/toasts'
import MatchmakingProgress from '@/components/MatchmakingProgress'
import PersonalityPanel from '@/components/PersonalityPanel'

import VrmExpressionTester from '@/components/ui/VrmExpressionTester'
import ProfileOverlay from '@/components/ui/ProfileOverlay'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/lib/i18n'
import { buildUrl } from '@/utils/buildUrl'
import { MamaSanSpecialist } from '@/features/matchmaking/mama-san-specialist'
import {
  handleWidgetChatFn,
  getCurrentWidgetAuthToken,
} from '@/features/chat/handlers'
import Image from 'next/image'

/**
 * CHAT_ACTION_CARD_CLICK Handler Documentation
 * ===========================================
 *
 * This widget handles action card clicks and generates profile recommendations
 * using mock host recommendation logic.
 *
 * ## Input Payload Structure
 *
 * The parent should send this message when a user clicks an action card:
 *
 * ```typescript
 * {
 *   type: 'CHAT_ACTION_CARD_CLICK',
 *   data: {
 *     actionId: string,     // ID of the action card
 *     actionType: string,   // Type of action (follow, subscribe, donate, etc.)
 *     actionData?: any,     // Optional additional action data
 *     timestamp: number,    // Unix timestamp
 *     userId: string        // ID of the user performing the action
 *   }
 * }
 * ```
 *
 * ### Supported Action IDs:
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

// Mock profile card generator based on action categories
const generateProfileCards = (
  actionId: string
): Array<{
  id: string
  name: string
  message: string
  description: string
  interests: string[]
  personality: string[]
  profileImage?: string
}> => {
  // Get the base URL for the widget
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`
    }
    return 'https://localhost:3000' // Fallback for SSR
  }

  const baseUrl = getBaseUrl()

  const profiles: Record<
    string,
    Array<{
      id: string
      name: string
      message: string
      description: string
      interests: string[]
      personality: string[]
      profileImage?: string
    }>
  > = {
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
      {
        id: 'kiwi-002',
        name: 'Kiwi',
        message:
          'Kyaa~! Another anime lover! 🥝 I just finished watching the cutest romance anime - want me to tell you about it? No spoilers, promise! (*´∀｀*)',
        description:
          'Bubbly anime fan with infectious enthusiasm for romance and comedy series',
        interests: ['anime', 'romance', 'comedy', 'music'],
        personality: ['energetic', 'bubbly', 'enthusiastic'],
        profileImage: `${baseUrl}/images/mockdata/kiwi.png`,
      },
      {
        id: 'emi-003',
        name: 'Emi',
        message:
          "Oh! Someone with great taste in anime! ฅ(♡ω♡*ฅ) I collect anime figures and love cosplay - maybe we can geek out together? What's your favorite series?",
        description:
          'Anime collector and cosplayer who loves sharing her passion for Japanese culture',
        interests: ['anime', 'cosplay', 'collecting', 'japanese-culture'],
        personality: ['passionate', 'creative', 'friendly'],
        profileImage: `${baseUrl}/images/mockdata/emi.png`,
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
      {
        id: 'tang-002',
        name: 'Tang',
        message:
          'Gaming creators unite! 🚀 I do game reviews and speedruns - just set a new personal record yesterday! What games are you creating content for?',
        description:
          'Gaming content creator specializing in reviews and speedrunning',
        interests: ['gaming', 'speedrunning', 'content-creation', 'reviews'],
        personality: ['determined', 'analytical', 'energetic'],
        profileImage: `${baseUrl}/images/mockdata/tang.png`,
      },
      {
        id: 'sab-003',
        name: 'Sab',
        message:
          "Interesting... another creator in the gaming space. 🎯 I focus on indie games and hidden gems. There's something fascinating about discovering games before they become mainstream...",
        description:
          'Indie game specialist who discovers and showcases underground gaming gems',
        interests: [
          'indie-games',
          'game-discovery',
          'storytelling',
          'mysteries',
        ],
        personality: ['mysterious', 'analytical', 'insightful'],
        profileImage: `${baseUrl}/images/mockdata/sab.png`,
      },
    ],
    'vtuber-recs': [
      {
        id: 'kiwi-vt-001',
        name: 'Kiwi',
        message:
          'Ooh, VTuber recommendations! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ I watch so many! From cozy chatting streams to epic gaming collabs - what kind of content do you like? I can recommend the perfect VTubers for you!',
        description:
          'VTuber enthusiast with encyclopedic knowledge of streamers and content styles',
        interests: ['vtubers', 'streaming', 'entertainment', 'community'],
        personality: ['enthusiastic', 'knowledgeable', 'helpful'],
        profileImage: `${baseUrl}/images/mockdata/kiwi.png`,
      },
      {
        id: 'emi-vt-002',
        name: 'Emi',
        message:
          "VTuber recs? YES! ✨ I follow so many amazing creators - some focus on singing, others on gaming, and some just have the most comfy chatting streams ever. What's your vibe?",
        description:
          'VTuber community member who loves supporting diverse creators and content',
        interests: ['vtubers', 'music', 'gaming', 'community-support'],
        personality: ['supportive', 'diverse-interests', 'community-minded'],
        profileImage: `${baseUrl}/images/mockdata/emi.png`,
      },
      {
        id: 'seira-vt-003',
        name: 'Seira',
        message:
          'VTuber recommendations! 🌸 I particularly enjoy the artistic and creative streamers - drawing streams are so relaxing to watch. Do you prefer high-energy or chill content?',
        description:
          'Art-focused VTuber fan who appreciates creative and aesthetic streaming content',
        interests: ['vtubers', 'art', 'creativity', 'aesthetic'],
        personality: ['artistic', 'calm', 'aesthetic-minded'],
        profileImage: `${baseUrl}/images/mockdata/seira.png`,
      },
    ],
    'kawaii-content': [
      {
        id: 'seira-kawaii-001',
        name: 'Seira',
        message:
          'Kawaii content! ♡(˃͈ દ ˂͈ ༶ ) You have excellent taste! I love everything kawaii - from fashion to room decor to the cutest accessories. Want to share kawaii finds together?',
        description:
          'Kawaii culture enthusiast with a passion for cute fashion and lifestyle',
        interests: ['kawaii', 'fashion', 'lifestyle', 'decor'],
        personality: ['cute', 'stylish', 'trend-aware'],
        profileImage: `${baseUrl}/images/mockdata/seira.png`,
      },
      {
        id: 'emi-kawaii-002',
        name: 'Emi',
        message:
          'Kawaii content lover! (´｡• ᵕ •｡`) ♡ I collect the most adorable things - plushies, stationery, accessories! My room is like a kawaii wonderland. What kawaii stuff do you love most?',
        description:
          'Kawaii collector who creates adorable spaces and loves cute merchandise',
        interests: ['kawaii', 'collecting', 'plushies', 'stationery'],
        personality: ['collector', 'adorable', 'organized'],
        profileImage: `${baseUrl}/images/mockdata/emi.png`,
      },
      {
        id: 'kiwi-kawaii-003',
        name: 'Kiwi',
        message:
          'Kawaii squad! ヾ(＾-＾)ノ I make kawaii content and love sharing the cutest discoveries! From tiny desserts to adorable outfits - kawaii makes everything better! Want to kawaii-fy your day together?',
        description:
          'Kawaii content creator who spreads joy through cute discoveries and lifestyle tips',
        interests: ['kawaii', 'content-creation', 'lifestyle', 'desserts'],
        personality: ['creative', 'joyful', 'inspiring'],
        profileImage: `${baseUrl}/images/mockdata/kiwi.png`,
      },
    ],
  }

  return profiles[actionId] || profiles['cute-anime'] // Default fallback
}

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
  const modelType = settingsStore((s) => s.modelType)

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
  }, [modelLoaded, authChecked, isAuthenticated, modelType])

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

  const backgroundImageUrl = homeStore((s) => s.backgroundImageUrl)
  const chatLog = homeStore((s) => s.chatLog)

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
    const recentMessages = currentChatLog.slice(-2).map((msg) => ({
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
    config.postMessages,
    sendChatHistoryToParent,
  ])

  // Listen for all widget events (auth, chat, config, etc.)
  useEffect(() => {
    const effectId = Math.random().toString(36).substr(2, 9)
    console.log(`🔧 Widget message listener useEffect #${effectId} running...`)
    console.log('🔧 Widget useEffect dependencies:')
    console.log('🔧   config.postMessages:', config.postMessages)
    console.log('🔧   isAuthenticated:', isAuthenticated)
    console.log('🔧   authChecked:', authChecked)
    console.log('🔧   authError:', authError)
    console.log('🔧 Widget ready to receive messages!')

    function handleAllMessages(event: MessageEvent) {
      // LOG EVERY SINGLE MESSAGE - even if malformed
      console.log('🔥 [Widget] === INCOMING MESSAGE ===')
      console.log('🔥 [Widget] Event object:', event)
      console.log('🔥 [Widget] Raw event data:', event.data)
      console.log('🔥 [Widget] Event origin:', event.origin)
      console.log('🔥 [Widget] Event source:', event.source)
      console.log('🔥 [Widget] Window location:', window.location.href)
      console.log('🔥 [Widget] Message type:', event.data?.type)
      console.log('🔥 [Widget] Origin comparison:', {
        eventOrigin: event.origin,
        expectedOrigin: 'http://localhost:3000',
        matches: event.origin === 'http://localhost:3000',
      })
      console.log('🔥 [Widget] Has data:', !!event.data)
      console.log(
        '🔥 [Widget] Data keys:',
        event.data ? Object.keys(event.data) : []
      )
      console.log(
        '🔥 [Widget] Current config.postMessages:',
        config.postMessages
      )
      console.log('🔥 [Widget] Current isAuthenticated:', isAuthenticated)
      console.log('🔥 [Widget] Current authChecked:', authChecked)
      console.log('🔥 [Widget] === END MESSAGE HEADER ===')

      if (!event.data) {
        console.log('🔥 [Widget] EARLY RETURN: No event data')
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
      if (!config.postMessages) {
        console.log(
          '🔥 [Widget] EARLY RETURN: PostMessage disabled, ignoring non-auth message:',
          event.data.type
        )
        return
      }

      // Handle WIDGET_CONFIG
      if (event.data.type === 'WIDGET_CONFIG') {
        console.log('[Widget] Processing WIDGET_CONFIG event')
        setConfig((prev) => ({ ...prev, ...event.data.config }))
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
        console.log('🔥 [Widget] 🎯 SUCCESS: Found CHAT_MESSAGE_SEND!')
        console.log('🔥 [Widget] Raw event.data:', event.data)
        console.log('🔥 [Widget] Raw event.data.data:', event.data.data)

        const { content, media, timestamp, userId } = event.data.data || {}
        console.log('🔥 [Widget] Extracted values:')
        console.log('🔥 [Widget]   content:', content)
        console.log('🔥 [Widget]   content type:', typeof content)
        console.log(
          '🔥 [Widget]   content length:',
          content ? content.length : 'N/A'
        )
        console.log('🔥 [Widget]   media:', media)
        console.log('🔥 [Widget]   timestamp:', timestamp)
        console.log('🔥 [Widget]   userId:', userId)

        if (content && typeof content === 'string') {
          console.log('🔥 [Widget] ✅ Content validation passed!')
          console.log('🔥 [Widget] Valid CHAT_MESSAGE_SEND data:', {
            content: content.substring(0, 50) + '...',
            media,
            timestamp,
            userId,
          })

          // Check if we have an auth token before processing
          const currentToken = getCurrentWidgetAuthToken()
          console.log('🔥 [Widget] Auth token check:')
          console.log('🔥 [Widget]   hasToken:', !!currentToken)
          console.log(
            '🔥 [Widget]   tokenLength:',
            currentToken ? currentToken.length : 0
          )
          console.log(
            '🔥 [Widget]   tokenStart:',
            currentToken ? currentToken.substring(0, 20) + '...' : 'none'
          )

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
          console.log(
            '🔥 [Widget] About to call handleWidgetChatFn() with content:',
            content.substring(0, 100) + '...'
          )

          const widgetChatHandler = handleWidgetChatFn()
          console.log(
            '🔥 [Widget] handleWidgetChatFn() returned:',
            typeof widgetChatHandler
          )

          console.log('🔥 [Widget] Calling widgetChatHandler with content...')
          widgetChatHandler(content).catch((error) => {
            console.error('🔥 [Widget] ❌ Chat handler error:', error)
            console.error('🔥 [Widget] ❌ Error stack:', error.stack)
            window.parent.postMessage(
              {
                type: 'WIDGET_ERROR',
                reason: 'chat_handler_error',
                error: String(error),
              },
              '*'
            )
          })
          console.log('🔥 [Widget] widgetChatHandler call completed (async)')
        } else {
          console.error('🔥 [Widget] ❌ Content validation failed!')
          console.error('🔥 [Widget] Invalid CHAT_MESSAGE_SEND data:', {
            content: typeof content,
            contentValue: content,
            hasData: !!event.data.data,
            dataKeys: event.data.data ? Object.keys(event.data.data) : [],
          })
        }
        console.log('🔥 [Widget] === END CHAT_MESSAGE_SEND PROCESSING ===')
        return
      }

      // Handle CLEAR_CHAT
      if (event.data.type === 'CLEAR_CHAT') {
        console.log('[Widget] Processing CLEAR_CHAT event')
        homeStore.setState({ chatLog: [] })
        return
      }

      // Handle CHAT_ACTION_CARD_CLICK
      if (event.data.type === 'CHAT_ACTION_CARD_CLICK') {
        console.log('🔥 [Widget] === PROCESSING CHAT_ACTION_CARD_CLICK ===')
        console.log('🔥 [Widget] Raw event.data:', event.data)
        console.log('🔥 [Widget] Raw event.data.data:', event.data.data)

        const { actionId, actionType, actionData, timestamp, userId } =
          event.data.data || {}
        console.log('🔥 [Widget] Extracted values:')
        console.log('🔥 [Widget]   actionId:', actionId)
        console.log('🔥 [Widget]   actionType:', actionType)
        console.log('🔥 [Widget]   actionData:', actionData)
        console.log('🔥 [Widget]   timestamp:', timestamp)
        console.log('🔥 [Widget]   userId:', userId)

        if (actionId && typeof actionId === 'string') {
          console.log('🔥 [Widget] ✅ ActionId validation passed!')

          // Generate profile cards based on actionId
          const profileCards = generateProfileCards(actionId)
          console.log(
            '🔥 [Widget] Generated profile cards:',
            profileCards.length
          )

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
        } else {
          console.error('🔥 [Widget] ❌ ActionId validation failed!')
          console.error('🔥 [Widget] Invalid CHAT_ACTION_CARD_CLICK data:', {
            actionId: typeof actionId,
            actionIdValue: actionId,
            hasData: !!event.data.data,
            dataKeys: event.data.data ? Object.keys(event.data.data) : [],
          })
        }
        console.log('🔥 [Widget] === END CHAT_ACTION_CARD_CLICK PROCESSING ===')
        return
      }

      // Handle parent's actual message format: {message: {...}}
      if (event.data.message && !event.data.type) {
        console.log(
          '🔥 [Widget] === PROCESSING ACTUAL PARENT MESSAGE FORMAT ==='
        )
        console.log('🔥 [Widget] Raw event.data:', event.data)
        console.log('🔥 [Widget] Raw event.data.message:', event.data.message)

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

        console.log('🔥 [Widget] Extracted content:', content)
        console.log('🔥 [Widget] Content type:', typeof content)

        if (content && typeof content === 'string') {
          console.log('🔥 [Widget] ✅ Content validation passed!')

          // Check if we have an auth token before processing
          const currentToken = getCurrentWidgetAuthToken()
          console.log('🔥 [Widget] Auth token check:')
          console.log('🔥 [Widget]   hasToken:', !!currentToken)
          console.log(
            '🔥 [Widget]   tokenLength:',
            currentToken ? currentToken.length : 0
          )
          console.log(
            '🔥 [Widget]   tokenStart:',
            currentToken ? currentToken.substring(0, 20) + '...' : 'none'
          )

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
          console.log(
            '🔥 [Widget] About to call handleWidgetChatFn() with content:',
            content.substring(0, 100) + '...'
          )

          const widgetChatHandler = handleWidgetChatFn()
          console.log(
            '🔥 [Widget] handleWidgetChatFn() returned:',
            typeof widgetChatHandler
          )

          console.log('🔥 [Widget] Calling widgetChatHandler with content...')
          widgetChatHandler(content).catch((error) => {
            console.error('🔥 [Widget] ❌ Chat handler error:', error)
            console.error('🔥 [Widget] ❌ Error stack:', error.stack)
            window.parent.postMessage(
              {
                type: 'WIDGET_ERROR',
                reason: 'chat_handler_error',
                error: String(error),
              },
              '*'
            )
          })
          console.log('🔥 [Widget] widgetChatHandler call completed (async)')
        } else {
          console.error('🔥 [Widget] ❌ Content validation failed!')
          console.error(
            '🔥 [Widget] Could not extract valid content from message:',
            {
              messageType: typeof messageObj,
              messageKeys:
                messageObj && typeof messageObj === 'object'
                  ? Object.keys(messageObj)
                  : [],
              messageValue: messageObj,
              extractedContent: content,
              contentType: typeof content,
            }
          )
        }
        console.log('🔥 [Widget] === END ACTUAL PARENT MESSAGE PROCESSING ===')
        return
      }

      // Handle unknown message types
      console.log('[Widget] Unhandled message type:', event.data.type)
      console.log('[Widget] Full unhandled event:', event.data)

      // Track all message types we're receiving
      const messageTypes = (window as any).receivedMessageTypes || []
      const messageType = event.data?.type || 'no-type'
      if (!messageTypes.includes(messageType)) {
        messageTypes.push(messageType)
        ;(window as any).receivedMessageTypes = messageTypes
        console.log(
          '[Widget] 📊 All message types received so far:',
          messageTypes
        )
      }
    }

    console.log('🔧 Widget adding message listener...')
    console.log('🔧 Widget listener context:')
    console.log('🔧   config.postMessages:', config.postMessages)
    console.log('🔧   isAuthenticated:', isAuthenticated)
    console.log('🔧   authChecked:', authChecked)
    console.log('🔧   authError:', authError)
    console.log('🔧   window object:', !!window)
    console.log(
      '🔧   addEventListener available:',
      typeof window.addEventListener
    )

    // Test the message listener immediately
    const testListener = (event: MessageEvent) => {
      console.log('🔧 TEST LISTENER: Message received!', event.data)
    }

    window.addEventListener('message', testListener)
    window.addEventListener('message', handleAllMessages)
    console.log('🔧 Widget message listener added successfully')

    // Send a test message to ourselves
    setTimeout(() => {
      console.log('🔧 Widget sending test message to self...')
      window.postMessage({ type: 'WIDGET_SELF_TEST', test: true }, '*')
    }, 1000)

    // Notify parent that widget is ready
    console.log('🔧 Widget sending WIDGET_READY to parent...')
    window.parent.postMessage({ type: 'WIDGET_READY' }, '*')
    console.log('🔧 Widget WIDGET_READY sent successfully')

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
      console.log('🔧 Cleanup reason - dependencies changed:', {
        postMessages: config.postMessages,
        isAuthenticated: isAuthenticated,
      })
      window.removeEventListener('message', testListener)
      window.removeEventListener('message', handleAllMessages)
      clearTimeout(timeout)
      console.log('🔧 Widget message listener removed')
    }
  }, [config.postMessages, isAuthenticated, authChecked, authError])

  // Debug: Status logger to show current widget state
  useEffect(() => {
    const statusLogger = setInterval(() => {
      console.log('🔧 Widget Status Check:')
      console.log('🔧   postMessages enabled:', config.postMessages)
      console.log('🔧   authenticated:', isAuthenticated)
      console.log('🔧   authChecked:', authChecked)
      console.log('🔧   authError:', authError)
      console.log('🔧   current token:', !!getCurrentWidgetAuthToken())
    }, 10000) // Every 10 seconds

    return () => clearInterval(statusLogger)
  }, [config.postMessages, isAuthenticated, authChecked, authError])

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
    Object.keys(config).forEach((key) => {
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

    setConfig((prev) => ({ ...prev, ...urlConfig, disableTTS: false }))

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        // Use the same handler as user input
        const widgetChatHandler = handleWidgetChatFn()
        widgetChatHandler('start matchmaking')
      }
    } else if (homeStore.getState().chatLog.length > 0) {
      // If there's existing chat history, send it to parent
      console.log(
        '🎪 Widget - Found existing chat history, sending to parent...'
      )
      sendChatHistoryToParent()
    }
  }, [
    isAuthenticated,
    authChecked,
    config.postMessages,
    sendChatHistoryToParent,
  ])

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
      {/* Always render the main widget/model area */}
      <div className="relative w-full h-full">
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
              src="/emi_gif.gif"
              alt="Emi's avatar"
              width={160}
              height={160}
              className="w-40 h-40 rounded-full border-4 border-pink-400 shadow-lg mb-6 object-cover bg-black"
              style={{ boxShadow: '0 4px 24px #18181b' }}
              priority
              unoptimized
            />
            <span
              className="text-pink-500 font-bold text-2xl mb-2"
              style={{ textShadow: '0 2px 8px #18181b, 0 0 2px #000' }}
            >
              Hey there! I&apos;m Emi
            </span>
            <span
              className="text-white text-lg"
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
        <div className="absolute inset-0">
          {/* Character Display */}
          {config.showCharacter && (
            <div
              className="absolute top-0 left-0 bottom-0 right-0 pointer-events-none z-0"
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
                window.parent.postMessage({ type: 'TOGGLE_FULLSCREEN' }, '*')
              }
            }}
            className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg z-30"
            title="Toggle Fullscreen"
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
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        )}

        <Toasts />
      </div>
    </>
  )
}

export default Widget
