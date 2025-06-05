import React, { useState } from 'react'
import { useMatchmaking } from '@/hooks/useMatchmaking'
import { MatchmakingResult } from '@/types/matchmaking'

interface MatchmakingDemoProps {
  userId?: string
  onComplete?: (result: MatchmakingResult) => void
}

export const MatchmakingDemo: React.FC<MatchmakingDemoProps> = ({
  userId = 'demo-user',
  onComplete,
}) => {
  const [inputMessage, setInputMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<
    Array<{
      role: 'user' | 'assistant'
      content: string
      data?: MatchmakingResult['data']
    }>
  >([])

  const {
    isActive,
    isLoading,
    currentResult,
    error,
    sessionId,
    startMatchmaking,
    sendMessage,
    reset,
    isAwaitingGender,
    showGenderButtons,
    disableTextInput,
    stepProgress,
    personalityResult,
    getPersonalityCategories,
  } = useMatchmaking({
    userId,
    config: {
      kokologyPersonality: 'emi',
      writerPersonality: 'emi',
      profilerPersonality: 'emi',
      questionCount: 5,
    },
    onComplete: (result) => {
      console.log('Matchmaking completed:', result)
      onComplete?.(result)
    },
    onProgress: (result) => {
      console.log('Matchmaking progress:', result)
    },
  })

  const handleStartMatchmaking = async () => {
    try {
      const result = await startMatchmaking(
        "I'd like to start my personality analysis!"
      )

      setChatHistory([
        { role: 'user', content: "I'd like to start my personality analysis!" },
        { role: 'assistant', content: result.message, data: result.data },
      ])
    } catch (err) {
      console.error('Error starting matchmaking:', err)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isActive) return

    try {
      const userMessage = inputMessage.trim()
      setInputMessage('')

      // Add user message to history
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: userMessage },
      ])

      const result = await sendMessage(userMessage)

      // Add assistant response to history
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.message,
          data: result.data,
        },
      ])
    } catch (err) {
      console.error('Error sending message:', err)
    }
  }

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    try {
      const genderText = gender === 'male' ? 'boy' : 'girl'

      // Add user response to history
      setChatHistory((prev) => [...prev, { role: 'user', content: genderText }])

      const result = await sendMessage(genderText)

      // Add assistant response to history
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.message,
          data: result.data,
        },
      ])
    } catch (err) {
      console.error('Error sending gender response:', err)
    }
  }

  const handleReset = () => {
    reset()
    setChatHistory([])
    setInputMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🌸 Personality Analysis Demo
        </h2>
        <p className="text-gray-600">
          Experience the complete matchmaking flow: kokology → analysis →
          profiling
        </p>
      </div>

      {/* Status and Progress */}
      {isActive && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">
              Session: {sessionId.slice(0, 8)}...
            </span>
            <button
              onClick={handleReset}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Reset
            </button>
          </div>

          {stepProgress && (
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-blue-700">
                  {stepProgress.label}
                </span>
                <span className="text-xs text-blue-600">
                  {stepProgress.current}/{stepProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(stepProgress.current / stepProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="text-xs text-blue-600">
            Phase: {stepProgress?.phase || 'initializing'} • Status:{' '}
            {isLoading ? 'processing...' : 'ready'}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 text-sm">Error: {error}</div>
        </div>
      )}

      {/* Completion Result */}
      {personalityResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            🎉 Analysis Complete!
          </h3>
          <div className="text-green-700">
            <strong>Your Personality Type:</strong> {personalityResult.category}
          </div>
          {personalityResult.imageUrl && (
            <div className="mt-2">
              <img
                src={personalityResult.imageUrl}
                alt={personalityResult.category || 'Personality'}
                className="w-32 h-32 object-cover rounded-lg"
                onError={(e) => {
                  console.log(
                    'Image failed to load:',
                    personalityResult.imageUrl
                  )
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Chat History */}
      <div className="mb-4 h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
        {chatHistory.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            Click "Start Analysis" to begin your personality discovery journey!
          </div>
        ) : (
          <div className="space-y-3">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  {msg.data?.stepProgress && (
                    <div className="mt-2 text-xs opacity-75">
                      Step {msg.data.stepProgress.current} of{' '}
                      {msg.data.stepProgress.total}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Controls */}
      <div className="space-y-3">
        {!isActive ? (
          <button
            onClick={handleStartMatchmaking}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting...' : '🌸 Start Personality Analysis'}
          </button>
        ) : (
          <>
            {/* Gender Selection Buttons */}
            {showGenderButtons && isAwaitingGender && (
              <div className="flex space-x-3">
                <button
                  onClick={() => handleGenderSelect('female')}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50"
                >
                  Girl 👧
                </button>
                <button
                  onClick={() => handleGenderSelect('male')}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Boy 👦
                </button>
              </div>
            )}

            {/* Text Input */}
            {!disableTextInput && (
              <div className="flex space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    isAwaitingGender
                      ? 'Or type your response...'
                      : 'Type your answer...'
                  }
                  disabled={isLoading}
                  className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  rows={2}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '...' : 'Send'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Debug Info */}
      <details className="mt-6">
        <summary className="text-sm text-gray-500 cursor-pointer">
          Debug Info
        </summary>
        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(
            {
              isActive,
              isLoading,
              isAwaitingGender,
              showGenderButtons,
              disableTextInput,
              stepProgress,
              personalityResult,
              sessionId: sessionId.slice(0, 8) + '...',
              availableCategories: getPersonalityCategories().length,
            },
            null,
            2
          )}
        </pre>
      </details>
    </div>
  )
}
