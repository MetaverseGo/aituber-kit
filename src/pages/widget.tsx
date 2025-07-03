import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { WidgetForm } from '@/components/widgetForm'
import VrmViewer from '@/components/vrmViewer'
import Live2DViewer from '@/components/live2DViewer'
import { Toasts } from '@/components/toasts'
import MatchmakingProgress from '@/components/MatchmakingProgress'
import PersonalityPanel from '@/components/PersonalityPanel'
import ChatMenu from '@/components/ChatMenu'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/lib/i18n'
import { buildUrl } from '@/utils/buildUrl'
import { MamaSanSpecialist } from '@/features/matchmaking/mama-san-specialist'

interface WidgetConfig {
  // Display options
  width?: string
  height?: string
  theme?: 'light' | 'dark' | 'minimal'
  showBackground?: boolean
  showCharacter?: boolean

  // Character options
  characterModel?: string
  characterName?: string
  systemPrompt?: string

  // UI options
  showInput?: boolean
  showChatLog?: boolean
  showVoiceButton?: boolean
  showSettingsButton?: boolean

  // Functional options
  apiKey?: string
  aiService?: string
  model?: string
  autoFocus?: boolean

  // Parent communication
  postMessages?: boolean
  allowFullscreen?: boolean
}

// Audio context management for iframe compatibility
const initializeAudioContext = async () => {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return null

    const audioContext = new AudioContextClass()

    // For iframes, we need to resume the context after user interaction
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
      console.log('AudioContext resumed successfully in iframe')
    }

    return audioContext
  } catch (error) {
    console.warn('Failed to initialize AudioContext:', error)
    return null
  }
}

const Widget = () => {
  const router = useRouter()
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatScrollRefHidden = useRef<HTMLDivElement>(null)
  const [audioContextReady, setAudioContextReady] = useState(false)
  const [config, setConfig] = useState<WidgetConfig>({
    width: '800px',
    height: '600px',
    theme: 'light',
    showBackground: true,
    showCharacter: true,
    showInput: true,
    showChatLog: true,
    showVoiceButton: true,
    showSettingsButton: false,
    autoFocus: true,
    postMessages: false,
    allowFullscreen: false,
  })

  const modelType = settingsStore(s => s.modelType)
  const backgroundImageUrl = homeStore(s => s.backgroundImageUrl)
  const chatLog = homeStore(s => s.chatLog)

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Listen for WIDGET_AUTH event
  useEffect(() => {
    function handleAuthEvent (event: MessageEvent) {
      if (event.data) {
        console.log('[Widget] Received postMessage event:', event.data)
      }
      if (event.data && event.data.type === 'WIDGET_AUTH' && event.data.token) {
        setIsAuthenticated(true)
        setAuthChecked(true)
        setAuthError(null)
      }
    }
    window.addEventListener('message', handleAuthEvent)
    // If no auth after a short delay, show error
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        setAuthChecked(true)
        setAuthError(
          'You are not authenticated. Please sign in to use the widget.'
        )
      }
    }, 1500)
    return () => {
      window.removeEventListener('message', handleAuthEvent)
      clearTimeout(timeout)
    }
  }, [isAuthenticated])

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

  // Audio context initialization with user gesture
  const handleUserInteraction = useCallback(async () => {
    if (!audioContextReady) {
      const audioContext = await initializeAudioContext()
      if (audioContext) {
        setAudioContextReady(true)
        console.log('Audio context initialized after user interaction')
      }
    }
  }, [audioContextReady])

  // Add global click listener for audio context initialization
  useEffect(() => {
    const handleClick = () => handleUserInteraction()
    const handleKeydown = () => handleUserInteraction()

    // Add event listeners for user interaction
    document.addEventListener('click', handleClick, { once: true })
    document.addEventListener('keydown', handleKeydown, { once: true })
    document.addEventListener('touchstart', handleClick, { once: true })

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [handleUserInteraction])

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
      console.log('🎨 Widget - Personality completion check:', {
        completed,
        hasResult,
        hasDismissed,
        isCompleted,
        shouldShow,
      })
      // Only adjust layout when panel should actually be visible
      setIsPersonalityCompleted(shouldShow)
    } catch (error) {
      console.log('🎨 Widget - Error checking personality completion:', error)
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
        console.log('🎨 Widget - Storage changed:', e.key)
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
        console.log(
          '🎨 Widget - Chat log changed, checking completion status...'
        )
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

  // PostMessage communication with parent
  useEffect(() => {
    if (!config.postMessages) return

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'WIDGET_CONFIG') {
        setConfig(prev => ({ ...prev, ...event.data.config }))
      }

      if (event.data.type === 'SEND_MESSAGE') {
        // Trigger sending a message from parent
        const form = document.querySelector('form')
        const input = form?.querySelector(
          'input[type="text"]'
        ) as HTMLInputElement
        if (input) {
          input.value = event.data.message
          form?.dispatchEvent(new Event('submit'))
        }
      }

      if (event.data.type === 'CLEAR_CHAT') {
        homeStore.setState({ chatLog: [] })
      }
    }

    window.addEventListener('message', handleMessage)

    // Notify parent that widget is ready
    window.parent.postMessage({ type: 'WIDGET_READY' }, '*')

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [config])

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
    // On initial load, if chat log is empty, insert Emi's greeting
    if (homeStore.getState().chatLog.length === 0) {
      homeStore.getState().upsertMessage({
        role: 'assistant',
        content: new MamaSanSpecialist().getIntro(),
        timestamp: new Date().toISOString(),
      })
    }
  }, [])

  const getThemeClasses = () => {
    switch (config.theme) {
      case 'dark':
        return 'bg-gray-900 text-white'
      case 'minimal':
        return 'bg-white border border-gray-200'
      default:
        return 'bg-gradient-to-br from-blue-50 to-purple-50'
    }
  }

  const containerStyle = {
    width: isPersonalityCompleted ? 'calc(100% - 320px)' : config.width,
    height: config.height,
    maxWidth: isPersonalityCompleted ? 'calc(800px - 320px)' : '800px',
    maxHeight: '600px',
  }

  const backgroundStyle =
    config.showBackground && backgroundImageUrl
      ? {
          backgroundImage: `url(${buildUrl(backgroundImageUrl)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}

  // Debug logging
  console.log('🎨 Widget - isPersonalityCompleted:', isPersonalityCompleted)
  console.log(
    '🎨 Widget - Rendering main content with right constraint:',
    isPersonalityCompleted ? '320px' : '0'
  )

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
          {/* Audio Context Permission Banner */}
          {!audioContextReady && (
            <div
              onClick={handleUserInteraction}
              className='absolute top-0 left-0 right-0 bg-blue-500 text-white text-sm py-2 px-4 z-50 cursor-pointer hover:bg-blue-600 transition-colors'
            >
              <div className='flex items-center justify-center gap-2'>
                <svg
                  className='w-4 h-4'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z' />
                  <path d='M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z' />
                </svg>
                <span>Click to enable microphone & audio features</span>
              </div>
            </div>
          )}

          {/* Matchmaking Progress Bar */}
          <MatchmakingProgress />
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

            {/* Chat Log - positioned just above input */}
            {config.showChatLog && chatLog.length > 0 && config.showInput && (
              <div
                ref={chatScrollRef}
                className='absolute bottom-20 left-2 right-2 max-h-32 overflow-y-auto scroll-hidden z-10'
              >
                <div className='space-y-2 p-2'>
                  {chatLog.slice(-2).map((msg, i) => {
                    const isUser = msg.role === 'user'
                    const alignment = isUser ? 'ml-auto' : 'mr-auto'
                    const bubbleColor = isUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/90 backdrop-blur-sm text-gray-800 border border-white/50 shadow-lg'

                    return (
                      <div
                        key={i}
                        className={`text-sm p-3 rounded-2xl max-w-[80%] ${bubbleColor} ${alignment}`}
                      >
                        {!isUser && (
                          <div className='font-semibold text-xs mb-1 opacity-70'>
                            {settingsStore.getState().characterName}
                          </div>
                        )}
                        <div className='leading-relaxed'>
                          {typeof msg.content === 'string'
                            ? msg.content.replace(/\[.*?\]/g, '')
                            : 'Image message'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Chat Log - for when input is hidden, show at bottom */}
            {config.showChatLog && chatLog.length > 0 && !config.showInput && (
              <div
                ref={chatScrollRefHidden}
                className='absolute bottom-2 left-2 right-2 max-h-32 overflow-y-auto scroll-hidden z-10'
              >
                <div className='space-y-2 p-2'>
                  {chatLog.slice(-2).map((msg, i) => {
                    const isUser = msg.role === 'user'
                    const alignment = isUser ? 'ml-auto' : 'mr-auto'
                    const bubbleColor = isUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/90 backdrop-blur-sm text-gray-800 border border-white/50 shadow-lg'

                    return (
                      <div
                        key={i}
                        className={`text-sm p-3 rounded-2xl max-w-[80%] ${bubbleColor} ${alignment}`}
                      >
                        {!isUser && (
                          <div className='font-semibold text-xs mb-1 opacity-70'>
                            {settingsStore.getState().characterName}
                          </div>
                        )}
                        <div className='leading-relaxed'>
                          {typeof msg.content === 'string'
                            ? msg.content.replace(/\[.*?\]/g, '')
                            : 'Image message'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Input Form */}
            {config.showInput && (
              <div className='absolute bottom-0 left-0 right-0 p-2 z-20'>
                <div className='bg-white/95 backdrop-blur-sm rounded-lg shadow-lg'>
                  <WidgetForm
                    showVoiceButton={config.showVoiceButton}
                    showSettingsButton={config.showSettingsButton}
                    autoFocus={config.autoFocus}
                    allowFullscreen={config.allowFullscreen}
                  />
                </div>
              </div>
            )}
          </div>

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
          <ChatMenu isWidget={true} />
        </div>
      )}
    </>
  )
}

export default Widget
