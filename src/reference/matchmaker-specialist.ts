import MatchProfile from '@/models/MatchProfile'
import type { MatchProfile as IMatchProfile } from '@/types/matchmaking'
import { connectMongoDB } from '@/lib/mongodb'
import { PersonalityCategory } from '@/types/matchmaking'

// Firebase-compatible interface with only minimal UI data
export interface MatchRecommendation {
  // Only minimal data needed for UI rendering
  profileId: string
  role: 'host' | 'guest'
  personalityCategory?: string
  personalityImageUrl?: string
  compatibility: number
  reasons: string[]
  connectionTips: string[]
}

export interface MatchmakerResult {
  message: string
  recommendations?: MatchRecommendation[]
  isComplete?: boolean
  step: string
  data?: {
    showProfileCarousel?: boolean
    selectedProfileId?: string
    chatMode?: 'emi' | 'personal_ai'
    stepProgress?: {
      current: number
      total: number
      label: string
      phase: 'matchmaking' | 'chatting'
    }
  }
}

// Helper function to get full profile data from MongoDB when needed
export async function getFullProfileData(
  profileId: string
): Promise<IMatchProfile | null> {
  try {
    await connectMongoDB()
    const profile = await MatchProfile.findOne({ uid: profileId }).exec()
    return profile
  } catch (error) {
    console.error('Error fetching full profile data:', error)
    return null
  }
}

export class MatchmakerSpecialist {
  private personality: 'emi' = 'emi'

  constructor() {
    this.personality = 'emi'
  }

  async processMatchmakingMessage(
    userId: string,
    message: string,
    sessionId: string,
    currentUserProfile: IMatchProfile
  ): Promise<MatchmakerResult> {
    await connectMongoDB()

    try {
      // Handle different matchmaking conversation flows
      const lowerMessage = message.toLowerCase().trim()

      if (
        lowerMessage.includes('start matching') ||
        lowerMessage.includes('find matches') ||
        lowerMessage.includes('show me people') ||
        lowerMessage.includes('show me my matches') ||
        lowerMessage.includes('show matches') ||
        lowerMessage.includes('my matches')
      ) {
        return await this.showInitialMatches(currentUserProfile)
      }

      if (
        lowerMessage.includes('more matches') ||
        lowerMessage.includes('see more') ||
        lowerMessage.includes('other people')
      ) {
        return await this.showMoreMatches(currentUserProfile)
      }

      if (
        lowerMessage.includes('chat with') ||
        lowerMessage.includes('talk to')
      ) {
        // Handle profile selection for chat
        return await this.handleProfileSelection(message, currentUserProfile)
      }

      // Default: Welcome to matchmaking
      return await this.welcomeToMatchmaking(currentUserProfile)
    } catch (error) {
      console.error('Matchmaker error:', error)
      return {
        message:
          'Oops! I had a little hiccup finding your matches 🌸 Let me try that again!',
        step: 'matchmaker_error',
        isComplete: false,
      }
    }
  }

  private async welcomeToMatchmaking(
    userProfile: IMatchProfile
  ): Promise<MatchmakerResult> {
    const personalityCategory = userProfile.currentSession.personalityCategory

    const welcomeMessages = [
      `Yay! Now that I know you're a **${personalityCategory}**, let's find you some amazing matches! 💕`,
      `Perfect! Your **${personalityCategory}** personality is going to attract some incredible people! ✨`,
      `Exciting! I can already think of some perfect matches for a **${personalityCategory}** like you! 🌸`,
      `Omg this is the fun part! Let me show you some cuties who would vibe perfectly with your **${personalityCategory}** energy! 💫`,
    ]

    const randomWelcome =
      welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]

    // Get initial matches
    const recommendations = await this.findMatches(userProfile, 3)

    return {
      message: `${randomWelcome}\n\nI've found some amazing people who would love to connect with you! Check them out below and tap "Chat" on anyone who catches your eye~ 👇`,
      recommendations,
      step: 'showing_matches',
      isComplete: false,
      data: {
        showProfileCarousel: true,
        stepProgress: {
          current: 1,
          total: 3,
          label: 'Finding your matches...',
          phase: 'matchmaking',
        },
      },
    }
  }

  private async showInitialMatches(
    userProfile: IMatchProfile
  ): Promise<MatchmakerResult> {
    const recommendations = await this.findMatches(userProfile, 4)

    const encouragingMessages = [
      "Here are some incredible people I think you'd vibe with! 💕",
      'These cuties caught my eye for you~ Take a look! ✨',
      "Ooh I'm excited about these matches! Which one speaks to you? 🌸",
      'Found some gems! Anyone giving you butterflies? 💫',
    ]

    const randomMessage =
      encouragingMessages[
        Math.floor(Math.random() * encouragingMessages.length)
      ]

    return {
      message: randomMessage,
      recommendations,
      step: 'showing_initial_matches',
      isComplete: false,
      data: {
        showProfileCarousel: true,
        stepProgress: {
          current: 2,
          total: 3,
          label: 'Curating your matches...',
          phase: 'matchmaking',
        },
      },
    }
  }

  private async showMoreMatches(
    userProfile: IMatchProfile
  ): Promise<MatchmakerResult> {
    const recommendations = await this.findMatches(userProfile, 4, {
      excludePrevious: true,
    })

    const moreMatchesMessages = [
      'More amazing people for you to discover! 💖',
      "I've got even more cuties to show you! ✨",
      'Fresh faces incoming! These ones are special too~ 🌸',
      "More matches, more possibilities! Who's catching your eye? 💫",
    ]

    const randomMessage =
      moreMatchesMessages[
        Math.floor(Math.random() * moreMatchesMessages.length)
      ]

    return {
      message: randomMessage,
      recommendations,
      step: 'showing_more_matches',
      isComplete: false,
      data: {
        showProfileCarousel: true,
      },
    }
  }

  private async handleProfileSelection(
    message: string,
    userProfile: IMatchProfile
  ): Promise<MatchmakerResult> {
    // Extract profile ID from message (this would be sent when user clicks chat button)
    // For now, return a transition message
    return {
      message:
        "Amazing choice! Let me connect you with their personal AI~ They're going to love chatting with you! 💕",
      step: 'switching_to_personal_chat',
      isComplete: false,
      data: {
        chatMode: 'personal_ai',
        stepProgress: {
          current: 3,
          total: 3,
          label: 'Connecting you...',
          phase: 'chatting',
        },
      },
    }
  }

  private async findMatches(
    userProfile: IMatchProfile,
    limit: number = 3,
    options: { excludePrevious?: boolean } = {}
  ): Promise<MatchRecommendation[]> {
    try {
      // Find potential matches based on:
      // 1. Opposite role (hosts if user is guest, guests if user is host)
      // 2. Completed personality analysis
      // 3. Compatible personality types

      const oppositeRole = userProfile.role === 'host' ? 'guest' : 'host'

      const matchQuery: any = {
        role: oppositeRole,
        'currentSession.status': 'completed',
        'currentSession.personalityCategory': { $exists: true },
        uid: { $ne: userProfile.uid }, // Exclude self
      }

      const potentialMatches = await MatchProfile.find(matchQuery)
        .limit(limit * 2) // Get more than needed for filtering
        .exec()

      // Calculate compatibility and create recommendations
      const recommendations: MatchRecommendation[] = []

      for (const match of potentialMatches) {
        if (recommendations.length >= limit) break

        const compatibility = this.calculateCompatibility(userProfile, match)
        const reasons = this.generateCompatibilityReasons(userProfile, match)
        const connectionTips = this.generateConnectionTips(userProfile, match)

        // Generate personality image URL based on category and role
        const personalityImageUrl = this.getPersonalityImageUrl(
          match.currentSession.personalityCategory,
          match.currentSession.gender
        )

        recommendations.push({
          profileId: match.uid,
          role: match.role,
          personalityCategory: match.currentSession.personalityCategory,
          personalityImageUrl,
          compatibility,
          reasons,
          connectionTips,
        })
      }

      // Sort by compatibility
      recommendations.sort((a, b) => b.compatibility - a.compatibility)

      return recommendations.slice(0, limit)
    } catch (error) {
      console.error('Error finding matches:', error)
      return []
    }
  }

  private calculateCompatibility(
    user: IMatchProfile,
    potential: IMatchProfile
  ): number {
    // Basic compatibility algorithm based on personality types
    // This can be enhanced with more sophisticated matching logic

    let compatibility = 50 // Base compatibility

    // Personality compatibility bonus
    if (
      user.currentSession.personalityCategory ===
      potential.currentSession.personalityCategory
    ) {
      compatibility += 20 // Same personality type
    } else {
      compatibility += 15 // Different but compatible
    }

    // Role compatibility (always opposite roles)
    compatibility += 25

    // Random factor for variety
    compatibility += Math.random() * 10

    return Math.min(Math.round(compatibility), 100)
  }

  private generateCompatibilityReasons(
    user: IMatchProfile,
    potential: IMatchProfile
  ): string[] {
    const reasons = []

    const userPersonality = user.currentSession.personalityCategory
    const potentialPersonality = potential.currentSession.personalityCategory

    if (userPersonality === potentialPersonality) {
      reasons.push(`You're both ${userPersonality}s - instant understanding!`)
    } else {
      reasons.push(
        `Your ${userPersonality} energy would balance their ${potentialPersonality} vibe perfectly`
      )
    }

    reasons.push(
      `Perfect role match - you complement each other's dating style`
    )

    const bonusReasons = [
      'Great conversation potential based on your personalities',
      'Similar relationship goals and communication style',
      "You'd challenge each other in the best ways",
      'Natural chemistry based on your personality types',
    ]

    reasons.push(bonusReasons[Math.floor(Math.random() * bonusReasons.length)])

    return reasons
  }

  private generateConnectionTips(
    user: IMatchProfile,
    potential: IMatchProfile
  ): string[] {
    const tips = []

    const userPersonality = user.currentSession.personalityCategory
    const potentialPersonality = potential.currentSession.personalityCategory

    // Personality-specific tips
    if (userPersonality && potentialPersonality) {
      tips.push(
        `As a ${userPersonality}, try opening with something thoughtful - ${potentialPersonality}s love that!`
      )
    }

    const genericTips = [
      'Start with a genuine compliment about their profile',
      'Ask about their favorite hobby or interest',
      'Share something fun about your day',
      'Be yourself - authenticity is magnetic!',
    ]

    tips.push(genericTips[Math.floor(Math.random() * genericTips.length)])

    return tips
  }

  // Helper method to generate personality image URL
  private getPersonalityImageUrl(
    categoryName?: string,
    gender?: 'female' | 'male'
  ): string {
    if (!categoryName) {
      return '/images/personalities/default-girl.webp'
    }

    // Default to female if no gender specified, then map to file naming
    const backendGender = gender || 'female'
    const fileGender = backendGender === 'male' ? 'boy' : 'girl'

    // Convert category name to lowercase and kebab-case for file naming
    const fileName = categoryName.toLowerCase().replace(/\s+/g, '-')
    return `/images/personalities/${fileName}-${fileGender}.webp`
  }
}
