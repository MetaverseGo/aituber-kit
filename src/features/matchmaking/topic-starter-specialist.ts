import { callAI } from '@/lib/ai-client'
import {
  AIResponseProcessor,
  createResponseProcessor,
} from '@/lib/ai-response-processor'

export interface TopicStarterConfig {
  personality?: 'emi'
  userId?: string
  minTurnsPerTopic?: number
}

export interface TopicConversationState {
  currentTopic: string | null
  turnCount: number // Number of turns on current topic
  topicHistory: Array<{
    topic: string
    turns: number
    startTime: Date
    endTime?: Date
  }>
  lastQuestion: string | null
}

export class TopicStarterSpecialist {
  private config: TopicStarterConfig
  private responseProcessor: AIResponseProcessor | null = null

  constructor(
    config: TopicStarterConfig = {
      personality: 'emi',
      minTurnsPerTopic: 3,
    }
  ) {
    console.log('🎨 TopicStarter - Constructor START')
    console.log('🎨 TopicStarter - Config received:', config)

    this.config = config

    // Initialize response processor if userId is provided
    if (config.userId) {
      console.log(
        '🎨 TopicStarter - UserId provided, creating response processor...'
      )
      try {
        this.responseProcessor = createResponseProcessor({
          source: 'mamasan', // Use same source as mamasan for consistency
          userId: config.userId,
          enableErrorPersistence: true,
          enableProfileUpdates: true,
          logLevel: 'info',
        })
        console.log('🎨 TopicStarter - Response processor created successfully')
      } catch (error) {
        console.error(
          '🎨 TopicStarter - ERROR creating response processor:',
          error
        )
        this.responseProcessor = null
      }
    }

    console.log('🎨 TopicStarter - Constructor completed')
  }

  /**
   * Set the user ID to enable validation and persistence features
   */
  setUserId(userId: string): void {
    this.config.userId = userId

    try {
      this.responseProcessor = createResponseProcessor({
        source: 'mamasan',
        userId,
        enableErrorPersistence: true,
        enableProfileUpdates: true,
        logLevel: 'info',
      })
    } catch (error) {
      console.error(
        '🎨 TopicStarter - ERROR creating response processor:',
        error
      )
      this.responseProcessor = null
    }
  }

  /**
   * Generate a new conversation topic based on user profile and interests
   */
  async generateNewTopic(userProfile?: any): Promise<{
    topic: string
    question: string
  }> {
    console.log('🎨 TopicStarter - Generating new topic...')
    console.log('  User profile available:', !!userProfile)

    const systemPrompt = this.getTopicGenerationSystemPrompt()
    const userPrompt = this.buildTopicGenerationPrompt(userProfile)

    try {
      const aiResponse = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      console.log('🎨 TopicStarter - AI response:', aiResponse)

      // Parse the response to extract topic and question
      const lines = aiResponse.split('\n').filter((line) => line.trim())
      let topic = 'general conversation'
      let question = aiResponse.trim()

      // Try to extract topic if formatted properly
      for (const line of lines) {
        if (line.toLowerCase().includes('topic:')) {
          topic = line.replace(/topic:/i, '').trim()
        } else if (line.toLowerCase().includes('question:')) {
          question = line.replace(/question:/i, '').trim()
        }
      }

      // If no structured format, use the whole response as question
      if (!question || question === aiResponse.trim()) {
        question = aiResponse.trim()
        // Try to infer topic from the question
        topic = this.inferTopicFromQuestion(question)
      }

      console.log('🎨 TopicStarter - Generated topic:', topic)
      console.log('🎨 TopicStarter - Generated question:', question)

      return { topic, question }
    } catch (error) {
      console.error('🎨 TopicStarter - Error generating topic:', error)

      // Fallback topics
      const fallbackTopics = [
        {
          topic: 'entertainment preferences',
          question: 'what kind of entertainment gets you excited these days?',
        },
        {
          topic: 'lifestyle interests',
          question: 'what does your ideal day off look like?',
        },
        {
          topic: 'social preferences',
          question: 'what kind of social vibe do you prefer?',
        },
        {
          topic: 'personal interests',
          question: 'what have you been really into lately?',
        },
      ]

      const selected =
        fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)]
      return selected
    }
  }

  /**
   * Continue conversation on current topic
   */
  async continueCurrentTopic(
    conversationState: TopicConversationState,
    userResponse: string,
    userProfile?: any
  ): Promise<string> {
    console.log(
      '🎨 TopicStarter - Continuing topic:',
      conversationState.currentTopic
    )
    console.log('  Turn count:', conversationState.turnCount)
    console.log('  User response:', userResponse.substring(0, 50) + '...')

    const systemPrompt =
      this.getTopicContinuationSystemPrompt(conversationState)
    const userPrompt = this.buildTopicContinuationPrompt(
      conversationState,
      userResponse,
      userProfile
    )

    try {
      const aiResponse = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      console.log('🎨 TopicStarter - Topic continuation response:', aiResponse)
      return aiResponse.trim()
    } catch (error) {
      console.error('🎨 TopicStarter - Error continuing topic:', error)

      // Fallback responses
      const fallbacks = [
        `that's really interesting! tell me more about that`,
        `oh i love that! what draws you to it?`,
        `that sounds amazing! how did you get into that?`,
        `ooh that's so cool! what's your favorite part about it?`,
      ]

      return fallbacks[Math.floor(Math.random() * fallbacks.length)]
    }
  }

  /**
   * Check if it's time to start a new topic
   */
  shouldStartNewTopic(conversationState: TopicConversationState): boolean {
    const minTurns = this.config.minTurnsPerTopic || 3
    const hasCurrentTopic = !!conversationState.currentTopic
    const hasEnoughTurns = conversationState.turnCount >= minTurns

    console.log('🎨 TopicStarter - Should start new topic check:')
    console.log('  Has current topic:', hasCurrentTopic)
    console.log('  Turn count:', conversationState.turnCount)
    console.log('  Min turns required:', minTurns)
    console.log('  Has enough turns:', hasEnoughTurns)

    // Start new topic if:
    // 1. No current topic, OR
    // 2. Enough turns completed (with some randomness to avoid being too predictable)
    if (!hasCurrentTopic) {
      console.log('  Decision: START NEW (no current topic)')
      return true
    }

    if (hasEnoughTurns) {
      // Add some randomness - 30% chance to continue even after min turns
      const shouldContinue = Math.random() < 0.3
      console.log('  Random continuation chance:', shouldContinue)
      console.log(
        '  Decision:',
        shouldContinue ? 'CONTINUE CURRENT' : 'START NEW'
      )
      return !shouldContinue
    }

    console.log('  Decision: CONTINUE CURRENT (not enough turns)')
    return false
  }

  /**
   * Update conversation state after a turn
   */
  updateConversationState(
    conversationState: TopicConversationState,
    newTopic?: string,
    newQuestion?: string
  ): TopicConversationState {
    const updatedState = { ...conversationState }

    if (newTopic && newTopic !== conversationState.currentTopic) {
      // Starting a new topic
      if (conversationState.currentTopic) {
        // Close previous topic
        const previousTopic = updatedState.topicHistory.find(
          (t) => t.topic === conversationState.currentTopic && !t.endTime
        )
        if (previousTopic) {
          previousTopic.endTime = new Date()
          previousTopic.turns = conversationState.turnCount
        }
      }

      // Start new topic
      updatedState.currentTopic = newTopic
      updatedState.turnCount = 1
      updatedState.topicHistory.push({
        topic: newTopic,
        turns: 0,
        startTime: new Date(),
      })

      console.log('🎨 TopicStarter - Started new topic:', newTopic)
    } else {
      // Continuing current topic
      updatedState.turnCount++
      console.log(
        '🎨 TopicStarter - Continued topic, turn count:',
        updatedState.turnCount
      )
    }

    if (newQuestion) {
      updatedState.lastQuestion = newQuestion
    }

    return updatedState
  }

  /**
   * Get system prompt for topic generation
   */
  private getTopicGenerationSystemPrompt(): string {
    if (this.config.personality === 'emi') {
      return `You are Emi, the chaotic-cute mama-san who loves getting to know her clients through fun conversations!

TASK: Generate an engaging conversation topic and opening question.

STYLE:
- Keep it casual and friendly (2-3 sentences max)
- No emojis or special characters
- Sound genuinely curious and interested
- Make it feel natural, not like an interview

TOPIC CATEGORIES to choose from:
- Entertainment (movies, music, games, shows)
- Lifestyle (daily routines, habits, preferences) 
- Social life (friends, relationships, social situations)
- Hobbies & interests (what they're into lately)
- Personal growth (goals, aspirations, changes)
- Fun hypotheticals (what-if scenarios)
- Memories & experiences (favorite moments, travel)

RESPONSE FORMAT:
Just provide the conversational question. Keep it natural and engaging!

Examples:
- "what kind of movies have you been obsessed with lately?"
- "what does your perfect weekend look like?"
- "what's something you've been wanting to try but haven't yet?"
- "what kind of music puts you in the best mood?"

Remember: Be natural, curious, and fun!`
    }

    return `Generate an engaging conversation topic and opening question. Keep it casual and friendly.`
  }

  /**
   * Get system prompt for topic continuation
   */
  private getTopicContinuationSystemPrompt(
    conversationState: TopicConversationState
  ): string {
    const currentTopic = conversationState.currentTopic || 'conversation'
    const turnCount = conversationState.turnCount

    if (this.config.personality === 'emi') {
      return `You are Emi, the chaotic-cute mama-san continuing a conversation about ${currentTopic}. This is turn ${turnCount} on this topic.

CURRENT TOPIC: ${currentTopic}
TURN COUNT: ${turnCount}

YOUR GOAL: Keep the conversation flowing naturally about this topic. Show genuine interest and curiosity.

CONVERSATION TECHNIQUES:
- Ask follow-up questions about what they shared
- Share relatable reactions or comments
- Dig deeper into interesting details
- Make connections to related aspects of the topic
- Show enthusiasm for their interests

STYLE:
- Keep responses short (2-3 sentences max)
- No emojis or special characters  
- Sound natural and engaged
- Be encouraging and positive

EXAMPLES of good follow-ups:
- "oh that sounds amazing! what got you into that?"
- "i love that! what's your favorite part about it?"
- "that's so interesting! how long have you been doing that?"
- "ooh tell me more about that - what makes it special for you?"

Remember: Stay curious and keep them talking about ${currentTopic}!`
    }

    return `Continue the conversation about ${currentTopic}. Show interest and ask follow-up questions.`
  }

  /**
   * Build prompt for topic generation
   */
  private buildTopicGenerationPrompt(userProfile?: any): string {
    let prompt = 'Generate an engaging conversation topic and question.'

    if (userProfile) {
      // Extract some interests from profile to guide topic selection
      const interests: string[] = []

      if (userProfile.datingProfile?.servicePreferences?.conversationTopics) {
        interests.push(
          ...userProfile.datingProfile.servicePreferences.conversationTopics
        )
      }

      if (userProfile.profileData?.interests) {
        userProfile.profileData.interests.forEach((interest: any) => {
          if (interest.category) interests.push(interest.category)
          if (interest.items) {
            interest.items.forEach((item: any) => {
              if (item.name) interests.push(item.name)
            })
          }
        })
      }

      if (interests.length > 0) {
        prompt += `\n\nUser has shown interest in: ${interests.slice(0, 5).join(', ')}`
        prompt +=
          '\nUse this to inspire the topic, but feel free to explore new areas too.'
      }
    }

    return prompt
  }

  /**
   * Build prompt for topic continuation
   */
  private buildTopicContinuationPrompt(
    conversationState: TopicConversationState,
    userResponse: string,
    userProfile?: any
  ): string {
    const topic = conversationState.currentTopic || 'conversation'

    let prompt = `Topic: ${topic}\n`
    prompt += `Turn: ${conversationState.turnCount}\n`
    prompt += `User just said: "${userResponse}"\n\n`
    prompt += `Continue the conversation about ${topic}. Show interest in what they shared and ask a thoughtful follow-up question.`

    return prompt
  }

  /**
   * Infer topic from generated question
   */
  private inferTopicFromQuestion(question: string): string {
    const lowerQuestion = question.toLowerCase()

    if (
      lowerQuestion.includes('movie') ||
      lowerQuestion.includes('show') ||
      lowerQuestion.includes('watch')
    ) {
      return 'entertainment preferences'
    }
    if (
      lowerQuestion.includes('music') ||
      lowerQuestion.includes('song') ||
      lowerQuestion.includes('artist')
    ) {
      return 'music preferences'
    }
    if (
      lowerQuestion.includes('game') ||
      lowerQuestion.includes('gaming') ||
      lowerQuestion.includes('play')
    ) {
      return 'gaming interests'
    }
    if (
      lowerQuestion.includes('weekend') ||
      lowerQuestion.includes('day off') ||
      lowerQuestion.includes('free time')
    ) {
      return 'lifestyle preferences'
    }
    if (
      lowerQuestion.includes('hobby') ||
      lowerQuestion.includes('interest') ||
      lowerQuestion.includes('into')
    ) {
      return 'personal interests'
    }
    if (
      lowerQuestion.includes('travel') ||
      lowerQuestion.includes('place') ||
      lowerQuestion.includes('visit')
    ) {
      return 'travel and places'
    }

    return 'general conversation'
  }

  /**
   * Create initial conversation state
   */
  createInitialState(): TopicConversationState {
    return {
      currentTopic: null,
      turnCount: 0,
      topicHistory: [],
      lastQuestion: null,
    }
  }
}
