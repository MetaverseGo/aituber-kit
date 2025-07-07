import { z } from 'zod'
import { callAI } from '@/lib/ai-client'

// Core validation error tracking
export interface ValidationError {
  originalText: string
  validationError: string
  timestamp: Date
  status: 'pending' | 'resolved' | 'ignore'
  retryCount: number
  context?: Record<string, any>
}

// Configuration for validation behavior
export interface ValidationConfig {
  maxRetries?: number
  source?: 'mamasan' | 'kokology' | 'profiler' | string
  enableFallback?: boolean
  logLevel?: 'silent' | 'error' | 'info' | 'debug'
}

// Result of validation process
export interface ValidationResult<T = any> {
  success: boolean
  data?: T
  errors?: ValidationError[]
  usedFallback?: boolean
}

// Schema definition that generates both Zod validator and prompt text
export interface SchemaDefinition {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  description?: string
  properties?: Record<string, SchemaDefinition>
  items?: SchemaDefinition
  enum?: string[]
  optional?: boolean
  strict?: boolean
}

/**
 * Converts a schema definition to a Zod validator
 */
export function createZodValidator(
  definition: SchemaDefinition
): z.ZodType<any> {
  switch (definition.type) {
    case 'string':
      if (definition.enum) {
        let enumSchema = z.enum(definition.enum as [string, ...string[]])
        return definition.optional ? enumSchema.optional() : enumSchema
      }
      let stringSchema = z.string()
      return definition.optional ? stringSchema.optional() : stringSchema

    case 'number':
      let numberSchema = z.number()
      return definition.optional ? numberSchema.optional() : numberSchema

    case 'boolean':
      let booleanSchema = z.boolean()
      return definition.optional ? booleanSchema.optional() : booleanSchema

    case 'array':
      if (!definition.items) {
        throw new Error('Array schema must define items')
      }
      let arraySchema = z.array(createZodValidator(definition.items))
      return definition.optional ? arraySchema.optional() : arraySchema

    case 'object':
      if (!definition.properties) {
        throw new Error('Object schema must define properties')
      }

      const shape: Record<string, z.ZodType<any>> = {}
      for (const [key, propDef] of Object.entries(definition.properties)) {
        shape[key] = createZodValidator(propDef)
      }

      let objectSchema = z.object(shape)
      if (definition.strict) {
        objectSchema = objectSchema.strict() as any
      }
      return definition.optional ? objectSchema.optional() : objectSchema

    default:
      throw new Error(`Unsupported schema type: ${definition.type}`)
  }
}

/**
 * Generates JSON schema documentation text for prompts
 */
export function generateSchemaPromptText(
  definition: SchemaDefinition,
  indent = 0
): string {
  const spaces = '  '.repeat(indent)

  switch (definition.type) {
    case 'string':
      if (definition.enum) {
        return `"${definition.enum.join('"|"')}"`
      }
      return 'string'

    case 'number':
      return 'number'

    case 'boolean':
      return 'true/false'

    case 'array':
      if (!definition.items) return 'array'
      return `[${generateSchemaPromptText(definition.items, indent)}]`

    case 'object':
      if (!definition.properties) return 'object'

      const props = Object.entries(definition.properties)
        .map(([key, propDef]) => {
          const optional = propDef.optional ? ' (optional)' : ''
          const desc = propDef.description ? ` // ${propDef.description}` : ''
          return `${spaces}  "${key}": ${generateSchemaPromptText(propDef, indent + 1)}${optional}${desc}`
        })
        .join(',\n')

      return `{\n${props}\n${spaces}}`

    default:
      return 'unknown'
  }
}

/**
 * Main validation utility class
 */
export class AIValidator<T = any> {
  private schema: z.ZodType<T>
  private config: Required<ValidationConfig>
  private schemaText: string

  constructor(
    schemaDefinition: SchemaDefinition,
    config: ValidationConfig = {}
  ) {
    this.schema = createZodValidator(schemaDefinition) as z.ZodType<T>
    this.config = {
      maxRetries: 3,
      source: 'unknown',
      enableFallback: true,
      logLevel: 'info',
      ...config,
    }
    this.schemaText = generateSchemaPromptText(schemaDefinition)
  }

  /**
   * Get the JSON schema text for including in prompts
   */
  getSchemaPromptText(): string {
    return this.schemaText
  }

  /**
   * Get the structured response requirement text for system prompts
   */
  getStructuredResponsePrompt(): string {
    return `CRITICAL: You MUST return valid JSON that follows this exact schema. No extra text, no markdown formatting, just pure JSON.

Required JSON structure:
${this.schemaText}

Rules:
- Use exact enum values as specified
- Include all required fields
- Ensure proper JSON formatting
- No extra properties outside the schema
- No comments or explanations outside the JSON`
  }

  /**
   * Validate a raw AI response with retry logic
   */
  async validateResponse(
    rawResponse: string,
    context?: Record<string, any>
  ): Promise<ValidationResult<T>> {
    const errors: ValidationError[] = []
    let lastValidationError = ''

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      this.log(
        'debug',
        `Validation attempt ${attempt}/${this.config.maxRetries}`
      )

      try {
        const validationResult = this.validateSingleResponse(rawResponse)

        if (validationResult.success) {
          this.log('info', '✅ Validation successful')
          return {
            success: true,
            data: validationResult.data,
            errors: errors.length > 0 ? errors : undefined,
          }
        } else {
          // Validation failed, record error
          lastValidationError = validationResult.error
          this.log(
            'debug',
            `❌ Validation failed (attempt ${attempt}): ${validationResult.error}`
          )

          const validationError: ValidationError = {
            originalText: rawResponse,
            validationError: validationResult.error,
            timestamp: new Date(),
            status: 'pending',
            retryCount: attempt,
            context,
          }
          errors.push(validationError)

          // If not the last attempt, we would retry with AI here
          // For now, we only validate the same response multiple times
          if (attempt === this.config.maxRetries) {
            break
          }
        }
      } catch (error) {
        this.log('error', `Validation attempt ${attempt} threw error:`, error)

        const validationError: ValidationError = {
          originalText: rawResponse,
          validationError: `Validation process failed: ${error}`,
          timestamp: new Date(),
          status: 'pending',
          retryCount: attempt,
          context,
        }
        errors.push(validationError)

        if (attempt === this.config.maxRetries) {
          break
        }
      }
    }

    // All validation attempts failed
    if (this.config.enableFallback) {
      this.log('info', '⚠️ All validation attempts failed, using fallback')
      const fallbackResult = this.attemptFallbackParsing(rawResponse)
      return {
        success: fallbackResult.success,
        data: fallbackResult.data,
        errors,
        usedFallback: true,
      }
    }

    return {
      success: false,
      errors,
    }
  }

  /**
   * Validate and retry with AI correction
   */
  async validateWithAIRetry(
    systemPrompt: string,
    userPrompt: string,
    context?: Record<string, any>
  ): Promise<ValidationResult<T>> {
    const errors: ValidationError[] = []
    let lastValidationError = ''

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      this.log(
        'debug',
        `AI validation attempt ${attempt}/${this.config.maxRetries}`
      )

      try {
        // Construct the full prompt with schema requirements
        const fullSystemPrompt = `${systemPrompt}\n\n${this.getStructuredResponsePrompt()}`

        // Add retry context if this isn't the first attempt
        let fullUserPrompt = userPrompt
        if (attempt > 1 && lastValidationError) {
          fullUserPrompt += `\n\nIMPORTANT: Your previous response failed validation with this error: "${lastValidationError}"
Please fix the JSON structure and ensure it follows the exact schema requirements.`
        }

        // Call AI
        const aiResponse = await callAI([
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: fullUserPrompt },
        ])

        // Validate the response
        const validationResult = this.validateSingleResponse(aiResponse)

        if (validationResult.success) {
          this.log('info', '✅ AI validation successful')
          return {
            success: true,
            data: validationResult.data,
            errors: errors.length > 0 ? errors : undefined,
          }
        } else {
          // Validation failed, record error and prepare for retry
          lastValidationError = validationResult.error
          this.log(
            'debug',
            `❌ AI validation failed (attempt ${attempt}): ${validationResult.error}`
          )

          const validationError: ValidationError = {
            originalText: aiResponse,
            validationError: validationResult.error,
            timestamp: new Date(),
            status: 'pending',
            retryCount: attempt,
            context: { ...context, attempt, systemPrompt, userPrompt },
          }
          errors.push(validationError)
        }
      } catch (error) {
        this.log('error', `AI call attempt ${attempt} failed:`, error)

        const validationError: ValidationError = {
          originalText: '',
          validationError: `AI call failed: ${error}`,
          timestamp: new Date(),
          status: 'pending',
          retryCount: attempt,
          context: { ...context, attempt, systemPrompt, userPrompt },
        }
        errors.push(validationError)
      }
    }

    // All AI attempts failed
    if (this.config.enableFallback) {
      this.log('info', '⚠️ All AI validation attempts failed, using fallback')
      const fallbackResult = this.attemptBasicFallback(context)
      return {
        success: fallbackResult.success,
        data: fallbackResult.data,
        errors,
        usedFallback: true,
      }
    }

    return {
      success: false,
      errors,
    }
  }

  /**
   * Validate a single response attempt
   */
  private validateSingleResponse(
    rawResponse: string
  ): { success: true; data: T } | { success: false; error: string } {
    try {
      // Clean the response - remove any markdown formatting
      let cleanedResponse = rawResponse.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '')
      }

      // Parse JSON
      const parsed = JSON.parse(cleanedResponse)

      // Validate with Zod
      const result = this.schema.safeParse(parsed)

      if (result.success) {
        return { success: true, data: result.data }
      } else {
        const errorMsg = result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
        return {
          success: false,
          error: `Schema validation failed: ${errorMsg}`,
        }
      }
    } catch (parseError) {
      return { success: false, error: `JSON parsing failed: ${parseError}` }
    }
  }

  /**
   * Attempt basic fallback parsing when validation fails
   */
  private attemptFallbackParsing(rawResponse: string): {
    success: boolean
    data?: any
  } {
    try {
      // Try to extract any JSON from the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return { success: true, data: parsed }
      }
    } catch (error) {
      // Ignore parsing errors in fallback
    }

    return { success: false }
  }

  /**
   * Basic fallback when all else fails
   */
  private attemptBasicFallback(context?: Record<string, any>): {
    success: boolean
    data?: any
  } {
    // Return a minimal valid response based on context
    // For response analysis, return a basic structure that won't break downstream processing
    const fallbackData = {
      answered: false,
      reason: 'AI validation failed completely - using fallback response',
      profileUpdates: {},
    }

    this.log('info', 'Using basic fallback data:', fallbackData)
    return {
      success: true, // Mark as success so it doesn't cause errors downstream
      data: fallbackData,
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
      const prefix = `[AIValidator:${this.config.source}]`
      console.log(prefix, message, ...args)
    }
  }
}

/**
 * Convenience function for creating validators with common patterns
 */
export function createStructuredResponseValidator<T>(
  schemaDefinition: SchemaDefinition,
  config?: ValidationConfig
): AIValidator<T> {
  return new AIValidator<T>(schemaDefinition, config)
}

/**
 * Helper function to add structured response requirements to system prompts
 */
export function addStructuredResponseRequirement(
  systemPrompt: string,
  schemaDefinition: SchemaDefinition
): { enhancedPrompt: string; validator: AIValidator } {
  const validator = new AIValidator(schemaDefinition)
  const enhancedPrompt = `${systemPrompt}\n\n${validator.getStructuredResponsePrompt()}`

  return {
    enhancedPrompt,
    validator,
  }
}
