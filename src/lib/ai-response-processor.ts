import {
  AIValidator,
  ValidationResult,
  ValidationError,
  SchemaDefinition,
} from './ai-validation'

// Configuration for the response processor
export interface ResponseProcessorConfig {
  source: 'mamasan' | 'kokology' | 'profiler' | string
  userId: string
  enableErrorPersistence?: boolean
  enableProfileUpdates?: boolean
  maxRetries?: number
  logLevel?: 'silent' | 'error' | 'info' | 'debug'
}

// Result of processing an AI response
export interface ProcessedResponse<T = any> {
  success: boolean
  data?: T
  errors?: ValidationError[]
  usedFallback?: boolean
  profileUpdatesSaved?: boolean
  errorsPersisted?: boolean
}

/**
 * High-level processor for AI responses with validation and persistence
 */
export class AIResponseProcessor {
  private config: Required<ResponseProcessorConfig>

  constructor(config: ResponseProcessorConfig) {
    this.config = {
      enableErrorPersistence: true,
      enableProfileUpdates: true,
      maxRetries: 3,
      logLevel: 'info',
      ...config,
    }
  }

  /**
   * Process a structured AI response with validation and persistence
   */
  async processStructuredResponse<T>(
    validator: AIValidator<T>,
    systemPrompt: string,
    userPrompt: string,
    context?: Record<string, any>
  ): Promise<ProcessedResponse<T>> {
    this.log('info', `Processing structured response for ${this.config.source}`)

    // Use the validator to get AI response with retry logic
    const validationResult = await validator.validateWithAIRetry(
      systemPrompt,
      userPrompt,
      { ...context, source: this.config.source, userId: this.config.userId }
    )

    const result: ProcessedResponse<T> = {
      success: validationResult.success,
      data: validationResult.data,
      errors: validationResult.errors,
      usedFallback: validationResult.usedFallback,
    }

    // Handle error persistence if enabled and there are errors
    if (this.config.enableErrorPersistence && validationResult.errors?.length) {
      try {
        await this.persistValidationErrors(validationResult.errors, context)
        result.errorsPersisted = true
        this.log(
          'info',
          `✅ Persisted ${validationResult.errors.length} validation errors`
        )
      } catch (error) {
        this.log('error', 'Failed to persist validation errors:', error)
        result.errorsPersisted = false
      }
    }

    // Handle profile updates if enabled and successful
    if (
      this.config.enableProfileUpdates &&
      validationResult.success &&
      validationResult.data
    ) {
      try {
        const profileUpdates = this.extractProfileUpdates(validationResult.data)
        if (profileUpdates && Object.keys(profileUpdates).length > 0) {
          await this.saveProfileUpdates(profileUpdates)
          result.profileUpdatesSaved = true
          this.log('info', '✅ Saved profile updates to database')
        }
      } catch (error) {
        this.log('error', 'Failed to save profile updates:', error)
        result.profileUpdatesSaved = false
      }
    }

    return result
  }

  /**
   * Process a raw AI response with validation (no AI retry)
   */
  async processRawResponse<T>(
    validator: AIValidator<T>,
    rawResponse: string,
    context?: Record<string, any>
  ): Promise<ProcessedResponse<T>> {
    this.log('info', `Processing raw response for ${this.config.source}`)

    // Validate the raw response
    const validationResult = await validator.validateResponse(rawResponse, {
      ...context,
      source: this.config.source,
      userId: this.config.userId,
    })

    const result: ProcessedResponse<T> = {
      success: validationResult.success,
      data: validationResult.data,
      errors: validationResult.errors,
      usedFallback: validationResult.usedFallback,
    }

    // Handle error persistence if enabled and there are errors
    if (this.config.enableErrorPersistence && validationResult.errors?.length) {
      try {
        await this.persistValidationErrors(validationResult.errors, context)
        result.errorsPersisted = true
        this.log(
          'info',
          `✅ Persisted ${validationResult.errors.length} validation errors`
        )
      } catch (error) {
        this.log('error', 'Failed to persist validation errors:', error)
        result.errorsPersisted = false
      }
    }

    // Handle profile updates if enabled and successful
    if (
      this.config.enableProfileUpdates &&
      validationResult.success &&
      validationResult.data
    ) {
      try {
        const profileUpdates = this.extractProfileUpdates(validationResult.data)
        if (profileUpdates && Object.keys(profileUpdates).length > 0) {
          await this.saveProfileUpdates(profileUpdates)
          result.profileUpdatesSaved = true
          this.log('info', '✅ Saved profile updates to database')
        }
      } catch (error) {
        this.log('error', 'Failed to save profile updates:', error)
        result.profileUpdatesSaved = false
      }
    }

    return result
  }

  /**
   * Create a validator with the processor's configuration
   */
  createValidator<T>(schemaDefinition: SchemaDefinition): AIValidator<T> {
    return new AIValidator<T>(schemaDefinition, {
      source: this.config.source,
      maxRetries: this.config.maxRetries,
      logLevel: this.config.logLevel,
      enableFallback: true,
    })
  }

  /**
   * Persist validation errors to the database
   */
  private async persistValidationErrors(
    errors: ValidationError[],
    context?: Record<string, any>
  ): Promise<void> {
    // Convert ValidationError objects to the database format
    const dbValidationErrors = errors.map((error) => ({
      source: this.config.source,
      originalText: error.originalText,
      validationError: error.validationError,
      timestamp: error.timestamp,
      status: error.status,
      retryCount: error.retryCount,
      context: { ...error.context, ...context },
    }))

    // Save to database via API
    const response = await fetch('/api/match-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveValidationErrors',
        uid: this.config.userId,
        data: { validationErrors: dbValidationErrors },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(`Database error: ${result.error}`)
    }
  }

  /**
   * Extract profile updates from validated data
   */
  private extractProfileUpdates(validatedData: any): any | null {
    // Check if the validated data contains profile updates
    if (validatedData && typeof validatedData === 'object') {
      // For response analysis schema, profile updates are in profileUpdates field
      if (validatedData.profileUpdates) {
        return this.transformProfileUpdates(validatedData.profileUpdates)
      }

      // For other schemas, look for direct profile data
      if (
        validatedData.personalityType ||
        validatedData.traits ||
        validatedData.insights
      ) {
        return this.transformPersonalityData(validatedData)
      }
    }

    return null
  }

  /**
   * Transform profile updates to MongoDB format
   */
  private transformProfileUpdates(profileUpdates: any): any {
    const mongoUpdates: any = {}

    // Map the AI analysis to MongoDB structure
    if (profileUpdates.physicalPreferences) {
      mongoUpdates['datingProfile.physicalPreferences'] =
        profileUpdates.physicalPreferences
    }

    if (profileUpdates.personality) {
      if (profileUpdates.personality.energyLevel) {
        mongoUpdates['datingProfile.servicePreferences.mood'] =
          profileUpdates.personality.energyLevel
      }
      if (profileUpdates.personality.dominanceStyle) {
        mongoUpdates['datingProfile.dominanceStyle'] =
          profileUpdates.personality.dominanceStyle
      }
      if (profileUpdates.personality.seekingTraits) {
        mongoUpdates[
          'profileData.preferences.matchingPrefs.personalityTraits'
        ] = profileUpdates.personality.seekingTraits
      }
    }

    if (profileUpdates.interests) {
      if (profileUpdates.interests.categories) {
        mongoUpdates['datingProfile.servicePreferences.primaryServices'] =
          profileUpdates.interests.categories
      }
      if (profileUpdates.interests.specificItems) {
        mongoUpdates['datingProfile.servicePreferences.conversationTopics'] =
          profileUpdates.interests.specificItems
      }
    }

    if (profileUpdates.preferences) {
      if (profileUpdates.preferences.moodSeeking) {
        mongoUpdates['datingProfile.servicePreferences.mood'] =
          profileUpdates.preferences.moodSeeking
      }
      if (profileUpdates.preferences.interactionStyle) {
        mongoUpdates['datingProfile.servicePreferences.interactionStyle'] =
          profileUpdates.preferences.interactionStyle
      }
      if (profileUpdates.preferences.serviceTypes) {
        mongoUpdates['datingProfile.servicePreferences.primaryServices'] =
          profileUpdates.preferences.serviceTypes
      }
      if (profileUpdates.preferences.conversationTopics) {
        mongoUpdates['datingProfile.servicePreferences.conversationTopics'] =
          profileUpdates.preferences.conversationTopics
      }
    }

    if (profileUpdates.demographics) {
      if (profileUpdates.demographics.agePreference) {
        mongoUpdates['datingProfile.demographics.agePreference.preference'] =
          profileUpdates.demographics.agePreference
      }
      if (profileUpdates.demographics.experienceLevel) {
        mongoUpdates['datingProfile.demographics.experienceLevel'] =
          profileUpdates.demographics.experienceLevel
      }
    }

    return mongoUpdates
  }

  /**
   * Transform personality analysis data to MongoDB format
   */
  private transformPersonalityData(personalityData: any): any {
    const mongoUpdates: any = {}

    if (personalityData.personalityType) {
      mongoUpdates['currentSession.personalityCategory'] =
        personalityData.personalityType
    }

    if (personalityData.summary) {
      mongoUpdates['currentSession.personalitySummary'] =
        personalityData.summary
    }

    if (personalityData.traits && Array.isArray(personalityData.traits)) {
      mongoUpdates['profileData.personality.traits'] = personalityData.traits
    }

    if (personalityData.insights && Array.isArray(personalityData.insights)) {
      mongoUpdates['profileData.personality.insights'] =
        personalityData.insights
    }

    return mongoUpdates
  }

  /**
   * Save profile updates to database
   */
  private async saveProfileUpdates(profileUpdates: any): Promise<void> {
    // Skip saving in server-side environment for now
    // This will be handled differently in the orchestrator
    if (typeof window === 'undefined') {
      this.log(
        'info',
        'Skipping profile save in server environment - will be handled by orchestrator'
      )
      return
    }

    const response = await fetch('/api/match-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateProfile',
        uid: this.config.userId,
        data: { profileUpdates },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(`Database error: ${result.error}`)
    }
  }

  /**
   * Logging utility
   */
  private log(
    level: 'silent' | 'error' | 'info' | 'debug',
    message: string,
    ...args: any[]
  ) {
    if (this.config.logLevel === 'silent') return

    const shouldLog =
      (level === 'error' &&
        ['error', 'info', 'debug'].includes(this.config.logLevel)) ||
      (level === 'info' && ['info', 'debug'].includes(this.config.logLevel)) ||
      (level === 'debug' && this.config.logLevel === 'debug')

    if (shouldLog) {
      const prefix = `[ResponseProcessor:${this.config.source}]`
      console.log(prefix, message, ...args)
    }
  }
}

/**
 * Factory function for creating response processors
 */
export function createResponseProcessor(
  config: ResponseProcessorConfig
): AIResponseProcessor {
  return new AIResponseProcessor(config)
}

/**
 * Convenience function for processing a single structured response
 */
export async function processStructuredAIResponse<T>(
  schemaDefinition: SchemaDefinition,
  systemPrompt: string,
  userPrompt: string,
  config: ResponseProcessorConfig,
  context?: Record<string, any>
): Promise<ProcessedResponse<T>> {
  const processor = new AIResponseProcessor(config)
  const validator = processor.createValidator<T>(schemaDefinition)
  return await processor.processStructuredResponse(
    validator,
    systemPrompt,
    userPrompt,
    context
  )
}
