import React from 'react'

export const ResetPersonalityButton: React.FC = () => {
  const resetPersonalityAnalysis = () => {
    try {
      localStorage.removeItem('personality_analysis_completed')
      localStorage.removeItem('personality_session_id')
      localStorage.removeItem('matchmaking_step_progress')
      localStorage.removeItem('last_matchmaking_result')
      window.location.reload()
    } catch (error) {
      console.error('Error resetting personality analysis:', error)
    }
  }

  return (
    <button
      onClick={resetPersonalityAnalysis}
      className="fixed top-4 right-4 z-50 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
      title="Reset personality analysis (for testing)"
    >
      Reset Analysis
    </button>
  )
}
