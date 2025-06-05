import { connectMongoDB } from './mongodb'
import MatchProfile from '@/models/MatchProfile'
import { Document } from 'mongoose'
import { KokologyAnalyst } from './ai-specialists/kokology-analyst'
import { PersonalityWriter } from './ai-specialists/personality-writer'
import { PersonalityProfiler } from './ai-specialists/personality-profiler'
import {
  MatchProfile as IMatchProfile,
  PersonalityCategory,
} from '@/types/matchmaking'

type MatchProfileDocument = IMatchProfile & Document

// Emi's analyzing messages (no AI inference required)
const ANALYZING_MESSAGES = [
  'ooo gimme a sec while I crunch all this data about u~ (｡♥‿♥｡) also quick q: are u a boy or girl? just for the perfect match!',
  'analyzing ur vibe rn... this is so fun! ✨ oh btw are u a boy or girl? helps me pick the perfect personality pic~',
  "omg ur answers are chef's kiss!! processing... (•̀ᴗ•́)و quick thing: boy or girl? need it for ur custom results!",
  'running my secret personality algorithms... hehe 🤓 real quick: are u a boy or girl? wanna make sure ur results are perfect!',
  'ok ok analyzing ur whole vibe... ur brain is fascinating bestie! oh and boy or girl? just for the aesthetic ✨',
  'brb computing ur personality profile... this is giving me SUCH good data! quick q: boy or girl? for ur personalized image~',
  'processing ur answers through my ultra-advanced vibes detector... 👀 also are u a boy or girl? need it for the final touch!',
  'hold up lemme decode all this personality data... ur so interesting!! btw boy or girl? makes ur results even more perfect ✨',
  'analyzing analyzing... ur answers are literally perfect specimens hehe 💅 quick: boy or girl? for maximum customization!',
  'running diagnostics on ur personality... this is so cool! oh also are u a boy or girl? helps with the visual vibes~',
  'crunching numbers on ur vibe... my algorithms are having a FIELD DAY!! quick thing: boy or girl? final detail I need!',
  "processing ur psychological profile... ur mind is chef's kiss tbh ✨ also boy or girl? for the perfect personality match pic!",
  "ok so I'm analyzing all ur responses and WOW... 🤯 real quick tho: are u a boy or girl? need it for ur custom aesthetic!",
  'running ur data through my personality matrix... this is giving main character energy! btw boy or girl? for personalization~',
  'analyzing ur whole energy signature... ur brain patterns are *incredible* bestie! quick q: boy or girl? for the finishing touch!',
  'processing... processing... ur answers are literally art!! 🎨 oh and are u a boy or girl? makes ur results extra perfect~',
  'decoding ur personality DNA rn... this is SO fascinating!! also quick: boy or girl? just need it for ur custom imagery ✨',
  'running advanced psychology algorithms... ur responses are giving me LIFE! 💫 btw boy or girl? for maximum aesthetic accuracy!',
  'analyzing ur vibe signature... honestly ur mind is amazing?? 🤓 oh also are u a boy or girl? final piece of the puzzle!',
  'crunching all this beautiful personality data... ur literally so unique!! quick thing: boy or girl? for the perfect visual match~',
]

export interface MatchmakingResult {
  message: string
  isComplete: boolean
  step: string
  data?: {
    personalityCategory?: string
    personalityImageUrl?: string
    profile?:
      | {
          category: PersonalityCategory
          confidence: number
          traits: string[]
          strengths: string[]
          role: 'host' | 'guest'
        }
      | {
          uid: string
          role: 'host' | 'guest'
          personalityCategory?: string
          completedAnalysis: boolean
        }
    expectingGender?: boolean
    showGenderButtons?: boolean
    disableTextInput?: boolean
    stepProgress?: {
      current: number
      total: number
      label: string
      phase: 'questions' | 'analyzing' | 'completed'
    }
  }
}

export interface MatchmakingConfig {
  kokologyPersonality?: 'empathetic' | 'analytical' | 'playful' | 'emi'
  writerPersonality?: 'empathetic' | 'insightful' | 'creative' | 'emi'
  profilerPersonality?: 'analytical' | 'intuitive' | 'systematic' | 'emi'
  questionCount?: number
}

export class MatchmakingOrchestrator {
  private kokologyAnalyst: KokologyAnalyst
  private personalityWriter: PersonalityWriter
  private personalityProfiler: PersonalityProfiler
  private config: MatchmakingConfig

  constructor(config: MatchmakingConfig = {}) {
    this.config = {
      kokologyPersonality: 'empathetic',
      writerPersonality: 'empathetic',
      profilerPersonality: 'analytical',
      questionCount: 5,
      ...config,
    }

    this.kokologyAnalyst = new KokologyAnalyst({
      personality: this.config.kokologyPersonality!,
      questionCount: this.config.questionCount!,
    })

    this.personalityWriter = new PersonalityWriter({
      personality: this.config.writerPersonality!,
      perspective: 'first-person',
    })

    this.personalityProfiler = new PersonalityProfiler({
      personality: this.config.profilerPersonality!,
    })
  }

  async processMessage(
    userId: string,
    message: string,
    sessionId: string
  ): Promise<MatchmakingResult> {
    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        await connectMongoDB()

        // Find or create user profile
        let profile = await MatchProfile.findOne({ uid: userId })

        if (!profile) {
          profile = await this.createNewProfile(userId, sessionId)
        }

        // At this point profile is guaranteed to exist
        const currentProfile = profile!

        console.log(
          `DEBUG: Current session status: ${currentProfile.currentSession.status}, step: ${currentProfile.currentSession.step}`
        )
        console.log(
          `DEBUG: Current sessionId: ${currentProfile.currentSession.sessionId}, incoming sessionId: ${sessionId}`
        )

        // Update session if needed
        if (currentProfile.currentSession.sessionId !== sessionId) {
          // Reset session state for new session
          console.log(
            `DEBUG: Session mismatch detected, resetting session from ${currentProfile.currentSession.sessionId} to ${sessionId}`
          )
          currentProfile.currentSession = {
            sessionId,
            status: 'idle',
            step: 0,
            missingFields: [],
            kokologyQuestions: [],
          }
          await currentProfile.save()
          console.log(
            `Reset session state for user ${userId}, new sessionId: ${sessionId}`
          )
        }

        console.log(
          `DEBUG: Routing to status: ${currentProfile.currentSession.status}`
        )

        // Route to appropriate handler based on current status
        switch (currentProfile.currentSession.status) {
          case 'idle':
          case 'kokology_analysis': {
            const questions =
              currentProfile.currentSession.kokologyQuestions || []
            // If there is an unanswered question, handle reloads defensively
            if (
              questions.length > 0 &&
              !questions[questions.length - 1].answer
            ) {
              // If the incoming message is empty (likely a reload), return no new message
              if (!message || message.trim() === '') {
                return {
                  message: '', // No new message
                  isComplete: false,
                  step: `kokology_question_${questions.length}`,
                  data: {
                    stepProgress: {
                      current: questions.length,
                      total: this.config.questionCount!,
                      label: `Question ${questions.length} of ${this.config.questionCount}`,
                      phase: 'questions',
                    },
                  },
                }
              }
              // If the incoming message is NOT empty, treat it as an answer and process it
              return await this.handleKokologyResponse(currentProfile, message)
            }
            // If all questions are answered, check if complete
            if (
              questions.length >= this.config.questionCount! &&
              questions[questions.length - 1]?.answer
            ) {
              return await this.generatePersonalitySummary(currentProfile)
            }
            // Otherwise, generate a new question as usual
            return await this.startKokologyAnalysis(currentProfile, message)
          }

          case 'personality_summary':
            return await this.generatePersonalitySummary(currentProfile)

          case 'awaiting_gender':
            return await this.handleGenderResponse(currentProfile, message)

          case 'personality_profiling':
            return await this.profilePersonality(currentProfile)

          case 'completed':
            return {
              message: `🌸 Your personality analysis is complete! You've been categorized as "${currentProfile.currentSession.personalityCategory}". Feel free to ask me anything else or let's start finding you some amazing connections!`,
              isComplete: true,
              step: 'completed',
              data: {
                personalityCategory:
                  currentProfile.currentSession.personalityCategory,
                personalityImageUrl: this.getPersonalityImageUrl(
                  currentProfile.currentSession.personalityCategory || '',
                  currentProfile.currentSession.gender
                ),
                profile: this.getPublicProfileData(currentProfile),
                stepProgress: {
                  current: this.config.questionCount!,
                  total: this.config.questionCount!,
                  label: 'Analysis complete!',
                  phase: 'completed',
                },
              },
            }

          default:
            return await this.handleError(
              currentProfile,
              'Unknown session status'
            )
        }
      } catch (error) {
        // Handle MongoDB VersionError (concurrent modification)
        if (
          (error as Error & { name?: string }).name === 'VersionError' &&
          retryCount < maxRetries - 1
        ) {
          retryCount++
          console.log(
            `Retry ${retryCount}/${maxRetries} due to VersionError for user ${userId}`
          )
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 100 * retryCount))
          continue
        }

        console.error('Error in matchmaking orchestrator:', error)
        return {
          message:
            'Oh no! I encountered an error. Let me reset and we can start fresh! 🌸',
          isComplete: false,
          step: 'error',
        }
      }
    }

    // If we get here, all retries failed
    return {
      message:
        'Oh no! I encountered an error. Let me reset and we can start fresh! 🌸',
      isComplete: false,
      step: 'error',
    }
  }

  private async createNewProfile(
    userId: string,
    sessionId: string
  ): Promise<InstanceType<typeof MatchProfile>> {
    const profile = new MatchProfile({
      uid: userId,
      role: 'guest', // Default to guest, can be updated later
      status: 'ONLINE',
      lastActive: new Date(),
      currentSession: {
        sessionId,
        status: 'idle',
        step: 0,
        missingFields: [],
        kokologyQuestions: [],
      },
    })

    await profile.save()
    return profile
  }

  private async startKokologyAnalysis(
    profile: MatchProfileDocument,
    message: string
  ): Promise<MatchmakingResult> {
    // Update status to kokology analysis
    profile.currentSession.status = 'kokology_analysis'
    profile.currentSession.step = 1

    // Generate first question
    const result = await this.kokologyAnalyst.askQuestion(1, [], message)

    // Store the first question in the array
    profile.currentSession.kokologyQuestions = [
      {
        id: 1,
        question: result.question,
        timestamp: new Date(),
      },
    ]

    await profile.save()

    return {
      message: result.question,
      isComplete: false,
      step: 'kokology_question_1',
      data: {
        stepProgress: {
          current: 1,
          total: this.config.questionCount!,
          label: `Question 1 of ${this.config.questionCount}`,
          phase: 'questions',
        },
      },
    }
  }

  private async handleKokologyResponse(
    profile: MatchProfileDocument,
    message: string
  ): Promise<MatchmakingResult> {
    const currentStep = profile.currentSession.step || 1
    const questions = profile.currentSession.kokologyQuestions || []

    // Store the answer to the current question
    // Find or create the current question entry
    const currentQuestionIndex = currentStep - 1
    if (currentQuestionIndex >= 0) {
      if (questions[currentQuestionIndex]) {
        // Update existing question with answer
        questions[currentQuestionIndex].answer = message
        questions[currentQuestionIndex].timestamp = new Date()
      } else {
        // This shouldn't happen, but if it does, create the question entry
        console.warn(`Missing question at step ${currentStep}, creating entry`)
        questions[currentQuestionIndex] = {
          id: currentStep,
          question: 'Previous question', // This is a fallback
          answer: message,
          timestamp: new Date(),
        }
      }
    }

    // Generate next question or complete analysis
    const nextStep = currentStep + 1
    const result = await this.kokologyAnalyst.askQuestion(
      nextStep,
      questions,
      message
    )

    if (result.isComplete) {
      // Store final answers and proceed directly to summary generation
      profile.currentSession.kokologyQuestions = questions
      await profile.save()

      // Directly generate personality summary instead of waiting for next message
      return await this.generatePersonalitySummary(profile)
    } else {
      // Add new question to the array
      questions.push({
        id: nextStep,
        question: result.question,
        timestamp: new Date(),
      })

      profile.currentSession.step = nextStep
      profile.currentSession.kokologyQuestions = questions
      await profile.save()

      return {
        message: result.question,
        isComplete: false,
        step: `kokology_question_${nextStep}`,
        data: {
          stepProgress: {
            current: nextStep,
            total: this.config.questionCount!,
            label: `Question ${nextStep} of ${this.config.questionCount}`,
            phase: 'questions',
          },
        },
      }
    }
  }

  private async generatePersonalitySummary(
    profile: MatchProfileDocument
  ): Promise<MatchmakingResult> {
    try {
      const questions = profile.currentSession.kokologyQuestions || []

      // Validate we have enough questions completed
      if (questions.length < this.config.questionCount!) {
        console.log(
          `Not enough questions completed: ${questions.length}/${this.config.questionCount}`
        )
        return await this.handleError(
          profile,
          'Insufficient kokology data - continuing analysis'
        )
      }

      // Generate insights from kokology responses
      const insights = await this.kokologyAnalyst.generateInsights(questions)

      // Create personality summary
      const summary = await this.personalityWriter.createPersonalitySummary(
        questions,
        insights
      )

      // Store the summary but don't show it to user
      profile.currentSession.personalitySummary = summary
      profile.currentSession.status = 'awaiting_gender'
      await profile.save()

      // Pick random analyzing message and ask for gender
      const randomMessage =
        ANALYZING_MESSAGES[
          Math.floor(Math.random() * ANALYZING_MESSAGES.length)
        ]

      // Start profiler in background (don't await)
      if (profile.currentSession.sessionId) {
        this.startBackgroundProfiling(
          profile.uid,
          profile.currentSession.sessionId
        )
      }

      return {
        message: randomMessage,
        isComplete: false,
        step: 'awaiting_gender',
        data: {
          expectingGender: true,
          showGenderButtons: true,
          disableTextInput: true,
          stepProgress: {
            current: this.config.questionCount!,
            total: this.config.questionCount!,
            label: 'Analyzing responses...',
            phase: 'analyzing',
          },
        },
      }
    } catch (error) {
      console.error('Error generating personality summary:', error)

      // Don't reset to idle - keep progress and try to continue
      profile.currentSession.status = 'personality_summary'
      await profile.save()

      return {
        message:
          "I'm having a moment processing your amazing answers! 🌸 Let me try that again real quick...",
        isComplete: false,
        step: 'retrying_summary',
      }
    }
  }

  private async profilePersonality(
    profile: MatchProfileDocument
  ): Promise<MatchmakingResult> {
    try {
      const summary = profile.currentSession.personalitySummary
      if (!summary) {
        throw new Error('No personality summary found')
      }

      const insights = await this.kokologyAnalyst.generateInsights(
        profile.currentSession.kokologyQuestions || []
      )

      // Profile the personality
      const profileResult = await this.personalityProfiler.profilePersonality(
        summary,
        insights
      )

      // Modify imageUrl based on gender
      const gender = profile.currentSession.gender || 'female' // Default to female
      const baseImageUrl = profileResult.category.imageUrl
      // Map backend gender to frontend file naming
      const fileGender = gender === 'male' ? 'boy' : 'girl'
      const genderedImageUrl = baseImageUrl.replace(
        '.webp',
        `-${fileGender}.webp`
      )

      // Store results and complete the process
      profile.currentSession.personalityCategory = profileResult.category.name
      profile.currentSession.status = 'completed'

      // Update the profile data with the analysis results
      if (!profile.profileData) {
        profile.profileData = {}
      }

      // Type assertion with proper interface instead of any
      const profileDataWithAnalysis = profile.profileData as {
        personalityAnalysis?: {
          category: PersonalityCategory
          confidence: number
          traits: string[]
          strengths: string[]
          recommendedRole: string
        }
      }

      profileDataWithAnalysis.personalityAnalysis = {
        category: profileResult.category,
        confidence: profileResult.confidence,
        traits: profileResult.secondaryTraits,
        strengths: profileResult.strengthsForMatching,
        recommendedRole: profileResult.recommendedRole,
      }

      // Set the recommended role
      profile.role = (
        profileResult.recommendedRole === 'either'
          ? 'guest'
          : profileResult.recommendedRole
      ) as 'host' | 'guest'

      await profile.save()

      return {
        message: `🎉 Your personality analysis is complete!\n\nYou are: **${
          profileResult.category.name
        }**\n\n${
          profileResult.category.description
        }\n\n✨ Here's what makes you special in relationships:\n${profileResult.strengthsForMatching
          .map((strength) => `• ${strength}`)
          .join('\n')}\n\nI'm sending you your personality image right now! 🌸`,
        isComplete: true,
        step: 'completed',
        data: {
          personalityCategory: profileResult.category.name,
          personalityImageUrl: genderedImageUrl,
          profile: {
            category: profileResult.category,
            confidence: profileResult.confidence,
            traits: profileResult.secondaryTraits,
            strengths: profileResult.strengthsForMatching,
            role:
              profileResult.recommendedRole === 'either'
                ? 'guest'
                : profileResult.recommendedRole,
          },
          stepProgress: {
            current: this.config.questionCount!,
            total: this.config.questionCount!,
            label: 'Analysis complete!',
            phase: 'completed',
          },
        },
      }
    } catch (error) {
      console.error('Error profiling personality:', error)
      return await this.handleError(profile, 'Failed to profile personality')
    }
  }

  private async handleGenderResponse(
    profile: MatchProfileDocument,
    message: string
  ): Promise<MatchmakingResult> {
    try {
      // Parse gender from message (simple keyword matching)
      const lowerMessage = message.toLowerCase().trim()
      let gender: 'female' | 'male' = 'female' // Default to female

      if (
        lowerMessage.includes('boy') ||
        lowerMessage.includes('male') ||
        lowerMessage.includes('man') ||
        lowerMessage.includes('guy')
      ) {
        gender = 'male'
      } else if (
        lowerMessage.includes('girl') ||
        lowerMessage.includes('female') ||
        lowerMessage.includes('woman') ||
        lowerMessage.includes('gal')
      ) {
        gender = 'female'
      }

      // Save gender response
      profile.currentSession.gender = gender
      await profile.save()

      // Acknowledge gender and let them know analysis is almost done
      const acknowledgements = [
        `got it bestie! ur results are almost ready~ 💕`,
        `perfect! finishing up ur analysis rn ✨`,
        `noted! ur personality profile is cooking~ 🔥`,
        `yay thanks! results coming in hot!! 💫`,
        `love it! almost done analyzing ur beautiful mind~ 🌸`,
      ]

      const randomAck =
        acknowledgements[Math.floor(Math.random() * acknowledgements.length)]

      return {
        message: randomAck,
        isComplete: false,
        step: 'acknowledging_gender',
      }
    } catch (error) {
      console.error('Error handling gender response:', error)
      // Continue without gender if there's an error
      return {
        message:
          "no worries if u don't wanna say! ur results are almost ready~ ✨",
        isComplete: false,
        step: 'continuing_analysis',
      }
    }
  }

  private async startBackgroundProfiling(
    userId: string,
    sessionId: string
  ): Promise<void> {
    try {
      // Wait a bit to let user potentially provide gender
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Get latest profile state
      await connectMongoDB()
      const profile = await MatchProfile.findOne({ uid: userId })

      if (!profile || profile.currentSession.sessionId !== sessionId) {
        console.log(
          'Profile not found or session changed, skipping background profiling'
        )
        return
      }

      if (profile.currentSession.status !== 'awaiting_gender') {
        console.log('Status changed, skipping background profiling')
        return
      }

      // Run profiler
      const profileResult = await this.profilePersonality(profile)

      // Send result directly to Firebase
      const { saveMessageToFirebase } = await import('@/lib/firebase-chat')

      await saveMessageToFirebase(
        sessionId,
        profileResult.message,
        'assistant',
        {
          step: profileResult.step,
          isComplete: profileResult.isComplete,
          ...profileResult.data,
        }
      )

      // If there's a personality image, send it as separate message
      if (profileResult.data?.personalityImageUrl) {
        const imageMessage = `Here's your personality type image! 🌸`
        await saveMessageToFirebase(sessionId, imageMessage, 'assistant', {
          imageUrl: profileResult.data.personalityImageUrl,
          personalityCategory: profileResult.data.personalityCategory,
          messageType: 'personality_image',
        })

        // Send CTA message for viewing matches
        const ctaMessage = `🎯 Ready to find your perfect match? Let's see who's compatible with your ${profileResult.data.personalityCategory} personality!`
        await saveMessageToFirebase(sessionId, ctaMessage, 'assistant', {
          messageType: 'cta_matches',
          showMatchesButton: true,
          personalityCategory: profileResult.data.personalityCategory,
          ctaButton: {
            text: 'View My Matches',
            action: 'view_matches',
            style: 'primary',
          },
        })
      }
    } catch (error) {
      console.error('Error in background profiling:', error)
    }
  }

  private async handleError(
    profile: MatchProfileDocument,
    errorMessage: string
  ): Promise<MatchmakingResult> {
    console.error('Matchmaking error:', errorMessage)

    // Don't reset if we have kokology questions completed
    const questions = profile.currentSession.kokologyQuestions || []
    const hasCompletedQuestions = questions.length >= this.config.questionCount!

    if (hasCompletedQuestions) {
      // If we have completed questions, try to continue from personality summary
      profile.currentSession.status = 'personality_summary'
      profile.currentSession.step = this.config.questionCount
      await profile.save()

      return {
        message:
          "I encountered a small hiccup! 🌸 But don't worry - I saved your answers. Let me continue analyzing your personality...",
        isComplete: false,
        step: 'recovering_from_error',
      }
    } else {
      // Only reset to idle if we haven't made progress
      profile.currentSession.status = 'idle'
      profile.currentSession.step = 0
      await profile.save()

      return {
        message:
          "I encountered an issue, but don't worry! Let's start fresh. Would you like to begin your personality analysis? 🌸",
        isComplete: false,
        step: 'error_reset',
      }
    }
  }

  private getPersonalityImageUrl(
    categoryName: string,
    gender?: 'female' | 'male'
  ): string {
    const category = this.personalityProfiler
      .getAllCategories()
      .find((cat) => cat.name === categoryName)

    if (!category) {
      return '/images/personalities/default.png'
    }

    // Default to female if no gender specified, then map to file naming
    const backendGender = gender || 'female'
    const fileGender = backendGender === 'male' ? 'boy' : 'girl'
    return category.imageUrl.replace('.webp', `-${fileGender}.webp`)
  }

  private getPublicProfileData(profile: IMatchProfile) {
    return {
      uid: profile.uid,
      role: profile.role,
      personalityCategory: profile.currentSession.personalityCategory,
      completedAnalysis: profile.currentSession.status === 'completed',
      // Add other public fields as needed
    }
  }

  // Helper methods for external access
  async getUserProfile(userId: string): Promise<IMatchProfile | null> {
    await connectMongoDB()
    return await MatchProfile.findOne({ uid: userId })
  }

  async resetUserSession(userId: string): Promise<void> {
    await connectMongoDB()
    await MatchProfile.updateOne(
      { uid: userId },
      {
        $set: {
          'currentSession.status': 'idle',
          'currentSession.step': 0,
          'currentSession.kokologyQuestions': [],
        },
      }
    )
  }

  getPersonalityCategories() {
    return this.personalityProfiler.getAllCategories()
  }
}
