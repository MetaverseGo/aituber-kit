import { audioCache, AudioCacheData } from './audio-cache'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { Talk } from '@/features/messages/messages'
import { Live2DHandler } from '@/features/messages/live2dHandler'

// Custom TTS function that uses audio caching
export class CachedTTS {
  static async speakWithCache(
    hostUid: string, 
    userPersonalityId: string,
    introText: string,
    onStart?: () => void,
    onComplete?: () => void
  ): Promise<void> {
    try {
      onStart?.()

      // Check cache first
      console.log(`🎵 CachedTTS - Checking cache for ${hostUid} with personality ${userPersonalityId}...`)
      console.log(`🔍 CachedTTS - Cache key will be: ${hostUid}_${userPersonalityId}`)
      const cachedAudio = await audioCache.getCachedAudio(hostUid, userPersonalityId)
      
      if (cachedAudio) {
        console.log(`🚀 CachedTTS - Found cached audio for ${hostUid}! Playing immediately...`)
        console.log(`⚡ CachedTTS - Skipping AI text generation - using cached text: "${cachedAudio.introText.substring(0, 50)}..."`)
        await audioCache.playAudioBlob(cachedAudio.audioBlob)
        onComplete?.()
        return
      }

      // No cache, generate new TTS
      console.log(`📭 CachedTTS - No cached audio found for ${hostUid}. Generating new TTS...`)
      console.log(`🎤 CachedTTS - Will cache with key: ${hostUid}_${userPersonalityId}`)
      const audioBuffer = await this.generateTTS(introText)
      
      if (!audioBuffer) {
        console.error(`❌ CachedTTS - Failed to generate TTS for ${hostUid}`)
        onComplete?.()
        return
      }

      // Convert ArrayBuffer to Blob for caching
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      
      // Cache the audio for future use
      console.log(`💾 CachedTTS - Caching audio for ${hostUid}...`)
      await audioCache.cacheAudio(hostUid, userPersonalityId, audioBlob, introText)

      // Play the generated audio
      console.log(`🔊 CachedTTS - Playing generated audio for ${hostUid}`)
      await this.playAudioBuffer(audioBuffer, introText)
      onComplete?.()

    } catch (error) {
      console.error(`❌ CachedTTS - Error in speakWithCache for ${hostUid}:`, error)
      onComplete?.()
    }
  }

  private static async generateTTS(text: string): Promise<ArrayBuffer | null> {
    const ss = settingsStore.getState()
    
    // Create a Talk object for the TTS system
    const talk: Talk = {
      message: text,
      emotion: 'happy'
    }

    try {
      // Use the existing TTS synthesis function
      return await this.synthesizeVoiceInternal(talk, ss.selectVoice)
    } catch (error) {
      console.error('❌ CachedTTS - Error generating TTS:', error)
      return null
    }
  }

  private static async synthesizeVoiceInternal(talk: Talk, voiceType: any): Promise<ArrayBuffer | null> {
    const ss = settingsStore.getState()

    if (ss.audioMode) {
      return null
    }

    // Import the synthesis functions dynamically to avoid circular dependencies
    const { synthesizeVoiceKoeiromapApi } = await import('@/features/messages/synthesizeVoiceKoeiromap')
    const { synthesizeVoiceVoicevoxApi } = await import('@/features/messages/synthesizeVoiceVoicevox')
    const { synthesizeVoiceGoogleApi } = await import('@/features/messages/synthesizeVoiceGoogle')
    const { synthesizeStyleBertVITS2Api } = await import('@/features/messages/synthesizeStyleBertVITS2')
    const { synthesizeVoiceAivisSpeechApi } = await import('@/features/messages/synthesizeVoiceAivisSpeech')
    const { synthesizeVoiceGSVIApi } = await import('@/features/messages/synthesizeVoiceGSVI')
    const { synthesizeVoiceElevenlabsApi } = await import('@/features/messages/synthesizeVoiceElevenlabs')
    const { synthesizeVoiceOpenAIApi } = await import('@/features/messages/synthesizeVoiceOpenAI')
    const { synthesizeVoiceAzureOpenAIApi } = await import('@/features/messages/synthesizeVoiceAzureOpenAI')
    const { synthesizeVoiceNijivoiceApi } = await import('@/features/messages/synthesizeVoiceNijivoice')

    try {
      switch (voiceType) {
        case 'koeiromap':
          return await synthesizeVoiceKoeiromapApi(
            talk,
            ss.koeiromapKey,
            ss.koeiroParam
          )
        case 'voicevox':
          return await synthesizeVoiceVoicevoxApi(
            talk,
            ss.voicevoxSpeaker,
            ss.voicevoxSpeed,
            ss.voicevoxPitch,
            ss.voicevoxIntonation,
            ss.voicevoxServerUrl
          )
        case 'google':
          return await synthesizeVoiceGoogleApi(
            talk,
            ss.googleTtsType,
            ss.selectLanguage
          )
        case 'stylebertvits2':
          return await synthesizeStyleBertVITS2Api(
            talk,
            ss.stylebertvits2ServerUrl,
            ss.stylebertvits2ApiKey,
            ss.stylebertvits2ModelId,
            ss.stylebertvits2Style,
            ss.stylebertvits2SdpRatio,
            ss.stylebertvits2Length,
            ss.selectLanguage
          )
        case 'aivis_speech':
          return await synthesizeVoiceAivisSpeechApi(
            talk,
            ss.aivisSpeechSpeaker,
            ss.aivisSpeechSpeed,
            ss.aivisSpeechPitch,
            ss.aivisSpeechIntonation,
            ss.aivisSpeechServerUrl
          )
        case 'gsvitts':
          return await synthesizeVoiceGSVIApi(
            talk,
            ss.gsviTtsServerUrl,
            ss.gsviTtsModelId,
            ss.gsviTtsBatchSize,
            ss.gsviTtsSpeechRate
          )
        case 'elevenlabs':
          return await synthesizeVoiceElevenlabsApi(
            talk,
            ss.elevenlabsApiKey,
            ss.elevenlabsVoiceId,
            ss.selectLanguage
          )
        case 'openai':
          return await synthesizeVoiceOpenAIApi(
            talk,
            ss.openaiKey,
            ss.openaiTTSVoice,
            ss.openaiTTSModel,
            ss.openaiTTSSpeed
          )
        case 'azure':
          return await synthesizeVoiceAzureOpenAIApi(
            talk,
            ss.azureTTSKey || ss.azureKey,
            ss.azureTTSEndpoint || ss.azureEndpoint,
            ss.openaiTTSVoice,
            ss.openaiTTSSpeed
          )
        case 'nijivoice':
          return await synthesizeVoiceNijivoiceApi(
            talk,
            ss.nijivoiceApiKey,
            ss.nijivoiceActorId,
            ss.nijivoiceSpeed,
            ss.nijivoiceEmotionalLevel,
            ss.nijivoiceSoundDuration
          )
        default:
          return null
      }
    } catch (error) {
      console.error('❌ CachedTTS - TTS synthesis error:', error)
      return null
    }
  }

  private static async playAudioBuffer(audioBuffer: ArrayBuffer, text: string): Promise<void> {
    const ss = settingsStore.getState()
    const hs = homeStore.getState()

    const talk: Talk = {
      message: text,
      emotion: 'happy'
    }

    try {
      if (ss.modelType === 'vrm') {
        await hs.viewer.model?.speak(audioBuffer, talk)
      } else if (ss.modelType === 'live2d') {
        await Live2DHandler.speak(audioBuffer, talk)
      } else {
        // Fallback to direct audio playback
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
        await audioCache.playAudioBlob(audioBlob)
      }
    } catch (error) {
      console.error('❌ CachedTTS - Error playing audio:', error)
      // Fallback to direct audio playback
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      await audioCache.playAudioBlob(audioBlob)
    }
  }

  // Get cached introduction text (without generating audio)
  static async getCachedIntroduction(hostUid: string, userPersonalityId: string): Promise<{ introText: string } | null> {
    console.log(`📄 CachedTTS - Checking for cached introduction text for ${hostUid}...`)
    const cached = await audioCache.getCachedAudio(hostUid, userPersonalityId)
    if (cached) {
      console.log(`✅ CachedTTS - Found cached introduction text for ${hostUid}: "${cached.introText.substring(0, 50)}..."`)
    } else {
      console.log(`📭 CachedTTS - No cached introduction text found for ${hostUid}`)
    }
    return cached
  }

  // Utility methods for cache management
  static async getCacheStats(): Promise<{ count: number; totalSize: number }> {
    return await audioCache.getCacheStats()
  }

  static async clearCache(): Promise<void> {
    return await audioCache.clearCache()
  }

  static async cleanupOldCache(maxAgeMs?: number): Promise<void> {
    return await audioCache.cleanupOldCache(maxAgeMs)
  }
} 