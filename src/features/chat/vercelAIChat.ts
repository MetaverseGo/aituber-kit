// TODO: Implement Anthropic prompt caching using cache_control and the required headers (see https://docs.anthropic.com/claude/docs/prompt-caching). This will require restructuring system/user messages to use Anthropic's native message format and adding the 'anthropic-beta: prompt-caching-2024-07-31' header.
// Current implementation does NOT use prompt caching.
// ---
//
import { Message } from '../messages/messages'
import i18next from 'i18next'
import toastStore from '@/features/stores/toast'
import {
  isVercelLocalAIService,
  AIService,
} from '@/features/constants/settings'
import settingsStore from '../stores/settings'

const getAIConfig = () => {
  const ss = settingsStore.getState()
  // AIServiceとして扱う（より広い型）
  const aiService = ss.selectAIService as AIService

  // Check if we're running on the server (no window object)
  const isServer = typeof window === 'undefined'

  // APIキー名は条件分岐で取得
  let apiKey = ''
  if (
    typeof aiService === 'string' &&
    aiService !== 'dify' &&
    aiService !== 'custom-api'
  ) {
    // First try to get from settings store (client-side)
    apiKey = (ss[`${aiService}Key` as keyof typeof ss] as string) || ''

    // If empty and we're on server, try environment variables
    if (!apiKey && isServer) {
      const servicePrefix = aiService.toUpperCase()
      apiKey =
        process.env[`${servicePrefix}_KEY`] ||
        process.env[`${servicePrefix}_API_KEY`] ||
        process.env[`NEXT_PUBLIC_${servicePrefix}_KEY`] ||
        process.env[`NEXT_PUBLIC_${servicePrefix}_API_KEY`] ||
        ''

      console.log(`🔑 Server-side API key lookup for ${aiService}:`, !!apiKey)
    }
  }

  return {
    aiApiKey: apiKey,
    selectAIService: aiService,
    selectAIModel: ss.selectAIModel,
    localLlmUrl: ss.localLlmUrl,
    azureEndpoint: ss.azureEndpoint,
    useSearchGrounding: ss.useSearchGrounding,
    temperature: ss.temperature,
    maxTokens: ss.maxTokens,
    customApiUrl: ss.customApiUrl,
    customApiHeaders: ss.customApiHeaders,
    customApiBody: ss.customApiBody,
    customApiStream: ss.customApiStream,
    includeSystemMessagesInCustomApi: ss.includeSystemMessagesInCustomApi,
  }
}

function handleApiError(errorCode: string): string {
  const languageCode = settingsStore.getState().selectLanguage
  i18next.changeLanguage(languageCode)

  // Special handling for API key related errors
  if (errorCode === 'EmptyAPIKey' || errorCode === 'InvalidAPIKey') {
    const aiService = settingsStore.getState().selectAIService
    if (aiService === 'anthropic') {
      return i18next.t(
        'Errors.AnthropicAPIKeyRequired',
        'Please configure your Anthropic API key in Settings → Model Provider. Get your free API key at https://console.anthropic.com/'
      )
    }
  }

  // Handle encoding errors specifically
  if (errorCode === 'RequestEncodingError') {
    return i18next.t(
      'Errors.RequestEncodingError',
      'Request contains characters that cannot be processed. Please try rephrasing your message with simpler text.'
    )
  }

  return i18next.t(`Errors.${errorCode || 'AIAPIError'}`)
}

// APIエンドポイントを決定する関数
function getApiEndpoint(aiService: string): string {
  // isVercelLocalAIServiceを使用してapiサービスかどうかを判定
  if (isVercelLocalAIService(aiService) && aiService === 'custom-api') {
    return '/api/ai/custom'
  }
  return '/api/ai/vercel'
}

export async function getVercelAIChatResponse(
  messages: Message[],
  aiServiceOverride?: string
) {
  const {
    aiApiKey,
    selectAIService,
    selectAIModel,
    localLlmUrl,
    azureEndpoint,
    useSearchGrounding,
    temperature,
    maxTokens,
    customApiUrl,
    customApiHeaders,
    customApiBody,
  } = getAIConfig()

  // Use override if provided
  const aiService = aiServiceOverride || selectAIService

  // APIエンドポイントを決定
  const relativeEndpoint = getApiEndpoint(aiService)
  const isServer = typeof window === 'undefined'
  const apiEndpoint = isServer
    ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${relativeEndpoint}`
    : relativeEndpoint

  try {
    // 共通リクエストデータ
    const requestData: any = {
      messages,
      stream: false,
    }

    // サービスタイプに応じてリクエストデータを追加
    if (aiService === 'custom-api') {
      // カスタムAPI用データ
      const filteredMessages = getAIConfig().includeSystemMessagesInCustomApi
        ? messages
        : messages.filter((message) => message.role !== 'system')

      Object.assign(requestData, {
        customApiUrl,
        customApiHeaders,
        customApiBody,
        temperature,
        maxTokens,
        messages: filteredMessages, // フィルタリングされたメッセージを使用
      })
    } else {
      // Vercel AI SDK用データ
      Object.assign(requestData, {
        apiKey: aiApiKey,
        aiService: aiService,
        model: selectAIModel,
        localLlmUrl,
        azureEndpoint,
        useSearchGrounding,
        temperature,
        maxTokens,
      })
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })

    if (!response.ok) {
      const responseBody = await response.json()
      throw new Error(
        `API request to ${aiService} failed with status ${response.status} and body ${responseBody.error}`,
        { cause: { errorCode: responseBody.errorCode } }
      )
    }

    const data = await response.json()
    return { text: data.text }
  } catch (error: any) {
    console.error(`Error fetching ${aiService} API response:`, error)

    // Handle specific error codes from API responses
    let errorCode = 'AIAPIError'

    if (error.cause && error.cause.errorCode) {
      errorCode = error.cause.errorCode
    } else if (error.message) {
      // Check for specific error patterns
      if (error.message.includes('Empty API Key')) {
        errorCode = 'EmptyAPIKey'
      } else if (
        error.message.includes('Invalid') &&
        error.message.includes('API Key')
      ) {
        errorCode = 'InvalidAPIKey'
      } else if (
        error.message.includes('401') ||
        error.message.includes('unauthorized')
      ) {
        errorCode = 'InvalidAPIKey'
      } else if (
        error.message.includes('RequestContentLengthMismatchError') ||
        error.cause?.code === 'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH'
      ) {
        errorCode = 'RequestEncodingError'
        console.error(
          'Request encoding error detected. This may be due to special characters in the prompt.'
        )
      }
    }

    const errorMessage = handleApiError(errorCode)
    console.error('Final error message:', errorMessage)

    return {
      response: new Response(
        JSON.stringify({
          choices: [{ message: { content: errorMessage } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    }
  }
}

export async function getVercelAIChatResponseStream(
  messages: Message[]
): Promise<ReadableStream<string>> {
  const {
    aiApiKey,
    selectAIService,
    selectAIModel,
    localLlmUrl,
    azureEndpoint,
    useSearchGrounding,
    temperature,
    maxTokens,
    customApiUrl,
    customApiHeaders,
    customApiBody,
  } = getAIConfig()

  // APIエンドポイントを決定
  const apiEndpoint = getApiEndpoint(selectAIService)

  // 共通リクエストデータ
  const requestData: any = {
    messages,
    stream: true,
  }

  // サービスタイプに応じてリクエストデータを追加
  if (selectAIService === 'custom-api') {
    // カスタムAPI用データ
    const filteredMessages = getAIConfig().includeSystemMessagesInCustomApi
      ? messages
      : messages.filter((message) => message.role !== 'system')

    Object.assign(requestData, {
      customApiUrl,
      customApiHeaders,
      customApiBody,
      temperature,
      maxTokens,
      messages: filteredMessages, // フィルタリングされたメッセージを使用
    })
  } else {
    // Vercel AI SDK用データ
    Object.assign(requestData, {
      apiKey: aiApiKey,
      aiService: selectAIService,
      model: selectAIModel,
      localLlmUrl,
      azureEndpoint,
      useSearchGrounding,
      temperature,
      maxTokens,
    })
  }

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
  })

  try {
    if (!response.ok) {
      const responseBody = await response.json()
      throw new Error(
        `API request to ${selectAIService} failed with status ${response.status} and body ${responseBody.error}`,
        { cause: { errorCode: responseBody.errorCode } }
      )
    }

    return new ReadableStream({
      async start(controller) {
        if (!response.body) {
          throw new Error(
            `API response from ${selectAIService} is empty, status ${response.status}`,
            { cause: { errorCode: 'AIAPIError' } }
          )
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('0:')) {
                const content = line.substring(2).trim()
                const decodedContent = JSON.parse(content)
                controller.enqueue(decodedContent)
              } else if (line.startsWith('data:')) {
                // OpenAI API形式のストリームデータに対応
                const content = line.substring(5).trim() // 'data:' プレフィックスを除去
                if (content === '[DONE]') continue // 終了マーカーは無視

                try {
                  const data = JSON.parse(content)
                  const text = data.choices?.[0]?.delta?.content
                  if (text) {
                    controller.enqueue(text)
                  }
                } catch (error) {
                  console.error('Error parsing JSON:', error)
                }
              } else if (line.startsWith('3:')) {
                const content = line.substring(2).trim()
                const decodedContent = JSON.parse(content)

                console.error(
                  `Error fetching ${selectAIService} API response:`,
                  decodedContent
                )
                toastStore.getState().addToast({
                  message: decodedContent,
                  type: 'error',
                  tag: 'vercel-api-error',
                })
              } else if (line.startsWith('9:')) {
                // Anthropicのツール呼び出し情報を処理
                const content = line.substring(2).trim()
                try {
                  const decodedContent = JSON.parse(content)
                  if (decodedContent.toolName) {
                    console.log(`Tool called: ${decodedContent.toolName}`)
                    const message = i18next.t('Toasts.UsingTool', {
                      toolName: decodedContent.toolName,
                    })
                    toastStore.getState().addToast({
                      message,
                      type: 'tool',
                      tag: `vercel-tool-info-${decodedContent.toolName}`,
                      duration: 3000,
                    })
                  }
                } catch (error) {
                  console.error('Error parsing tool call JSON:', error)
                }
              } else if (line.startsWith('e:') || line.startsWith('d:')) {
                continue
              } else if (line.match(/^([a-z]|\d):/)) {
                // これらは通常、ストリームの終了やメタデータを示すものであり、コンテンツではない
                continue
              } else if (line.trim() !== '') {
                // Ollamaなど、JSONLフォーマットのストリーミングデータに対応
                try {
                  const data = JSON.parse(line)
                  // Ollama形式: {"message":{"role":"assistant","content":"テキスト"}}
                  if (data.message?.content) {
                    controller.enqueue(data.message.content)
                  }
                } catch (error) {
                  console.error('Error parsing JSONL:', error, line)
                }
              }
            }
          }
        } catch (error) {
          console.error(
            `Error fetching ${selectAIService} API response:`,
            error
          )

          const errorMessage = handleApiError('AIAPIError')
          toastStore.getState().addToast({
            message: errorMessage,
            type: 'error',
            tag: 'vercel-api-error',
          })
        } finally {
          controller.close()
          reader.releaseLock()
        }
      },
    })
  } catch (error: any) {
    const errorMessage = handleApiError(
      error.cause ? error.cause.errorCode : 'AIAPIError'
    )
    toastStore.getState().addToast({
      message: errorMessage,
      type: 'error',
      tag: 'vercel-api-error',
    })
    throw error
  }
}
