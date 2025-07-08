import { Message } from '@/features/messages/messages'
import { NextRequest } from 'next/server'
import {
  VercelAIService,
  isVercelCloudAIService,
  isVercelLocalAIService,
} from '@/features/constants/settings'
import { modifyMessages } from '../services/utils'
import {
  aiServiceConfig,
  streamAiText,
  generateAiText,
} from '../services/vercelAi'
import { googleSearchGroundingModels } from '@/features/constants/aiModels'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: NextRequest) {
  console.log('🚀 API/AI/Vercel - Request received:', {
    method: req.method,
    url: req.url,
  })

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method Not Allowed',
        errorCode: 'METHOD_NOT_ALLOWED',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const {
    messages,
    apiKey,
    aiService,
    model,
    localLlmUrl,
    azureEndpoint,
    stream,
    useSearchGrounding,
    dynamicRetrievalThreshold,
    temperature = 1.0,
    maxTokens = 4096,
  } = await req.json()

  console.log('🚀 API/AI/Vercel - Request params:', {
    aiService,
    model,
    messagesCount: messages?.length,
    hasApiKey: !!apiKey,
    stream,
    temperature,
    maxTokens,
  })

  // APIキーの取得と検証
  let aiApiKey = apiKey
  console.log('🚀 API/AI/Vercel - Initial API key present:', !!apiKey)
  console.log(
    '🚀 API/AI/Vercel - Is cloud service:',
    isVercelCloudAIService(aiService)
  )

  if (isVercelCloudAIService(aiService)) {
    if (!aiApiKey) {
      // 環境変数から[サービス名]_KEY または [サービス名]_API_KEY の形式でAPIキーを取得
      const servicePrefix = aiService.toUpperCase()
      console.log(
        '🚀 API/AI/Vercel - Looking for env vars:',
        `${servicePrefix}_KEY`,
        `${servicePrefix}_API_KEY`
      )

      const envKey1 = process.env[`${servicePrefix}_KEY`]
      const envKey2 = process.env[`${servicePrefix}_API_KEY`]

      console.log('🚀 API/AI/Vercel - Env key 1 present:', !!envKey1)
      console.log('🚀 API/AI/Vercel - Env key 2 present:', !!envKey2)

      aiApiKey = envKey1 || envKey2 || ''
    }

    console.log('🚀 API/AI/Vercel - Final API key present:', !!aiApiKey)

    if (!aiApiKey) {
      console.log('🚀 API/AI/Vercel - ERROR: No API key found!')
      return new Response(
        JSON.stringify({ error: 'Empty API Key', errorCode: 'EmptyAPIKey' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // ローカルLLMのURL検証
  if (isVercelLocalAIService(aiService) && aiService !== 'custom-api') {
    if (!localLlmUrl) {
      return new Response(
        JSON.stringify({
          error: 'Empty Local LLM URL',
          errorCode: 'EmptyLocalLLMURL',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // Azureのエンドポイントとデプロイメント名の処理
  let modifiedAzureEndpoint = (
    azureEndpoint ||
    process.env.AZURE_ENDPOINT ||
    ''
  ).replace(/^https:\/\/|\.openai\.azure\.com.*$/g, '')
  let modifiedAzureDeployment =
    (azureEndpoint || process.env.AZURE_ENDPOINT || '').match(
      /\/deployments\/([^\/]+)/
    )?.[1] || ''
  let modifiedModel = aiService === 'azure' ? modifiedAzureDeployment : model

  // モデル名のバリデーション
  if (isVercelCloudAIService(aiService) && !modifiedModel) {
    return new Response(
      JSON.stringify({
        error: 'Invalid AI service or model',
        errorCode: 'AIInvalidProperty',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // AIサービスのインスタンス作成
  const getServiceInstance = aiServiceConfig[aiService as VercelAIService]
  if (!getServiceInstance) {
    return new Response(
      JSON.stringify({
        error: 'Invalid AI service',
        errorCode: 'InvalidAIService',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    // AIサービスに適したパラメータを生成
    const serviceParams =
      aiService === 'azure'
        ? { resourceName: modifiedAzureEndpoint, apiKey: aiApiKey }
        : isVercelLocalAIService(aiService)
          ? { baseURL: localLlmUrl }
          : { apiKey: aiApiKey }

    // モデルインスタンスの作成
    const modelInstance = getServiceInstance(serviceParams)

    // メッセージの修正
    const modifiedMessages = modifyMessages(aiService, model, messages)

    // Google検索接地オプションの設定
    const isUseSearchGrounding =
      aiService === 'google' &&
      useSearchGrounding &&
      modifiedMessages.every((msg) => typeof msg.content === 'string')

    let options = {}
    if (isUseSearchGrounding) {
      options = {
        useSearchGrounding: true,
        ...(dynamicRetrievalThreshold !== undefined &&
          modifiedModel &&
          googleSearchGroundingModels.includes(
            modifiedModel as (typeof googleSearchGroundingModels)[number]
          ) && {
            dynamicRetrievalConfig: {
              dynamicThreshold: dynamicRetrievalThreshold,
            },
          }),
      }
    }

    console.log('options', options)

    // ストリーミングレスポンスまたは一括レスポンスの生成
    if (stream) {
      return await streamAiText({
        model: modifiedModel,
        modelInstance,
        messages: modifiedMessages,
        temperature,
        maxTokens,
        options,
      })
    } else {
      return await generateAiText({
        model: modifiedModel,
        modelInstance,
        messages: modifiedMessages,
        temperature,
        maxTokens,
      })
    }
  } catch (error) {
    console.error('🚀 API/AI/Vercel - CRITICAL ERROR:', error)
    console.error('🚀 API/AI/Vercel - Error type:', typeof error)
    console.error('🚀 API/AI/Vercel - Error message:', (error as any)?.message)
    console.error('🚀 API/AI/Vercel - Error stack:', (error as any)?.stack)

    return new Response(
      JSON.stringify({
        error: 'Unexpected Error',
        errorCode: 'AIAPIError',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
