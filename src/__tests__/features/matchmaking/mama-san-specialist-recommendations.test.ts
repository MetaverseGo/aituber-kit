import { MamaSanSpecialist } from '@/features/matchmaking/mama-san-specialist'
import { MamaSanSessionState } from '@/types/matchmaking'

// Mock MongoDB connection and MatchProfile model
jest.mock('@/lib/mongodb', () => ({
  connectMongoDB: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/models/MatchProfile', () => ({
  __esModule: true,
  default: {
    find: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue([
        // Mock host profiles for testing
        {
          uid: 'kaito-123',
          role: 'host',
          status: 'ONLINE',
          datingProfile: {
            servicePreferences: {
              primaryServices: ['gaming'],
              mood: 'energetic',
              interactionStyle: 'playful',
              conversationTopics: ['gaming', 'anime'],
            },
            platformMetrics: {
              gamingSkill: 9,
              personalityRating: 8,
              entertainmentValue: 8,
            },
          },
          profileData: {
            interests: [{ category: 'gaming' }, { category: 'anime' }],
            personality: {
              traits: [{ name: 'confident' }, { name: 'funny' }],
            },
          },
        },
        {
          uid: 'ryu-456',
          role: 'host',
          status: 'ONLINE',
          datingProfile: {
            servicePreferences: {
              primaryServices: ['conversation'],
              mood: 'calm',
              interactionStyle: 'deep',
              conversationTopics: ['art', 'philosophy'],
            },
            platformMetrics: {
              gamingSkill: 5,
              personalityRating: 9,
              entertainmentValue: 7,
            },
          },
          profileData: {
            interests: [{ category: 'conversation' }, { category: 'art' }],
            personality: {
              traits: [{ name: 'gentle' }, { name: 'understanding' }],
            },
          },
        },
        {
          uid: 'hana-789',
          role: 'host',
          status: 'ONLINE',
          datingProfile: {
            servicePreferences: {
              primaryServices: ['entertainment'],
              mood: 'cheerful',
              interactionStyle: 'playful',
              conversationTopics: ['music', 'karaoke'],
            },
            platformMetrics: {
              gamingSkill: 6,
              personalityRating: 8,
              entertainmentValue: 9,
            },
          },
          profileData: {
            interests: [{ category: 'music' }, { category: 'entertainment' }],
            personality: {
              traits: [{ name: 'funny' }, { name: 'gentle' }],
            },
          },
        },
      ]),
    }),
  },
}))

describe('MamaSanSpecialist - Dynamic Recommendations', () => {
  let specialist: MamaSanSpecialist

  beforeEach(() => {
    specialist = new MamaSanSpecialist({
      personality: 'emi',
      questionCount: 4,
      userId: 'test-user',
      useDatabase: false, // Explicitly use mock data for tests
    })
  })

  describe('Dynamic Recommendations', () => {
    it('should return different recommendations for gaming preferences', async () => {
      const mamaSan = new MamaSanSpecialist({ useDatabase: false })
      const state: MamaSanSessionState = {
        currentQuestion: 0,
        isComplete: false,
        answers: ['I love competitive gaming', 'I play FPS games'],
      }

      const recommendations = await mamaSan.getRecommendations(state)

      expect(recommendations).toHaveLength(3)

      // Should prioritize Eris (gaming-focused host)
      const hostTitles = recommendations.map((r) => r.title)
      expect(hostTitles).toContain('Eris')

      // Should have correct image paths
      const images = recommendations.map((r) => r.data?.image)
      expect(images.every((img) => img.includes('/images/mockdata/'))).toBe(
        true
      )
      expect(images.every((img) => img.endsWith('.png'))).toBe(true)

      // Check for gaming-related tags
      const allTags = recommendations.flatMap((r) => r.data?.tags || [])
      expect(
        allTags.some(
          (tag) =>
            tag.toLowerCase().includes('gaming') ||
            tag.toLowerCase().includes('confident')
        )
      ).toBe(true)
    })

    it('should return different recommendations for conversation preferences', async () => {
      const mamaSan = new MamaSanSpecialist({ useDatabase: false })
      const state: MamaSanSessionState = {
        currentQuestion: 0,
        isComplete: false,
        answers: ['I enjoy deep conversations', 'Philosophy interests me'],
      }

      const recommendations = await mamaSan.getRecommendations(state)

      expect(recommendations).toHaveLength(3)

      // Should prioritize Sab (conversation/mystery-focused host)
      const hostTitles = recommendations.map((r) => r.title)
      expect(hostTitles).toContain('Sab')

      // Should have correct image paths
      const images = recommendations.map((r) => r.data?.image)
      expect(images.every((img) => img.includes('/images/mockdata/'))).toBe(
        true
      )

      // Check for conversation-related tags
      const allTags = recommendations.flatMap((r) => r.data?.tags || [])
      expect(
        allTags.some(
          (tag) =>
            tag.toLowerCase().includes('understanding') ||
            tag.toLowerCase().includes('conversation')
        )
      ).toBe(true)
    })

    it('should return different recommendations for entertainment preferences', async () => {
      const mamaSan = new MamaSanSpecialist({ useDatabase: false })
      const state: MamaSanSessionState = {
        currentQuestion: 0,
        isComplete: false,
        answers: ['I love music and karaoke', 'Entertainment is important'],
      }

      const recommendations = await mamaSan.getRecommendations(state)

      expect(recommendations).toHaveLength(3)

      // Should prioritize Kiwi (entertainment/karaoke-focused host)
      const hostTitles = recommendations.map((r) => r.title)
      expect(hostTitles).toContain('Kiwi')

      // Should have correct image paths
      const images = recommendations.map((r) => r.data?.image)
      expect(images.every((img) => img.includes('/images/mockdata/'))).toBe(
        true
      )

      // Check for entertainment-related tags
      const allTags = recommendations.flatMap((r) => r.data?.tags || [])
      expect(
        allTags.some(
          (tag) =>
            tag.toLowerCase().includes('music') ||
            tag.toLowerCase().includes('funny')
        )
      ).toBe(true)
    })

    it('should return different recommendations for art/culture preferences', async () => {
      const mamaSan = new MamaSanSpecialist({ useDatabase: false })
      const state: MamaSanSessionState = {
        currentQuestion: 0,
        isComplete: false,
        answers: [
          'I appreciate art and culture',
          'Fashion and travel interest me',
        ],
      }

      const recommendations = await mamaSan.getRecommendations(state)

      expect(recommendations).toHaveLength(3)

      // Should prioritize Seira (art/culture-focused host)
      const hostTitles = recommendations.map((r) => r.title)
      expect(hostTitles).toContain('Seira')

      // Check for art/culture-related tags
      const allTags = recommendations.flatMap((r) => r.data?.tags || [])
      expect(
        allTags.some(
          (tag) =>
            tag.toLowerCase().includes('art') ||
            tag.toLowerCase().includes('elegant')
        )
      ).toBe(true)
    })

    it('should return different recommendations for adventure/sports preferences', async () => {
      const mamaSan = new MamaSanSpecialist({ useDatabase: false })
      const state: MamaSanSessionState = {
        currentQuestion: 0,
        isComplete: false,
        answers: [
          'I love adventure and sports',
          'Fitness and travel are my passions',
        ],
      }

      const recommendations = await mamaSan.getRecommendations(state)

      expect(recommendations).toHaveLength(3)

      // Should prioritize Tang (adventure/sports-focused host)
      const hostTitles = recommendations.map((r) => r.title)
      expect(hostTitles).toContain('Tang')

      // Check for adventure/sports-related tags
      const allTags = recommendations.flatMap((r) => r.data?.tags || [])
      expect(
        allTags.some(
          (tag) =>
            tag.toLowerCase().includes('adventure') ||
            tag.toLowerCase().includes('bold') ||
            tag.toLowerCase().includes('sports')
        )
      ).toBe(true)
    })

    it('should show all 5 hosts across different preferences', async () => {
      const mamaSan = new MamaSanSpecialist({ useDatabase: false })

      const testCases = [
        ['gaming', 'competitive'],
        ['conversation', 'philosophy'],
        ['music', 'entertainment'],
        ['art', 'culture'],
        ['sports', 'adventure'],
      ]

      const allHostNames = new Set<string>()

      for (const preferences of testCases) {
        const state: MamaSanSessionState = {
          currentQuestion: 0,
          isComplete: false,
          answers: preferences,
        }

        const recommendations = await mamaSan.getRecommendations(state)
        recommendations.forEach((rec) => allHostNames.add(rec.title))
      }

      // Should have seen all 5 hosts
      expect(allHostNames.size).toBe(5)
      expect([...allHostNames].sort()).toEqual([
        'Eris',
        'Kiwi',
        'Sab',
        'Seira',
        'Tang',
      ])
    })
  })
})
