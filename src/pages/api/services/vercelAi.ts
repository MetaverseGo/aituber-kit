import { Message } from '@/features/messages/messages'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createXai } from '@ai-sdk/xai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createCohere } from '@ai-sdk/cohere'
import { createMistral } from '@ai-sdk/mistral'
import { createAzure } from '@ai-sdk/azure'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createOllama } from 'ollama-ai-provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText, generateText, CoreMessage } from 'ai'
import { VercelAIService } from '@/features/constants/settings'

/**
 * Create a custom fetch function that handles encoding issues in production
 * Prevents RequestContentLengthMismatchError by ensuring proper UTF-8 encoding
 */
function createEncodingSafeFetch(providerName: string) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    // Ensure proper headers with explicit charset
    const headers = {
      ...init?.headers,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    }

    // Sanitize request body to prevent encoding mismatches
    let body = init?.body
    if (body && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body)
        // Re-stringify to ensure proper encoding and remove problematic characters
        const sanitized = JSON.stringify(parsed, null, 0)
          .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
          .replace(/[\u200B-\u200F\uFEFF]/g, '') // Remove zero-width characters

        body = sanitized
      } catch (e) {
        console.warn(
          `🤖 ${providerName} - Could not parse request body for sanitization:`,
          e
        )
      }
    }

    return fetch(input, {
      ...init,
      headers,
      body,
    })
  }
}

type AIServiceConfig = Record<VercelAIService, (params: any) => any>

/**
 * Vercel AI SDKを使用したAIサービス設定
 */
export const aiServiceConfig: AIServiceConfig = {
  openai: ({ apiKey }) =>
    createOpenAI({
      apiKey,
      fetch: createEncodingSafeFetch('OpenAI'),
    }),
  anthropic: ({ apiKey }) =>
    createAnthropic({
      apiKey,
      fetch: createEncodingSafeFetch('Anthropic'),
    }),
  google: ({ apiKey }) =>
    createGoogleGenerativeAI({
      apiKey,
      fetch: createEncodingSafeFetch('Google'),
    }),
  azure: ({ resourceName, apiKey }) =>
    createAzure({
      resourceName,
      apiKey,
      fetch: createEncodingSafeFetch('Azure'),
    }),
  xai: ({ apiKey }) =>
    createXai({
      apiKey: process.env.XAI_API_KEY || apiKey,
      fetch: createEncodingSafeFetch('XAI'),
    }),
  groq: ({ apiKey }) =>
    createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey,
      fetch: createEncodingSafeFetch('Groq'),
    }),
  cohere: ({ apiKey }) =>
    createCohere({
      apiKey,
      fetch: createEncodingSafeFetch('Cohere'),
    }),
  mistralai: ({ apiKey }) =>
    createMistral({
      apiKey,
      fetch: createEncodingSafeFetch('Mistral'),
    }),
  perplexity: ({ apiKey }) =>
    createOpenAI({
      baseURL: 'https://api.perplexity.ai/',
      apiKey,
      fetch: createEncodingSafeFetch('Perplexity'),
    }),
  fireworks: ({ apiKey }) =>
    createOpenAI({
      baseURL: 'https://api.fireworks.ai/inference/v1',
      apiKey,
      fetch: createEncodingSafeFetch('Fireworks'),
    }),
  deepseek: ({ apiKey }) =>
    createDeepSeek({
      apiKey,
      fetch: createEncodingSafeFetch('DeepSeek'),
    }),
  openrouter: ({ apiKey }) =>
    createOpenRouter({
      apiKey,
      fetch: createEncodingSafeFetch('OpenRouter'),
    }),
  lmstudio: ({ baseURL }) =>
    createOpenAICompatible({ name: 'lmstudio', baseURL }),
  ollama: ({ baseURL }) => createOllama({ baseURL }),
  'custom-api': () => null, // 特別な処理はせず、カスタムAPI用
}

/**
 * ストリーミングでテキスト生成を行う
 */
export async function streamAiText({
  model,
  modelInstance,
  messages,
  temperature,
  maxTokens,
  options = {},
}: {
  model: string
  modelInstance: any
  messages: Message[]
  temperature: number
  maxTokens: number
  options?: any
}) {
  try {
    const result = await streamText({
      model: modelInstance(model, options),
      messages: messages as CoreMessage[],
      temperature,
      maxTokens,
    })

    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error(`Vercel AI Stream Error: ${error.message || 'Unknown error'}`)
    console.error(`Model: ${model}, Temperature: ${temperature}`)

    return new Response(
      JSON.stringify({
        error: `AI Service Error: ${error.message || 'Unknown error'}`,
        errorCode: 'AIServiceError',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * 一括でテキスト生成を行う
 */
export async function generateAiText({
  model,
  modelInstance,
  messages,
  temperature,
  maxTokens,
}: {
  model: string
  modelInstance: any
  messages: Message[]
  temperature: number
  maxTokens: number
}) {
  console.log('🤖 Vercel AI - generateAiText starting:', {
    model,
    messagesCount: messages.length,
    temperature,
    maxTokens,
  })

  try {
    // Sanitize messages to prevent encoding issues
    const sanitizedMessages = messages.map((msg) => ({
      ...msg,
      content:
        typeof msg.content === 'string'
          ? msg.content
              .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
              .replace(/[\u200B-\u200F\uFEFF]/g, '') // Remove zero-width characters
              .trim()
          : msg.content,
    }))

    console.log('🤖 Vercel AI - Messages sanitized, creating model instance...')
    const modelInstanceResult = modelInstance(model)
    console.log('🤖 Vercel AI - Model instance created successfully')

    console.log('🤖 Vercel AI - Calling generateText...')
    const result = await generateText({
      model: modelInstanceResult,
      messages: sanitizedMessages as CoreMessage[],
      temperature,
      maxTokens,
    })

    console.log('🤖 Vercel AI - generateText completed successfully')
    console.log(
      '🤖 Vercel AI - Response text length:',
      result.text?.length || 0
    )

    return new Response(JSON.stringify({ text: result.text }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('🤖 Vercel AI Generate Error - DETAILS:')
    console.error('🤖 Error type:', typeof error)
    console.error('🤖 Error constructor:', error?.constructor?.name)
    console.error('🤖 Error message:', error.message || 'Unknown error')

    // Handle specific Anthropic API errors
    if (
      error.message &&
      error.message.includes('RequestContentLengthMismatchError')
    ) {
      console.error('🤖 Character encoding issue detected')
      return new Response(
        JSON.stringify({
          error: 'Request encoding error. Please try again with simpler text.',
          errorCode: 'EncodingError',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      )
    }

    console.error('🤖 Error stack:', error.stack)
    console.error('🤖 Full error object:', error)
    console.error(`🤖 Model: ${model}, Temperature: ${temperature}`)

    return new Response(
      JSON.stringify({
        error: `AI Service Error: ${error.message || 'Unknown error'}`,
        errorCode: 'AIServiceError',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    )
  }
}
