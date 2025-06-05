import React from 'react'

interface APISetupGuideProps {
  onClose?: () => void
}

export const APISetupGuide: React.FC<APISetupGuideProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-purple-600 mb-2">
            🌸 Welcome to Your Personality Journey!
          </h2>
          <p className="text-gray-600">
            Let's get you set up to discover your unique personality type
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800 mb-2">Quick Setup:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Click the Settings gear icon (⚙️) in the menu</li>
              <li>Go to "Model Provider" tab</li>
              <li>Choose "Anthropic" as your AI service</li>
              <li>Enter your Anthropic API key</li>
              <li>Come back and say "hello" to start!</li>
            </ol>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Need an API Key?</h3>
            <p className="text-sm text-gray-700 mb-2">
              Get your free Anthropic API key:
            </p>
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors text-sm"
            >
              Get Anthropic API Key →
            </a>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">What happens next?</h3>
            <p className="text-sm text-gray-700">
              ✨ 5 fun personality questions<br/>
              🎭 Discover your personality type<br/>
              💫 Unlock personalized chat experience
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full mt-6 bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 transition-colors"
          >
            Got it! Let me set this up
          </button>
        )}
      </div>
    </div>
  )
} 