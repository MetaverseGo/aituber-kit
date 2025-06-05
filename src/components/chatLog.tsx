import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { EMOTIONS } from '@/features/messages/messages'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { messageSelectors } from '@/features/messages/messageSelectors'

export const ChatLog = () => {
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const chatLogRef = useRef<HTMLDivElement>(null)

  const characterName = settingsStore((s) => s.characterName)
  const chatLogWidth = settingsStore((s) => s.chatLogWidth)
  const messages = messageSelectors.getTextAndImageMessages(
    homeStore((s) => s.chatLog)
  )

  const [isDragging, setIsDragging] = useState<boolean>(false)

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    })
  }, [])

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [messages])

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const newWidth = e.clientX

      const constrainedWidth = Math.max(
        300,
        Math.min(newWidth, window.innerWidth * 0.8)
      )

      settingsStore.setState({ chatLogWidth: constrainedWidth })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const resizeHandle = resizeHandleRef.current
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      if (resizeHandle) {
        resizeHandle.removeEventListener('mousedown', handleMouseDown)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={chatLogRef}
      className="absolute h-[100svh] pb-16 z-10 max-w-full"
      style={{ width: `${chatLogWidth}px` }}
    >
      <div className="relative max-h-full px-4 pt-24 pb-16">
        {/* Fade gradient overlays */}
        <div className="absolute top-24 left-0 right-0 h-6 bg-gradient-to-b from-black/20 via-black/10 to-transparent pointer-events-none z-20"></div>
        <div className="absolute bottom-16 left-0 right-0 h-8 bg-gradient-to-t from-black/20 via-black/10 to-transparent pointer-events-none z-20"></div>
        
        {/* Scrollable content */}
        <div className="max-h-full overflow-y-auto scroll-hidden relative">
          {messages.map((msg, i) => {
            return (
              <div key={i} ref={messages.length - 1 === i ? chatScrollRef : null}>
                {typeof msg.content === 'string' ? (
                  <Chat
                    role={msg.role}
                    message={msg.content}
                    characterName={characterName}
                  />
                ) : (
                  <>
                    <Chat
                      role={msg.role}
                      message={msg.content ? msg.content[0].text : ''}
                      characterName={characterName}
                    />
                    <ChatImage
                      role={msg.role}
                      imageUrl={msg.content ? msg.content[1].image : ''}
                      characterName={characterName}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div
        ref={resizeHandleRef}
        className="absolute top-0 right-0 h-full w-4 cursor-ew-resize hover:bg-secondary hover:bg-opacity-20"
        style={{
          cursor: isDragging ? 'grabbing' : 'ew-resize',
        }}
      >
        <div className="absolute top-1/2 right-1 h-16 w-1 bg-secondary bg-opacity-40 rounded-full transform -translate-y-1/2"></div>
      </div>
    </div>
  )
}

const Chat = ({
  role,
  message,
  characterName,
}: {
  role: string
  message: string
  characterName: string
}) => {
  const emotionPattern = new RegExp(`\\[(${EMOTIONS.join('|')})\\]\\s*`, 'gi')
  const processedMessage = message.replace(emotionPattern, '')

  const isUser = role === 'user'
  const alignment = isUser ? 'ml-auto mr-0' : 'mr-auto ml-0'
  const bubbleColor = isUser 
    ? 'bg-blue-500 text-white' 
    : 'bg-white/90 backdrop-blur-sm text-gray-800 border border-white/50 shadow-lg'
  const maxWidth = isUser ? 'max-w-[70%]' : 'max-w-[80%]'

  return (
    <div className={`mx-4 my-3 ${maxWidth} ${alignment}`}>
      {role === 'code' ? (
        <pre className="whitespace-pre-wrap break-words bg-gray-900/90 backdrop-blur-sm text-white p-4 rounded-2xl shadow-lg border border-white/20">
          <code className="font-mono text-sm">{message}</code>
        </pre>
      ) : (
        <div className={`px-4 py-3 rounded-2xl ${bubbleColor}`}>
          {!isUser && (
            <div className="text-xs font-semibold mb-1 opacity-70">
              {characterName || 'CHARACTER'}
            </div>
          )}
          <div className="text-sm font-medium leading-relaxed">
            {processedMessage}
          </div>
        </div>
      )}
    </div>
  )
}

const ChatImage = ({
  role,
  imageUrl,
  characterName,
}: {
  role: string
  imageUrl: string
  characterName: string
}) => {
  const offsetX = role === 'user' ? 'pl-40' : 'pr-40'

  return (
    <div className={`mx-auto ml-0 md:ml-10 lg:ml-20 my-4 ${offsetX}`}>
      <Image
        src={imageUrl}
        alt="Generated Image"
        className="rounded-lg"
        width={512}
        height={512}
      />
    </div>
  )
}
