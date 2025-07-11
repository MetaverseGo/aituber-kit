import mongoose, { Schema, Document } from 'mongoose'

export interface IPlayfriendsUser extends Document {
  _id: mongoose.Types.ObjectId
  uid: string
  username: string
  profilePic?: string
  bio?: string
  updatedAt: Date
  gender: 'male' | 'female' | 'other'
  birthday?: Date
  roles: string[] // Array of role strings, we'll filter for 'h'
  missionProfile: {
    chatBadgeUrl: string
    level: number
    fontHexColor: string
    accumulatedExp?: number
  }
  privileges?: {
    avatarFrame?: {
      mediaUrls: {
        mobile: string
        web: string
      }
    }
  }
  score?: number // For search results
}

const PlayfriendsUserSchema: Schema = new Schema(
  {
    uid: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    profilePic: {
      type: String,
    },
    bio: {
      type: String,
      index: 'text', // Text index for search
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    birthday: {
      type: Date,
    },
    roles: [
      {
        type: String,
        index: true,
      },
    ],
    missionProfile: {
      chatBadgeUrl: {
        type: String,
        required: true,
      },
      level: {
        type: Number,
        required: true,
        default: 1,
      },
      fontHexColor: {
        type: String,
        required: true,
        default: '000000',
      },
      accumulatedExp: {
        type: Number,
        default: 0,
      },
    },
    privileges: {
      avatarFrame: {
        mediaUrls: {
          mobile: {
            type: String,
          },
          web: {
            type: String,
          },
        },
      },
    },
  },
  {
    timestamps: false, // We're using our own updatedAt field
  }
)

// Indexes for search functionality
PlayfriendsUserSchema.index({ username: 1 })
PlayfriendsUserSchema.index({ uid: 1 })
PlayfriendsUserSchema.index({ roles: 1 })
PlayfriendsUserSchema.index({ updatedAt: -1 })
PlayfriendsUserSchema.index({ 'missionProfile.level': -1 })

// Function to create model with specific connection
export function createPlayfriendsUserModel(connection: mongoose.Connection) {
  return connection.model<IPlayfriendsUser>('User', PlayfriendsUserSchema)
}

// Default export (this might not work with separate connections, but keeping for compatibility)
export default mongoose.models.PlayfriendsUser ||
  mongoose.model<IPlayfriendsUser>('PlayfriendsUser', PlayfriendsUserSchema)
