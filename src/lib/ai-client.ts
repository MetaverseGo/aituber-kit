// TODO: Implement Anthropic prompt caching (see https://docs.anthropic.com/claude/docs/prompt-caching) for large static system prompts. This will require using cache_control and the correct message format.
// ---

import { Message } from '@/features/messages/messages'

/**
 * Universal AI client that uses the same infrastructure as normal aituber chat
 * Works with any configured AI service (OpenAI, Anthropic, Google, etc.)
 *
 * This function runs on the server-side and calls AI services directly without internal HTTP requests.
 */
export async function callAI(messages: Message[]): Promise<string> {
  // Read provider selection from server-side environment variables
  const primaryProvider = process.env.SELECT_AI_SERVICE || 'anthropic'
  const backupProvider = process.env.SELECT_AI_SERVICE_BACKUP || 'xai'

  // Get model from server-side environment
  const model = process.env.SELECT_AI_MODEL || 'claude-3-5-sonnet-20241022'

  // Direct AI service call without internal HTTP requests
  const makeDirectAICall = async (aiService: string): Promise<string> => {
    console.log(
      `[AI] Making direct AI service call with provider: ${aiService}`
    )

    // Get API key from environment variables
    const servicePrefix = aiService.toUpperCase()
    const apiKey =
      process.env[`${servicePrefix}_KEY`] ||
      process.env[`${servicePrefix}_API_KEY`] ||
      ''

    if (!apiKey) {
      throw new Error(
        `No API key found for ${aiService}. Expected ${servicePrefix}_KEY or ${servicePrefix}_API_KEY`
      )
    }

    // Import AI service functions directly (avoid HTTP calls)
    const { aiServiceConfig, generateAiText } = await import(
      '@/pages/api/services/vercelAi'
    )
    const { modifyMessages } = await import('@/pages/api/services/utils')
    const { isVercelLocalAIService } = await import(
      '@/features/constants/settings'
    )

    // Create service instance
    const getServiceInstance =
      aiServiceConfig[aiService as keyof typeof aiServiceConfig]
    if (!getServiceInstance) {
      throw new Error(`Invalid AI service: ${aiService}`)
    }

    // Generate service parameters
    const serviceParams = isVercelLocalAIService(aiService)
      ? { baseURL: process.env.LOCAL_LLM_URL || '' }
      : { apiKey }

    // Create model instance
    const modelInstance = getServiceInstance(serviceParams)

    // Modify messages for the specific service
    const modifiedMessages = modifyMessages(aiService, model, messages)

    console.log(`[AI] Calling ${aiService} with model: ${model}`)

    // Call the AI service directly
    const response = await generateAiText({
      model,
      modelInstance,
      messages: modifiedMessages,
      temperature: parseFloat(process.env.TEMPERATURE || '1.0'),
      maxTokens: parseInt(process.env.MAX_TOKENS || '4096'),
    })

    // Extract text from response
    const data = await response.json()
    console.log('[AI] AI service response received:', {
      hasText: !!data.text,
      textLength: data.text?.length,
    })

    if (!data.text) {
      throw new Error('Received empty response from AI service')
    }

    return data.text
  }

  try {
    console.log(`[AI] Using primary provider: ${primaryProvider}`)
    return await makeDirectAICall(primaryProvider)
  } catch (error: any) {
    // --- Fallback logic for 5xx/Overloaded/Credits errors ---
    const isServerError =
      error &&
      typeof error.message === 'string' &&
      // Any 5xx error code
      (/\b5\d\d\b/.test(error.message) ||
        // Common overload/credit/limit phrases
        error.message.toLowerCase().includes('overloaded') ||
        error.message.toLowerCase().includes('no credits') ||
        error.message.toLowerCase().includes('quota') ||
        error.message.toLowerCase().includes('insufficient funds') ||
        error.message.toLowerCase().includes('out of credits'))

    if (isServerError) {
      console.warn(
        `[AI Fallback] ${primaryProvider} 5xx/Overloaded/Credits error detected, retrying with backup provider: ${backupProvider}...`
      )
      try {
        return await makeDirectAICall(backupProvider)
      } catch (fallbackError) {
        console.error(
          `[AI Fallback] Backup provider (${backupProvider}) also failed:`,
          fallbackError
        )
        throw new Error(
          `Both ${primaryProvider} and ${backupProvider} failed: ` +
            fallbackError
        )
      }
    }
    // --- End fallback logic ---
    console.error('AI call failed:', error)
    throw new Error(
      `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
