import { callAI } from '@/lib/ai-client'
import {
  AIResponseProcessor,
  createResponseProcessor,
} from '@/lib/ai-response-processor'
import type { TopicConversationState } from '@/types/matchmaking'
import type { MamaSanSpecialistConfig } from './mama-san-specialist'

const MIN_TURNS_FOR_NEW_TOPIC = 3
const PROFILE_QUESTION_COOLDOWN = 4 // Ask a profile question at most once every 4 turns

export class TopicStarterSpecialist {
  private config: MamaSanSpecialistConfig
  private minTurnsPerTopic: number

  constructor(config: MamaSanSpecialistConfig = {}) {
    this.config = config
    this.minTurnsPerTopic = config.minTurnsPerTopic || MIN_TURNS_FOR_NEW_TOPIC
  }

  setUserId(userId: string): void {
    this.config.userId = userId
  }

  /**
   * Check if it's time to start a new topic conversation.
   */
  shouldStartNewTopic(state: TopicConversationState): boolean {
    // If no current topic, we must start one.
    if (!state.currentTopic) {
      return true
    }
    // If the turn count for the current topic is below the minimum, continue it.
    if (state.turnCount < this.minTurnsPerTopic) {
      return false
    }
    // If minimum turns are met, there's a chance to switch topics.
    // For now, we'll switch aggressively after min turns.
    return true
  }

  /**
   * Check if the cooldown for asking a profile question has passed.
   */
  isProfileQuestionCooldownOver(state: TopicConversationState): boolean {
    const turnsSince = state.turnsSinceLastProfileQuestion ?? 0
    return turnsSince >= PROFILE_QUESTION_COOLDOWN
  }

  /**
   * Create the initial state for a topic conversation.
   */
  createInitialState(): TopicConversationState {
    return {
      currentTopic: null,
      turnCount: 0,
      topicHistory: [],
      lastQuestion: null,
      turnsSinceLastProfileQuestion: 0,
    }
  }

  /**
   * Update the conversation state after a turn.
   */
  updateConversationState(
    currentState: TopicConversationState,
    newTopic?: string,
    newQuestion?: string,
    isProfileQuestion: boolean = false
  ): TopicConversationState {
    let {
      currentTopic,
      turnCount,
      topicHistory,
      turnsSinceLastProfileQuestion,
    } = currentState

    if (newTopic && newTopic !== currentTopic) {
      // Starting a new topic
      if (currentTopic) {
        topicHistory.push(currentTopic)
      }
      currentTopic = newTopic
      turnCount = 1
      turnsSinceLastProfileQuestion = isProfileQuestion ? 0 : 1
    } else {
      // Continuing the same topic
      turnCount++
      if (isProfileQuestion) {
        turnsSinceLastProfileQuestion = 0
      } else {
        turnsSinceLastProfileQuestion = (turnsSinceLastProfileQuestion ?? 0) + 1
      }
    }

    return {
      currentTopic,
      turnCount,
      topicHistory,
      lastQuestion: newQuestion ?? null,
      turnsSinceLastProfileQuestion,
    }
  }

  /**
   * Continue the current topic with a follow-up question.
   */
  async continueCurrentTopic(
    state: TopicConversationState,
    lastUserResponse: string,
    userProfile?: any
  ): Promise<string> {
    console.log('💬 Continuing topic:', state.currentTopic)

    try {
      const response = await callAI([
        {
          role: 'system',
          content: `You are Emi, a friendly mama-san continuing a conversation with a client.

Current Topic: ${state.currentTopic}
Conversation History (summary): The user has shown interest in this topic for ${state.turnCount} turns. Your goal is to keep the conversation flowing naturally.

Your Task: Based on the user's last response, ask a relevant, open-ended follow-up question. Keep the conversation engaging and on-topic.

Style:
- Casual, lowercase, 1-2 sentences.
- No emojis.
- Sound genuinely curious.
- Do not change the topic.

User's last response: "${lastUserResponse}"

Generate your follow-up question now.`,
        },
      ])

      if (!response || !response.trim()) {
        throw new Error('Empty response from AI')
      }
      return response.trim()
    } catch (error) {
      console.error('Error continuing topic:', error)
      return 'oh really? tell me more about that!' // Fallback
    }
  }

  /**
   * Generate a new conversation topic and the opening question.
   */
  async generateNewTopic(
    state: TopicConversationState,
    userProfile?: any
  ): Promise<{
    topic: string
    question: string
  }> {
    try {
      console.log('🎨 TopicStarter - Generating new topic')

      const response = await callAI([
        {
          role: 'system',
          content: `You are Emi, a mama-san skilled at starting engaging conversations.

Your Task: Generate a new, interesting conversation topic and a natural opening question for a client. The topic should be based on their profile but feel spontaneous.

Client Profile Summary: ${this.summarizeUserProfile(userProfile)}
${state.topicHistory.length > 0 ? `Topics already discussed: ${state.topicHistory.join(', ')}.` : 'No topics discussed yet.'}

Style Requirements:
- The topic should be a short phrase (e.g., "favorite travel memories", "dream jobs").
- The question should be casual, open-ended, and inviting.
- Your entire output must be a single, valid JSON object, with no other text before or after.

JSON Format:
{
  "topic": "string",
  "question": "string"
}

Generate the JSON object now.`,
        },
      ])

      const responseJson = JSON.parse(response || '{}')
      if (!responseJson.topic || !responseJson.question) {
        throw new Error('Invalid JSON response from AI')
      }
      return responseJson
    } catch (error) {
      console.error('Error generating new topic:', error)
      return this.getFallbackTopic()
    }
  }

  /**
   * Generate 3 short response suggestions for a given question or topic
   */
  async generateResponseSuggestions(
    question: string,
    topic?: string,
    userProfile?: any
  ): Promise<string[]> {
    console.log('💭 TopicStarter - Generating response suggestions for:', {
      question: question.substring(0, 50) + '...',
      topic,
      hasProfile: !!userProfile,
    })

    try {
      const systemPrompt = `You are a helpful assistant generating short, natural response suggestions for a user who is chatting with Emi, a friendly mama-san.

Current question/topic context: "${question}"
${topic ? `Topic being discussed: ${topic}` : ''}
${userProfile ? `User profile context: ${this.summarizeUserProfile(userProfile)}` : 'No user profile available.'}

Your task: Generate exactly 3 short, natural response options that a user might want to say in reply to this question. Each response should be:
- 2-6 words maximum
- Natural and conversational
- Different from each other (variety in tone/approach)
- Appropriate for casual conversation with a friendly AI

Examples of good responses:
- "love that idea!"
- "not really my thing"
- "sounds interesting"
- "tell me more"
- "that's perfect"
- "something different maybe"

Return ONLY a valid JSON array of exactly 3 strings, nothing else.

Format: ["response1", "response2", "response3"]`

      const response = await callAI([
        {
          role: 'system',
          content: systemPrompt,
        },
      ])

      // Parse the JSON response
      const suggestions = JSON.parse(response || '[]')

      if (Array.isArray(suggestions) && suggestions.length === 3) {
        console.log(
          '✅ TopicStarter - Generated response suggestions:',
          suggestions
        )
        return suggestions
      } else {
        throw new Error('Invalid response format from AI')
      }
    } catch (error) {
      console.error(
        '❌ TopicStarter - Error generating response suggestions:',
        error
      )

      // Return fallback suggestions
      const fallbacks = ['sounds good!', 'not really', 'tell me more']
      console.log('✅ TopicStarter - Using fallback suggestions:', fallbacks)
      return fallbacks
    }
  }

  private getFallbackTopic(): { topic: string; question: string } {
    const fallbacks = [
      {
        topic: 'recent fun',
        question: 'so what have you been up to for fun lately?',
      },
      {
        topic: 'hidden talents',
        question: 'do you have any secret talents or weird skills?',
      },
      {
        topic: 'favorite things',
        question: 'what is something you could talk about for hours?',
      },
    ]
    return fallbacks[Math.floor(Math.random() * fallbacks.length)]
  }

  /**
   * Summarize user profile for the AI prompt.
   */
  private summarizeUserProfile(userProfile?: any): string {
    if (!userProfile) {
      return 'No profile data available. Ask about general interests.'
    }

    const parts: string[] = []
    if (userProfile.profileData?.interests?.length > 0) {
      parts.push(
        `Interests: ${userProfile.profileData.interests.map((i: any) => i.category).join(', ')}`
      )
    }
    if (userProfile.datingProfile?.servicePreferences?.conversationTopics) {
      parts.push(
        `Likes to talk about: ${userProfile.datingProfile.servicePreferences.conversationTopics.join(', ')}`
      )
    }
    if (userProfile.profileData?.personality?.traits?.length > 0) {
      parts.push(
        `Personality seems: ${userProfile.profileData.personality.traits.map((t: any) => t.name).join(', ')}`
      )
    }

    if (parts.length === 0) {
      return 'Profile is mostly empty. Focus on broad, engaging topics.'
    }

    return parts.join('. ')
  }
}
