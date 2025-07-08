import { Message } from '@/features/messages/messages'
import type { NextApiRequest, NextApiResponse } from 'next'
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('🚀 API/AI/Vercel - Request received:', {
    method: req.method,
    url: req.url,
  })

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      errorCode: 'METHOD_NOT_ALLOWED',
    })
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
  } = req.body

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
      return res.status(400).json({
        error: 'Empty API Key',
        errorCode: 'EmptyAPIKey',
      })
    }

    // Additional validation for API key format to prevent malformed requests
    if (aiApiKey.trim().length === 0) {
      console.log('🚀 API/AI/Vercel - ERROR: API key is empty string!')
      return res.status(400).json({
        error: 'Invalid API Key: API key cannot be empty',
        errorCode: 'InvalidAPIKey',
      })
    }

    // Service-specific API key validation
    if (aiService === 'anthropic') {
      // Anthropic API keys should start with 'sk-'
      if (!aiApiKey.startsWith('sk-')) {
        console.log(
          '🚀 API/AI/Vercel - ERROR: Invalid Anthropic API key format!'
        )
        return res.status(400).json({
          error: 'Invalid Anthropic API Key: Must start with sk-',
          errorCode: 'InvalidAPIKey',
        })
      }
    }
  }

  // ローカルLLMのURL検証
  if (isVercelLocalAIService(aiService) && aiService !== 'custom-api') {
    if (!localLlmUrl) {
      return res.status(400).json({
        error: 'Empty Local LLM URL',
        errorCode: 'EmptyLocalLLMURL',
      })
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
    return res.status(400).json({
      error: 'Invalid AI service or model',
      errorCode: 'AIInvalidProperty',
    })
  }

  // AIサービスのインスタンス作成
  const getServiceInstance = aiServiceConfig[aiService as VercelAIService]
  if (!getServiceInstance) {
    return res.status(400).json({
      error: 'Invalid AI service',
      errorCode: 'InvalidAIService',
    })
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
      const response = await streamAiText({
        model: modifiedModel,
        modelInstance,
        messages: modifiedMessages,
        temperature,
        maxTokens,
        options,
      })
      // For streaming, we need to pipe the response body to res
      if (response.body) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Transfer-Encoding', 'chunked')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(decoder.decode(value, { stream: true }))
          }
          res.end()
        } catch (streamError) {
          console.error('Streaming error:', streamError)
          res.end()
        }
      } else {
        res
          .status(500)
          .json({ error: 'No response body', errorCode: 'AIAPIError' })
      }
    } else {
      const response = await generateAiText({
        model: modifiedModel,
        modelInstance,
        messages: modifiedMessages,
        temperature,
        maxTokens,
      })
      const data = await response.json()
      res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('🚀 API/AI/Vercel - CRITICAL ERROR:', error)
    console.error('🚀 API/AI/Vercel - Error type:', typeof error)
    console.error('🚀 API/AI/Vercel - Error message:', (error as any)?.message)
    console.error('🚀 API/AI/Vercel - Error stack:', (error as any)?.stack)

    return res.status(500).json({
      error: 'Unexpected Error',
      errorCode: 'AIAPIError',
    })
  }
}
