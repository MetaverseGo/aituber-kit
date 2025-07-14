import { useState, useCallback } from 'react'

const emotionToImage: Record<string, string> = {
  angry: '/images/emigg/angry.png',
  happy: '/images/emigg/happy.png',
  neutral: '/images/emigg/neutral.png',
  relaxed: '/images/emigg/relaxed.png',
  sad: '/images/emigg/sad.png',
  surprised: '/images/emigg/surprised.png',
}

export function useEmotionImage(initialEmotion: string = 'neutral') {
  const [emotion, setEmotion] = useState(initialEmotion)
  const emotionImage = emotionToImage[emotion] || emotionToImage['neutral']

  const setEmotionSafe = useCallback((newEmotion: string) => {
    console.log('🎭 [useEmotionImage] setEmotionSafe called with:', {
      newEmotion,
      emotionType: typeof newEmotion,
      isValidEmotion: newEmotion in emotionToImage,
      availableEmotions: Object.keys(emotionToImage),
      willSetTo: newEmotion in emotionToImage ? newEmotion : 'neutral',
    })
    setEmotion(newEmotion in emotionToImage ? newEmotion : 'neutral')
  }, [])

  console.log('🎭 [useEmotionImage] Current state:', {
    emotion,
    emotionImage,
    imageExists: emotionImage !== emotionToImage['neutral'],
  })

  return [emotionImage, setEmotionSafe, emotion] as [
    string,
    (e: string) => void,
    string,
  ]
}
