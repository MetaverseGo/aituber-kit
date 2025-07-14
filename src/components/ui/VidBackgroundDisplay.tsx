import React from 'react'

interface VidBackgroundDisplayProps {
  videoSrc: string
  videoLabel?: string
  children?: React.ReactNode
}

const VidBackgroundDisplay: React.FC<VidBackgroundDisplayProps> = ({
  videoSrc,
  videoLabel,
  children,
}) => {
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden z-50">
      <video
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover -z-10"
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
