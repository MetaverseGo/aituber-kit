import mongoose from 'mongoose'

interface PlayfriendsConnection {
  isConnected?: number
}

const playfriendsConnection: PlayfriendsConnection = {}

// Create a separate connection for Playfriends database
let playfriendsConnectionInstance: mongoose.Connection | null = null

export async function connectPlayfriendsMongoDB(): Promise<mongoose.Connection> {
  // Return existing connection if available
  if (
    playfriendsConnectionInstance &&
    playfriendsConnectionInstance.readyState === 1
  ) {
    console.log('Playfriends MongoDB already connected')
    return playfriendsConnectionInstance
  }

  try {
    const mongoUri = process.env.MONGODB_URI_PF!

    console.log('🔧 [MongoDB-PF] Connecting to Playfriends MongoDB...')
    console.log('🔧 [MongoDB-PF] Connection string length:', mongoUri.length)
    console.log(
      '🔧 [MongoDB-PF] Connection string prefix:',
      mongoUri.substring(0, 20)
    )

    // Create a new connection instance for Playfriends
    playfriendsConnectionInstance = mongoose.createConnection(mongoUri, {
      bufferCommands: false,
    })

    console.log(
      '🔧 [MongoDB-PF] Connection instance created, waiting for open event...'
    )

    // Wait for connection to be established
    await new Promise((resolve, reject) => {
      if (!playfriendsConnectionInstance) {
        console.error('🔧 [MongoDB-PF] Failed to create connection instance')
        reject(new Error('Failed to create connection'))
        return
      }

      playfriendsConnectionInstance.once('open', () => {
        console.log('🔧 [MongoDB-PF] Connection opened successfully')
        resolve(true)
      })

      playfriendsConnectionInstance.once('error', (error) => {
        console.error('🔧 [MongoDB-PF] Connection error event:', error)
        reject(error)
      })

      // Add timeout to avoid hanging
      setTimeout(() => {
        console.error('🔧 [MongoDB-PF] Connection timeout after 10 seconds')
        reject(new Error('Connection timeout'))
      }, 10000)
    })

    console.log('🔧 [MongoDB-PF] Playfriends MongoDB connected successfully')
    return playfriendsConnectionInstance
  } catch (error) {
    console.error('🔧 [MongoDB-PF] ❌ Connection failed:', error)
    console.error(
      '🔧 [MongoDB-PF] Error type:',
      (error as Error).constructor.name
    )
    console.error('🔧 [MongoDB-PF] Error message:', (error as Error).message)

    // Clean up failed connection instance
    if (playfriendsConnectionInstance) {
      try {
        playfriendsConnectionInstance.close()
      } catch (closeError) {
        console.error(
          '🔧 [MongoDB-PF] Error closing failed connection:',
          closeError
        )
      }
      playfriendsConnectionInstance = null
    }

    throw error
  }
}

export async function disconnectPlayfriendsMongoDB(): Promise<void> {
  if (
    playfriendsConnectionInstance &&
    playfriendsConnectionInstance.readyState === 1
  ) {
    await playfriendsConnectionInstance.close()
    playfriendsConnectionInstance = null
    console.log('Playfriends MongoDB disconnected')
  }
}

export function getPlayfriendsConnection(): mongoose.Connection | null {
  return playfriendsConnectionInstance
}
