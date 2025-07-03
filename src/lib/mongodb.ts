// Mock MongoDB connection for deployment compatibility
// Since mongoose is not included in dependencies, providing a mock implementation

import mongoose from 'mongoose'

interface Connection {
  isConnected?: number
}

const connection: Connection = {}

export async function connectMongoDB(): Promise<void> {
  if (connection.isConnected) {
    console.log('MongoDB already connected')
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
    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    throw error
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (connection.isConnected) {
    await mongoose.disconnect()
    connection.isConnected = 0
    console.log('MongoDB disconnected')
  }
}
