import { useCallback, useState } from 'react'
import homeStore from '@/features/stores/home'
import { handleWidgetChatFn } from '../features/chat/handlers'
import { MessageInputContainer } from './messageInputContainer'

interface WidgetFormProps {
  showVoiceButton?: boolean
  showSettingsButton?: boolean
  autoFocus?: boolean
  allowFullscreen?: boolean
}

export const WidgetForm = ({
  showVoiceButton = true,
  showSettingsButton = false,
  autoFocus = true,
  allowFullscreen = false,
}: WidgetFormProps) => {
  const handleSendChat = handleWidgetChatFn()

  const hookSendChat = useCallback(
    (text: string) => {
      // Widget mode: all chat goes through matchmaking orchestrator (MamaSan flow)
      handleSendChat(text)
    },
    [handleSendChat]
  )

  return (
    <div className="widget-form">
      <MessageInputContainer
        onChatProcessStart={hookSendChat}
        showVoiceButton={showVoiceButton}
      />
    </div>
  )
}
