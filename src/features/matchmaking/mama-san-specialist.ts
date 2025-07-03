import { callAI } from '@/lib/ai-client'
import { MamaSanSessionState } from '@/types/matchmaking'

export interface MamaSanSpecialistConfig {
  personality?: 'emi'
  questionCount?: number
}

const DEFAULT_QUESTIONS = [
  'What kind of mood are you in today?',
  'Do you have a preferred type?',
  'What kind of conversation do you enjoy?',
  'Do you enjoy any particular service? (e.g., karaoke, games, deep talk, etc.)?',
  'Would you like to relax, or are you in the mood for something lively?',
  'What kind of person would you like to spend time with?',
]

const EMI_STYLE = {
  intro:
    "hi! welcome to the lounge. i'm emi, your matchmaker for today. let's find you the perfect host!",
  style: {
    voice: 'casual, playful, and chaotically wholesome',
    approach:
      'i want to get to know your vibe so i can recommend the best hosts for you',
    rules: [
      'keep it short, sweet, lowercase, and emoji-free',
      'never sound like a bot',
      'always be encouraging and a little bit chaotic',
      'never ask more than one question at a time',
      'never explain why you are asking',
    ],
  },
}

export class MamaSanSpecialist {
  private config: MamaSanSpecialistConfig
  private questions: string[]

  constructor(
    config: MamaSanSpecialistConfig = {
      personality: 'emi',
      questionCount: DEFAULT_QUESTIONS.length,
    }
  ) {
    this.config = config
    this.questions = DEFAULT_QUESTIONS.slice(
      0,
      config.questionCount || DEFAULT_QUESTIONS.length
    )
  }

  getIntro(): string {
    return EMI_STYLE.intro
  }

  getCurrentQuestion(state: MamaSanSessionState): string {
    return this.questions[state.currentQuestion] || ''
  }

  isSessionComplete(state: MamaSanSessionState): boolean {
    return state.currentQuestion >= this.questions.length
  }

  async analyzeResponse(
    question: string,
    userResponse: string
  ): Promise<{ answered: boolean; reason?: string }> {
    // Use AI to check if the user's response answers the question
    const prompt = `You are Emi, a playful, modern-day mama-san. Did the following user response answer the question?\n\nQuestion: ${question}\nUser Response: ${userResponse}\n\nReply with ONLY 'yes' or 'no' and a very short reason if 'no'.`
    const aiReply = await callAI([
      {
        role: 'system',
        content: 'You are Emi, a playful, modern-day mama-san.',
      },
      { role: 'user', content: prompt },
    ])
    const yesNo = aiReply.trim().toLowerCase()
    if (yesNo.startsWith('yes')) return { answered: true }
    return { answered: false, reason: aiReply }
  }

  buildSearchQuery(state: MamaSanSessionState): string {
    // Build a search query string based on the user's answers
    // (Widget will use this to call the host search API)
    const queryParts = this.questions.map((q, i) => {
      const a = state.answers[i] || ''
      return `${q} ${a}`.trim()
    })
    return queryParts.join(' | ')
  }

  getRecommendationPrompt(state: MamaSanSessionState): string {
    // After all questions, recommend hosts based on answers
    return `based on your answers, i'm going to recommend some hosts who match your vibe! sit tight while i find the best matches for you.`
  }
}
