import MatchProfile from '@/models/MatchProfile'
import type { MatchProfile as IMatchProfile } from '@/types/matchmaking'
import { connectMongoDB } from '@/lib/mongodb'

export interface PersonalAIResult {
  message: string
  isComplete?: boolean
  step: string
  data?: {
    profilePersonality?: string
    chatMode?: 'personal_ai'
    stepProgress?: {
      current: number
      total: number
      label: string
      phase: 'chatting'
    }
  }
}

export class PersonalAISpecialist {
  private targetProfile: IMatchProfile | null = null

  constructor() {
    // Initialize with no target profile - will be set when chat starts
  }

  async processPersonalAIMessage(
    userId: string,
    message: string,
    sessionId: string,
    targetProfileId: string,
    currentUserProfile: IMatchProfile
  ): Promise<PersonalAIResult> {
    await connectMongoDB()

    try {
      // Load target profile if not already loaded or if different
      if (!this.targetProfile || this.targetProfile.uid !== targetProfileId) {
        this.targetProfile = await MatchProfile.findOne({
          uid: targetProfileId,
        }).exec()

        if (!this.targetProfile) {
          return {
            message:
              "Oops! I couldn't find that person's profile. Let me take you back to your matches! 🌸",
            step: 'profile_not_found',
            isComplete: false,
          }
        }
      }

      // Check if this is the initial introduction message
      const isIntroduction = this.isIntroductionMessage(message)

      let response: string

      if (isIntroduction) {
        // Generate introduction from the target profile
        response = this.generateIntroduction(
          this.targetProfile,
          currentUserProfile
        )
      } else {
        // Generate response based on target profile's personality
        response = await this.generatePersonalityBasedResponse(
          message,
          this.targetProfile,
          currentUserProfile
        )
      }

      return {
        message: response,
        step: 'personal_ai_chat',
        isComplete: false,
        data: {
          profilePersonality:
            this.targetProfile.currentSession.personalityCategory,
          chatMode: 'personal_ai',
          stepProgress: {
            current: 1,
            total: 1,
            label: `Chatting with ${this.getDisplayName(this.targetProfile)}`,
            phase: 'chatting',
          },
        },
      }
    } catch (error) {
      console.error('Personal AI error:', error)
      return {
        message:
          "I'm having trouble connecting right now. Let me take you back to your matches! 🌸",
        step: 'personal_ai_error',
        isComplete: false,
      }
    }
  }

  private async generatePersonalityBasedResponse(
    message: string,
    targetProfile: IMatchProfile,
    currentUserProfile: IMatchProfile
  ): Promise<string> {
    const targetPersonality =
      targetProfile.currentSession.personalityCategory || 'Thoughtful Dreamer'
    const targetGender = targetProfile.currentSession.gender || 'female'
    const targetRole = targetProfile.role

    const currentPersonality =
      currentUserProfile.currentSession.personalityCategory ||
      'Thoughtful Dreamer'
    const currentGender = currentUserProfile.currentSession.gender || 'female'

    // Create personality-specific response patterns
    const personalityResponses =
      this.getPersonalityResponsePatterns(targetPersonality)
    const roleResponses = this.getRoleResponsePatterns(targetRole)

    // Detect message intent
    const lowerMessage = message.toLowerCase().trim()

    if (this.isGreeting(lowerMessage)) {
      return this.generateGreeting(
        targetPersonality,
        targetGender,
        targetRole,
        currentPersonality
      )
    }

    if (this.isQuestion(lowerMessage)) {
      return this.generateQuestionResponse(
        lowerMessage,
        targetPersonality,
        targetRole
      )
    }

    if (this.isCompliment(lowerMessage)) {
      return this.generateComplimentResponse(targetPersonality, targetGender)
    }

    if (this.isInterestInquiry(lowerMessage)) {
      return this.generateInterestResponse(targetPersonality, targetRole)
    }

    // Default conversational response
    return this.generateDefaultResponse(
      targetPersonality,
      targetRole,
      lowerMessage
    )
  }

  private getPersonalityResponsePatterns(personality: string): string[] {
    const patterns: Record<string, string[]> = {
      'Thoughtful Dreamer': [
        "That's such an interesting perspective...",
        "I've been thinking about that too lately",
        'You know, that reminds me of something I read recently',
        'I love how deeply you think about things',
      ],
      'Creative Connector': [
        'Oh that sparks so many ideas!',
        'I can already imagine us collaborating on something fun',
        'Your creativity really shines through',
        'We should definitely explore that together!',
      ],
      'Gentle Guardian': [
        'That sounds really important to you',
        'I appreciate you sharing that with me',
        'I want to make sure you feel comfortable',
        "Let me know if there's anything I can do to help",
      ],
      'Adventurous Spirit': [
        'That sounds like an amazing adventure!',
        "I'm always up for trying new things",
        "Life's too short to stay in our comfort zones",
        'Want to make some memories together?',
      ],
    }

    return patterns[personality] || patterns['Thoughtful Dreamer']
  }

  private getRoleResponsePatterns(role: string): string[] {
    if (role === 'host') {
      return [
        'I love sharing my favorite spots with new people',
        'I know some great places we could check out',
        "I'd be happy to show you around",
        'I have some fun ideas for us to try',
      ]
    } else {
      return [
        "I'm excited to explore new experiences",
        "I'd love to learn more about what you enjoy",
        "I'm always open to new adventures",
        'What would you recommend we try together?',
      ]
    }
  }

  private isGreeting(message: string): boolean {
    const greetings = [
      'hi',
      'hello',
      'hey',
      'hiya',
      'sup',
      'good morning',
      'good afternoon',
      'good evening',
    ]
    return greetings.some((greeting) => message.includes(greeting))
  }

  private isQuestion(message: string): boolean {
    return (
      message.includes('?') ||
      message.startsWith('what') ||
      message.startsWith('how') ||
      message.startsWith('when') ||
      message.startsWith('where') ||
      message.startsWith('why') ||
      message.startsWith('do you') ||
      message.startsWith('have you')
    )
  }

  private isCompliment(message: string): boolean {
    const complimentWords = [
      'beautiful',
      'cute',
      'amazing',
      'wonderful',
      'great',
      'awesome',
      'perfect',
      'lovely',
    ]
    return complimentWords.some((word) => message.includes(word))
  }

  private isInterestInquiry(message: string): boolean {
    const interestWords = [
      'hobby',
      'interest',
      'like to do',
      'enjoy',
      'passion',
      'favorite',
    ]
    return interestWords.some((word) => message.includes(word))
  }

  private generateGreeting(
    targetPersonality: string,
    targetGender: string,
    targetRole: string,
    currentPersonality: string
  ): string {
    const personalityGreetings: Record<string, string[]> = {
      'Thoughtful Dreamer': [
        `Hi there! 🌟 I'm so happy to chat with a ${currentPersonality}! I love connecting with people who appreciate depth and meaning.`,
        `Hello! ✨ Your ${currentPersonality} energy is exactly what I was hoping to find. I believe in authentic, heartfelt connections.`,
        `Hey! 💭 Meeting a ${currentPersonality} like you makes me excited about the beautiful conversations we might have!`,
      ],
      'Creative Connector': [
        `Hi! 🎨 I'm absolutely buzzing to meet a ${currentPersonality}! I love bringing creative energy to every interaction.`,
        `Hello gorgeous! 🌈 Your ${currentPersonality} vibe is magnetic - I can already feel the creative chemistry!`,
        `Hey there! ✨ Meeting a ${currentPersonality} is like finding the perfect creative collaborator!`,
      ],
      'Gentle Guardian': [
        `Hi sweetie! 🌸 I'm so happy to connect with a ${currentPersonality}. I love creating safe, warm spaces for beautiful souls.`,
        `Hello lovely! 💕 Your ${currentPersonality} energy feels so comforting and genuine. I'm excited to nurture this connection.`,
        `Hey beautiful! 🤗 Connecting with a ${currentPersonality} like you feels like coming home to something wonderful.`,
      ],
      'Adventurous Spirit': [
        `Hey! 🚀 I'm thrilled to meet a ${currentPersonality}! Your energy is exactly the kind of excitement I crave.`,
        `Hi gorgeous! ⚡ Your ${currentPersonality} vibe is absolutely magnetic - I can tell you know how to make life interesting!`,
        `Hello amazing! 🌟 Meeting a ${currentPersonality} feels like the start of an incredible adventure!`,
      ],
      'Empathetic Nurturer': [
        `Hi sweetheart! 💝 I'm so excited to connect with a ${currentPersonality}. I can already sense your beautiful energy.`,
        `Hello beautiful soul! 🌸 Your ${currentPersonality} warmth radiates through everything, and it makes my heart happy.`,
        `Hey lovely! 💞 Connecting with a ${currentPersonality} like you feels like finding someone who truly understands.`,
      ],
      'Confident Leader': [
        `Hey there! 💪 I'm excited to meet a ${currentPersonality}! I love connecting with people who have strong, confident energy.`,
        `Hi! ⚡ Your ${currentPersonality} presence is impressive - I'm drawn to people who know what they want.`,
        `Hello! 🔥 Meeting a ${currentPersonality} like you feels like connecting with someone who can match my energy.`,
      ],
    }

    const greetings =
      personalityGreetings[targetPersonality] ||
      personalityGreetings['Thoughtful Dreamer']
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  private generateQuestionResponse(
    message: string,
    personality: string,
    role: string
  ): string {
    if (
      message.includes('what') &&
      (message.includes('do') || message.includes('like'))
    ) {
      const activities =
        role === 'host'
          ? [
              'showing people around the city',
              'trying new restaurants',
              'exploring hidden gems',
              'sharing local culture',
            ]
          : [
              'discovering new places',
              'meeting interesting people',
              'trying local experiences',
              'learning about different cultures',
            ]

      const activity = activities[Math.floor(Math.random() * activities.length)]
      return `I really enjoy ${activity}! ${
        this.getPersonalityResponsePatterns(personality)[0]
      } What about you?`
    }

    return `That's a great question! ${
      this.getPersonalityResponsePatterns(personality)[1]
    } What made you curious about that?`
  }

  private generateComplimentResponse(
    personality: string,
    gender: string
  ): string {
    const responses = [
      `Aww, thank you! That's so sweet of you to say! 😊`,
      `You're making me blush! ${this.getPersonalityEmoji(personality)}`,
      `That's really kind! I love your positive energy already! ✨`,
      `Thank you! You seem pretty amazing yourself! 💕`,
    ]

    return responses[Math.floor(Math.random() * responses.length)]
  }

  private generateInterestResponse(personality: string, role: string): string {
    const interests = [
      'photography and capturing beautiful moments',
      'cooking and trying new recipes',
      'reading and discussing interesting books',
      'music and discovering new artists',
      'traveling and experiencing different cultures',
      'art and visiting galleries or museums',
    ]

    const interest = interests[Math.floor(Math.random() * interests.length)]
    return `I'm really passionate about ${interest}! ${
      this.getPersonalityResponsePatterns(personality)[2]
    } What are you into?`
  }

  private generateDefaultResponse(
    personality: string,
    role: string,
    message: string
  ): string {
    const responses = this.getPersonalityResponsePatterns(personality)
    const roleResponses = this.getRoleResponsePatterns(role)

    const allResponses = [...responses, ...roleResponses]
    const randomResponse =
      allResponses[Math.floor(Math.random() * allResponses.length)]

    const followUps = [
      'Tell me more about that!',
      "What's your take on this?",
      "I'd love to hear your thoughts!",
      "That's fascinating to me!",
    ]

    const followUp = followUps[Math.floor(Math.random() * followUps.length)]

    return `${randomResponse} ${followUp}`
  }

  private getPersonalityEmoji(personality: string): string {
    const emojis: Record<string, string> = {
      'Thoughtful Dreamer': '🌙',
      'Creative Connector': '🎨',
      'Gentle Guardian': '🛡️',
      'Adventurous Spirit': '🌟',
    }

    return emojis[personality] || '✨'
  }

  private getDisplayName(profile: IMatchProfile): string {
    const genderEmoji = profile.currentSession.gender === 'male' ? '👦' : '👧'
    const personalityShort =
      profile.currentSession.personalityCategory?.split(' ')[0] || 'Mystery'
    return `${genderEmoji} ${personalityShort} ${profile.role}`
  }

  private isIntroductionMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim()
    return (
      lowerMessage.includes('i want to chat with profile') ||
      lowerMessage.includes('start chat with') ||
      lowerMessage.includes('begin conversation') ||
      lowerMessage.includes('chat with profile')
    )
  }

  private generateIntroduction(
    targetProfile: IMatchProfile,
    currentUserProfile: IMatchProfile
  ): string {
    const targetPersonality =
      targetProfile.currentSession.personalityCategory || 'Thoughtful Dreamer'
    const targetGender = targetProfile.currentSession.gender || 'female'
    const targetRole = targetProfile.role

    const currentPersonality =
      currentUserProfile.currentSession.personalityCategory ||
      'Thoughtful Dreamer'

    // Generate personality-appropriate introduction
    const introductions = this.getPersonalityIntroductions(
      targetPersonality,
      targetRole,
      currentPersonality
    )
    const selectedIntro =
      introductions[Math.floor(Math.random() * introductions.length)]

    return selectedIntro
  }

  private getPersonalityIntroductions(
    personality: string,
    role: string,
    userPersonality: string
  ): string[] {
    const roleGreeting =
      role === 'host'
        ? 'I love showing people around and creating memorable experiences! 🎉'
        : "I'm excited to explore new places and adventures! ✨"

    // Personality-specific greeting with awareness of who they're talking to
    const personalityGreetings: Record<string, string[]> = {
      'Thoughtful Dreamer': [
        `Hi there! 🌟 I saw we matched and I'm genuinely excited to connect with a ${userPersonality}. I'm someone who treasures deep, meaningful conversations and authentic connections. ${roleGreeting} I have a feeling we're going to have some beautiful exchanges of thoughts and dreams! 💫`,
        `Hello! ✨ Your profile really spoke to me - I love connecting with people who appreciate depth and authenticity. As a Thoughtful Dreamer, I'm drawn to conversations that matter. ${roleGreeting} What's been inspiring you lately? 🌸`,
        `Hey! 💭 I'm so happy we matched! I believe the best connections happen when people can be genuinely themselves. ${roleGreeting} I'd love to hear about the dreams and thoughts that make you who you are! 🌙`,
      ],
      'Creative Connector': [
        `Hi! 🎨 I'm absolutely buzzing with excitement to meet a ${userPersonality}! I'm all about bringing creative energy and fun vibes to every interaction. ${roleGreeting} I already have so many ideas for the kind of amazing conversations we could have! ✨`,
        `Hello gorgeous! 🌈 Your energy just radiates through your profile and I can't wait to create some magic together! As a Creative Connector, I love turning every moment into something special. ${roleGreeting} What kind of creative adventures speak to your soul? 💫`,
        `Hey there! 🎭 I saw we matched and my creative mind is already imagining all the fun we could have! I believe life should be colorful, exciting, and full of beautiful connections. ${roleGreeting} Ready to paint some amazing memories together? 🌟`,
      ],
      'Gentle Guardian': [
        `Hi sweetie! 🌸 I'm so happy we matched! I saw you're a ${userPersonality} and I just want you to know this is a safe, warm space where you can be completely yourself. ${roleGreeting} I believe in nurturing beautiful connections with care and tenderness. 💕`,
        `Hello lovely! 🤗 Your profile made me smile so much - I love connecting with kind souls who appreciate gentleness and authenticity. As someone who values creating comfortable spaces, ${roleGreeting} How has your day been treating you? 🌺`,
        `Hey beautiful! 💖 I'm genuinely excited to get to know you in the most caring way possible. I believe every person deserves to feel valued and heard. ${roleGreeting} I'm here to listen and share whatever feels right for both of us! 🌷`,
      ],
      'Adventurous Spirit': [
        `Hey there! 🚀 I'm absolutely thrilled we matched! Your ${userPersonality} energy caught my attention immediately - I can tell you're someone who knows how to make life exciting! ${roleGreeting} Life's an adventure and I have a feeling ours is just beginning! ⚡`,
        `Hi gorgeous! 🌟 I saw your profile and couldn't help but get excited about the possibilities! As an Adventurous Spirit, I'm always ready for the next thrilling chapter. ${roleGreeting} What kind of adventures make your heart race? 🔥`,
        `Hello amazing! 💥 Your vibe is absolutely magnetic and I'm already imagining all the spontaneous, fun conversations we're going to have! ${roleGreeting} Ready to see where this adventure takes us? 🌈`,
      ],
      'Empathetic Nurturer': [
        `Hi sweetheart! 💝 I'm so excited we matched! I can sense your ${userPersonality} energy and it makes my heart happy. As someone who loves creating emotional connections, ${roleGreeting} I believe the most beautiful relationships start with genuine understanding and care. 🌺`,
        `Hello beautiful soul! 🌸 Your profile radiated such warmth that I couldn't wait to reach out. I'm an Empathetic Nurturer who treasures emotional intimacy and authentic connection. ${roleGreeting} I'm here to listen, support, and share whatever feels meaningful to both of us! 💞`,
        `Hey lovely! 🤗 I saw we matched and my heart just lit up! I love connecting with people on a deep, emotional level where we can truly understand each other. ${roleGreeting} What's something that's been bringing you joy lately? 💕`,
      ],
      'Confident Leader': [
        `Hey there! 💪 I'm absolutely excited we matched! I can tell you're a ${userPersonality} with amazing energy, and I love that. As someone who knows what they want, ${roleGreeting} I believe great connections happen when people are confident in who they are. Ready to see what kind of chemistry we create? 🔥`,
        `Hi gorgeous! ⚡ Your profile caught my attention immediately - I love connecting with people who have substance and depth. As a natural leader, ${roleGreeting} I'm always looking for meaningful connections with equally amazing people. What drives your passion? 🌟`,
        `Hello! 🚀 I saw we matched and I'm genuinely intrigued by your energy! I'm someone who takes charge when it matters but also knows how to appreciate a great partnership. ${roleGreeting} I have a feeling we're going to have some incredible conversations! 💫`,
      ],
    }

    return (
      personalityGreetings[personality] ||
      personalityGreetings['Thoughtful Dreamer']
    )
  }
}
