import mongoose, { Schema, Document } from 'mongoose'
import { MatchProfile as IMatchProfile } from '@/types/matchmaking'

interface MatchProfileDocument extends IMatchProfile, Document {}

// Extend IMatchProfile to include mamasanState, stamina, and intimacyLevel
export interface MamaSanState {
  currentQuestion: number
  answers: string[]
  isComplete: boolean
}

// Add stamina and intimacyLevel to the type
export interface MatchProfileWithStats extends IMatchProfile {
  mamasanState?: MamaSanState
  stamina?: number
  intimacyLevel?: number
}

declare module '@/types/matchmaking' {
  interface MatchProfile {
    mamasanState?: MamaSanState
    stamina?: number
    intimacyLevel?: number
  }
}

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

const MamaSanStateSchema = new Schema({
  currentQuestion: { type: Number, default: 0 },
  answers: { type: [String], default: [] },
  isComplete: { type: Boolean, default: false },
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
              enum: ['high', 'medium', 'low'],
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
              enum: ['chatty', 'focused', 'mix'],
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
        },
        interactionMetrics: {
          messageCount: Number,
          duration: Number,
          bookingMade: Boolean,
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
      },
    },

    completionStatus: {
      personality: Number,
      interests: Number,
      overall: Number,
      lastUpdated: Date,
    },

    profileHistory: [Schema.Types.Mixed],
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

// Clear any existing model to force reload of schema changes
if (mongoose.models.MatchProfile) {
  delete mongoose.models.MatchProfile
}

const MatchProfile = mongoose.model<MatchProfileDocument>(
  'MatchProfile',
  MatchProfileSchema
)

export default MatchProfile
