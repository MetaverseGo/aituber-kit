import React from 'react'
import Image from 'next/image'

interface PngEmotionDisplayProps {
  emotionImage: string
  emotionLabel?: string
  children?: React.ReactNode
}

const PngEmotionDisplay: React.FC<PngEmotionDisplayProps> = ({
  emotionImage,
  emotionLabel,
  children,
}) => {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center w-screen h-screen bg-black/90 z-50"
      style={{ marginTop: '-150px' }} // Move content up by 150px
    >
      <Image
        src={emotionImage}
        alt={emotionLabel || 'Emotion'}
        width={200}
        height={200}
        className="w-50 h-50 rounded-full border-4 border-pink-400 shadow-lg mb-6 object-cover bg-black"
        style={{ boxShadow: '0 4px 24px #18181b' }}
        priority
        unoptimized
      />
      <span
        className="text-pink-500 font-bold text-2xl mb-2"
        style={{ textShadow: '0 2px 8px #18181b, 0 0 2px #000' }}
      >
        Hey there! I&apos;m Emi
      </span>
      <span
        className="text-white text-lg"
        style={{ textShadow: '0 2px 8px #18181b, 0 0 2px #000' }}
      >
        Ask me for amazing creators and content
      </span>
    </div>
  )
}

export default PngEmotionDisplay
