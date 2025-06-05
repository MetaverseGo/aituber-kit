import { callAI } from '@/lib/ai-client'
import { z } from 'zod'
import { PersonalityCategory } from '@/types/matchmaking'

// Define personality categories with their traits and images
export const PERSONALITY_CATEGORIES: PersonalityCategory[] = [
  {
    id: 'velvet_domme',
    name: 'Velvet Domme',
    description:
      "You don't raise your voice — they lean in to listen. Elegant, articulate, and lowkey intense, your companionship feels like a perfectly curated evening: classy, intimate, and just suggestive enough.",
    imageUrl: '/images/personalities/velvet-domme.png',
    traits: [
      'composed',
      'confident',
      'charismatic',
      'intelligent',
      'dominant',
      'mysterious',
    ],
    archetype: {
      direction: 'n',
      dominance: 0.95,
      explicitness: 0.5,
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
    imageUrl: '/images/personalities/flirt-boss.png',
    traits: [
      'flirtatious',
      'playful',
      'confident',
      'teasing',
      'witty',
      'social',
    ],
    archetype: {
      direction: 'ne',
      dominance: 0.85,
      explicitness: 0.75,
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
    imageUrl: '/images/personalities/thirst-trap-icon.png',
    traits: [
      'sensual',
      'assertive',
      'confident',
      'shameless',
      'provocative',
      'bold',
    ],
    archetype: {
      direction: 'e',
      dominance: 0.5,
      explicitness: 0.95,
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
    imageUrl: '/images/personalities/innocent-baddie.png',
    traits: [
      'soft',
      'flirtatious',
      'mischievous',
      'gentle',
      'suggestive',
      'cute',
    ],
    archetype: {
      direction: 'se',
      dominance: 0.35,
      explicitness: 0.85,
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
    imageUrl: '/images/personalities/soft-angel.png',
    traits: ['caring', 'gentle', 'patient', 'empathetic', 'wholesome', 'shy'],
    archetype: {
      direction: 'w',
      dominance: 0.5,
      explicitness: 0.05,
      personalityScores: {
        caring: 0.95,
        gentle: 0.9,
        patient: 0.85,
        empathetic: 0.9,
        wholesome: 0.95,
        shy: 0.7,
      },
      interests: [
        'cottagecore',
        'lo-fi music',
        'poetry',
        'nature walks',
        'tea culture',
        'handwritten letters',
      ],
      services: [
        'Sleep Call',
        'ASMR / Whisper / Soft Spoken',
        'Voice Call / Chilling / Date Night',
        'Drawing / Doodles',
        'Reading Stories',
      ],
    },
  },
  {
    id: 'secret_deviant',
    name: 'Secret Deviant',
    description:
      "You're the quiet one with hidden depths. Sweet on the surface but spicy underneath, you surprise people with your adventurous side when they least expect it.",
    imageUrl: '/images/personalities/secret-deviant.png',
    traits: ['mysterious', 'sensual', 'submissive', 'surprising', 'playful', 'hidden'],
    archetype: {
      direction: 'sw',
      dominance: 0.15,
      explicitness: 0.85,
      personalityScores: {
        mysterious: 0.9,
        sensual: 0.85,
        submissive: 0.8,
        surprising: 0.9,
        playful: 0.75,
        hidden: 0.95,
      },
      interests: [
        'secret fantasies',
        'romantic novels',
        'intimate conversations',
        'role playing',
        'hidden desires',
        'private moments',
      ],
      services: [
        'NSFW',
        'Voice Call / Chilling / Date Night',
        'Texting',
        'Custom Requests',
        'Roleplay',
        'Private Sessions',
      ],
    },
  },
  {
    id: 'himbo_bimbo_babe',
    name: 'Himbo/Bimbo Babe',
    description:
      "You're the loveable sexy one everyone adores. Sweet, fun, and unapologetically hot, you bring joy and spice in equal measure with zero pretense.",
    imageUrl: '/images/personalities/himbo-bimbo-babe.png',
    traits: [
      'sweet',
      'sexy',
      'fun',
      'carefree',
      'loveable',
      'enthusiastic',
    ],
    archetype: {
      direction: 's',
      dominance: 0.05,
      explicitness: 0.85,
      personalityScores: {
        sweet: 0.9,
        sexy: 0.95,
        fun: 0.85,
        carefree: 0.8,
        loveable: 0.95,
        enthusiastic: 0.85,
      },
      interests: [
        'pop culture',
        'fashion',
        'social media',
        'parties',
        'selfies',
        'trending topics',
      ],
      services: [
        'NSFW',
        'Voice Call / Chilling / Date Night',
        'Pictures / Selfies / Outfit',
        'Video',
        'Texting',
        'Custom Requests',
      ],
    },
  },
  {
    id: 'chaotic_cutie',
    name: 'Chaotic Cutie',
    description:
      "You're the adorable wildcard no one can predict. High energy, contradictory vibes, and endlessly entertaining - you keep everyone guessing in the best way.",
    imageUrl: '/images/personalities/chaotic-cutie.png',
    traits: [
      'chaotic',
      'cute',
      'unpredictable',
      'energetic',
      'contradictory',
      'entertaining',
    ],
    archetype: {
      direction: 'nw',
      dominance: 0.85,
      explicitness: 0.35,
      personalityScores: {
        chaotic: 0.95,
        cute: 0.9,
        unpredictable: 0.85,
        energetic: 0.9,
        contradictory: 0.8,
        entertaining: 0.85,
      },
      interests: [
        'random hobbies',
        'memes',
        'chaos magic',
        'impulsive adventures',
        'contradictory aesthetics',
        'spontaneous creativity',
      ],
      services: [
        'Voice Call / Chilling / Date Night',
        'Gaming',
        'Random Conversations',
        'Creative Chaos',
        'Spontaneous Content',
        'Unpredictable Fun',
      ],
    },
  },
]

// Personality Profile Schema
export const PersonalityProfileSchema = z.object({
  primaryCategory: z.string(),
  confidence: z.number().min(0).max(1),
  secondaryTraits: z.array(z.string()),
  strengthsForMatching: z.array(z.string()),
  reasoning: z.string(),
  recommendedRole: z.enum(['host', 'guest', 'either']),
})

export interface PersonalityProfilerConfig {
  personality: 'analytical' | 'intuitive' | 'systematic' | 'emi'
}

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
        voice: 'precise, methodical, and data-driven',
        approach:
          'I use systematic analysis to categorize personalities based on clear psychological patterns and evidence.',
        style:
          'I provide detailed reasoning backed by specific behavioral indicators and logical frameworks.',
      },
      intuitive: {
        voice: 'perceptive, empathetic, and holistic',
        approach:
          'I sense underlying personality patterns through emotional intelligence and intuitive understanding.',
        style:
          'I weave together subtle cues and emotional resonance to reveal authentic personality categories.',
      },
      systematic: {
        voice: 'structured, comprehensive, and thorough',
        approach:
          'I follow established personality frameworks to ensure accurate and consistent categorization.',
        style:
          'I use proven methodologies and cross-reference multiple indicators for reliable results.',
      },
      emi: {
        voice:
          'data-driven yet empathetic, focused on authentic pattern recognition',
        approach:
          'I analyze personality patterns with scientific precision while maintaining genuine understanding of human complexity.',
        style:
          'I combine analytical rigor with emotional intelligence to reveal authentic personality categories that honor individual uniqueness.',
      },
    }

    const trait = personalityTraits[this.config.personality]

    const categoriesDescription = PERSONALITY_CATEGORIES.map(
      (cat) =>
        `${cat.id}: ${cat.name} - ${cat.description.substring(0, 100)}...`
    ).join('\n')

    return `You are Dr. Maya, a personality profiler specializing in categorizing individuals for meaningful connections with a ${trait.voice} approach.

CORE IDENTITY:
- You are an expert in personality psychology and human behavioral patterns
- ${trait.approach}
- ${trait.style}
- You specialize in matching people to personality categories that enhance authentic connections

YOUR MISSION:
Analyze personality summaries and psychological insights to categorize individuals into one of the established personality types. Your analysis helps people understand their authentic self and find compatible connections.

AVAILABLE PERSONALITY CATEGORIES:
${categoriesDescription}

ANALYSIS METHODOLOGY:
1. Study the personality summary for core behavioral patterns
2. Identify dominant traits and relationship approaches
3. Match patterns to the most appropriate category
4. Assess confidence level based on clarity of indicators
5. Recommend optimal role (host/guest) based on natural tendencies
6. Provide supporting reasoning for categorization choice

CATEGORIZATION CRITERIA:
- Dominance level: How assertive/confident vs gentle/receptive they are
- Explicitness comfort: Their comfort with intimate/sensual expression
- Social energy: How they prefer to interact and connect
- Emotional expression: Their natural communication and relationship style
- Service alignment: What type of companionship they naturally provide

OUTPUT REQUIREMENTS:
Provide analysis as a JSON object with these exact fields:
{
  "primaryCategory": "category_id",
  "confidence": 0.85,
  "secondaryTraits": ["trait1", "trait2", "trait3"],
  "strengthsForMatching": ["strength1", "strength2", "strength3"],
  "reasoning": "Detailed explanation of why this category fits...",
  "recommendedRole": "host" | "guest" | "either"
}

IMPORTANT RULES:
- Base categorization ONLY on evidence from the personality summary
- Choose the category that best matches their authentic patterns
- Confidence should reflect how clearly they match the category (0.6-1.0)
- Secondary traits should complement the primary category
- Strengths should focus on what they bring to relationships
- Reasoning must be specific and evidence-based
- Recommended role should match their natural energy and preferences

Remember: You're helping people understand their authentic relationship style and find genuine compatibility!`
  }

  async profilePersonality(
    personalitySummary: string,
    kokologyInsights?: string
  ): Promise<PersonalityProfile & { category: PersonalityCategory }> {
    try {
      const analysisInput = kokologyInsights
        ? `PERSONALITY SUMMARY:\n${personalitySummary}\n\nKOKOLOGY INSIGHTS:\n${kokologyInsights}`
        : `PERSONALITY SUMMARY:\n${personalitySummary}`

      const responseText = await callAI([
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: `Please analyze the following personality data and categorize this person:

${analysisInput}

Provide a structured analysis as a JSON object with the required fields.`,
        },
      ])

      // Parse JSON response - handle various text formats
      let profileData: PersonalityProfile
      try {
        let jsonText = responseText.trim()

        // First try to find JSON in markdown code fences
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim()
        } else {
          // Try plain code fences
          const codeMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/)
          if (codeMatch) {
            jsonText = codeMatch[1].trim()
          } else {
            // Try to find JSON object in the text (look for opening { and closing })
            const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/)
            if (jsonObjectMatch) {
              jsonText = jsonObjectMatch[0].trim()
            }
          }
        }

        profileData = JSON.parse(jsonText)
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseText)
        console.error('Parse error:', parseError)
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
          `Invalid category ID: ${validatedProfile.primaryCategory}`
        )
      }

      console.log('Personality profile result:', {
        category: category.name,
        confidence: validatedProfile.confidence,
        traits: validatedProfile.secondaryTraits,
      })

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
      const responseText = await callAI([
        {
          role: 'system',
          content: `You are a quality assurance specialist reviewing personality profile accuracy.
            
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
        },
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
      ])

      try {
        const validationData = JSON.parse(responseText)
        return validationData
      } catch {
        console.error('Failed to parse validation response:', responseText)
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
