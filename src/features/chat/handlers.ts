import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'
import { Message, EmotionType } from '@/features/messages/messages'
import { speakCharacter } from '@/features/messages/speakCharacter'
import { judgeSlide } from '@/features/slide/slideAIHelpers'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import slideStore from '@/features/stores/slide'
import { goToSlide } from '@/components/slides'
import { messageSelectors } from '../messages/messageSelectors'
import webSocketStore from '@/features/stores/websocketStore'
import i18next from 'i18next'
import toastStore from '@/features/stores/toast'
import { generateMessageId } from '@/utils/messageUtils'
import { SYSTEM_PROMPT_EN } from '@/features/constants/systemPromptConstants'

// セッションIDを生成する関数
const generateSessionId = () => generateMessageId()

/**
 * Check if TTS is disabled via URL parameter
 * This is used to conditionally disable TTS in widget contexts
 */
const isTTSDisabled = (): boolean => {
  if (typeof window === 'undefined') return false
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('disableTTS') === 'true'
}

// コードブロックのデリミネーター
const CODE_DELIMITER = '```'

// Store the authentication token received from the parent
let widgetAuthToken: string | null = null

// Listen for WIDGET_AUTH event from parent
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'WIDGET_AUTH' && event.data.token) {
      widgetAuthToken = event.data.token
      // Also store it globally for other components to access
      ;(window as any).widgetAuthToken = event.data.token
    }
  })
}

// Utility to get the widget's current auth token
async function getWidgetAuthToken(): Promise<string> {
  return widgetAuthToken || ''
}

// Export a synchronous version for other components to use
export function getCurrentWidgetAuthToken(): string {
  return widgetAuthToken || ''
}

// Check if user has completed personality analysis
const hasCompletedPersonalityAnalysis = (): boolean => {
  try {
    const completed = localStorage.getItem('personality_analysis_completed')
    return completed === 'true'
  } catch {
    return false
  }
}

// Check if required API keys are configured
const hasRequiredAPIKeys = (): boolean => {
  try {
    const { anthropicKey, selectAIService } = settingsStore.getState()

    // If using Anthropic, check for Anthropic key
    if (selectAIService === 'anthropic' || !selectAIService) {
      return !!anthropicKey
    }

    // For other services, just check if any service is selected
    return !!selectAIService
  } catch {
    return false
  }
}

// Mark personality analysis as completed
const markPersonalityAnalysisCompleted = (): void => {
  try {
    localStorage.setItem('personality_analysis_completed', 'true')
    // Clear the session ID since analysis is complete
    localStorage.removeItem('personality_session_id')
    // Clear the step progress data
    localStorage.removeItem('matchmaking_step_progress')
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * テキストから感情タグ `[...]` を抽出する
 * @param text 入力テキスト
 * @returns 感情タグと残りのテキスト
 */
const extractEmotion = (
  text: string
): { emotionTag: string; remainingText: string } => {
  // 先頭のスペースを無視して、感情タグを検出
  const emotionMatch = text.match(/^\s*\[(.*?)\]/)
  if (emotionMatch?.[0]) {
    return {
      emotionTag: emotionMatch[0].trim(), // タグ自体の前後のスペースは除去
      // 先頭のスペースも含めて削除し、さらに前後のスペースを除去
      remainingText: text
        .slice(text.indexOf(emotionMatch[0]) + emotionMatch[0].length)
        .trimStart(),
    }
  }
  return { emotionTag: '', remainingText: text }
}

/**
 * テキストから文法的に区切りの良い文を抽出する
 * @param text 入力テキスト
 * @returns 抽出された文と残りのテキスト
 */
const extractSentence = (
  text: string
): { sentence: string; remainingText: string } => {
  const sentenceMatch = text.match(
    /^(.{1,19}?(?:[。．.!?！？\n]|(?=\[))|.{20,}?(?:[、,。．.!?！？\n]|(?=\[)))/
  )
  if (sentenceMatch?.[0]) {
    return {
      sentence: sentenceMatch[0],
      remainingText: text.slice(sentenceMatch[0].length).trimStart(),
    }
  }
  return { sentence: '', remainingText: text }
}

/**
 * 発話と関連する状態更新を行う
 * @param sessionId セッションID
 * @param sentence 発話する文
 * @param emotionTag 感情タグ (例: "[neutral]")
 * @param currentAssistantMessageListRef アシスタントメッセージリストの参照
 * @param currentSlideMessagesRef スライドメッセージリストの参照
 */
const handleSpeakAndStateUpdate = (
  sessionId: string,
  sentence: string,
  emotionTag: string,
  currentAssistantMessageListRef: { current: string[] },
  currentSlideMessagesRef: { current: string[] }
) => {
  const hs = homeStore.getState()
  const emotion = emotionTag.includes('[')
    ? (emotionTag.slice(1, -1).toLowerCase() as EmotionType)
    : 'relaxed'

  // 発話不要/不可能な文字列だった場合はスキップ
  if (
    sentence === '' ||
    sentence.replace(
      /^[\s\u3000\t\n\r\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]'"''""・、。,.!?！？:：;；\-_=+~～*＊@＠#＃$＄%％^＾&＆|｜\\＼/／`｀]+$/gu,
      ''
    ) === ''
  ) {
    return
  }

  // Only trigger TTS if not disabled
  if (!isTTSDisabled()) {
    speakCharacter(
      sessionId,
      { message: sentence, emotion: emotion },
      () => {
        hs.incrementChatProcessingCount()
        currentSlideMessagesRef.current.push(sentence)
        homeStore.setState({
          slideMessages: [...currentSlideMessagesRef.current],
        })
      },
      () => {
        hs.decrementChatProcessingCount()
        currentSlideMessagesRef.current.shift()
        homeStore.setState({
          slideMessages: [...currentSlideMessagesRef.current],
        })
      }
    )
  }
}

/**
 * 受け取ったメッセージを処理し、AIの応答を生成して発話させる (Refactored)
 * @param receivedMessage 処理する文字列
 */
export const speakMessageHandler = async (receivedMessage: string) => {
  const sessionId = generateSessionId()
  const currentSlideMessagesRef = { current: [] as string[] }
  const assistantMessageListRef = { current: [] as string[] }

  let isCodeBlock: boolean = false
  let codeBlockContent: string = ''
  let accumulatedAssistantText: string = ''
  let remainingMessage = receivedMessage
  let currentMessageId: string = generateMessageId()

  while (remainingMessage.length > 0 || isCodeBlock) {
    let processableText = ''
    let currentCodeBlock = ''

    if (isCodeBlock) {
      if (remainingMessage.includes(CODE_DELIMITER)) {
        const [codeEnd, ...rest] = remainingMessage.split(CODE_DELIMITER)
        currentCodeBlock = codeBlockContent + codeEnd
        codeBlockContent = ''
        remainingMessage = rest.join(CODE_DELIMITER).trimStart()
        isCodeBlock = false

        if (accumulatedAssistantText.trim()) {
          homeStore.getState().upsertMessage({
            id: currentMessageId,
            role: 'assistant',
            content: accumulatedAssistantText.trim(),
          })
          accumulatedAssistantText = ''
        }
        const codeBlockId = generateMessageId()
        homeStore.getState().upsertMessage({
          id: codeBlockId,
          role: 'code',
          content: currentCodeBlock,
        })

        currentMessageId = generateMessageId()
        continue
      } else {
        codeBlockContent += remainingMessage
        remainingMessage = ''
        continue
      }
    } else if (remainingMessage.includes(CODE_DELIMITER)) {
      const [beforeCode, ...rest] = remainingMessage.split(CODE_DELIMITER)
      processableText = beforeCode
      codeBlockContent = rest.join(CODE_DELIMITER)
      isCodeBlock = true
      remainingMessage = ''
    } else {
      processableText = remainingMessage
      remainingMessage = ''
    }

    if (processableText.length > 0) {
      let localRemaining = processableText.trimStart()
      while (localRemaining.length > 0) {
        const prevLocalRemaining = localRemaining
        const { emotionTag, remainingText: textAfterEmotion } =
          extractEmotion(localRemaining)
        const { sentence, remainingText: textAfterSentence } =
          extractSentence(textAfterEmotion)

        if (sentence) {
          assistantMessageListRef.current.push(sentence)
          const aiText = emotionTag ? `${emotionTag} ${sentence}` : sentence
          accumulatedAssistantText += aiText + ' '
          handleSpeakAndStateUpdate(
            sessionId,
            sentence,
            emotionTag,
            assistantMessageListRef,
            currentSlideMessagesRef
          )
          localRemaining = textAfterSentence
        } else {
          if (localRemaining === prevLocalRemaining && localRemaining) {
            const finalSentence = localRemaining
            assistantMessageListRef.current.push(finalSentence)
            const aiText = emotionTag
              ? `${emotionTag} ${finalSentence}`
              : finalSentence
            accumulatedAssistantText += aiText + ' '
            handleSpeakAndStateUpdate(
              sessionId,
              finalSentence,
              emotionTag,
              assistantMessageListRef,
              currentSlideMessagesRef
            )
            localRemaining = ''
          } else {
            localRemaining = textAfterSentence
          }
        }
        if (
          localRemaining.length > 0 &&
          localRemaining === prevLocalRemaining &&
          !sentence
        ) {
          console.warn(
            'Potential infinite loop detected in speakMessageHandler, breaking. Remaining:',
            localRemaining
          )
          const finalSentence = localRemaining
          assistantMessageListRef.current.push(finalSentence)
          accumulatedAssistantText += finalSentence + ' '
          handleSpeakAndStateUpdate(
            sessionId,
            finalSentence,
            '',
            assistantMessageListRef,
            currentSlideMessagesRef
          )
          break
        }
      }
    }

    if (isCodeBlock && codeBlockContent) {
      if (accumulatedAssistantText.trim()) {
        homeStore.getState().upsertMessage({
          id: currentMessageId,
          role: 'assistant',
          content: accumulatedAssistantText.trim(),
        })
        accumulatedAssistantText = ''
      }
      remainingMessage = codeBlockContent
      codeBlockContent = ''
    }
  }

  if (accumulatedAssistantText.trim()) {
    homeStore.getState().upsertMessage({
      id: currentMessageId,
      role: 'assistant',
      content: accumulatedAssistantText.trim(),
    })
  }
  if (isCodeBlock && codeBlockContent.trim()) {
    console.warn('Loop ended unexpectedly while in code block state.')
    homeStore.getState().upsertMessage({
      role: 'code',
      content: codeBlockContent.trim(),
    })
  }
}

/**
 * AIからの応答を処理する関数 (Refactored for chunk-by-chunk saving)
 * @param messages 解答生成に使用するメッセージの配列
 */
export const processAIResponse = async (messages: Message[]) => {
  const sessionId = generateSessionId()
  homeStore.setState({ chatProcessing: true })
  let stream

  const currentSlideMessagesRef = { current: [] as string[] }
  const assistantMessageListRef = { current: [] as string[] }

  try {
    stream = await getAIChatResponseStream(messages)
  } catch (e) {
    console.error(e)
    homeStore.setState({ chatProcessing: false })
    return
  }

  if (stream == null) {
    homeStore.setState({ chatProcessing: false })
    return
  }

  const reader = stream.getReader()
  let receivedChunksForSpeech = ''
  let currentMessageId: string | null = null
  let currentMessageContent = ''
  let currentEmotionTag = ''
  let isCodeBlock = false
  let codeBlockContent = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        let textToAdd = value

        if (!isCodeBlock) {
          const delimiterIndexInValue = value.indexOf(CODE_DELIMITER)
          if (delimiterIndexInValue !== -1) {
            textToAdd = value.substring(0, delimiterIndexInValue)
          }
        }

        if (currentMessageId === null) {
          currentMessageId = generateMessageId()
          currentMessageContent = textToAdd
          if (currentMessageContent) {
            homeStore.getState().upsertMessage({
              id: currentMessageId,
              role: 'assistant',
              content: currentMessageContent,
            })
          }
        } else if (!isCodeBlock) {
          currentMessageContent += textToAdd

          if (textToAdd) {
            homeStore.getState().upsertMessage({
              id: currentMessageId,
              role: 'assistant',
              content: currentMessageContent,
            })
          }
        }

        if (!isCodeBlock && currentMessageContent) {
          homeStore.setState({ assistantMessage: currentMessageContent })
        }

        receivedChunksForSpeech += value
      }

      let processableTextForSpeech = receivedChunksForSpeech
      receivedChunksForSpeech = ''

      while (processableTextForSpeech.length > 0) {
        const originalProcessableText = processableTextForSpeech

        if (isCodeBlock) {
          codeBlockContent += processableTextForSpeech
          processableTextForSpeech = ''

          const delimiterIndex = codeBlockContent.lastIndexOf(CODE_DELIMITER)

          if (
            delimiterIndex !== -1 &&
            delimiterIndex >=
              codeBlockContent.length -
                (originalProcessableText.length + CODE_DELIMITER.length - 1)
          ) {
            const actualCode = codeBlockContent.substring(0, delimiterIndex)
            const remainingAfterDelimiter = codeBlockContent.substring(
              delimiterIndex + CODE_DELIMITER.length
            )

            if (actualCode.trim()) {
              homeStore.getState().upsertMessage({
                role: 'code',
                content: actualCode,
              })
            }

            codeBlockContent = ''
            isCodeBlock = false
            currentEmotionTag = ''

            currentMessageId = generateMessageId()
            currentMessageContent = ''

            processableTextForSpeech = remainingAfterDelimiter.trimStart()
            continue
          } else {
            receivedChunksForSpeech = codeBlockContent + receivedChunksForSpeech
            codeBlockContent = ''
            break
          }
        } else {
          const delimiterIndex =
            processableTextForSpeech.indexOf(CODE_DELIMITER)
          if (delimiterIndex !== -1) {
            const beforeCode = processableTextForSpeech.substring(
              0,
              delimiterIndex
            )
            const afterDelimiterRaw = processableTextForSpeech.substring(
              delimiterIndex + CODE_DELIMITER.length
            )

            //
            let textToProcessBeforeCode = beforeCode.trimStart()
            while (textToProcessBeforeCode.length > 0) {
              const prevText = textToProcessBeforeCode
              const {
                emotionTag: extractedEmotion,
                remainingText: textAfterEmotion,
              } = extractEmotion(textToProcessBeforeCode)
              if (extractedEmotion) currentEmotionTag = extractedEmotion
              const { sentence, remainingText: textAfterSentence } =
                extractSentence(textAfterEmotion)

              if (sentence) {
                handleSpeakAndStateUpdate(
                  sessionId,
                  sentence,
                  currentEmotionTag,
                  assistantMessageListRef,
                  currentSlideMessagesRef
                )
                textToProcessBeforeCode = textAfterSentence
                if (!textAfterSentence) currentEmotionTag = ''
              } else {
                receivedChunksForSpeech =
                  textToProcessBeforeCode + receivedChunksForSpeech
                textToProcessBeforeCode = ''
                break
              }

              if (
                textToProcessBeforeCode.length > 0 &&
                textToProcessBeforeCode === prevText
              ) {
                console.warn('Speech processing loop stuck on:', prevText)
                receivedChunksForSpeech =
                  textToProcessBeforeCode + receivedChunksForSpeech
                break
              }
            }

            isCodeBlock = true
            codeBlockContent = ''

            const langMatch = afterDelimiterRaw.match(/^ *(\w+)? *\n/)
            let remainingAfterDelimiter = afterDelimiterRaw
            if (langMatch) {
              remainingAfterDelimiter = afterDelimiterRaw.substring(
                langMatch[0].length
              )
            }
            processableTextForSpeech = remainingAfterDelimiter
            continue
          } else {
            const {
              emotionTag: extractedEmotion,
              remainingText: textAfterEmotion,
            } = extractEmotion(processableTextForSpeech)
            if (extractedEmotion) currentEmotionTag = extractedEmotion

            const { sentence, remainingText: textAfterSentence } =
              extractSentence(textAfterEmotion)

            if (sentence) {
              handleSpeakAndStateUpdate(
                sessionId,
                sentence,
                currentEmotionTag,
                assistantMessageListRef,
                currentSlideMessagesRef
              )
              processableTextForSpeech = textAfterSentence
              if (!textAfterSentence) currentEmotionTag = ''
            } else {
              receivedChunksForSpeech =
                processableTextForSpeech + receivedChunksForSpeech
              processableTextForSpeech = ''
              break
            }
          }
        }

        if (
          processableTextForSpeech.length > 0 &&
          processableTextForSpeech === originalProcessableText
        ) {
          console.warn(
            'Main speech processing loop stuck on:',
            originalProcessableText
          )
          receivedChunksForSpeech =
            processableTextForSpeech + receivedChunksForSpeech
          processableTextForSpeech = ''
          break
        }
      }

      if (done) {
        if (receivedChunksForSpeech.length > 0) {
          if (!isCodeBlock) {
            const finalSentence = receivedChunksForSpeech
            const { emotionTag: extractedEmotion, remainingText: finalText } =
              extractEmotion(finalSentence)
            if (extractedEmotion) currentEmotionTag = extractedEmotion

            handleSpeakAndStateUpdate(
              sessionId,
              finalText,
              currentEmotionTag,
              assistantMessageListRef,
              currentSlideMessagesRef
            )
          } else {
            console.warn(
              'Stream ended while still in code block state. Saving remaining code.',
              codeBlockContent
            )
            codeBlockContent += receivedChunksForSpeech
            if (codeBlockContent.trim()) {
              homeStore.getState().upsertMessage({
                role: 'code',
                content: codeBlockContent,
              })
            }
            codeBlockContent = ''
            isCodeBlock = false
          }
        }

        if (isCodeBlock && codeBlockContent.trim()) {
          console.warn(
            'Stream ended unexpectedly while in code block state. Saving buffered code.'
          )
          homeStore.getState().upsertMessage({
            role: 'code',
            content: codeBlockContent,
          })
          codeBlockContent = ''
          isCodeBlock = false
        }
        break
      }
    }
  } catch (e) {
    console.error('Error processing AI response stream:', e)
  } finally {
    reader.releaseLock()
  }

  homeStore.setState({
    chatProcessing: false,
  })

  if (currentMessageContent.trim()) {
    homeStore.getState().upsertMessage({
      id: currentMessageId ?? generateMessageId(),
      role: 'assistant',
      content: currentMessageContent.trim(),
    })
  }
  if (isCodeBlock && codeBlockContent.trim()) {
    console.warn(
      'Stream ended unexpectedly while in code block state. Saving buffered code.'
    )
    homeStore.getState().upsertMessage({
      role: 'code',
      content: codeBlockContent,
    })
    codeBlockContent = ''
    isCodeBlock = false
  }
}

/**
 * アシスタントとの会話を行う
 * 画面のチャット欄から入力されたときに実行される処理
 * Youtubeでチャット取得した場合もこの関数を使用する
 */
export const handleSendChatFn = () => async (text: string) => {
  // Use a consistent sessionId for the entire personality analysis session
  let sessionId = localStorage.getItem('personality_session_id')
  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem('personality_session_id', sessionId)
  }

  const newMessage = text
  const timestamp = new Date().toISOString()

  if (newMessage === null) return

  const ss = settingsStore.getState()
  const sls = slideStore.getState()
  const wsManager = webSocketStore.getState().wsManager
  const modalImage = homeStore.getState().modalImage

  if (ss.externalLinkageMode) {
    homeStore.setState({ chatProcessing: true })

    if (wsManager?.websocket?.readyState === WebSocket.OPEN) {
      homeStore.getState().upsertMessage({
        role: 'user',
        content: newMessage,
        timestamp: timestamp,
      })

      wsManager.websocket.send(
        JSON.stringify({ content: newMessage, type: 'chat' })
      )
    } else {
      toastStore.getState().addToast({
        message: i18next.t('NotConnectedToExternalAssistant'),
        type: 'error',
        tag: 'not-connected-to-external-assistant',
      })
      homeStore.setState({
        chatProcessing: false,
      })
    }
  } else if (ss.realtimeAPIMode) {
    if (wsManager?.websocket?.readyState === WebSocket.OPEN) {
      homeStore.getState().upsertMessage({
        role: 'user',
        content: newMessage,
        timestamp: timestamp,
      })
    }
  } else {
    let systemPrompt = ss.systemPrompt
    if (ss.slideMode) {
      if (sls.isPlaying) {
        return
      }

      try {
        let scripts = JSON.stringify(
          require(
            `../../../public/slides/${sls.selectedSlideDocs}/scripts.json`
          )
        )
        systemPrompt = systemPrompt.replace('{{SCRIPTS}}', scripts)

        let supplement = ''
        try {
          const response = await fetch(
            `/api/getSupplement?slideName=${sls.selectedSlideDocs}`
          )
          if (!response.ok) {
            throw new Error('Failed to fetch supplement')
          }
          const data = await response.json()
          supplement = data.supplement
          systemPrompt = systemPrompt.replace('{{SUPPLEMENT}}', supplement)
        } catch (e) {
          console.error('supplement.txtの読み込みに失敗しました:', e)
        }

        const answerString = await judgeSlide(newMessage, scripts, supplement)
        const answer = JSON.parse(answerString)
        if (answer.judge === 'true' && answer.page !== '') {
          goToSlide(Number(answer.page))
          systemPrompt += `\n\nEspecial Page Number is ${answer.page}.`
        }
      } catch (e) {
        console.error(e)
      }
    }

    // Check stamina limit for regular chat mode (removed auto-trigger matchmaking)
    if (!modalImage) {
      const checkStaminaLimit = async () => {
        try {
          const {
            isStaminaEmpty,
            getRemainingStamina,
            getTimeUntilNextRefill,
          } = await import('@/utils/chatLimits')
          const isEmpty = isStaminaEmpty()
          const remaining = getRemainingStamina()
          const timeUntilRefill = getTimeUntilNextRefill()

          if (isEmpty) {
            const minutes = Math.ceil(timeUntilRefill / 60000)
            return {
              blocked: true,
              message: `Out of stamina! You'll get +1 stamina in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
            }
          }

          return { blocked: false, remaining }
        } catch {
          return { blocked: false }
        }
      }

      const staminaCheck = await checkStaminaLimit()
      if (staminaCheck.blocked) {
        console.log('🎯 Chat Handler - Stamina depleted, blocking message')
        homeStore.setState({ chatProcessing: false })
        toastStore.getState().addToast({
          message: staminaCheck.message || 'Out of stamina! Wait for refill.',
          type: 'error',
          tag: 'stamina-depleted',
        })
        return
      }
    }

    homeStore.setState({ chatProcessing: true })

    // 🎯 Debug: Log system prompt being used for regular chat
    console.log(
      '🎯 Regular Chat - System prompt being used:',
      systemPrompt.substring(0, 100) + '...'
    )
    console.log('🎯 Regular Chat - Character name:', ss.characterName)

    const userMessageContent: Message['content'] = modalImage
      ? [
          { type: 'text' as const, text: newMessage },
          { type: 'image' as const, image: modalImage },
        ]
      : newMessage

    homeStore.getState().upsertMessage({
      role: 'user',
      content: userMessageContent,
      timestamp: timestamp,
    })

    if (modalImage) {
      homeStore.setState({ modalImage: '' })
    }

    const currentChatLog = homeStore.getState().chatLog

    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messageSelectors.getProcessedMessages(
        currentChatLog,
        ss.includeTimestampInUserMessage
      ),
    ]

    try {
      await processAIResponse(messages)

      // Increment chat stats for regular chat mode (after successful AI response)
      if (!modalImage) {
        console.log(
          '🎯 Chat Handler - Incrementing chat stats after successful message'
        )
        try {
          const { incrementChatStats } = await import('@/utils/chatLimits')
          incrementChatStats()
        } catch (statsError) {
          console.error('Error incrementing chat stats:', statsError)
        }
      }
    } catch (e) {
      console.error(e)
      homeStore.setState({ chatProcessing: false })
    }
  }
}

/**
 * WebSocketからのテキストを受信したときの処理
 */
export const handleReceiveTextFromWsFn =
  () =>
  async (
    text: string,
    role?: string,
    emotion: EmotionType = 'neutral',
    type?: string
  ) => {
    const sessionId = generateSessionId()
    if (text === null || role === undefined) return

    const ss = settingsStore.getState()
    const hs = homeStore.getState()
    const wsManager = webSocketStore.getState().wsManager

    if (ss.externalLinkageMode) {
      console.log('ExternalLinkage Mode: true')
    } else {
      console.log('ExternalLinkage Mode: false')
      return
    }

    homeStore.setState({ chatProcessing: true })

    if (role !== 'user') {
      if (type === 'start') {
        // startの場合は何もしない（textは空文字のため）
        console.log('Starting new response')
        wsManager?.setTextBlockStarted(false)
      } else if (
        hs.chatLog.length > 0 &&
        hs.chatLog[hs.chatLog.length - 1].role === role &&
        wsManager?.textBlockStarted
      ) {
        // 既存のメッセージに追加（IDを維持）
        const lastMessage = hs.chatLog[hs.chatLog.length - 1]
        const lastContent =
          typeof lastMessage.content === 'string' ? lastMessage.content : ''

        homeStore.getState().upsertMessage({
          id: lastMessage.id,
          role: role,
          content: lastContent + text,
        })
      } else {
        // 新しいメッセージを追加（新規IDを生成）
        homeStore.getState().upsertMessage({
          role: role,
          content: text,
        })
        wsManager?.setTextBlockStarted(true)
      }

      if (role === 'assistant' && text !== '') {
        try {
          // 文ごとに音声を生成 & 再生、返答を表示
          // Only trigger TTS if not disabled
          if (!isTTSDisabled()) {
            speakCharacter(
              sessionId,
              {
                message: text,
                emotion: emotion,
              },
              () => {
                const lastMessage = hs.chatLog[hs.chatLog.length - 1]
                const content =
                  typeof lastMessage.content === 'string'
                    ? lastMessage.content
                    : ''

                homeStore.setState({
                  assistantMessage: content,
                })
              },
              () => {
                // hs.decrementChatProcessingCount()
              }
            )
          }
        } catch (e) {
          console.error('Error in speakCharacter:', e)
        }
      }

      if (type === 'end') {
        // レスポンスの終了処理
        console.log('Response ended')
        wsManager?.setTextBlockStarted(false)
        homeStore.setState({ chatProcessing: false })
      }
    }

    homeStore.setState({ chatProcessing: type !== 'end' })
  }

/**
 * RealtimeAPIからのテキストまたは音声データを受信したときの処理
 */
export const handleReceiveTextFromRtFn = () => {
  // 連続する response.audio イベントで共通の sessionId を使用するための変数
  let currentSessionId: string | null = null

  return async (
    text?: string,
    role?: string,
    type?: string,
    buffer?: ArrayBuffer
  ) => {
    // type が `response.audio` かつ currentSessionId が未設定の場合に新しいセッションIDを発番
    // それ以外の場合は既存の sessionId を使い続ける。
    // レスポンス終了（content_part.done 等）時にリセットする。

    if (currentSessionId === null) {
      currentSessionId = generateSessionId()
    }

    const sessionId = currentSessionId

    const ss = settingsStore.getState()
    const hs = homeStore.getState()

    if (ss.realtimeAPIMode) {
      console.log('realtime api mode: true')
    } else if (ss.audioMode) {
      console.log('audio mode: true')
    } else {
      console.log('realtime api mode: false')
      return
    }

    homeStore.setState({ chatProcessing: true })

    if (role == 'assistant') {
      if (type?.includes('response.audio') && buffer !== undefined) {
        console.log('response.audio:')
        try {
          // Only trigger TTS if not disabled
          if (!isTTSDisabled()) {
            speakCharacter(
              sessionId,
              {
                emotion: 'neutral',
                message: '',
                buffer: buffer,
              },
              () => {},
              () => {}
            )
          }
        } catch (e) {
          console.error('Error in speakCharacter:', e)
        }
      } else if (type === 'response.content_part.done' && text !== undefined) {
        homeStore.getState().upsertMessage({
          role: role,
          content: text,
        })
      }
    }
    homeStore.setState({ chatProcessing: false })

    // レスポンスが完了したらセッションIDをリセット
    if (type === 'response.content_part.done') {
      currentSessionId = null
    }
  }
}

/**
 * Widget-specific chat handler that routes all chat through matchmaking orchestrator
 * This ensures that all widget conversations go through the MamaSan flow by default
 */
export const handleWidgetChatFn = () => async (text: string) => {
  const newMessage = text
  const timestamp = new Date().toISOString()

  console.log(
    '🎪 Widget Chat - handleWidgetChatFn called with message:',
    newMessage.substring(0, 50) + '...'
  )

  if (newMessage === null) return

  try {
    homeStore.setState({ chatProcessing: true })
    window.parent.postMessage({ type: 'WIDGET_CHAT_PROCESSING' }, '*')

    // Add user message to chat log
    homeStore.getState().upsertMessage({
      role: 'user',
      content: newMessage,
      timestamp: timestamp,
    })

    // Get the token from the parent
    console.log('🎪 Widget Chat - Getting auth token...')
    const token = await getWidgetAuthToken()
    console.log('🎪 Widget Chat - Auth token status:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenStart: token ? token.substring(0, 20) + '...' : 'none',
    })

    if (!token) {
      console.error('🎪 Widget Chat - No auth token available')
      window.parent.postMessage(
        { type: 'WIDGET_ERROR', reason: 'unauthenticated' },
        '*'
      )
      homeStore.setState({ chatProcessing: false })
      return
    }

    // Call the server-side matchmaking API
    console.log('🎪 Widget Chat - Making API call to /api/matchmaking...')
    const requestBody = { message: newMessage, token }
    console.log('🎪 Widget Chat - Request body:', {
      message: newMessage.substring(0, 50) + '...',
      token: token.substring(0, 20) + '...',
    })

    const response = await fetch('/api/matchmaking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    console.log(
      '🎪 Widget Chat - API response status:',
      response.status,
      response.statusText
    )
    console.log(
      '🎪 Widget Chat - API response headers:',
      Object.fromEntries(response.headers.entries())
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🎪 Widget Chat - API call failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })
      window.parent.postMessage(
        {
          type: 'WIDGET_ERROR',
          reason: 'api_error',
          details: { status: response.status, body: errorText },
        },
        '*'
      )
      homeStore.setState({ chatProcessing: false })
      return
    }

    const data = await response.json()
    console.log('🎪 Widget Chat - API response data:', {
      message: data.message ? data.message.substring(0, 100) + '...' : 'none',
      isComplete: data.isComplete,
      step: data.step,
      hasData: !!data.data,
      hasRecommendations: !!data.data?.recommendations,
      emotion: data.data?.emotion,
      emotionType: typeof data.data?.emotion,
    })

    console.log('🎭 CHAT HANDLER - Full data object:', {
      dataKeys: data.data ? Object.keys(data.data) : [],
      emotion: data.data?.emotion,
      emotionExists: 'emotion' in (data.data || {}),
      fullDataObject: data.data,
    })

    // Add assistant message to chat log
    homeStore.getState().upsertMessage({
      role: 'assistant',
      content: data.message,
      timestamp: new Date().toISOString(),
    })

    // Handle emotion data directly for PNG/VID mode emotion switching
    if (data.data?.emotion) {
      console.log(
        '🎭 Widget Chat - Processing emotion directly:',
        data.data.emotion
      )

      // Call the global emotion handler function
      try {
        const handleMatchmakingResponse = (window as any)
          .handleMatchmakingResponse
        if (handleMatchmakingResponse) {
          handleMatchmakingResponse({ emotion: data.data.emotion })
          console.log('🎭 Widget Chat - Emotion processed successfully')
        } else {
          console.log(
            '🎭 Widget Chat - handleMatchmakingResponse not available'
          )
        }
      } catch (error) {
        console.error('🎭 Widget Chat - Error processing emotion:', error)
      }

      // Also send to parent for any external listeners
      window.parent.postMessage(
        {
          type: 'WIDGET_EMOTION_UPDATE',
          data: {
            emotion: data.data.emotion,
          },
        },
        '*'
      )
    } else {
      console.log('🎭 Widget Chat - NO EMOTION FOUND:', {
        hasData: !!data.data,
        dataKeys: data.data ? Object.keys(data.data) : [],
        emotionValue: data.data?.emotion,
        emotionType: typeof data.data?.emotion,
        dataObject: data.data,
      })
    }

    // Send recommendations to parent if available
    if (data.data?.recommendations && data.data.recommendations.length > 0) {
      console.log(
        '🎯 Widget Chat - Sending recommendations to parent:',
        data.data.recommendations.length
      )
      window.parent.postMessage(
        {
          type: 'CHAT_ACTION_CARDS_UPDATE',
          data: {
            actionCards: data.data.recommendations,
          },
        },
        '*'
      )
    }

    // MamaSan is now in continuous profiling mode - no completion event
    // The conversation continues indefinitely to build user profile
    console.log(
      '🎪 Widget Chat - MamaSan response processed, mode:',
      data.data?.mode || 'onboarding'
    )

    // Check if TTS is disabled via URL parameter
    const disableTTS = isTTSDisabled()
    console.log('🎪 Widget Chat - TTS disabled:', disableTTS)

    // Use speakMessageHandler for the response (it handles TTS, etc.) only if TTS is not disabled
    if (!disableTTS) {
      console.log('🎪 Widget Chat - Processing TTS for response...')
      await speakMessageHandler(data.message)
    }

    // Check if we need to send a follow-up request for the first question
    if (data.data?.needsFollowUp) {
      console.log('🎪 Widget Chat - Follow-up needed, sending after delay...')

      // Wait for the specified delay (or default to 1.5 seconds)
      const delay = data.data.followUpDelay || 1500
      setTimeout(async () => {
        console.log(
          '🎪 Widget Chat - Sending follow-up request for first question...'
        )

        try {
          // Send empty message to trigger the first question
          const followUpResponse = await fetch('/api/matchmaking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '', token }),
          })

          if (followUpResponse.ok) {
            const followUpData = await followUpResponse.json()
            console.log('🎪 Widget Chat - Follow-up response:', {
              message: followUpData.message
                ? followUpData.message.substring(0, 100) + '...'
                : 'none',
              step: followUpData.step,
            })

            // Add the first question to chat log
            homeStore.getState().upsertMessage({
              role: 'assistant',
              content: followUpData.message,
              timestamp: new Date().toISOString(),
            })

            // Process TTS for the first question if enabled
            if (!disableTTS) {
              await speakMessageHandler(followUpData.message)
            }
          }
        } catch (followUpError) {
          console.error(
            '🎪 Widget Chat - Follow-up request failed:',
            followUpError
          )
        }
      }, delay)
    }

    homeStore.setState({ chatProcessing: false })
    window.parent.postMessage(
      { type: 'WIDGET_CHAT_DONE', message: data.message },
      '*'
    )
    console.log('🎪 Widget Chat - Successfully completed processing')
  } catch (error) {
    console.error('🎪 Widget Chat - Exception caught:', error)
    console.error('🎪 Widget Chat - Error stack:', (error as any)?.stack)
    homeStore.setState({ chatProcessing: false })
    window.parent.postMessage(
      { type: 'WIDGET_ERROR', reason: 'exception', error: String(error) },
      '*'
    )
  }
}
