import React, { useState, useMemo } from 'react'
import homeStore from '@/features/stores/home'
import { VRMExpressionPresetName } from '@pixiv/three-vrm'

const PRESETS: VRMExpressionPresetName[] = [
  'neutral',
  'happy',
  'angry',
  'sad',
  'relaxed',
  'surprised',
  'aa',
  'ih',
  'ou',
  'ee',
  'oh',
  'blink',
  'blinkLeft',
  'blinkRight',
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
]

export default function VrmExpressionTester() {
  const [currentIdx, setCurrentIdx] = useState(0)
  const viewer = homeStore.getState().viewer
  const model = viewer.model
  const vrm = model?.vrm
  const expressionManager = vrm?.expressionManager

  const availablePresets = useMemo(() => {
    if (!expressionManager) return []
    return PRESETS.filter(
      (preset) => expressionManager.getValue(preset) !== undefined
    )
  }, [expressionManager])

  // Set default to 'relaxed' if available
  React.useEffect(() => {
    if (!availablePresets.length) return
    const relaxedIdx = availablePresets.indexOf('relaxed')
    if (relaxedIdx !== -1) {
      setCurrentIdx(relaxedIdx)
      model?.playEmotion(availablePresets[relaxedIdx])
    } else {
      setCurrentIdx(0)
      model?.playEmotion(availablePresets[0])
    }
    // Only run on mount or when availablePresets changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expressionManager, model, availablePresets])

  const handleNext = () => {
    if (!availablePresets.length) return
    const nextIdx = (currentIdx + 1) % availablePresets.length
    setCurrentIdx(nextIdx)
    model?.playEmotion(availablePresets[nextIdx])
  }

  if (!vrm || !expressionManager) return null

  return (
    <div className="fixed bottom-4 right-4 bg-white/90 p-4 rounded shadow z-50">
      <div className="mb-2 font-bold">Available VRM Expressions:</div>
      <ul className="mb-2">
        {availablePresets.map((preset, idx) => (
          <li
            key={preset}
            style={{ fontWeight: idx === currentIdx ? 'bold' : undefined }}
          >
            {preset}
          </li>
        ))}
      </ul>
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={handleNext}
        disabled={!availablePresets.length}
      >
        Play Next Expression
      </button>
    </div>
  )
}
