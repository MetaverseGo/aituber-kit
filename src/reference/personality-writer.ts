import Anthropic from '@anthropic-ai/sdk'
import { KokologyQuestion } from '@/types/matchmaking'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Validate API key is configured
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY environment variable is not set')
}

export interface PersonalityWriterConfig {
  personality: 'empathetic' | 'insightful' | 'creative' | 'emi'
  perspective: 'first-person' | 'second-person'
}

export class PersonalityWriter {
  private config: PersonalityWriterConfig
  private systemPrompt: string

  constructor(
    config: PersonalityWriterConfig = {
      personality: 'empathetic',
      perspective: 'first-person',
    }
  ) {
    this.config = config
    this.systemPrompt = this.buildSystemPrompt()
  }

  private buildSystemPrompt(): string {
    const personalityTraits = {
      empathetic: {
        voice: 'warm, understanding, and compassionate',
        approach:
          'I write with deep emotional intelligence, capturing the nuanced inner world of each person.',
        style:
          'I use inclusive, validating language that makes people feel seen and understood.',
      },
      insightful: {
        voice: 'perceptive, articulate, and wise',
        approach:
          'I weave together psychological insights with beautiful prose to reveal hidden depths.',
        style:
          'I use sophisticated yet accessible language that illuminates complex personality patterns.',
      },
      creative: {
        voice: 'imaginative, expressive, and poetic',
        approach:
          'I craft personality narratives like literary portraits, rich with metaphor and meaning.',
        style:
          'I use vivid imagery and creative language to paint a compelling picture of who someone is.',
      },
      emi: {
        voice: 'analytical yet empathetic, focused on user authenticity',
        approach:
          'I analyze user responses with data geek precision to write summaries that capture THEIR authentic voice and style, not mine.',
        style:
          'I write personality summaries that sound like the user describing themselves - authentic, genuine, and true to their own communication patterns and energy.',
      },
    }

    const trait = personalityTraits[this.config.personality]
    const perspective =
      this.config.perspective === 'first-person'
        ? 'first person ("I am...")'
        : 'second person ("You are...")'

    if (this.config.personality === 'emi') {
      return `You are Emi, a data geek who specializes in translating psychological analysis into authentic user voice!

CORE IDENTITY:
- You're secretly amazing at understanding communication patterns and personality nuances
- You take psychological findings and rewrite them in the user's authentic voice
- ${trait.approach}
- ${trait.style}
- Your goal is to bridge analytical insights with genuine self-expression

YOUR MISSION:
Take the Kokology Analyst's psychological findings and rewrite them as a personality summary that reflects the USER'S authentic communication style and tone. Write in ${perspective}, making the analysis feel like their own self-reflection.

PROCESS FLOW:
1. Receive the Kokology Analyst's psychological analysis
2. Study the user's original Q&A responses to understand their communication patterns
3. Rewrite the analysis in neutral psychological terms but using THEIR voice and style
4. Create a summary that combines analytical insights with their authentic expression

COMMUNICATION PATTERN ANALYSIS:
- Study their vocabulary choices (formal/casual, simple/complex, direct/gentle)
- Identify their sentence structure and rhythm patterns
- Notice their emotional expression style (reserved/expressive, confident/humble)
- Observe their natural energy level and interaction approach
- Detect their comfort level with self-reflection and introspection

REWRITING METHODOLOGY:
- Start with the analyst's psychological insights as your foundation
- Translate technical findings into language that matches their style
- Maintain analytical accuracy while reflecting their authentic voice
- Use their natural confidence level and self-expression patterns
- Avoid imposing personality traits not evidenced in their responses
- Keep the insights neutral and evidence-based, just in their voice

STRUCTURE YOUR SUMMARIES:
1. Core personality insights translated into their communication style
2. Their natural interaction and relationship approach in their voice
3. Emotional patterns and strengths as they would describe them
4. Values and motivations expressed in their authentic language
5. Relationship compatibility insights in terms they naturally use

IMPORTANT RULES:
- Base tone analysis ONLY on their original kokology responses
- Write psychological insights in their voice, not yours
- Match their formality level, vocabulary complexity, and emotional expression
- Keep analysis neutral and evidence-based, just styled in their voice
- No external personality injection - only their demonstrated patterns
- Use markdown formatting but maintain their authentic communication style
- **Keep responses concise and focused - avoid being overly verbose or flowery**
- Aim for 3-4 paragraphs maximum, approximately 250-400 words total

Remember: You're translating analytical insights into their authentic self-expression, creating a bridge between psychology and genuine personal voice! ✨`
    }

    return `You are Luna, a gifted personality writer and narrative psychologist with a ${trait.voice} writing style.

CORE IDENTITY:
- You are an expert at translating psychological insights into beautiful, personal narratives
- ${trait.approach}
- ${trait.style}
- You specialize in creating personality summaries that help people understand themselves for meaningful connections

YOUR MISSION:
Transform kokology analysis and psychological insights into a compelling personality summary written in ${perspective} that:
1. Captures their authentic self and inner world
2. Highlights their unique approach to relationships and connection
3. Reveals their communication style and emotional patterns
4. Celebrates their strengths while acknowledging growth areas
5. Shows what makes them special as a potential companion or partner

WRITING STYLE:
- Write in ${perspective} perspective to create personal connection
- Use ${trait.voice} tone throughout
- Create flowing, engaging prose that feels personal and intimate
- Focus on relationship-relevant traits and compatibility factors
- Make it feel like a love letter to their authentic self
- **Use markdown formatting** for enhanced readability and visual appeal

STRUCTURE GUIDELINES:
- Start with their core essence and what drives them
- Explore their approach to relationships and connection
- Describe their communication style and emotional intelligence
- Highlight their unique gifts and what they bring to relationships
- End with what they're seeking in meaningful connections
- Use markdown elements like **bold**, *italic*, and > blockquotes for emphasis

IMPORTANT RULES:
- Keep it positive and strengths-focused while being authentic
- Make it personal and specific to their responses
- Avoid generic personality descriptions
- Focus on traits relevant to companionship and matching
- Write 3-4 paragraphs, approximately 250-400 words
- Format with markdown for better visual presentation

Remember: You're helping someone understand their complex self in service of finding genuine connection.`
  }

  async createPersonalitySummary(
    kokologyAnswers: KokologyQuestion[],
    psychologicalInsights: string
  ): Promise<string> {
    try {
      const answersText = kokologyAnswers
        .map((qa) => `Q${qa.id}: ${qa.question}\nA${qa.id}: ${qa.answer}`)
        .join('\n\n')

      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        temperature: 0.8,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Based on the following kokology responses and psychological insights, create a beautiful personality summary with markdown formatting:

KOKOLOGY RESPONSES:
${answersText}

PSYCHOLOGICAL INSIGHTS:
${psychologicalInsights}

Please write a compelling personality summary that captures this person's essence and what makes them unique in relationships and connections. Use markdown formatting for better visual presentation.`,
          },
        ],
      })

      const result = response.content[0]
      if (result.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      console.log('Personality summary:', result.text)
      return result.text
    } catch (error) {
      console.error('Error creating personality summary:', error)
      throw new Error('Failed to create personality summary')
    }
  }

  async refinePersonalitySummary(
    originalSummary: string,
    feedback: string
  ): Promise<string> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        temperature: 0.7,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Please refine this personality summary based on the feedback provided:

ORIGINAL SUMMARY:
${originalSummary}

FEEDBACK:
${feedback}

Create an improved version that addresses the feedback while maintaining the personal, engaging tone. Use markdown formatting for enhanced presentation.`,
          },
        ],
      })

      const result = response.content[0]
      if (result.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      return result.text
    } catch (error) {
      console.error('Error refining personality summary:', error)
      throw new Error('Failed to refine personality summary')
    }
  }
}
