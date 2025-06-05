import { useCallback, useState } from 'react'
import homeStore from '@/features/stores/home'
import { handleSendChatFn } from '../features/chat/handlers'
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
  const handleSendChat = handleSendChatFn()

  const hookSendChat = useCallback(
    (text: string) => {
      // Widget mode: simplified chat without webcam integration
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
