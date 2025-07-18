import React from 'react'

interface VidBackgroundDisplayProps {
  videoSrc: string
  videoLabel?: string
  children?: React.ReactNode
  onVideoEnd?: () => void
}

const VidBackgroundDisplay: React.FC<VidBackgroundDisplayProps> = ({
  videoSrc,
  videoLabel,
  children,
  onVideoEnd,
}) => {
  // Determine if this is a neutral emotion (should loop) or other emotion (play once)
  const isNeutralEmotion =
    videoLabel === 'neutral' || videoSrc.includes('neutral.mp4')

  const handleVideoEnd = () => {
    console.log('🎬 [VidBackgroundDisplay] Video ended:', {
      videoLabel,
      videoSrc,
      isNeutralEmotion,
    })

    // Only call onVideoEnd for non-neutral emotions
    if (!isNeutralEmotion && onVideoEnd) {
      console.log(
        '🎬 [VidBackgroundDisplay] Calling onVideoEnd for non-neutral emotion'
      )
      onVideoEnd()
    }
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden z-50">
      <video
        src={videoSrc}
        autoPlay
        loop={isNeutralEmotion} // Only loop neutral emotions
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="absolute top-0 left-0 w-full h-full object-contain -z-10"
      />
      {videoLabel && (
        <div className="absolute top-4 left-4 bg-black/60 text-white px-4 py-2 rounded-lg z-10">
          {videoLabel}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {children}
      </div>
    </div>
  )
}

export default VidBackgroundDisplay
