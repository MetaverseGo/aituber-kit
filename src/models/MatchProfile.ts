import mongoose, { Schema, Document } from 'mongoose'
import { MatchProfile as IMatchProfile } from '@/types/matchmaking'

// Extended interface for the MatchProfile model with additional fields
interface ExtendedMatchProfile extends IMatchProfile {
  mamasanState?: MamaSanState
  stamina?: number
  intimacyLevel?: number
  validationErrors?: Array<{
    source: 'mamasan' | 'kokology' | 'profiler'
    originalText: string
    validationError: string
    timestamp: Date
    status: 'pending' | 'resolved' | 'ignore'
    retryCount: number
    context?: {
      question?: string
      userResponse?: string
      attemptNumber?: number
    }
  }>
  datingProfile?: {
    physicalPreferences?: {
      height?: string
      build?: string
      ethnicity?: string
      style?: string
      attractionTags?: string[]
      dealBreakers?: string[]
    }
    relationshipStyle?: string
    intimacyComfort?: string
    dominanceStyle?: string
    demographics?: {
      agePreference?: {
        min?: number
        max?: number
        preference?: string
      }
      locationImportance?: string
      experienceLevel?: string
    }
    servicePreferences?: {
      primaryServices?: string[]
      mood?: string
      interactionStyle?: string
      conversationTopics?: string[]
      sessionLength?: string
    }
    platformMetrics?: {
      attractivenessRating?: number
      personalityRating?: number
      communicationRating?: number
      gamingSkill?: number
      entertainmentValue?: number
      reliability?: number
      friendliness?: number
      responseTime?: number
      sessionSuccessRate?: number
      repeatClientRate?: number
    }
    contentPreferences?: {
      explicitnessLevel?: string
      boundaries?: string[]
      specialties?: string[]
      fantasies?: string[]
    }
    verification?: {
      isVerified?: boolean
      verificationMethod?: string
      trustScore?: number
      reportCount?: number
      positiveReviews?: number
    }
  }
}

interface MatchProfileDocument extends ExtendedMatchProfile, Document {}

// Extend IMatchProfile to include mamasanState, stamina, and intimacyLevel
export interface MamaSanState {
  currentQuestion: number
  answers: string[]
  isComplete: boolean
}

// Add stamina and intimacyLevel to the type
// Export the extended interface as an alias for backward compatibility
export type MatchProfileWithStats = ExtendedMatchProfile

const PersonalityTraitSchema = new Schema({
  name: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 1 },
})

const PersonalityValueSchema = new Schema({
  name: { type: String, required: true },
  importance: { type: Number, required: true, min: 0, max: 1 },
})

const InterestSchema = new Schema({
  category: { type: String, required: true },
  items: [
    {
      name: { type: String, required: true },
      level: { type: Number, required: true, min: 0, max: 1 },
    },
  ],
})

const LanguageSchema = new Schema({
  code: { type: String, required: true },
  proficiency: { type: Number, required: true, min: 0, max: 1 },
})

const ServiceSchema = new Schema({
  name: { type: String, required: true },
  skill: { type: Number, required: true, min: 0, max: 1 },
  isActive: { type: Boolean, default: true },
  availability: {
    days: [String],
    hours: [Number],
  },
})

const ActivitySchema = new Schema({
  name: { type: String, required: true },
  skill: { type: Number, required: true, min: 0, max: 1 },
  enjoyment: { type: Number, required: true, min: 0, max: 1 },
})

const GameSchema = new Schema({
  name: { type: String, required: true },
  skill: { type: Number, required: true, min: 0, max: 1 },
  playTime: { type: Number, required: true, min: 0 },
})

const KokologyQuestionSchema = new Schema({
  id: { type: Number, required: true },
  question: { type: String, required: true },
  answer: { type: String },
  timestamp: { type: Date, default: Date.now },
})

const TopicConversationSchema = new Schema({
  currentTopic: { type: String, default: null },
  turnCount: { type: Number, default: 0 },
  turnsSinceLastProfileQuestion: { type: Number, default: 0 },
  topicHistory: { type: [String], default: [] },
  lastProfileQuestionTurn: { type: Number, default: -1 },
})

const GreetingStateSchema = new Schema({
  hasGreeted: { type: Boolean, default: false },
  greetingType: { type: String, default: null },
})

const MamaSanStateSchema = new Schema({
  currentQuestion: { type: Number, default: 0 },
  answers: { type: [String], default: [] },
  isComplete: { type: Boolean, default: false },
  needsFirstQuestion: { type: Boolean, default: false },
  topicConversation: { type: TopicConversationSchema, default: () => ({}) },
  greetingState: { type: GreetingStateSchema, default: () => ({}) },
})

const MatchProfileSchema = new Schema<MatchProfileDocument>(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['host', 'guest'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ONLINE', 'AWAY', 'OFFLINE', 'HOSTING', 'IN_ROOM'],
      default: 'OFFLINE',
    },
    lastActive: {
      type: Date,
      default: Date.now,
      index: true,
    },
    stamina: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    intimacyLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Online Dating & Fan Service Platform Fields
    datingProfile: {
      // Physical Appearance & Preferences
      physicalPreferences: {
        height: String, // "tall", "short", "any", specific ranges
        build: String, // "slim", "athletic", "curvy", "muscular", etc.
        ethnicity: String, // "Asian", "Latina", "any", etc.
        style: String, // "cute", "elegant", "edgy", "casual", etc.
        attractionTags: [String], // ["sexy", "innocent", "goth", "sporty"]
        dealBreakers: [String], // physical deal-breakers
      },

      // Dating & Relationship Style
      relationshipStyle: {
        type: String,
        default: 'casual',
      },

      intimacyComfort: {
        type: String,
        enum: [
          'very-conservative',
          'conservative',
          'moderate',
          'open',
          'very-open',
        ],
        default: 'moderate',
      },

      dominanceStyle: {
        type: String,
        enum: ['dominant', 'submissive', 'switch', 'vanilla'],
        default: 'vanilla',
      },

      // Demographics & Preferences
      demographics: {
        agePreference: {
          min: Number,
          max: Number,
          preference: String, // "younger", "older", "same age", "any"
        },
        locationImportance: {
          type: String,
          enum: ['very-important', 'somewhat-important', 'not-important'],
          default: 'somewhat-important',
        },
        experienceLevel: {
          type: String,
          enum: ['beginner', 'intermediate', 'experienced', 'expert'],
          default: 'intermediate',
        },
      },

      // Fan Service & Entertainment Preferences
      servicePreferences: {
        primaryServices: [String], // ["gaming", "chatting", "teaching", "companionship"]
        mood: {
          type: String,
          default: 'friendly',
        },
        interactionStyle: {
          type: String,
          default: 'casual',
        },
        conversationTopics: [String], // ["anime", "gaming", "music", "lifestyle"]
        sessionLength: {
          type: String,
          enum: ['short', 'medium', 'long', 'marathon'],
          default: 'medium',
        },
      },

      // Platform-Specific Ratings & Metrics
      platformMetrics: {
        // Tinder-style metrics
        attractivenessRating: { type: Number, min: 0, max: 10, default: 5 },
        personalityRating: { type: Number, min: 0, max: 10, default: 5 },
        communicationRating: { type: Number, min: 0, max: 10, default: 5 },

        // Epal.gg-style metrics
        gamingSkill: { type: Number, min: 0, max: 10, default: 5 },
        entertainmentValue: { type: Number, min: 0, max: 10, default: 5 },
        reliability: { type: Number, min: 0, max: 10, default: 5 },
        friendliness: { type: Number, min: 0, max: 10, default: 5 },

        // General service metrics
        responseTime: { type: Number, default: 0 }, // average in minutes
        sessionSuccessRate: { type: Number, min: 0, max: 1, default: 0 },
        repeatClientRate: { type: Number, min: 0, max: 1, default: 0 },
      },

      // Social & Content Preferences
      contentPreferences: {
        explicitnessLevel: {
          type: String,
          default: 'mild',
        },
        boundaries: [String], // what they won't do
        specialties: [String], // what they're known for
        fantasies: [String], // roleplay scenarios they enjoy
      },

      // Verification & Trust
      verification: {
        isVerified: { type: Boolean, default: false },
        verificationMethod: String, // "photo", "video", "id", etc.
        trustScore: { type: Number, min: 0, max: 100, default: 50 },
        reportCount: { type: Number, default: 0 },
        positiveReviews: { type: Number, default: 0 },
      },
    },

    // Core Profile Data
    profileData: {
      personality: {
        traits: [PersonalityTraitSchema],
        values: [PersonalityValueSchema],
      },
      interests: [InterestSchema],
      interactionStyle: String,
      confidenceScores: {
        personality: { type: Map, of: Number },
        interests: { type: Map, of: Number },
        interactionStyle: Number,
      },
      sourceTracking: {
        personality: { type: Map, of: String },
        interests: { type: Map, of: String },
        interactionStyle: String,
      },
      capabilities: {
        languages: [LanguageSchema],
        services: [ServiceSchema],
        activities: [ActivitySchema],
        games: [GameSchema],
        teachingStyle: String,
      },
      preferences: {
        matchingPrefs: {
          languageImportance: Number,
          skillLevelPreference: {
            type: String,
            enum: ['similar', 'better', 'any'],
          },
          personalityTraits: [String],
          dealBreakers: [String],
          hostPreferences: {
            energyLevel: {
              type: String,
            },
            teachingStyle: String,
            desiredServices: [
              {
                name: String,
                importance: Number,
              },
            ],
          },
          guestPreferences: {
            skillLevel: {
              type: String,
              enum: ['beginner', 'intermediate', 'advanced'],
            },
            interactionStyle: {
              type: String,
            },
            groupSize: {
              min: Number,
              max: Number,
            },
          },
        },
      },
    },

    // Vector Embeddings
    embeddings: {
      personality: [Number],
      interests: [Number],
      capabilities: [Number],
      physicalPreferences: [Number], // New: for physical attraction matching
      servicePreferences: [Number], // New: for service-based matching
      lastUpdated: Date,
    },

    // Session Management
    currentSession: {
      sessionId: String,
      status: {
        type: String,
        enum: [
          'idle',
          'kokology_analysis',
          'personality_summary',
          'awaiting_gender',
          'personality_profiling',
          'completed',
        ],
        default: 'idle',
      },
      step: { type: Number, default: 0 },
      missingFields: [String],
      context: Schema.Types.Mixed,
      kokologyQuestions: [KokologyQuestionSchema],
      personalitySummary: String,
      personalityCategory: String,
      gender: {
        type: String,
        enum: ['female', 'male'],
      },
    },

    // MamaSan AI State
    mamasanState: {
      type: MamaSanStateSchema,
      default: () => ({}),
    },

    // AI Response Validation Errors
    validationErrors: [
      {
        source: {
          type: String,
          enum: ['mamasan', 'kokology', 'profiler'],
          required: true,
        },
        originalText: { type: String, required: true },
        validationError: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ['pending', 'resolved', 'ignore'],
          default: 'pending',
        },
        retryCount: { type: Number, default: 0 },
        context: {
          question: String,
          userResponse: String,
          attemptNumber: Number,
        },
      },
    ],

    // Matching History & Feedback
    matchHistory: [
      {
        matchedUid: String,
        timestamp: Date,
        score: Number,
        serviceType: String,
        feedback: {
          rating: Number,
          tags: [String],
          comment: String,
          serviceQuality: Number,
          teachingQuality: Number,
          wouldBookAgain: Boolean,
          // Enhanced feedback for dating/fan service
          attractiveness: Number, // 1-10 rating
          personality: Number, // 1-10 rating
          communication: Number, // 1-10 rating
          entertainment: Number, // 1-10 rating
          value: Number, // 1-10 rating
        },
        interactionMetrics: {
          messageCount: Number,
          duration: Number,
          bookingMade: Boolean,
          tipAmount: Number, // for fan service platforms
          repeated: Boolean, // if they booked again
        },
      },
    ],

    // Optimization Metrics
    matchingMetrics: {
      averageRating: Number,
      serviceTypeRatings: [
        {
          service: String,
          avgRating: Number,
          count: Number,
        },
      ],
      successfulMatches: Number,
      bookingConversion: Number,
      lastUpdated: Date,
      complementaryScores: {
        teachingSuccess: Number,
        learningProgress: Number,
        personalityMatch: Number,
        physicalAttraction: Number, // New: for dating apps
        serviceCompatibility: Number, // New: for fan service
      },
      // Revenue metrics for platforms
      revenue: {
        totalEarned: { type: Number, default: 0 },
        averageSessionValue: { type: Number, default: 0 },
        topServiceRevenue: String, // which service makes most money
      },
    },

    completionStatus: {
      personality: Number,
      interests: Number,
      overall: Number,
      datingProfile: Number, // New: completion of dating fields
      lastUpdated: Date,
    },

    profileHistory: [Schema.Types.Mixed],

    onboardingChoice: {
      type: String,
      enum: ['anime', 'boy', 'girl'],
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for efficient querying
MatchProfileSchema.index({ 'embeddings.lastUpdated': -1 })
MatchProfileSchema.index({ 'currentSession.status': 1, lastActive: -1 })
MatchProfileSchema.index({ 'matchingMetrics.averageRating': -1 })
MatchProfileSchema.index({
  role: 1,
  'profileData.capabilities.services.isActive': 1,
})
MatchProfileSchema.index({ status: 1, lastActive: -1 })

export default mongoose.models.MatchProfile ||
  mongoose.model<MatchProfileDocument>('MatchProfile', MatchProfileSchema)
