export interface PlayfriendsUser {
  _id: string
  uid: string
  username: string
  updatedAt: string
  profilePic?: string
  bio?: string
  birthday?: string | null
  gender: 'male' | 'female' | 'other'
  missionProfile: {
    chatBadgeUrl: string
    level: number
    fontHexColor: string
  }
  privileges?: {
    avatarFrame?: {
      mediaUrls: {
        mobile: string
        web: string
      }
    }
  }
  score: number
}

export interface PlayfriendsSearchResponse {
  d: PlayfriendsUser[]
}

export interface ProfileCardData {
  id: string
  name: string
  message: string
  description: string
  interests: string[]
  personality: string[]
  profileImage?: string
}

export class PlayfriendsClient {
  private readonly baseUrl = '/api/playfriends-search'

  async search(query: string): Promise<PlayfriendsUser[]> {
    console.log('🔥 [PlayfriendsClient] Starting search for:', query)
    console.log(
      '🔥 [PlayfriendsClient] Request URL:',
      `${this.baseUrl}?q=${encodeURIComponent(query)}`
    )

    try {
      const response = await fetch(
        `${this.baseUrl}?q=${encodeURIComponent(query)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )

      console.log('🔥 [PlayfriendsClient] Response status:', response.status)
      console.log('🔥 [PlayfriendsClient] Response ok:', response.ok)
      console.log(
        '🔥 [PlayfriendsClient] Response headers:',
        Object.fromEntries(response.headers.entries())
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('🔥 [PlayfriendsClient] Error response text:', errorText)
        throw new Error(
          `Playfriends API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data: PlayfriendsSearchResponse = await response.json()
      console.log('🔥 [PlayfriendsClient] Response data:', data)
      console.log('🔥 [PlayfriendsClient] Users returned:', data.d?.length || 0)

      return data.d || []
    } catch (error) {
      console.error(
        '🔥 [PlayfriendsClient] Error fetching from Playfriends API:',
        error
      )
      console.error(
        '🔥 [PlayfriendsClient] Error type:',
        (error as Error).constructor.name
      )
      console.error(
        '🔥 [PlayfriendsClient] Error message:',
        (error as Error).message
      )
      if (error instanceof TypeError) {
        console.error(
          '🔥 [PlayfriendsClient] This might be a CORS or network error'
        )
      }
      throw error
    }
  }

  transformToProfileCard(
    user: PlayfriendsUser,
    actionId: string
  ): ProfileCardData {
    // Generate personalized greeting based on bio and action context
    const greeting = this.generateGreeting(user, actionId)

    // Extract interests from bio or derive from action context
    const interests = this.extractInterests(user.bio || '', actionId)

    // Generate personality traits from bio, gender, and level
    const personality = this.generatePersonality(user)

    // Clean and truncate bio for description
    const description = this.cleanBio(user.bio || '')

    return {
      id: user._id,
      name: user.username,
      message: greeting,
      description: description,
      interests: interests,
      personality: personality,
      profileImage: user.profilePic,
    }
  }

  private generateGreeting(user: PlayfriendsUser, actionId: string): string {
    const name = user.username
    const bio = user.bio || ''

    // Context-aware greetings based on actionId
    const greetingTemplates = {
      'cute-anime': [
        `Hi! I'm ${name}! 🌸 I love anime and cute things! Want to chat about our favorite series? ✨`,
        `Hey there! ${name} here! (◕‿◕) I'm always up for talking about anime and kawaii culture! 💕`,
        `Hiya! I'm ${name}! ✨ Fellow anime lover? Let's geek out together! 🌟`,
      ],
      'gaming-creators': [
        `Hey! I'm ${name}! 🎮 Gaming creator here - let's talk about games and content! 🚀`,
        `Hi there! ${name} at your service! 🎯 Always down to chat about gaming and streaming! ⚡`,
        `What's up! I'm ${name}! 🕹️ Gaming is life - want to share some epic moments? 🔥`,
      ],
      'vtuber-recs': [
        `Hello! I'm ${name}! 🎭 VTuber here - want some amazing creator recommendations? ✨`,
        `Hey! ${name} speaking! 🌟 I know tons of amazing VTubers - what's your vibe? 🎪`,
        `Hi there! I'm ${name}! 🎬 VTuber world is amazing - let me share some gems! 💎`,
      ],
      'kawaii-content': [
        `Kawaii! I'm ${name}! ♡(^_^) Everything cute makes life better! 🌸`,
        `Hi! ${name} here! (^_^) ♡ Let's share all things kawaii together! 🎀`,
        `Hello! I'm ${name}! ✨ Kawaii culture enthusiast - want to kawaii-fy your day? 💕`,
      ],
    }

    const templates =
      greetingTemplates[actionId as keyof typeof greetingTemplates] ||
      greetingTemplates['cute-anime']
    const template = templates[Math.floor(Math.random() * templates.length)]

    // If bio contains VTuber/streaming keywords, add relevant context
    if (
      bio.toLowerCase().includes('vtuber') ||
      bio.toLowerCase().includes('stream')
    ) {
      return template.replace('!', ' and I stream too! 🎭')
    }

    return template
  }

  private extractInterests(bio: string, actionId: string): string[] {
    const interests: string[] = []
    const bioLower = bio.toLowerCase()

    // Base interests from actionId
    const baseInterests = {
      'cute-anime': ['anime', 'kawaii'],
      'gaming-creators': ['gaming', 'streaming'],
      'vtuber-recs': ['vtubers', 'streaming'],
      'kawaii-content': ['kawaii', 'cute-culture'],
    }

    interests.push(
      ...(baseInterests[actionId as keyof typeof baseInterests] || ['anime'])
    )

    // Extract additional interests from bio
    const interestMap = {
      art: ['art', 'drawing', 'illustration', 'design'],
      music: ['music', 'singing', 'kpop', 'jpop'],
      gaming: ['game', 'gaming', 'gamer', 'esports'],
      cosplay: ['cosplay', 'costume'],
      anime: ['anime', 'manga', 'otaku'],
      streaming: ['stream', 'content', 'youtube', 'twitch'],
      fashion: ['fashion', 'style', 'outfit'],
      creative: ['creative', 'creator', 'artist'],
    }

    Object.entries(interestMap).forEach(([interest, keywords]) => {
      if (
        keywords.some((keyword) => bioLower.includes(keyword)) &&
        !interests.includes(interest)
      ) {
        interests.push(interest)
      }
    })

    return interests.slice(0, 5) // Limit to 5 interests
  }

  private generatePersonality(user: PlayfriendsUser): string[] {
    const personality: string[] = []
    const bio = user.bio?.toLowerCase() || ''
    const level = user.missionProfile.level

    // Base personality from gender
    if (user.gender === 'female') {
      personality.push('friendly')
    } else if (user.gender === 'male') {
      personality.push('confident')
    }

    // Personality from level (experience indicator)
    if (level >= 20) {
      personality.push('experienced', 'knowledgeable')
    } else if (level >= 10) {
      personality.push('enthusiastic', 'active')
    } else {
      personality.push('newcomer', 'eager')
    }

    // Personality from bio keywords
    const personalityMap = {
      creative: ['art', 'create', 'design', 'illustration'],
      energetic: ['energy', 'excited', 'love', '!'],
      sweet: ['cute', 'sweet', 'kawaii', '💕', '🌸'],
      funny: ['funny', 'lol', 'joke', 'humor'],
      mysterious: ['mystery', 'dark', 'shadow'],
      passionate: ['passion', 'love', 'obsess', 'adore'],
      chill: ['chill', 'relax', 'calm', 'cozy'],
      competitive: ['compete', 'win', 'champion', 'rank'],
    }

    Object.entries(personalityMap).forEach(([trait, keywords]) => {
      if (
        keywords.some((keyword) => bio.includes(keyword)) &&
        !personality.includes(trait)
      ) {
        personality.push(trait)
      }
    })

    return personality.slice(0, 4) // Limit to 4 personality traits
  }

  private cleanBio(bio: string): string {
    // Remove URLs and clean up bio for description
    let cleaned = bio.replace(/https?:\/\/[^\s]+/g, '')
    // Remove excessive emojis and special characters
    cleaned = cleaned.replace(/[^\w\s.,!?'"()\-]/g, ' ')
    // Clean up whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    // Truncate if too long
    if (cleaned.length > 120) {
      cleaned = cleaned.substring(0, 117) + '...'
    }
    return cleaned || 'A friendly creator ready to chat!'
  }
}

// Export singleton instance
export const playfriendsClient = new PlayfriendsClient()
