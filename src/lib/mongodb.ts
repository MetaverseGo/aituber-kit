// Mock MongoDB connection for deployment compatibility
// Since mongoose is not included in dependencies, providing a mock implementation

import mongoose from 'mongoose'

interface Connection {
  isConnected?: number
}

const connection: Connection = {}

export async function connectMongoDB(): Promise<void> {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) {
    connection.isConnected = 1
    console.log('MongoDB already connected (readyState=1)')
    return
  }
  if (mongoose.connection.readyState === 2) {
    console.log('MongoDB connection is in progress (readyState=2)')
    return
  }
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      'mongodb://localhost:27017/aituber-kit'

    const db = await mongoose.connect(mongoUri, {
      bufferCommands: false,
    })

    connection.isConnected = db.connections[0].readyState
    console.log(
      'MongoDB connected successfully (readyState=' +
        db.connections[0].readyState +
        ')'
    )
  } catch (error) {
    console.error('MongoDB connection error:', error)
    throw error
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect()
    connection.isConnected = 0
    console.log('MongoDB disconnected')
  }
}
