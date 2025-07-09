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

  const modelType = settingsStore(s => s.modelType)
  const backgroundImageUrl = homeStore(s => s.backgroundImageUrl)
  const chatLog = homeStore(s => s.chatLog)

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

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

    function handleAllMessages (event: MessageEvent) {
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
          widgetChatHandler(content).catch(error => {
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
          widgetChatHandler(content).catch(error => {
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

    setConfig(prev => ({ ...prev, ...urlConfig }))

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
      {!authChecked ? (
        <div className='flex items-center justify-center h-screen text-lg'>
          Loading...
        </div>
      ) : !isAuthenticated ? (
        <div
          className='fixed inset-0 flex items-center justify-center w-screen h-screen'
          style={{
            backgroundImage: "url('/backgrounds/static-noise.gif')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#18181b',
            zIndex: 9999,
          }}
        >
          <span
            style={{
              color: '#f22897',
              fontWeight: 'bold',
              fontSize: '1.5rem',
              textShadow: '0 2px 8px #18181b, 0 0 2px #000',
              background: 'rgba(24,24,27,0.7)',
              borderRadius: '8px',
              padding: '1.5rem 2.5rem',
            }}
          >
            You are not authenticated. Please sign in.
          </span>
        </div>
      ) : (
        <div
          className={`relative overflow-hidden ${getThemeClasses()}`}
          style={{ ...containerStyle, ...backgroundStyle }}
        >
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
                  window.parent.postMessage({ type: 'TOGGLE_FULLSCREEN' }, '*')
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
      )}
    </>
  )
}

export default Widget
