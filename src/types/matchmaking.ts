export interface KokologyQuestion {
  id: number
  question: string
  answer?: string
  timestamp: Date
}

export interface PersonalityCategory {
  id: string
  name: string
  description: string
  imageUrl: string
  traits: string[]
  archetype: {
    direction: string
    dominance: number
    explicitness: number
    personalityScores: Record<string, number>
    interests: string[]
    services: string[]
  }
}

export interface MatchmakingSession {
  sessionId: string
  status:
    | 'idle'
    | 'kokology_analysis'
    | 'personality_summary'
    | 'awaiting_gender'
    | 'personality_profiling'
    | 'completed'
  step: number
  kokologyQuestions: KokologyQuestion[]
  personalitySummary?: string
  personalityCategory?: string
  gender?: 'female' | 'male'
  missingFields: string[]
}

export interface MatchmakingResult {
  message: string
  isComplete: boolean
  step: string
  data?: {
    personalityCategory?: string
    personalityImageUrl?: string
    profile?:
      | {
          category: PersonalityCategory
          confidence: number
          traits: string[]
          strengths: string[]
          role: 'host' | 'guest'
        }
      | {
          uid: string
          role: 'host' | 'guest'
          personalityCategory?: string
          completedAnalysis: boolean
        }
    expectingGender?: boolean
    showGenderButtons?: boolean
    disableTextInput?: boolean
    stepProgress?: {
      current: number
      total: number
      label: string
      phase: 'questions' | 'analyzing' | 'completed'
    }
  }
}

export interface MatchmakingConfig {
  kokologyPersonality?: 'empathetic' | 'analytical' | 'playful' | 'emi'
  writerPersonality?: 'empathetic' | 'insightful' | 'creative' | 'emi'
  profilerPersonality?: 'analytical' | 'intuitive' | 'systematic' | 'emi'
  questionCount?: number
}
