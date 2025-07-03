import { connectMongoDB } from './mongodb'
import MatchProfile from '@/models/MatchProfile'
import {
  MatchProfile as IMatchProfile,
  MatchmakingSession,
} from '@/types/matchmaking'

export class MatchProfileService {
  /**
   * Get or create a match profile for a user
   */
  static async getOrCreateProfile(
    uid: string,
    role: 'host' | 'guest'
  ): Promise<IMatchProfile> {
    await connectMongoDB()

    let profile = await MatchProfile.findOne({ uid })

    if (!profile) {
      profile = new MatchProfile({
        uid,
        role,
        status: 'OFFLINE',
        lastActive: new Date(),
        currentSession: {
          status: 'idle',
          step: 0,
          missingFields: [],
          kokologyQuestions: [],
        },
        profileData: {
          personality: { traits: [], values: [] },
          interests: [],
          interactionStyle: '',
          confidenceScores: {
            personality: {},
            interests: {},
            interactionStyle: 0,
          },
          sourceTracking: {
            personality: {},
            interests: {},
            interactionStyle: '',
          },
          capabilities: {
            languages: [],
            services: [],
            activities: [],
            games: [],
            teachingStyle: '',
          },
          preferences: {
            matchingPrefs: {
              languageImportance: 0,
              skillLevelPreference: 'any',
              personalityTraits: [],
              dealBreakers: [],
              hostPreferences: {
                energyLevel: 'medium',
                teachingStyle: '',
                desiredServices: [],
              },
              guestPreferences: {
                skillLevel: 'beginner',
                interactionStyle: 'mix',
                groupSize: { min: 1, max: 5 },
              },
            },
          },
        },
        embeddings: {
          personality: [],
          interests: [],
          capabilities: [],
          lastUpdated: new Date(),
        },
        matchHistory: [],
        matchingMetrics: {
          averageRating: 0,
          serviceTypeRatings: [],
          successfulMatches: 0,
          bookingConversion: 0,
          lastUpdated: new Date(),
          complementaryScores: {
            teachingSuccess: 0,
            learningProgress: 0,
            personalityMatch: 0,
          },
        },
        completionStatus: {
          personality: 0,
          interests: 0,
          overall: 0,
          lastUpdated: new Date(),
        },
        profileHistory: [],
      })

      await profile.save()
    }

    return profile.toObject()
  }

  /**
   * Update user's last active timestamp
   */
  static async updateLastActive(uid: string): Promise<void> {
    await connectMongoDB()
    await MatchProfile.findOneAndUpdate({ uid }, { lastActive: new Date() })
  }

  /**
   * Update user's status
   */
  static async updateStatus(
    uid: string,
    status: IMatchProfile['status']
  ): Promise<void> {
    await connectMongoDB()
    await MatchProfile.findOneAndUpdate(
      { uid },
      { status, lastActive: new Date() }
    )
  }

  /**
   * Update current session data
   */
  static async updateSession(
    uid: string,
    sessionData: Partial<MatchmakingSession>
  ): Promise<void> {
    await connectMongoDB()
    await MatchProfile.findOneAndUpdate(
      { uid },
      {
        currentSession: sessionData,
        lastActive: new Date(),
      }
    )
  }

  /**
   * Get profiles by role and status
   */
  static async getProfilesByRoleAndStatus(
    role: 'host' | 'guest',
    status: IMatchProfile['status'][]
  ): Promise<IMatchProfile[]> {
    await connectMongoDB()
    const profiles = await MatchProfile.find({
      role,
      status: { $in: status },
    }).sort({ lastActive: -1 })

    return profiles.map((profile: any) => profile.toObject())
  }

  /**
   * Update profile data (personality, interests, etc.)
   */
  static async updateProfileData(
    uid: string,
    profileData: Partial<IMatchProfile['profileData']>
  ): Promise<void> {
    await connectMongoDB()
    await MatchProfile.findOneAndUpdate(
      { uid },
      {
        $set: {
          ...Object.entries(profileData).reduce(
            (acc, [key, value]) => {
              acc[`profileData.${key}`] = value
              return acc
            },
            {} as Record<string, any>
          ),
          lastActive: new Date(),
        },
      }
    )
  }

  /**
   * Add to match history
   */
  static async addMatchHistory(
    uid: string,
    matchEntry: IMatchProfile['matchHistory'][0]
  ): Promise<void> {
    await connectMongoDB()
    await MatchProfile.findOneAndUpdate(
      { uid },
      {
        $push: { matchHistory: matchEntry },
        lastActive: new Date(),
      }
    )
  }

  /**
   * Update completion status
   */
  static async updateCompletionStatus(
    uid: string,
    completionData: Partial<IMatchProfile['completionStatus']>
  ): Promise<void> {
    await connectMongoDB()
    await MatchProfile.findOneAndUpdate(
      { uid },
      {
        completionStatus: {
          ...completionData,
          lastUpdated: new Date(),
        },
        lastActive: new Date(),
      }
    )
  }

  /**
   * Update embeddings
   */
  static async updateEmbeddings(
    uid: string,
    embeddings: Partial<IMatchProfile['embeddings']>
  ): Promise<void> {
    await connectMongoDB()
    await MatchProfile.findOneAndUpdate(
      { uid },
      {
        embeddings: {
          ...embeddings,
          lastUpdated: new Date(),
        },
        lastActive: new Date(),
      }
    )
  }

  /**
   * Find profiles for matching based on criteria
   */
  static async findMatchCandidates(
    excludeUid: string,
    role: 'host' | 'guest',
    limit: number = 10
  ): Promise<IMatchProfile[]> {
    await connectMongoDB()

    const profiles = await MatchProfile.find({
      uid: { $ne: excludeUid },
      role,
      status: { $in: ['ONLINE', 'HOSTING'] },
      'completionStatus.overall': { $gt: 0.5 }, // Only include reasonably complete profiles
    })
      .sort({
        'matchingMetrics.averageRating': -1,
        lastActive: -1,
      })
      .limit(limit)

    return profiles.map((profile: any) => profile.toObject())
  }

  /**
   * Clean up old offline profiles
   */
  static async cleanupOldProfiles(
    daysSinceLastActive: number = 30
  ): Promise<number> {
    await connectMongoDB()

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActive)

    const result = await MatchProfile.deleteMany({
      status: 'OFFLINE',
      lastActive: { $lt: cutoffDate },
      matchHistory: { $size: 0 }, // Only delete profiles with no match history
    })

    return result.deletedCount || 0
  }
}
