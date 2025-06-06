import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { WidgetForm } from '@/components/widgetForm'
import VrmViewer from '@/components/vrmViewer'
import Live2DViewer from '@/components/live2DViewer'
import { Toasts } from '@/components/toasts'
import MatchmakingProgress from '@/components/MatchmakingProgress'
import ChatMenu from '@/components/ChatMenu'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/lib/i18n'
import { buildUrl } from '@/utils/buildUrl'

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

const Widget = () => {
  const router = useRouter()
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

  const modelType = settingsStore((s) => s.modelType)
  const backgroundImageUrl = homeStore((s) => s.backgroundImageUrl)
  const chatLog = homeStore((s) => s.chatLog)

  // Detect if personality analysis is completed for split layout
  const [isPersonalityCompleted, setIsPersonalityCompleted] = useState(false)

  // Check for personality completion status
  useEffect(() => {
    const checkCompletionStatus = () => {
      try {
        const completed = localStorage.getItem('personality_analysis_completed') === 'true'
        const hasResult = localStorage.getItem('last_matchmaking_result') !== null
        const shouldShow = completed && hasResult
        console.log('🎨 Widget - Personality completion check:', { completed, hasResult, shouldShow })
        setIsPersonalityCompleted(shouldShow)
      } catch (error) {
        console.log('🎨 Widget - Error checking personality completion:', error)
        setIsPersonalityCompleted(false)
      }
    }

    // Initial check
    checkCompletionStatus()

    // Listen for localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'personality_analysis_completed' || e.key === 'last_matchmaking_result') {
        console.log('🎨 Widget - Storage changed:', e.key)
        checkCompletionStatus()
      }
    }
    
    // Listen for chat log changes (in case completion happens)
    const unsubscribe = homeStore.subscribe((state, prevState) => {
      if (state.chatLog !== prevState.chatLog) {
        console.log('🎨 Widget - Chat log changed, checking completion status...')
        // Small delay to allow localStorage to be updated
        setTimeout(checkCompletionStatus, 100)
      }
    })

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      unsubscribe()
    }
  }, [])

  // Also check based on MatchmakingProgress component state
  useEffect(() => {
    const interval = setInterval(() => {
      // Direct check - if there's a personality panel visible, constrain the layout
      const personalityPanel = document.querySelector('[class*="fixed"][class*="right-0"][class*="w-80"]')
      const shouldConstrain = personalityPanel !== null
      if (shouldConstrain !== isPersonalityCompleted) {
        console.log('🎨 Widget - Direct panel detection override:', shouldConstrain)
        setIsPersonalityCompleted(shouldConstrain)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [isPersonalityCompleted])

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

    setConfig((prev) => ({ ...prev, ...urlConfig }))

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
  }, [])

  // PostMessage communication with parent
  useEffect(() => {
    if (!config.postMessages) return

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'WIDGET_CONFIG') {
        setConfig((prev) => ({ ...prev, ...event.data.config }))
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
  }, [config.postMessages])

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
  console.log('🎨 Widget - Rendering main content with right constraint:', isPersonalityCompleted ? '320px' : '0')

  return (
    <div
      className={`relative overflow-hidden ${getThemeClasses()}`}
      style={{ ...containerStyle, ...backgroundStyle }}
    >
      {/* Matchmaking Progress Bar */}
      <MatchmakingProgress />
      
      {/* Main content */}
      <div className="absolute inset-0">
        {/* Character Display */}
        {config.showCharacter && (
          <div
            className="absolute top-0 left-0 bottom-0 right-0 pointer-events-none z-0"
            style={{ paddingBottom: config.showInput ? '80px' : '0' }}
          >
            {modelType === 'vrm' ? <VrmViewer /> : <Live2DViewer />}
          </div>
        )}

        {/* Chat Log - positioned just above input */}
        {config.showChatLog && chatLog.length > 0 && config.showInput && (
          <div className="absolute bottom-20 left-2 right-2 max-h-32 overflow-y-auto scroll-hidden z-10">
            <div className="space-y-2 p-2">
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
                      <div className="font-semibold text-xs mb-1 opacity-70">
                        {settingsStore.getState().characterName}
                      </div>
                    )}
                    <div className="leading-relaxed">
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
          <div className="absolute bottom-2 left-2 right-2 max-h-32 overflow-y-auto scroll-hidden z-10">
            <div className="space-y-2 p-2">
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
                      <div className="font-semibold text-xs mb-1 opacity-70">
                        {settingsStore.getState().characterName}
                      </div>
                    )}
                    <div className="leading-relaxed">
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
          <div className="absolute bottom-0 left-0 right-0 p-2 z-20">
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg">
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
      <ChatMenu isWidget={true} />
    </div>
  )
}

export default Widget
