import mongoose, { Schema, Document } from 'mongoose'

export interface IProfilingQuestion extends Document {
  _id: mongoose.Types.ObjectId
  questionId: string // Unique string ID for easy reference
  text: string // The actual question text (gender-neutral)
  category: string // Main category (physicalPreferences, relationshipStyle, etc.)
  subcategory?: string // Subcategory (height, build, style, etc.)
  tags: string[] // Tags for filtering and grouping
  difficulty: 'basic' | 'intermediate' | 'advanced' // Question complexity
  priority: number // Priority for asking (1-10, higher = more important)
  isActive: boolean // Whether question is currently in use
  createdAt: Date
  updatedAt: Date
}

const ProfilingQuestionSchema: Schema = new Schema(
  {
    questionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'physicalPreferences',
        'relationshipStyle',
        'intimacyComfort',
        'dominanceStyle',
        'demographics',
        'servicePreferences',
        'interests',
        'lifestyle',
        'communication',
        'values',
      ],
      index: true,
    },
    subcategory: {
      type: String,
      trim: true,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    difficulty: {
      type: String,
      enum: ['basic', 'intermediate', 'advanced'],
      default: 'basic',
      index: true,
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for efficient querying
ProfilingQuestionSchema.index({ category: 1, subcategory: 1 })
ProfilingQuestionSchema.index({ isActive: 1, priority: -1 })
ProfilingQuestionSchema.index({ tags: 1, isActive: 1 })
ProfilingQuestionSchema.index({ difficulty: 1, priority: -1 })

// Text search index for question content
ProfilingQuestionSchema.index({ text: 'text', tags: 'text' })

export default mongoose.models.ProfilingQuestion ||
  mongoose.model<IProfilingQuestion>(
    'ProfilingQuestion',
    ProfilingQuestionSchema
  )
