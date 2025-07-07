import type { NextApiRequest, NextApiResponse } from 'next'
import MatchProfile from '@/models/MatchProfile'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { connectMongoDB } from '@/lib/mongodb'
import { MatchProfile as IMatchProfile } from '@/types/matchmaking'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await connectMongoDB()

  console.log('[MatchProfile API] Incoming request:', {
    method: req.method,
    query: req.query,
    body: req.body ? Object.keys(req.body) : undefined,
  })

  if (req.method === 'GET') {
    // Handle GET request with query parameters (legacy support)
    const { action, uid } = req.query

    if (action === 'getProfile' && uid) {
      try {
        console.log('[MatchProfile API] GET - Fetching profile for UID:', uid)
        const profile = await MatchProfile.findOne({ uid })

        if (profile) {
          console.log('[MatchProfile API] GET - Profile found')
          return res.status(200).json({
            success: true,
            profile: profile.toObject(),
          })
        } else {
          console.log('[MatchProfile API] GET - Profile not found')
          return res.status(200).json({
            success: false,
            message: 'Profile not found',
          })
        }
      } catch (error) {
        console.error('[MatchProfile API] GET - Error:', error)
        return res.status(500).json({
          success: false,
          error: 'Internal server error',
        })
      }
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action or missing uid',
    })
  }

  if (req.method === 'POST') {
    // Handle POST request with Firebase authentication
    const { action, token, uid, data } = req.body

    if (!token) {
      console.log('[MatchProfile API] POST - Missing token')
      return res.status(401).json({
        success: false,
        error: 'Authentication token required',
      })
    }

    try {
      // Verify Firebase token
      console.log('[MatchProfile API] POST - Verifying Firebase token...')
      const admin = getFirebaseAdmin()
      const decoded = await admin.auth().verifyIdToken(token)
      const authenticatedUid = decoded.uid

      console.log(
        '[MatchProfile API] POST - Token verified for UID:',
        authenticatedUid
      )

      if (action === 'getProfile') {
        // Get profile for authenticated user
        const profile = await MatchProfile.findOne({ uid: authenticatedUid })

        if (profile) {
          console.log(
            '[MatchProfile API] POST - Profile found for authenticated user'
          )
          return res.status(200).json({
            success: true,
            profile: profile.toObject(),
          })
        } else {
          console.log(
            '[MatchProfile API] POST - Profile not found for authenticated user'
          )
          return res.status(200).json({
            success: false,
            message: 'Profile not found',
          })
        }
      }

      if (action === 'updateProfile') {
        // Update profile for authenticated user
        if (!data || !data.profileUpdates) {
          return res.status(400).json({
            success: false,
            error: 'Missing profile update data',
          })
        }

        console.log(
          '[MatchProfile API] POST - Updating profile for UID:',
          authenticatedUid
        )
        console.log(
          '[MatchProfile API] POST - Update data:',
          data.profileUpdates
        )

        const result = await MatchProfile.findOneAndUpdate(
          { uid: authenticatedUid },
          { $set: data.profileUpdates },
          {
            new: true,
            upsert: true,
            runValidators: true,
          }
        )

        console.log('[MatchProfile API] POST - Profile updated successfully')
        return res.status(200).json({
          success: true,
          profile: result.toObject(),
        })
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid action',
      })
    } catch (verifyError) {
      console.error(
        '[MatchProfile API] POST - Token verification failed:',
        verifyError
      )
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      })
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed',
  })
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
    const { action, uid, data } = req.body

    if (!uid) {
      return res.status(400).json({ error: 'UID is required' })
    }

    await connectMongoDB()

    if (action === 'saveValidationErrors') {
      // Save validation errors to profile
      const { validationErrors } = data

      const result = await MatchProfile.findOneAndUpdate(
        { uid },
        {
          $push: {
            validationErrors: { $each: validationErrors },
          },
        },
        { upsert: true, new: true }
      )

      console.log('✅ Validation errors saved to profile:', uid)
      return res.status(200).json({ success: true, profile: result })
    } else if (action === 'updateProfile') {
      // Update profile with analysis data
      const { profileUpdates } = data

      const result = await MatchProfile.findOneAndUpdate(
        { uid },
        { $set: profileUpdates },
        { upsert: true, new: true }
      )

      console.log('✅ Profile updated with analysis data:', uid)
      return res.status(200).json({ success: true, profile: result })
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('Error updating match profile:', error)
    return res.status(500).json({ error: 'Failed to update profile' })
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
