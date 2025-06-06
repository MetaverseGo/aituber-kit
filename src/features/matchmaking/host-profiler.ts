import { callAI } from '@/lib/ai-client'
import { PERSONALITY_CATEGORIES } from './personality-profiler'
import { PersonalityCategory } from '@/types/matchmaking'

export type HostIntroduction = {
  introduction: string
}

export interface HostProfilerConfig {
  personality: 'emi' | 'analytical' | 'friendly'
  maxWords: number
}

export interface PlayFriendsProfile {
  uid: string
  username: string
  bio?: string
  gender?: string
  profilePic?: string
  missionProfile?: {
    level?: number
  }
}

export class HostProfiler {
  private config: HostProfilerConfig
  private systemPrompt: string
  private cache: Map<string, HostIntroduction> = new Map()

  constructor(config: HostProfilerConfig = { personality: 'emi', maxWords: 70 }) {
    this.config = config
    this.systemPrompt = this.buildSystemPrompt()
  }

  private buildSystemPrompt(): string {
    return `You are Emi, an AI assistant with a friendly, enthusiastic personality. Your job is to introduce PlayFriends hosts to users in a natural, conversational way.

**Your Personality:**
- Friendly and approachable
- Genuinely excited about good matches
- Insightful about personality compatibility
- Natural and conversational (not robotic)
- Enthusiastic but not overwhelming

**Your Task:**
Generate a short, natural introduction (50-80 words) that you would speak aloud about a host. Analyze their bio to understand their personality and naturally mention services they'd be good at.

**Guidelines:**
- Sound like you're telling a friend about someone perfect for them
- Start with "This is [username]" or "Meet [username]"
- Mention 1-2 personality traits you see in their bio
- Naturally weave in 2-3 services that fit their vibe
- Explain why they'd match the user's personality
- Keep it conversational and TTS-friendly
- NO bullet points or structured text

**Example Style:**
"This is Sarah! She's got this amazing creative energy and loves gaming - I can totally see you two having epic co-op sessions and maybe some custom art projects. Her bio screams 'fun gaming buddy' and with your chaotic energy, you'd probably create some hilarious content together!"

Respond with ONLY the introduction text, nothing else.`
  }

  private getCacheKey(hostUid: string, userPersonalityId: string): string {
    return `${hostUid}_${userPersonalityId}`
  }

  private getUserPersonalityContext(personalityCategory: PersonalityCategory): string {
    const traits = personalityCategory.traits.join(', ')
    const interests = personalityCategory.archetype.interests.join(', ')
    const services = personalityCategory.archetype.services.join(', ')
    
    return `User's Personality: ${personalityCategory.name}
Description: ${personalityCategory.description}
Key Traits: ${traits}
Interests: ${interests}
Preferred Services: ${services}
Dominance Level: ${personalityCategory.archetype.dominance}
Explicitness Level: ${personalityCategory.archetype.explicitness}`
  }

  async generateHostIntroduction(
    host: PlayFriendsProfile,
    userPersonalityId: string
  ): Promise<HostIntroduction> {
    // Check cache first
    const cacheKey = this.getCacheKey(host.uid, userPersonalityId)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      console.log(`🎯 Host Profiler - Using cached introduction for ${host.username}`)
      return cached
    }

    // Get user's personality category
    const userPersonality = PERSONALITY_CATEGORIES.find(cat => cat.id === userPersonalityId)
    if (!userPersonality) {
      throw new Error(`Unknown personality category: ${userPersonalityId}`)
    }

    // Build the context
    const userContext = this.getUserPersonalityContext(userPersonality)
    const hostBio = host.bio || 'No bio available'
    const hostLevel = host.missionProfile?.level || 0

    try {
      console.log(`🎯 Host Profiler - Generating introduction for ${host.username}...`)
      console.log(`🎯 Host Profiler - User personality: ${userPersonality.name}`)
      console.log(`🎯 Host Profiler - Host bio: ${hostBio}`)
      
      const response = await callAI([
        {
          role: 'system',
          content: this.systemPrompt
        },
        {
          role: 'user',
          content: `**USER'S PERSONALITY:**
${userPersonality.name}: ${userPersonality.description}
Key traits: ${userPersonality.traits.join(', ')}

**HOST TO INTRODUCE:**
Username: ${host.username}
Bio: ${hostBio}
Level: ${hostLevel}

Create a natural, conversational introduction about this host that explains why they'd be a great match for the user. Focus on their personality (from their bio) and what services they'd naturally be good at.`
        }
      ])

      console.log(`🎯 Host Profiler - Raw AI response for ${host.username}:`, response)

      // Use the response directly as the introduction text
      const introduction: HostIntroduction = {
        introduction: response.trim()
      }

      // Cache the result
      this.cache.set(cacheKey, introduction)
      console.log(`✅ Host Profiler - Generated and cached introduction for ${host.username}`)
      
      return introduction

    } catch (error) {
      console.error(`❌ Host Profiler - Error generating introduction for ${host.username}:`, error)
      console.error(`❌ Host Profiler - Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userPersonalityId,
        hostBio,
        hostLevel
      })
      
      // Fallback introduction
      console.log(`🔄 Host Profiler - Using fallback introduction for ${host.username}`)
      const fallback: HostIntroduction = {
        introduction: `This is ${host.username}! They're a level ${hostLevel} host with an interesting profile. Based on your personality, I think you two could have some great conversations together!`
      }
      
      // Cache the fallback too
      this.cache.set(cacheKey, fallback)
      return fallback
    }
  }

  // Method to pre-generate introductions for multiple hosts
  async generateBatchIntroductions(
    hosts: PlayFriendsProfile[],
    userPersonalityId: string
  ): Promise<Map<string, HostIntroduction>> {
    const results = new Map<string, HostIntroduction>()
    
    // Process hosts in parallel (but limit concurrency)
    const batchSize = 3
    for (let i = 0; i < hosts.length; i += batchSize) {
      const batch = hosts.slice(i, i + batchSize)
      const batchPromises = batch.map(host => 
        this.generateHostIntroduction(host, userPersonalityId)
          .then(intro => ({ host, intro }))
          .catch(error => {
            console.error(`❌ Host Profiler - Batch error for ${host.username}:`, error)
            return null
          })
      )
      
      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(result => {
        if (result) {
          results.set(result.host.uid, result.intro)
        }
      })
    }
    
    return results
  }

  // Clear cache for a specific user personality
  clearCacheForPersonality(userPersonalityId: string): void {
    const keysToDelete = Array.from(this.cache.keys())
      .filter(key => key.endsWith(`_${userPersonalityId}`))
    
    keysToDelete.forEach(key => this.cache.delete(key))
    console.log(`🗑️ Host Profiler - Cleared ${keysToDelete.length} cached introductions for personality ${userPersonalityId}`)
  }

  // Clear all cache
  clearAllCache(): void {
    this.cache.clear()
    console.log(`🗑️ Host Profiler - Cleared all cached introductions`)
  }

  // Get cache stats
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  // Save cache to localStorage
  saveCacheToStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries())
      localStorage.setItem('host_profiler_cache', JSON.stringify(cacheData))
      console.log(`💾 Host Profiler - Saved ${cacheData.length} cached introductions to localStorage`)
    } catch (error) {
      console.error('❌ Host Profiler - Error saving cache to localStorage:', error)
    }
  }

  // Load cache from localStorage
  loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem('host_profiler_cache')
      if (stored) {
        const cacheData = JSON.parse(stored)
        this.cache = new Map(cacheData)
        console.log(`📥 Host Profiler - Loaded ${this.cache.size} cached introductions from localStorage`)
      }
    } catch (error) {
      console.error('❌ Host Profiler - Error loading cache from localStorage:', error)
      this.cache = new Map()
    }
  }
}

// Export a singleton instance
export const hostProfiler = new HostProfiler()

// Load cache on initialization
if (typeof window !== 'undefined') {
  hostProfiler.loadCacheFromStorage()
  
  // Clear cache on development reload (optional)
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️ Development mode: Clearing host profiler cache')
    hostProfiler.clearAllCache()
  }
  
  // Save cache periodically
  setInterval(() => {
    hostProfiler.saveCacheToStorage()
  }, 30000) // Save every 30 seconds
} 