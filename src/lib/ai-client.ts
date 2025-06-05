import { Message } from '@/features/messages/messages'
import { getVercelAIChatResponse } from '@/features/chat/vercelAIChat'

/**
 * Universal AI client that uses the same infrastructure as normal aituber chat
 * Works with any configured AI service (OpenAI, Anthropic, Google, etc.)
 */
export async function callAI(messages: Message[]): Promise<string> {
  try {
    console.log('Making AI call with messages:', messages.length, 'messages')
    const response = await getVercelAIChatResponse(messages)
    console.log('AI response received:', response)
    
    if (!response || !response.text) {
      console.error('Empty or invalid AI response:', response)
      throw new Error('Received empty response from AI service')
    }
    
    return response.text
  } catch (error) {
    console.error('AI call failed:', error)
    throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
