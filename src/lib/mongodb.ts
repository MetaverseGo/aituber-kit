// Mock MongoDB connection for deployment compatibility
// Since mongoose is not included in dependencies, providing a mock implementation

export async function connectMongoDB(): Promise<void> {
  // Mock connection - does nothing but satisfies the import
  console.log('Mock MongoDB connection - no actual database connection')
  return Promise.resolve()
}
