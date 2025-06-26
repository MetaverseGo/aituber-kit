// Audio cache manager for TTS host introductions
class AudioCacheManager {
  private dbName = 'host_intro_audio_cache'
  private dbVersion = 1
  private storeName = 'audio_blobs'
  private db: IDBDatabase | null = null
  private currentAudio: HTMLAudioElement | null = null

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
      this.initDB()
    }
  }

  private async initDB(): Promise<void> {
    // Additional safety check
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      console.warn('⚠️ Audio Cache - IndexedDB not available (SSR environment)')
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => {
        console.error(
          '❌ Audio Cache - Failed to open IndexedDB:',
          request.error
        )
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ Audio Cache - IndexedDB initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store for audio blobs
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'cacheKey',
          })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          console.log('🗄️ Audio Cache - Created object store')
        }
      }
    })
  }

  private getCacheKey(hostUid: string, userPersonalityId: string): string {
    return `${hostUid}_${userPersonalityId}`
  }

  async cacheAudio(
    hostUid: string,
    userPersonalityId: string,
    audioBlob: Blob,
    introText: string
  ): Promise<void> {
    if (!this.db) {
      console.warn(
        '⚠️ Audio Cache - Database not initialized, cannot cache audio'
      )
      return
    }

    const cacheKey = this.getCacheKey(hostUid, userPersonalityId)
    console.log(
      `💾 Audio Cache - Caching audio with key: "${cacheKey}" (${Math.round(audioBlob.size / 1024)}KB)`
    )
    const cacheData = {
      cacheKey,
      hostUid,
      userPersonalityId,
      audioBlob,
      introText,
      timestamp: Date.now(),
      size: audioBlob.size,
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(cacheData)

      request.onsuccess = () => {
        console.log(
          `✅ Audio Cache - Successfully cached audio for ${hostUid} with key "${cacheKey}" (${Math.round(audioBlob.size / 1024)}KB)`
        )
        resolve()
      }

      request.onerror = () => {
        console.error('❌ Audio Cache - Failed to cache audio:', request.error)
        reject(request.error)
      }
    })
  }

  async getCachedAudio(
    hostUid: string,
    userPersonalityId: string
  ): Promise<{ audioBlob: Blob; introText: string } | null> {
    if (!this.db) {
      console.warn(
        '⚠️ Audio Cache - Database not initialized, cannot retrieve cache'
      )
      return null
    }

    const cacheKey = this.getCacheKey(hostUid, userPersonalityId)
    console.log(`🔍 Audio Cache - Looking up cache key: "${cacheKey}"`)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(cacheKey)

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          console.log(
            `🎵 Audio Cache - Found cached audio for ${hostUid} (${Math.round(result.size / 1024)}KB, cached ${new Date(result.timestamp).toLocaleString()})`
          )
          resolve({
            audioBlob: result.audioBlob,
            introText: result.introText,
          })
        } else {
          console.log(
            `📭 Audio Cache - No cached audio found for key "${cacheKey}"`
          )
          resolve(null)
        }
      }

      request.onerror = () => {
        console.error(
          '❌ Audio Cache - Failed to retrieve cached audio:',
          request.error
        )
        reject(request.error)
      }
    })
  }

  async clearCache(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => {
        console.log('🗑️ Audio Cache - Cleared all cached audio')
        resolve()
      }

      request.onerror = () => {
        console.error('❌ Audio Cache - Failed to clear cache:', request.error)
        reject(request.error)
      }
    })
  }

  async getCacheStats(): Promise<{ count: number; totalSize: number }> {
    if (!this.db) return { count: 0, totalSize: 0 }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result
        const totalSize = results.reduce(
          (sum, item) => sum + (item.size || 0),
          0
        )
        console.log(
          `📊 Audio Cache - ${results.length} cached files, ${Math.round(totalSize / 1024)}KB total`
        )
        resolve({
          count: results.length,
          totalSize,
        })
      }

      request.onerror = () => {
        console.error(
          '❌ Audio Cache - Failed to get cache stats:',
          request.error
        )
        reject(request.error)
      }
    })
  }

  async cleanupOldCache(
    maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
  ): Promise<void> {
    if (!this.db) return

    const cutoffTime = Date.now() - maxAgeMs

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('timestamp')
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime))

      let deletedCount = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          console.log(
            `🧹 Audio Cache - Cleaned up ${deletedCount} old cache entries`
          )
          resolve()
        }
      }

      request.onerror = () => {
        console.error(
          '❌ Audio Cache - Failed to cleanup old cache:',
          request.error
        )
        reject(request.error)
      }
    })
  }

  async playAudioBlob(audioBlob: Blob): Promise<void> {
    // Stop any currently playing audio
    this.stopCurrentAudio()

    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const url = URL.createObjectURL(audioBlob)

      // Track this audio element
      this.currentAudio = audio

      audio.onload = () => URL.revokeObjectURL(url)
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (this.currentAudio === audio) {
          this.currentAudio = null
        }
        resolve()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        if (this.currentAudio === audio) {
          this.currentAudio = null
        }
        reject(new Error('Failed to play audio blob'))
      }

      audio.src = url
      audio.play().catch(reject)
    })
  }

  stopCurrentAudio(): void {
    if (this.currentAudio) {
      console.log('🛑 Audio Cache - Stopping current audio playback')
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
  }
}

// Export singleton instance
export const audioCache = new AudioCacheManager()

// Export types for use in other files
export type AudioCacheData = {
  audioBlob: Blob
  introText: string
}
