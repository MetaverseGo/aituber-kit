import React, { useState, useRef, useEffect } from 'react'
import i18n from 'i18next'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { handleSendChatFn } from '@/features/chat/handlers'
import { SYSTEM_PROMPT_EN } from '@/features/constants/systemPromptConstants'

interface ChatMenuProps {
  isWidget?: boolean
}

export const ChatMenu: React.FC<ChatMenuProps> = ({ isWidget = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Check if personality analysis is available
  const [hasPersonalityAnalysis, setHasPersonalityAnalysis] = useState(false)
  
  useEffect(() => {
    const checkPersonalityAnalysis = () => {
      try {
        const completed = localStorage.getItem('personality_analysis_completed') === 'true'
        const hasResult = localStorage.getItem('last_matchmaking_result') !== null
        setHasPersonalityAnalysis(completed && hasResult)
      } catch {
        setHasPersonalityAnalysis(false)
      }
    }
    
    // Check initially
    checkPersonalityAnalysis()
    
    // Check periodically in case analysis completes while menu is open
    const interval = setInterval(checkPersonalityAnalysis, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  const showPersonalityPanel = () => {
    // Trigger showing the personality panel by dispatching a custom event
    window.dispatchEvent(new CustomEvent('showPersonalityPanel'))
    setIsOpen(false)
  }

  const startOver = async () => {
    try {
      // Clear personality analysis data
      localStorage.removeItem('personality_analysis_completed')
      localStorage.removeItem('personality_session_id')
      localStorage.removeItem('matchmaking_step_progress')
      localStorage.removeItem('last_matchmaking_result')
      
      // Reset character name to default "Emi", language to English, and system prompt to English
      settingsStore.setState({ 
        characterName: 'Emi',
        selectLanguage: 'en',
        systemPrompt: SYSTEM_PROMPT_EN
      })
      
      // Update i18n language immediately
      i18n.changeLanguage('en')
      
      // Close menu
      setIsOpen(false)
      
      console.log('Chat cleared, personality analysis reset, and character name reset to Emi')
      
      // Auto-start conversation with a message that triggers personality analysis
      const handleSendChat = handleSendChatFn()
      
      // Use a specific trigger phrase to start the personality assessment
      const personalityTrigger = "begin personality analysis"
      
      // Small delay to ensure settings are updated before starting
      setTimeout(async () => {
        // Send the trigger message to start personality analysis
        await handleSendChat(personalityTrigger)
        
        // Clear the chat log immediately after to hide the trigger message
        // This will remove the "begin personality analysis" user message
        setTimeout(() => {
          const currentChatLog = homeStore.getState().chatLog
          // Keep only Emi's response (assistant messages), remove user trigger message
          const filteredLog = currentChatLog.filter(msg => msg.role === 'assistant')
          homeStore.setState({ chatLog: filteredLog })
        }, 100)
      }, 500)
      
    } catch (error) {
      console.error('Error starting over:', error)
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${isWidget ? 'absolute top-2 right-12' : 'fixed top-4 right-4'} z-50 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 border border-gray-200`}
        title="Chat Commands"
      >
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <div className={`${isWidget ? 'absolute top-12 right-2' : 'fixed top-16 right-4'} z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-3">
            <div className="flex items-center space-x-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="font-semibold">Chat Commands</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Show Personality Panel - only when analysis is available */}
            {hasPersonalityAnalysis && (
              <button
                onClick={showPersonalityPanel}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center space-x-3 text-gray-700"
              >
                <svg
                  className="w-5 h-5 text-purple-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <div>
                  <div className="font-medium">Show Personality</div>
                  <div className="text-sm text-gray-500">View your personality analysis</div>
                </div>
              </button>
            )}
            
            <button
              onClick={startOver}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center space-x-3 text-gray-700"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <div>
                <div className="font-medium">Start Over</div>
                <div className="text-sm text-gray-500">Clear chat and start new session</div>
              </div>
            </button>

            {/* Placeholder for future commands */}
            <div className="px-4 py-2 text-sm text-gray-400 border-t border-gray-100 mt-1">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>More commands coming soon</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatMenu 