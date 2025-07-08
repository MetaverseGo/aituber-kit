export interface KokologyQuestion {
  id: number
  question: string
  answer?: string
  timestamp: Date
}

export interface MamaSanSessionState {
  currentQuestion: number
  answers: string[]
  isComplete: boolean
  topicConversation?: TopicConversationState
}

export interface TopicConversationState {
  currentTopic: string | null
  turnCount: number // Number of turns on current topic
  topicHistory: Array<{
    topic: string
    turns: number
    startTime: Date
    endTime?: Date
  }>
  lastQuestion: string | null
}

export interface PersonalityTrait {
  name: string
  score: number
}

export interface PersonalityValue {
  name: string
  importance: number
}

export interface InterestItem {
  name: string
  level: number
}

export interface Interest {
  category: string
  items: InterestItem[]
}

export interface Language {
  code: string
  proficiency: number
}

export interface Service {
  name: string
  skill: number
  isActive?: boolean
  availability?: {
    days: string[]
    hours: number[]
  }
}

export interface Activity {
  name: string
  skill: number
  enjoyment: number
}

export interface Game {
  name: string
  skill: number
  playTime: number
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
  sessionId?: string
  status:
    | 'idle'
    | 'kokology_analysis'
    | 'personality_summary'
    | 'awaiting_gender'
    | 'personality_profiling'
    | 'completed'
  step: number
  missingFields: string[]
  context?: any
  kokologyQuestions: KokologyQuestion[]
  personalitySummary?: string
  personalityCategory?: string
  gender?: 'female' | 'male'
  mamasan?: MamaSanSessionState
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
    mamasan?: {
      searchQuery: string
      answers: string[]
    }
  }
}

export interface MatchmakingConfig {
  kokologyPersonality?: 'empathetic' | 'analytical' | 'playful' | 'emi'
  writerPersonality?: 'empathetic' | 'insightful' | 'creative' | 'emi'
  profilerPersonality?: 'analytical' | 'intuitive' | 'systematic' | 'emi'
  questionCount?: number
}

export interface MatchFeedback {
  rating: number
  tags: string[]
  comment: string
  serviceQuality: number
  teachingQuality: number
  wouldBookAgain: boolean
}

export interface InteractionMetrics {
  messageCount: number
  duration: number
  bookingMade: boolean
}

export interface MatchHistoryEntry {
  matchedUid: string
  timestamp: Date
  score: number
  serviceType: string
  feedback: MatchFeedback
  interactionMetrics: InteractionMetrics
}

export interface ServiceTypeRating {
  service: string
  avgRating: number
  count: number
}

export interface ComplementaryScores {
  teachingSuccess: number
  learningProgress: number
  personalityMatch: number
}

export interface MatchingMetrics {
  averageRating: number
  serviceTypeRatings: ServiceTypeRating[]
  successfulMatches: number
  bookingConversion: number
  lastUpdated: Date
  complementaryScores: ComplementaryScores
}

export interface CompletionStatus {
  personality: number
  interests: number
  overall: number
  lastUpdated: Date
}

export interface Embeddings {
  personality: number[]
  interests: number[]
  capabilities: number[]
  lastUpdated: Date
}

export interface DesiredService {
  name: string
  importance: number
}

export interface HostPreferences {
  energyLevel: 'high' | 'medium' | 'low'
  teachingStyle: string
  desiredServices: DesiredService[]
}

export interface GuestPreferences {
  skillLevel: 'beginner' | 'intermediate' | 'advanced'
  interactionStyle: 'chatty' | 'focused' | 'mix'
  groupSize: {
    min: number
    max: number
  }
}

export interface MatchingPreferences {
  languageImportance: number
  skillLevelPreference: 'similar' | 'better' | 'any'
  personalityTraits: string[]
  dealBreakers: string[]
  hostPreferences: HostPreferences
  guestPreferences: GuestPreferences
}

export interface Preferences {
  matchingPrefs: MatchingPreferences
}

export interface Capabilities {
  languages: Language[]
  services: Service[]
  activities: Activity[]
  games: Game[]
  teachingStyle: string
}

export interface ConfidenceScores {
  personality: Record<string, number>
  interests: Record<string, number>
  interactionStyle: number
}

export interface SourceTracking {
  personality: Record<string, string>
  interests: Record<string, string>
  interactionStyle: string
}

export interface ProfileData {
  personality: {
    traits: PersonalityTrait[]
    values: PersonalityValue[]
  }
  interests: Interest[]
  interactionStyle: string
  confidenceScores: ConfidenceScores
  sourceTracking: SourceTracking
  capabilities: Capabilities
  preferences: Preferences
}

export interface MatchProfile {
  uid: string
  role: 'host' | 'guest'
  status: 'ONLINE' | 'AWAY' | 'OFFLINE' | 'HOSTING' | 'IN_ROOM'
  lastActive: Date

  // Core Profile Data
  profileData: ProfileData

  // Vector Embeddings
  embeddings: Embeddings

  // Session Management
  currentSession: MatchmakingSession

  // Matching History & Feedback
  matchHistory: MatchHistoryEntry[]

  // Optimization Metrics
  matchingMetrics: MatchingMetrics

  completionStatus: CompletionStatus

  profileHistory: any[]

  createdAt?: Date
  updatedAt?: Date
}
