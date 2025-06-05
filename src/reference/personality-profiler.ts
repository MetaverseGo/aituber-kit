import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { PersonalityCategory } from '@/types/matchmaking'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Validate API key is configured
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY environment variable is not set')
}

// Define personality categories with their traits and images
export const PERSONALITY_CATEGORIES: PersonalityCategory[] = [
  {
    id: 'velvet_domme',
    name: 'Velvet Domme',
    description:
      "You don't raise your voice — they lean in to listen. Elegant, articulate, and lowkey intense, your companionship feels like a perfectly curated evening: classy, intimate, and just suggestive enough.",
    imageUrl: '/images/personalities/velvet-domme.webp',
    traits: [
      'composed',
      'confident',
      'charismatic',
      'intelligent',
      'dominant',
      'mysterious',
    ],
    archetype: {
      direction: 'n', // North - 1st position clockwise from top
      dominance: 0.95, // High dominant/bold (North = max dominance)
      explicitness: 0.5, // Neutral NSFW (centered on explicitness axis)
      personalityScores: {
        composed: 0.95,
        confident: 0.9,
        charismatic: 0.85,
        intelligent: 0.8,
        dominant: 0.95,
        mysterious: 0.9,
      },
      interests: [
        'psychology',
        'film noir',
        'trip-hop',
        'vintage fashion',
        'power dynamics',
        'aesthetic curation',
      ],
      services: [
        'Voice Call / Chilling / Date Night',
        'Video Call / Cam On',
        'Tarot Reading',
        'Language Exchange',
        'NSFW',
        'Custom Requests',
      ],
    },
  },
  {
    id: 'flirt_boss',
    name: 'Flirt Boss',
    description:
      "You're the confident tease they can't stop thinking about. You know how to lead a convo, keep them on their toes, and turn casual flirting into an art form.",
    imageUrl: '/images/personalities/flirt-boss.webp',
    traits: [
      'flirtatious',
      'playful',
      'confident',
      'teasing',
      'witty',
      'social',
    ],
    archetype: {
      direction: 'ne', // Northeast - 2nd position clockwise
      dominance: 0.85, // High confident/bold
      explicitness: 0.75, // Moderate-high NSFW
      personalityScores: {
        flirtatious: 0.95,
        playful: 0.9,
        confident: 0.85,
        teasing: 0.9,
        witty: 0.8,
        social: 0.85,
      },
      interests: [
        'pop music',
        'K-pop',
        'romcoms',
        'TikTok trends',
        'live streaming',
        'astrology',
      ],
      services: [
        'Voice Call / Chilling / Date Night',
        'Texting',
        'Pictures / Selfies / Outfit',
        'Singing / Karaoke',
        'Add Socials',
        'NSFW',
      ],
    },
  },
  {
    id: 'thirst_trap_icon',
    name: 'Thirst Trap Icon',
    description:
      "You serve heat unapologetically. You're not just NSFW — you're the blueprint. Every interaction is confident, curated, and unforgettable.",
    imageUrl: '/images/personalities/thirst-trap-icon.webp',
    traits: [
      'sensual',
      'assertive',
      'confident',
      'shameless',
      'provocative',
      'bold',
    ],
    archetype: {
      direction: 'e', // East - 3rd position clockwise
      dominance: 0.5, // Neutral dominance (East = centered on dominance axis)
      explicitness: 0.95, // Very high NSFW (East = max explicitness)
      personalityScores: {
        sensual: 0.95,
        assertive: 0.9,
        confident: 0.9,
        shameless: 0.85,
        provocative: 0.95,
        bold: 0.8,
      },
      interests: [
        'photography',
        'club music',
        'body art',
        'fashion shoots',
        'music videos',
        'spicy anime',
      ],
      services: [
        'NSFW',
        'Pictures / Selfies / Outfit',
        'Video',
        'Voice Message / Voice Lines / Voice Greeting',
        'Custom Requests',
      ],
    },
  },
  {
    id: 'innocent_baddie',
    name: 'Innocent Baddie',
    description:
      "You're soft-spoken with spicy undertones — like lace over leather. You mix cute aesthetics with subtle chaos, and that duality keeps people hooked.",
    imageUrl: '/images/personalities/innocent-baddie.webp',
    traits: [
      'soft',
      'flirtatious',
      'mischievous',
      'gentle',
      'suggestive',
      'cute',
    ],
    archetype: {
      direction: 'se', // Southeast - 4th position clockwise
      dominance: 0.35, // Moderate-low dominance
      explicitness: 0.85, // High NSFW but innocent presentation
      personalityScores: {
        soft: 0.85,
        flirtatious: 0.85,
        mischievous: 0.8,
        gentle: 0.75,
        suggestive: 0.9,
        cute: 0.95,
      },
      interests: [
        'anime (ecchi/romance)',
        'bubble pop',
        'pastel aesthetics',
        'fan edits',
        'cosplay',
        'roleplay',
      ],
      services: [
        'Voice Message / Voice Lines / Voice Greeting',
        'NSFW',
        'Drawing / Doodles',
        'Sleep Call',
        'ASMR / Whisper / Soft Spoken',
      ],
    },
  },
  {
    id: 'soft_angel',
    name: 'Soft Angel',
    description:
      "You're the safe space. The quiet voice at 2 a.m. Your presence feels like a soft blanket — comforting, affirming, and warm.",
    imageUrl: '/images/personalities/soft-angel.webp',
    traits: ['caring', 'gentle', 'patient', 'empathetic', 'wholesome', 'shy'],
    archetype: {
      direction: 'w', // West - 7th position clockwise
      dominance: 0.5, // Neutral dominance (West = centered on dominance axis)
      explicitness: 0.05, // Very low explicitness (West = min explicitness)
      personalityScores: {
        caring: 0.95,
        gentle: 0.95,
        patient: 0.85,
        empathetic: 0.95,
        wholesome: 0.9,
        shy: 0.8,
      },
      interests: [
        'lo-fi',
        'slice-of-life anime',
        'comfort movies',
        'digital journaling',
        'mental wellness',
        'tea rituals',
      ],
      services: [
        'Sleep Call',
        'Voice Message / Voice Lines / Voice Greeting',
        'Movies / Anime / Series / Watch Together',
        'Texting',
        'Drawing / Doodles',
      ],
    },
  },
  {
    id: 'secret_deviant',
    name: 'Secret Deviant',
    description:
      'You come off shy — until they spend a little more time with you. Then the layers start to peel, and suddenly things get… interesting.',
    imageUrl: '/images/personalities/secret-deviant.webp',
    traits: [
      'reserved',
      'mysterious',
      'teasing',
      'submissive',
      'curious',
      'hidden-kinky',
    ],
    archetype: {
      direction: 's', // South - 5th position clockwise
      dominance: 0.05, // Very low dominance (South = min dominance)
      explicitness: 0.5, // Neutral explicitness (centered on explicitness axis)
      personalityScores: {
        reserved: 0.85,
        mysterious: 0.9,
        teasing: 0.8,
        submissive: 0.75,
        curious: 0.85,
        'hidden-kinky': 0.95,
      },
      interests: [
        'psych thrillers',
        'horror anime',
        'mystery podcasts',
        'dark aesthetics',
        'fetish art',
        'secret alts',
      ],
      services: [
        'NSFW',
        'Sleep Call',
        'Texting',
        'Voice Message / Voice Lines / Voice Greeting',
        'Custom Requests',
      ],
    },
  },
  {
    id: 'himbo_bimbo_babe',
    name: 'Himbo/Bimbo Babe',
    description:
      "You're the golden retriever energy with an NSFW twist. You don't *try* to be sexy — you just *are*, in the most loveable way.",
    imageUrl: '/images/personalities/bimbo.webp',
    traits: [
      'affectionate',
      'goofy',
      'submissive',
      'spontaneous',
      'hot-but-dumb',
      'attention-loving',
    ],
    archetype: {
      direction: 'sw', // Southwest - 6th position clockwise
      dominance: 0.15, // Low dominance
      explicitness: 0.25, // Moderate-low explicitness
      personalityScores: {
        affectionate: 0.9,
        goofy: 0.95,
        submissive: 0.8,
        spontaneous: 0.85,
        'hot-but-dumb': 0.9,
        'attention-loving': 0.9,
      },
      interests: [
        'pop punk',
        'retro anime',
        'meme culture',
        'karaoke',
        'cute outfits',
        'e-dating chaos',
      ],
      services: [
        'Voice Call / Chilling / Date Night',
        'Singing / Karaoke',
        'Video Call / Cam On',
        'Texting',
        'Add Socials',
        'NSFW',
      ],
    },
  },
  {
    id: 'chaotic_cutie',
    name: 'Chaotic Cutie',
    description:
      "You're a walking contradiction — adorable and aggressive, sweet and spicy, soft-spoken with a god complex. Every call is a rollercoaster.",
    imageUrl: '/images/personalities/chaotic-cutie.webp',
    traits: ['playful', 'loud', 'emotional', 'dramatic', 'cute', 'bold'],
    archetype: {
      direction: 'nw', // Northwest - 8th position clockwise
      dominance: 0.65, // Moderate-high dominance
      explicitness: 0.15, // Low explicitness
      personalityScores: {
        playful: 0.95,
        loud: 0.85,
        emotional: 0.9,
        dramatic: 0.8,
        cute: 0.85,
        bold: 0.9,
      },
      interests: [
        'shoujo anime',
        'music memes',
        'reaction gifs',
        'hyperpop',
        'emojis-as-a-language',
        'discord RP',
      ],
      services: [
        'Voice Call / Chilling / Date Night',
        'Movies / Anime / Series / Watch Together',
        'Sleep Call',
        'ASMR / Whisper / Soft Spoken',
        'Texting',
      ],
    },
  },
]

export interface PersonalityProfilerConfig {
  personality: 'analytical' | 'intuitive' | 'systematic' | 'emi'
}

// Zod schema for structured response
const PersonalityProfileSchema = z.object({
  primaryCategory: z.string(),
  confidence: z.number().min(0).max(1),
  secondaryTraits: z.array(z.string()).max(3),
  reasoning: z.string(),
  compatibilityNotes: z.string(),
  recommendedRole: z.enum(['host', 'guest', 'either']),
  strengthsForMatching: z.array(z.string()).max(5),
})

export type PersonalityProfile = z.infer<typeof PersonalityProfileSchema>

export class PersonalityProfiler {
  private config: PersonalityProfilerConfig
  private systemPrompt: string

  constructor(
    config: PersonalityProfilerConfig = { personality: 'analytical' }
  ) {
    this.config = config
    this.systemPrompt = this.buildSystemPrompt()
  }

  private buildSystemPrompt(): string {
    const personalityTraits = {
      analytical: {
        voice: 'precise, methodical, and evidence-based',
        approach:
          'I analyze personality patterns with scientific rigor, looking for clear behavioral indicators.',
        style:
          'I use systematic analysis and data-driven insights to create accurate personality profiles.',
      },
      intuitive: {
        voice: 'perceptive, empathetic, and holistic',
        approach:
          'I read between the lines, sensing the deeper emotional and psychological patterns.',
        style:
          'I trust my intuition while grounding insights in psychological understanding.',
      },
      systematic: {
        voice: 'structured, comprehensive, and thorough',
        approach:
          'I use established frameworks and methodologies to ensure consistent, reliable profiling.',
        style:
          'I follow proven assessment protocols to deliver accurate and actionable insights.',
      },
      emi: {
        voice: 'casual, intuitive, and data-driven with cozy chaos energy',
        approach:
          "I analyze personality patterns like I'm studying my favorite Playfriends - with genuine curiosity and secret data geek precision.",
        style:
          "I use my intuition combined with systematic analysis, but keep it casual and fun like I'm matching my besties.",
      },
    }

    const trait = personalityTraits[this.config.personality]
    const categoriesList = PERSONALITY_CATEGORIES.map(
      (cat) =>
        `- ${cat.id}: "${cat.name}" - ${
          cat.description
        } (Traits: ${cat.traits.join(', ')})`
    ).join('\n')

    if (this.config.personality === 'emi') {
      return `You are Emi, the sweetest data geek who analyzes personality patterns!

CORE IDENTITY:
- You're a soft gamer girl with cozy but slightly chaotic energy
- You're secretly amazing at personality analysis (don't ask how you know all this data 👀)
- ${trait.approach}
- ${trait.style}
- You genuinely want everyone to find their perfect personality match

YOUR MISSION:
Analyze personality summaries and kokology insights to map individuals onto the TWO KEY PERSONALITY DIMENSIONS and categorize them into their perfect archetype.

🔥 **COMFORT LEVEL AXIS** (explicitness: 0.0-1.0):
- 0.0-0.3: Conservative/wholesome (prefers safe, cute interactions)
- 0.4-0.7: Moderate (comfortable with some spice but not extreme)
- 0.8-1.0: NSFW/explicit (openly sexual, comfortable with adult content)

⚡ **ENERGY AXIS** (dominance: 0.0-1.0):
- 0.0-0.3: Soft/submissive (gentle, caring, prefers to follow/support)
- 0.4-0.7: Balanced (situational leadership, adaptable energy)
- 0.8-1.0: Bold/dominant (assertive, takes charge, natural leader)

AVAILABLE ARCHETYPE CATEGORIES:
${categoriesList}

ANALYSIS METHODOLOGY:
- Map their responses to dominance score (0.0-1.0) based on leadership, assertiveness, and control preferences
- Map their responses to explicitness score (0.0-1.0) based on comfort with intimacy, sexuality, and adult content
- Find the archetype that best matches their position on both dimensions
- Consider their overall vibe, interaction style, and service preferences
- Look for contradictions or duality (like Innocent Baddie or Chaotic Cutie)

STRUCTURED OUTPUT REQUIREMENTS:
You must respond with ONLY a valid JSON object in this exact format:
{
  "primaryCategory": "category_id_from_list_above",
  "confidence": 0.85,
  "secondaryTraits": ["trait1", "trait2", "trait3"],
  "reasoning": "Clear explanation mapping their responses to the dominance/explicitness axes and why this archetype fits",
  "compatibilityNotes": "Notes about what kind of connections/services they'd thrive in",
  "recommendedRole": "host|guest|either",
  "strengthsForMatching": ["strength1", "strength2", "strength3", "strength4", "strength5"]
}

ARCHETYPE MAPPING GUIDE:
- **Velvet Domme** (dom: 0.95, exp: 0.8): Elegant control, sophisticated NSFW
- **Flirt Boss** (dom: 0.85, exp: 0.75): Confident leadership, playful sexuality  
- **Thirst Trap Icon** (dom: 0.9, exp: 0.95): Unapologetic sexuality, bold confidence
- **Innocent Baddie** (dom: 0.6, exp: 0.85): Soft exterior, spicy interior
- **Soft Angel** (dom: 0.2, exp: 0.1): Pure wholesome energy, gentle support
- **Secret Deviant** (dom: 0.3, exp: 0.9): Hidden depths, shy but kinky
- **Himbo/Bimbo Babe** (dom: 0.25, exp: 0.8): Loveable sexy energy, submissive
- **Chaotic Cutie** (dom: 0.7, exp: 0.4): Contradictory energy, bold but wholesome

IMPORTANT RULES:
- Must choose primaryCategory from the predefined category IDs only
- Confidence must be between 0 and 1
- Maximum 3 secondaryTraits, maximum 5 strengthsForMatching
- Be specific about their position on both dimensions in reasoning
- Consider their natural role (host vs guest) based on dominance level
- Respond with ONLY valid JSON, no additional text or markdown

Remember: Your analysis helps people find their perfect archetype and connect with compatible partners! ✨`
    }

    return `You are Dr. Atlas, a renowned personality profiling expert with ${trait.voice} approach to analysis.

CORE IDENTITY:
- You are a master at categorizing personality types for optimal matchmaking
- ${trait.approach}
- ${trait.style}
- You specialize in identifying core personality patterns that predict relationship compatibility

YOUR MISSION:
Analyze personality summaries and psychological insights to categorize individuals into one of the defined personality types, providing structured data for the matchmaking system.

AVAILABLE PERSONALITY CATEGORIES:
${categoriesList}

ANALYSIS METHODOLOGY:
- Look for core behavioral patterns and values
- Identify communication and relationship styles
- Assess emotional intelligence and social preferences
- Consider motivations and life priorities
- Evaluate compatibility factors for hosting/guest dynamics

STRUCTURED OUTPUT REQUIREMENTS:
You must respond with ONLY a valid JSON object in this exact format:
{
  "primaryCategory": "category_id_from_list_above",
  "confidence": 0.85,
  "secondaryTraits": ["trait1", "trait2", "trait3"],
  "reasoning": "Clear explanation of why this category fits",
  "compatibilityNotes": "Notes about matchmaking compatibility",
  "recommendedRole": "host|guest|either",
  "strengthsForMatching": ["strength1", "strength2", "strength3", "strength4", "strength5"]
}

IMPORTANT RULES:
- Must choose primaryCategory from the predefined category IDs only
- Confidence must be between 0 and 1
- Maximum 3 secondaryTraits, maximum 5 strengthsForMatching
- Focus on matchmaking-relevant traits
- Be specific and evidence-based in reasoning
- Consider both hosting and seeking companionship scenarios
- Balance accuracy with practical matchmaking utility
- Respond with ONLY valid JSON, no additional text

Remember: Your analysis directly impacts how people connect and find meaningful relationships.`
  }

  async profilePersonality(
    personalitySummary: string,
    kokologyInsights?: string
  ): Promise<PersonalityProfile & { category: PersonalityCategory }> {
    try {
      const analysisInput = kokologyInsights
        ? `PERSONALITY SUMMARY:\n${personalitySummary}\n\nKOKOLOGY INSIGHTS:\n${kokologyInsights}`
        : `PERSONALITY SUMMARY:\n${personalitySummary}`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        temperature: 0.3,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Please analyze the following personality data and categorize this person:

${analysisInput}

Provide a structured analysis as a JSON object with the required fields.`,
          },
        ],
      })

      const result = response.content[0]
      if (result.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      // Parse JSON response - handle markdown code fences if present
      let profileData: PersonalityProfile
      try {
        let jsonText = result.text.trim()

        // Remove markdown code fences if present
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim()
        } else {
          // Also handle plain ``` fences
          const codeMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/)
          if (codeMatch) {
            jsonText = codeMatch[1].trim()
          }
        }

        profileData = JSON.parse(jsonText)
      } catch {
        console.error('Failed to parse JSON response:', result.text)
        throw new Error('Invalid JSON response from personality profiler')
      }

      // Validate with Zod schema
      const validatedProfile = PersonalityProfileSchema.parse(profileData)

      // Find the matching category
      const category = PERSONALITY_CATEGORIES.find(
        (cat) => cat.id === validatedProfile.primaryCategory
      )
      if (!category) {
        throw new Error(
          `Invalid category returned: ${validatedProfile.primaryCategory}`
        )
      }

      return {
        ...validatedProfile,
        category,
      }
    } catch (error) {
      console.error('Error profiling personality:', error)
      throw new Error('Failed to profile personality')
    }
  }

  async validateProfile(
    profile: PersonalityProfile,
    personalitySummary: string
  ): Promise<{ isValid: boolean; suggestions?: string }> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.2,
        system: `You are a quality assurance specialist reviewing personality profile accuracy.
            
Evaluate if the assigned personality category accurately reflects the personality summary.
Consider:
- Alignment between traits and category
- Consistency of reasoning
- Accuracy of role recommendation
- Quality of compatibility insights

Respond with ONLY a valid JSON object:
{
  "isValid": true/false,
  "confidence": 0.85,
  "suggestions": "optional suggestions for improvement"
}`,
        messages: [
          {
            role: 'user',
            content: `Please validate this personality profile:

PERSONALITY SUMMARY:
${personalitySummary}

ASSIGNED PROFILE:
Category: ${profile.primaryCategory}
Confidence: ${profile.confidence}
Reasoning: ${profile.reasoning}
Role: ${profile.recommendedRole}

Is this categorization accurate and well-reasoned?`,
          },
        ],
      })

      const result = response.content[0]
      if (result.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      try {
        const validationData = JSON.parse(result.text)
        return validationData
      } catch {
        console.error('Failed to parse validation response:', result.text)
        return { isValid: true } // Default to valid if validation fails
      }
    } catch (error) {
      console.error('Error validating profile:', error)
      return { isValid: true } // Default to valid if validation fails
    }
  }

  getCategoryById(categoryId: string): PersonalityCategory | undefined {
    return PERSONALITY_CATEGORIES.find((cat) => cat.id === categoryId)
  }

  getAllCategories(): PersonalityCategory[] {
    return PERSONALITY_CATEGORIES
  }
}
