import { NextApiRequest, NextApiResponse } from 'next'
import { connectMongoDB } from '@/lib/mongodb'
import MatchProfile from '@/models/MatchProfile'
import { MatchProfile as IMatchProfile } from '@/types/matchmaking'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await connectMongoDB()

    switch (req.method) {
      case 'GET':
        return handleGet(req, res)
      case 'POST':
        return handlePost(req, res)
      case 'PUT':
        return handlePut(req, res)
      case 'DELETE':
        return handleDelete(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { uid, role, status } = req.query

  try {
    let query: any = {}

    if (uid) {
      query.uid = uid
    }

    if (role) {
      query.role = role
    }

    if (status) {
      query.status = status
    }

    // If specific uid is requested, return single profile
    if (uid && typeof uid === 'string') {
      const profile = await MatchProfile.findOne({ uid })
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' })
      }
      return res.status(200).json(profile)
    }

    // Otherwise return list of profiles
    const profiles = await MatchProfile.find(query)
      .sort({ lastActive: -1 })
      .limit(50)

    return res.status(200).json(profiles)
  } catch (error) {
    console.error('Get Error:', error)
    return res.status(500).json({ error: 'Failed to fetch profiles' })
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const profileData: Partial<IMatchProfile> = req.body

    // Validate required fields
    if (!profileData.uid || !profileData.role) {
      return res.status(400).json({ error: 'uid and role are required' })
    }

    // Check if profile already exists
    const existingProfile = await MatchProfile.findOne({ uid: profileData.uid })
    if (existingProfile) {
      return res.status(409).json({ error: 'Profile already exists' })
    }

    // Create new profile with defaults
    const newProfile = new MatchProfile({
      ...profileData,
      status: profileData.status || 'OFFLINE',
      lastActive: new Date(),
      currentSession: {
        status: 'idle',
        step: 0,
        missingFields: [],
        kokologyQuestions: [],
      },
      profileData: profileData.profileData || {
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

    const savedProfile = await newProfile.save()
    return res.status(201).json(savedProfile)
  } catch (error) {
    console.error('Post Error:', error)
    return res.status(500).json({ error: 'Failed to create profile' })
  }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { uid } = req.query
    const updateData = req.body

    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required' })
    }

    const updatedProfile = await MatchProfile.findOneAndUpdate(
      { uid },
      {
        ...updateData,
        lastActive: new Date(),
      },
      { new: true, runValidators: true }
    )

    if (!updatedProfile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    return res.status(200).json(updatedProfile)
  } catch (error) {
    console.error('Put Error:', error)
    return res.status(500).json({ error: 'Failed to update profile' })
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { uid } = req.query

    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required' })
    }

    const deletedProfile = await MatchProfile.findOneAndDelete({ uid })

    if (!deletedProfile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    return res.status(200).json({ message: 'Profile deleted successfully' })
  } catch (error) {
    console.error('Delete Error:', error)
    return res.status(500).json({ error: 'Failed to delete profile' })
  }
}
