import mongoose, { Schema, Document } from 'mongoose'

export interface IUserQuestionHistory extends Document {
  _id: mongoose.Types.ObjectId
  userId: string // User identifier (could be session ID, user ID, etc.)
  questionId: string // Reference to ProfilingQuestion.questionId
  askedAt: Date
  answeredAt?: Date
  responseText?: string // Store the user's response
  profileTagsExtracted?: string[] // Tags extracted from the response
  isSkipped?: boolean // If user skipped the question
  context?: string // Context in which question was asked
}

const UserQuestionHistorySchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    questionId: {
      type: String,
      required: true,
      index: true,
    },
    askedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    answeredAt: {
      type: Date,
    },
    responseText: {
      type: String,
      trim: true,
    },
    profileTagsExtracted: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    isSkipped: {
      type: Boolean,
      default: false,
    },
    context: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for efficient querying
UserQuestionHistorySchema.index({ userId: 1, questionId: 1 }, { unique: true })
UserQuestionHistorySchema.index({ userId: 1, askedAt: -1 })
UserQuestionHistorySchema.index({ userId: 1, answeredAt: -1 })
UserQuestionHistorySchema.index({ questionId: 1, askedAt: -1 })

export default mongoose.models.UserQuestionHistory ||
  mongoose.model<IUserQuestionHistory>(
    'UserQuestionHistory',
    UserQuestionHistorySchema
  )
