import { useState, useCallback } from 'react'

export function useVideoSource(
  initialSrc: string = '',
  initialLabel: string = ''
) {
  const [videoSrc, setVideoSrc] = useState(initialSrc)
  const [videoLabel, setVideoLabel] = useState(initialLabel)

  const setSource = useCallback((src: string, label?: string) => {
    setVideoSrc(src)
    if (label !== undefined) setVideoLabel(label)
  }, [])

  return [videoSrc, setSource, videoLabel, setVideoLabel] as [
    string,
    (src: string, label?: string) => void,
    string,
    (label: string) => void,
  ]
}
