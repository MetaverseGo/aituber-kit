// TODO: Implement Anthropic prompt caching (see https://docs.anthropic.com/claude/docs/prompt-caching) for large static system prompts. This will require using cache_control and the correct message format.
// ---

import { Message } from '@/features/messages/messages'

/**
 * Universal AI client that uses the same infrastructure as normal aituber chat
 * Works with any configured AI service (OpenAI, Anthropic, Google, etc.)
 *
 * This function runs on the server-side, so it gets configuration from server-side environment variables.
 */
export async function callAI(messages: Message[]): Promise<string> {
  // Read provider selection from server-side environment variables
  const primaryProvider = process.env.SELECT_AI_SERVICE || 'anthropic'
  const backupProvider = process.env.SELECT_AI_SERVICE_BACKUP || 'xai'

  // Get model from server-side environment
  const model = process.env.SELECT_AI_MODEL || 'claude-3-5-sonnet-20241022'

  // Direct API call to our Vercel AI endpoint with server-side configuration
  const makeAPICall = async (aiService: string): Promise<string> => {
    console.log(`[AI] Making direct API call with provider: ${aiService}`)

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

    // Prepare request data with server-side configuration
    const requestData = {
      messages,
      apiKey,
      aiService,
      model,
      stream: false,
      temperature: parseFloat(process.env.TEMPERATURE || '1.0'),
      maxTokens: parseInt(process.env.MAX_TOKENS || '4096'),
      useSearchGrounding: process.env.USE_SEARCH_GROUNDING === 'true',
      localLlmUrl: process.env.LOCAL_LLM_URL || '',
      azureEndpoint: process.env.AZURE_ENDPOINT || '',
    }

    // Determine the correct API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const endpoint = `${baseUrl}/api/ai/vercel`

    console.log(`[AI] Calling ${endpoint} with service: ${aiService}`)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `[AI] API call failed: ${response.status} ${response.statusText}`,
        errorText
      )
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const data = await response.json()
    console.log('[AI] API response received:', {
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
    return await makeAPICall(primaryProvider)
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
        return await makeAPICall(backupProvider)
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
