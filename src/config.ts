import Configstore from 'configstore'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export interface V0Config {
  apiKey?: string
  openaiApiKey?: string
  anthropicApiKey?: string
  defaultAIModel?: 'v0' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku'
  timeout?: number
  defaultDevice?: 'desktop' | 'mobile'
  defaultFullPage?: boolean
  defaultShowImage?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  outputDirectory?: string
}

export class ConfigManager {
  private config: Configstore
  private configPath: string

  constructor() {
    this.config = new Configstore('v0-ui-reviewer', {
      timeout: 60000,
      defaultDevice: 'desktop',
      defaultFullPage: true,
      defaultShowImage: true,
      logLevel: 'info',
      outputDirectory: process.cwd()
    })
    
    this.configPath = path.join(os.homedir(), '.v0-ui-reviewer', 'config.json')
  }

  get(key: keyof V0Config): any {
    return this.config.get(key)
  }

  set(key: keyof V0Config, value: any): void {
    this.config.set(key, value)
  }

  getAll(): V0Config {
    return this.config.all
  }

  setAll(config: V0Config): void {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        this.config.set(key as keyof V0Config, value)
      }
    })
  }

  clear(): void {
    this.config.clear()
  }

  getApiKey(): string | undefined {
    return this.get('apiKey') || process.env.V0_API_KEY
  }

  async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.configPath)
    await fs.mkdir(configDir, { recursive: true })
  }

  isFirstRun(): boolean {
    return !this.get('apiKey') && !process.env.V0_API_KEY
  }

  getConfigPath(): string {
    return this.config.path
  }
}

export const configManager = new ConfigManager()