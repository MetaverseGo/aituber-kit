// Mock implementation for deployment compatibility
// Since mongoose is not included in dependencies, providing a mock implementation
import type { MatchProfile as IMatchProfile } from '@/types/matchmaking'

// Mock implementation for deployment compatibility
const MatchProfileStatic = {
  findOne: (query: any) => Promise.resolve(null),
  find: (query: any) => ({
    limit: (n: number) => ({
      exec: () => Promise.resolve([]),
    }),
    exec: () => Promise.resolve([]),
  }),
  updateOne: (query: any, update: any) =>
    Promise.resolve({ acknowledged: true }),
  create: (data: any) => Promise.resolve(data),
}

// Constructor function to match mongoose model pattern
const MatchProfile = function (this: any, data: Partial<IMatchProfile>) {
  Object.assign(this, data)
  this.save = () => Promise.resolve(this)
  return this
} as any

// Assign static methods
Object.assign(MatchProfile, MatchProfileStatic)

export type MatchProfileDocument = IMatchProfile & {
  save: () => Promise<any>
}

export default MatchProfile
