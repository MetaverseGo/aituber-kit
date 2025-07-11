import { NextApiRequest, NextApiResponse } from 'next'
import { connectPlayfriendsMongoDB } from '@/lib/mongodb-playfriends'
import { createPlayfriendsUserModel } from '@/models/PlayfriendsUser'

// Error classes
class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

class InternalServerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InternalServerError'
  }
}

const errs = {
  BadRequestError,
  InternalServerError,
}

const searchUsers = async ({
  q,
  limit = 10,
}: {
  q: string
  limit?: number
}) => {
  if (!q) {
    throw new errs.BadRequestError('Search term (q) is required')
  }

  // Limit parsing
  const parsedLimit = parseInt(limit.toString(), 10)
  // Fetch slightly more initially if re-ranking significantly changes order,
  // but sticking to requested limit for now.
  const fetchLimit = parsedLimit

  try {
    const connection = await connectPlayfriendsMongoDB()
    const User = createPlayfriendsUserModel(connection)
    // Search stage using function score inside compound (relevance + EXP only)
    const searchStage = {
      $search: {
        index: 'pfusername_search',
        compound: {
          should: [
            {
              // Keep working autocomplete for username
              autocomplete: {
                query: q,
                path: 'username',
                tokenOrder: 'sequential',
              },
            },
            {
              // Keep UID search from Lambda logic
              text: {
                query: q,
                path: 'uid',
              },
            },
            {
              // Add text search for bio with fuzzy - higher boost for profile cards
              text: {
                query: q,
                path: 'bio',
                fuzzy: { maxEdits: 2, prefixLength: 3 },
                score: { boost: { value: 2.0 } }, // Boost bio matches for better profile cards
              },
            },
          ],
          minimumShouldMatch: 1,
          // Use function score inside compound (relevance + EXP only - profile completeness handled in JS)
          score: {
            function: {
              add: [
                { score: 'relevance' }, // Base relevance score
                {
                  // EXP contribution
                  log1p: {
                    path: {
                      value: 'missionProfile.accumulatedExp',
                      undefined: 0,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    }

    // Define the match stage to filter for complete profiles
    const profileMatchStage = {
      $match: {
        roles: 'h', // Must be a host
        bio: { $exists: true, $nin: [null, ''] }, // Must have bio content
        username: { $exists: true, $nin: [null, ''] }, // Must have username
      },
    }

    // Define the projection stage
    const projectStage = {
      $project: {
        _id: 1,
        uid: 1,
        username: 1,
        profilePic: 1,
        bio: 1,
        updatedAt: 1,
        score: { $meta: 'searchScore' },
        gender: 1,
        birthday: 1,
        'missionProfile.chatBadgeUrl': 1,
        'missionProfile.level': 1,
        'missionProfile.fontHexColor': 1,
        'missionProfile.accumulatedExp': 1, // Include for scoring verification
        'privileges.avatarFrame.mediaUrls': 1,
        // Add computed field for bio length (for debugging)
        bioLength: { $strLenCP: { $ifNull: ['$bio', ''] } },
      },
    }

    // Define the limit stage - fetch more initially for better selection
    const limitStage = { $limit: Math.min(fetchLimit * 2, 20) }

    // Construct the pipeline
    const pipeline = [searchStage, profileMatchStage, projectStage, limitStage]

    // console.log('[searchUsers] Attempting query...')
    // console.log('[searchUsers] Pipeline:', JSON.stringify(pipeline, null, 2))

    const results = await User.aggregate(pipeline) // Fetch results

    // console.log(
    //   '[searchUsers] Results from Mongoose aggregate (before JS sort):',
    //   JSON.stringify(results, null, 2)
    // )

    // --- Apply Enhanced Recency and Profile Quality Scoring in JavaScript ---
    const nowMs = Date.now()
    const recencyWeight = 3 // Reduced weight for recency
    const profileQualityWeight = 2 // New weight for profile quality
    const halfLifeDays = 7
    const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000

    const scoredResults = results.map((user: any) => {
      const updatedAtMs = user.updatedAt
        ? new Date(user.updatedAt).getTime()
        : 0
      const ageMs = Math.max(0, nowMs - updatedAtMs) // Avoid negative age

      // Exponential decay scoring: score = weight * (0.5 ^ (age / halfLife))
      const recencyScore = recencyWeight * Math.pow(0.5, ageMs / halfLifeMs)

      // Profile quality score (for profile cards)
      let profileQualityScore = 0
      if (user.profilePic) profileQualityScore += 1.0 // Has profile picture
      if (user.bio && user.bio.length > 50) profileQualityScore += 1.0 // Substantial bio
      if (user.bio && user.bio.length > 200) profileQualityScore += 0.5 // Very detailed bio
      if (user.gender) profileQualityScore += 0.5 // Has gender info
      if (user.birthday) profileQualityScore += 0.5 // Has birthday info
      profileQualityScore *= profileQualityWeight

      // Combine Atlas score with JS scoring
      const combinedScore =
        (user.score || 0) + recencyScore + profileQualityScore

      return {
        ...user, // Keep original user data
        // jsRecencyScore: recencyScore, // Can uncomment for debugging score components
        // profileQualityScore: profileQualityScore, // Can uncomment for debugging
        combinedScore: combinedScore,
      }
    })

    // Sort results by the new combined score in descending order
    scoredResults.sort((a: any, b: any) => b.combinedScore - a.combinedScore)

    // Take only the requested number of results after sorting
    const limitedResults = scoredResults.slice(0, fetchLimit)
    // --- End Enhanced Scoring ---

    // Clean up extra fields before returning
    const finalResults = limitedResults.map(
      ({ combinedScore, bioLength, ...rest }: any) => rest
    )

    // Return the re-sorted and cleaned results
    return finalResults
  } catch (error: any) {
    console.error('Error in searchUsers:', error)
    if (
      error.name === 'MongoNetworkError' ||
      error.message.includes('$search requires')
    ) {
      throw new errs.InternalServerError(
        'Search service is currently unavailable.'
      )
    }
    throw new errs.InternalServerError(
      'An error occurred during the user search'
    )
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q, limit = '10' } = req.query

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search term (q) is required' })
    }

    console.log('[playfriends-search] Searching for:', q)
    console.log('[playfriends-search] Limit:', limit)

    const results = await searchUsers({
      q,
      limit: parseInt(limit as string, 10),
    })

    console.log('[playfriends-search] Found', results.length, 'users')

    // Return results in the same format as the original Playfriends API
    res.status(200).json({
      d: results,
    })
  } catch (error) {
    console.error('Error in playfriends-search endpoint:', error)

    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message })
    }

    if (error instanceof InternalServerError) {
      return res.status(500).json({ error: error.message })
    }

    res.status(500).json({ error: 'Internal server error' })
  }
}
