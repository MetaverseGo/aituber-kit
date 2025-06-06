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
import { MatchmakingChatHandler } from '@/features/matchmaking/matchmaking-chat-handler'
import { SYSTEM_PROMPT_EN } from '@/features/constants/systemPromptConstants'

// セッションIDを生成する関数
const generateSessionId = () => generateMessageId()

// コードブロックのデリミネーター
const CODE_DELIMITER = '```'

// Global matchmaking handler instance
let globalMatchmakingHandler: MatchmakingChatHandler | null = null

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

// Initialize matchmaking handler
export const initializeMatchmakingHandler = () => {
  if (!globalMatchmakingHandler) {
    // Use a simple user ID for now - could be enhanced with actual user management
    const userId = 'default-user'
    globalMatchmakingHandler = new MatchmakingChatHandler(userId)
  }
  return globalMatchmakingHandler
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
    : 'neutral'

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

    // Check if user has completed personality analysis
    const hasCompleted = hasCompletedPersonalityAnalysis()
    console.log('🎯 Chat Handler - Personality analysis completed:', hasCompleted)
    console.log('🎯 Chat Handler - Modal image present:', !!modalImage)

    // If not completed, force matchmaking mode (only for text messages, not images)
    if (!hasCompleted && !modalImage) {
      console.log('🎯 Chat Handler - Entering matchmaking mode for message:', newMessage)
      homeStore.setState({ chatProcessing: true })

      // Add user message
      homeStore.getState().upsertMessage({
        role: 'user',
        content: newMessage,
        timestamp: timestamp,
      })

      const matchmakingHandler = initializeMatchmakingHandler()

      try {
        console.log('🎯 Chat Handler - Processing with matchmaking handler...')
        // Process matchmaking flow (either start new or continue existing)
        const matchmakingResult = await matchmakingHandler.processChatMessage(
          newMessage,
          sessionId
        )
        console.log('🎯 Chat Handler - Matchmaking result:', matchmakingResult)

        if (matchmakingResult) {
          console.log('🎯 Chat Handler - Got matchmaking result:', {
            isComplete: matchmakingResult.isComplete,
            step: matchmakingResult.step,
            hasData: !!matchmakingResult.data,
            dataKeys: matchmakingResult.data ? Object.keys(matchmakingResult.data) : [],
            data: matchmakingResult.data
          })
          
          // Store step progress in localStorage BEFORE speaking message to fix progress bar timing
          if (matchmakingResult.data?.stepProgress) {
            console.log('🎯 Chat Handler - Storing step progress before speaking:', matchmakingResult.data.stepProgress)
            localStorage.setItem('matchmaking_step_progress', JSON.stringify(matchmakingResult.data.stepProgress))
          }

          // Store the complete result for split layout display
          if (matchmakingResult.isComplete && matchmakingResult.data) {
            console.log('🎯 Chat Handler - Storing complete matchmaking result for split layout:', matchmakingResult.data)
            localStorage.setItem('last_matchmaking_result', JSON.stringify(matchmakingResult))
          } else if (matchmakingResult.isComplete) {
            console.log('🎯 Chat Handler - Analysis complete but no data to store:', matchmakingResult)
          }

          console.log('🎯 Chat Handler - Speaking message:', matchmakingResult.message)
          // Use speakMessageHandler for the response
          await speakMessageHandler(matchmakingResult.message)

          // Check if completed
          if (matchmakingResult.isComplete) {
            console.log('🎯 Chat Handler - Personality analysis completed! Marking as done.')
            markPersonalityAnalysisCompleted()
            // Clear step progress when complete
            localStorage.removeItem('matchmaking_step_progress')
            
            // 🎯 Ensure Emi's personality is restored after analysis completion
            console.log('🎯 Chat Handler - Ensuring Emi personality is restored after analysis completion')
            const currentSystemPrompt = settingsStore.getState().systemPrompt
            console.log('🎯 Chat Handler - Current system prompt:', currentSystemPrompt.substring(0, 100) + '...')
            
            // If system prompt doesn't contain Emi's personality, restore it
            if (!currentSystemPrompt.includes('You are Emi, a friendly and engaging conversation partner')) {
              console.log('🎯 Chat Handler - System prompt missing Emi personality, restoring...')
              settingsStore.setState({ 
                systemPrompt: SYSTEM_PROMPT_EN,
                characterName: 'Emi'
              })
            }
          }

          homeStore.setState({ chatProcessing: false })
          return
        } else {
          console.log('🎯 Chat Handler - No matchmaking result returned!')
        }
      } catch (error) {
        console.error('🎯 Chat Handler - Matchmaking error:', error)
        
        // Handle specific API key error
        if (error instanceof Error && error.message.includes('API key is not configured')) {
          console.log('🎯 Chat Handler - API key error detected')
          const errorMessage = `🌸 To start your personality analysis, I need you to configure your Anthropic API key first! 

Please:
1. Click the Settings menu (⚙️)
2. Go to "Model Provider" 
3. Enter your Anthropic API key
4. Then come back and we can begin your personality journey! ✨`

          await speakMessageHandler(errorMessage)
          homeStore.setState({ chatProcessing: false })
          return
        }
        
        // For other errors, show a helpful message but stay in matchmaking mode
        console.log('🎯 Chat Handler - Generic error, staying in matchmaking mode')
        const errorMessage = `🌸 I encountered a small hiccup with your personality analysis! Let me try again. 

Please make sure:
• Your internet connection is stable
• Your API key is properly configured in Settings
• Then send any message to continue! ✨`

        await speakMessageHandler(errorMessage)
        homeStore.setState({ chatProcessing: false })
        return
      }
    } else {
      console.log('🎯 Chat Handler - Skipping matchmaking mode - completed:', hasCompleted, 'modalImage:', !!modalImage)
    }

    // Check stamina limit for free chat mode
    if (hasCompleted && !modalImage) {
      const checkStaminaLimit = async () => {
        try {
          const { isStaminaEmpty, getRemainingStamina, getTimeUntilNextRefill } = await import('@/utils/chatLimits')
          const isEmpty = isStaminaEmpty()
          const remaining = getRemainingStamina()
          const timeUntilRefill = getTimeUntilNextRefill()
          
          if (isEmpty) {
            const minutes = Math.ceil(timeUntilRefill / 60000)
            return { 
              blocked: true, 
              message: `Out of stamina! You'll get +1 stamina in ${minutes} minute${minutes !== 1 ? 's' : ''}.`
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
    
    // 🎯 Debug: Log system prompt being used after personality analysis completion
    console.log('🎯 Free Chat - System prompt being used:', systemPrompt.substring(0, 100) + '...')
    console.log('🎯 Free Chat - Character name:', ss.characterName)
    console.log('🎯 Free Chat - Analysis completed:', hasCompleted)
    
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
      
      // Increment chat stats for free chat mode (after successful AI response)
      if (hasCompleted && !modalImage) {
        console.log('🎯 Chat Handler - Incrementing chat stats after successful message')
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
