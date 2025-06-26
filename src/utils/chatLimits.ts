export interface ChatStats {
  dailyMessages: number
  lastResetDate: string
  intimacyLevel: number
  totalMessages: number
  lastRefillTime: number
}

const STAMINA_LIMIT = 10
const REFILL_INTERVAL_MINUTES = 5

export const getChatStats = (): ChatStats => {
  try {
    const stored = localStorage.getItem('chat_stats')
    if (stored) {
      let stats = JSON.parse(stored) as ChatStats
      const today = new Date().toDateString()
      const now = Date.now()

      // Reset daily counter if it's a new day
      if (stats.lastResetDate !== today) {
        stats.dailyMessages = 0
        stats.lastResetDate = today
        stats.lastRefillTime = now
      }

      // Handle stamina refill every 5 minutes
      if (stats.lastRefillTime) {
        const timeSinceLastRefill = now - stats.lastRefillTime
        const refillIntervalMs = REFILL_INTERVAL_MINUTES * 60 * 1000
        const refillsEarned = Math.floor(timeSinceLastRefill / refillIntervalMs)

        if (refillsEarned > 0 && stats.dailyMessages > 0) {
          // Reduce used messages (increase available stamina)
          stats.dailyMessages = Math.max(0, stats.dailyMessages - refillsEarned)
          stats.lastRefillTime = now - (timeSinceLastRefill % refillIntervalMs)

          // Save updated stats
          localStorage.setItem('chat_stats', JSON.stringify(stats))
          console.log(
            `⚡ Stamina refilled! Gained ${refillsEarned} stamina. Current: ${STAMINA_LIMIT - stats.dailyMessages}/${STAMINA_LIMIT}`
          )
        }
      } else {
        // Add lastRefillTime if missing from old saves
        stats.lastRefillTime = now
        localStorage.setItem('chat_stats', JSON.stringify(stats))
      }

      return stats
    }
  } catch (error) {
    console.error('Error loading chat stats:', error)
  }

  // Return default stats
  return {
    dailyMessages: 0,
    lastResetDate: new Date().toDateString(),
    intimacyLevel: 0,
    totalMessages: 0,
    lastRefillTime: Date.now(),
  }
}

export const isStaminaEmpty = (): boolean => {
  const stats = getChatStats()
  return stats.dailyMessages >= STAMINA_LIMIT
}

export const getRemainingStamina = (): number => {
  const stats = getChatStats()
  return Math.max(0, STAMINA_LIMIT - stats.dailyMessages)
}

export const incrementChatStats = (intimacyGain: number = 1.5): ChatStats => {
  const stats = getChatStats()
  const newStats = {
    ...stats,
    dailyMessages: Math.min(STAMINA_LIMIT, stats.dailyMessages + 1),
    intimacyLevel: Math.min(100, stats.intimacyLevel + intimacyGain),
    totalMessages: stats.totalMessages + 1,
    lastRefillTime: stats.lastRefillTime || Date.now(),
  }

  localStorage.setItem('chat_stats', JSON.stringify(newStats))
  return newStats
}

export const resetDailyStats = (): void => {
  const stats = getChatStats()
  const resetStats = {
    ...stats,
    dailyMessages: 0,
    lastResetDate: new Date().toDateString(),
    lastRefillTime: Date.now(),
  }

  localStorage.setItem('chat_stats', JSON.stringify(resetStats))
}

export const getTimeUntilNextRefill = (): number => {
  const stats = getChatStats()
  if (!stats.lastRefillTime || stats.dailyMessages === 0) {
    return 0 // No refill needed if stamina is full
  }

  const now = Date.now()
  const timeSinceLastRefill = now - stats.lastRefillTime
  const refillIntervalMs = REFILL_INTERVAL_MINUTES * 60 * 1000
  const timeUntilNext =
    refillIntervalMs - (timeSinceLastRefill % refillIntervalMs)

  return Math.max(0, timeUntilNext)
}

export const DAILY_MESSAGE_LIMIT = STAMINA_LIMIT
