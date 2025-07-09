// TODO: Implement Anthropic prompt caching (see https://docs.anthropic.com/claude/docs/prompt-caching) for large static system prompts. This will require using cache_control and the correct message format.
// ---

import { Message } from '@/features/messages/messages'
import { getVercelAIChatResponse } from '@/features/chat/vercelAIChat'

/**
 * Universal AI client that uses the same infrastructure as normal aituber chat
 * Works with any configured AI service (OpenAI, Anthropic, Google, etc.)
 */
export async function callAI(messages: Message[]): Promise<string> {
  // Read provider selection from environment
  const primaryProvider =
    process.env.NEXT_PUBLIC_SELECT_AI_SERVICE || 'anthropic'
  const backupProvider =
    process.env.NEXT_PUBLIC_SELECT_AI_SERVICE_BACKUP || 'xai'

  try {
    console.log(`[AI] Using primary provider: ${primaryProvider}`)
    const response = await getVercelAIChatResponse(messages, primaryProvider)
    console.log('AI response received:', response)

    if (!response || !response.text) {
      console.error('Empty or invalid AI response:', response)
      throw new Error('Received empty response from AI service')
    }

    return response.text
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
        const response = await getVercelAIChatResponse(messages, backupProvider)
        if (!response || !response.text) {
          throw new Error(
            `Fallback to backup provider (${backupProvider}) failed: empty response`
          )
        }
        return response.text
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
