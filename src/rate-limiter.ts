import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

interface RateLimitData {
  v0: {
    count: number
    resetAt: number
  }
  openai: {
    count: number
    resetAt: number
  }
  anthropic: {
    count: number
    resetAt: number
  }
}

export class RateLimiter {
  private dataPath: string
  private limits = {
    v0: { daily: 200, window: 24 * 60 * 60 * 1000 }, // 200/day
    openai: { daily: 10000, window: 60 * 1000 }, // 10k/min (simplified)
    anthropic: { daily: 1000, window: 60 * 1000 } // 1k/min (simplified)
  }

  constructor() {
    this.dataPath = path.join(os.homedir(), '.v0-reviewer', 'rate-limits.json')
  }

  async checkLimit(service: 'v0' | 'openai' | 'anthropic'): Promise<{ allowed: boolean; remaining: number; resetIn?: number }> {
    const data = await this.loadData()
    const now = Date.now()
    const serviceData = data[service]
    
    // Reset if window expired
    if (now > serviceData.resetAt) {
      serviceData.count = 0
      serviceData.resetAt = now + this.limits[service].window
      await this.saveData(data)
    }

    const limit = this.limits[service].daily
    const remaining = Math.max(0, limit - serviceData.count)
    const allowed = remaining > 0

    return {
      allowed,
      remaining,
      resetIn: allowed ? undefined : Math.ceil((serviceData.resetAt - now) / 1000)
    }
  }

  async increment(service: 'v0' | 'openai' | 'anthropic'): Promise<void> {
    const data = await this.loadData()
    data[service].count++
    await this.saveData(data)
  }

  async getRemainingQuota(service: 'v0' | 'openai' | 'anthropic'): Promise<number> {
    const { remaining } = await this.checkLimit(service)
    return remaining
  }

  private async loadData(): Promise<RateLimitData> {
    try {
      const content = await fs.readFile(this.dataPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      // Initialize with empty data
      const now = Date.now()
      return {
        v0: { count: 0, resetAt: now + this.limits.v0.window },
        openai: { count: 0, resetAt: now + this.limits.openai.window },
        anthropic: { count: 0, resetAt: now + this.limits.anthropic.window }
      }
    }
  }

  private async saveData(data: RateLimitData): Promise<void> {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true })
    await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2))
  }

  formatResetTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
    return `${Math.ceil(seconds / 3600)}h`
  }
}

export default RateLimiter