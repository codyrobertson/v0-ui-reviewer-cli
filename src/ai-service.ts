import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import fetch from 'node-fetch'
import { configManager } from './config.js'
import { logger } from './logger.js'
import { SystemPrompts, PromptVariables } from './prompts.js'
import { RateLimiter } from './rate-limiter.js'

export type AIModel = 'v0' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'o3-mini' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'claude-sonnet-4'

export interface AIServiceConfig {
  openaiApiKey?: string
  anthropicApiKey?: string
  v0ApiKey?: string
  defaultModel?: AIModel
  verbose?: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  imageUrl?: string
}

export interface ChatOptions {
  model?: AIModel
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  promptVariables?: PromptVariables
}

export class MultiModelAIService {
  private openai?: OpenAI
  private anthropic?: Anthropic
  private v0ApiKey?: string
  private defaultModel: AIModel
  private verbose: boolean
  private rateLimiter: RateLimiter

  constructor(config: AIServiceConfig = {}) {
    // Initialize from config or environment
    const openaiKey = config.openaiApiKey || configManager.get('openaiApiKey') || process.env.OPENAI_API_KEY
    const anthropicKey = config.anthropicApiKey || configManager.get('anthropicApiKey') || process.env.ANTHROPIC_API_KEY
    this.v0ApiKey = config.v0ApiKey || configManager.get('apiKey') || process.env.V0_API_KEY
    this.defaultModel = config.defaultModel || configManager.get('defaultAIModel') || 'v0'
    this.verbose = config.verbose || false
    this.rateLimiter = new RateLimiter()

    // Initialize clients
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey })
    }
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey })
    }

    this.log('Multi-model AI service initialized', 'debug')
  }

  private log(message: string, level: 'info' | 'debug' | 'warn' | 'error' = 'info') {
    if (this.verbose || level === 'error' || level === 'warn') {
      logger[level](message)
    }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const model = options.model || this.defaultModel
    
    // Check rate limits
    const service = this.getServiceForModel(model)
    const { allowed, remaining, resetIn } = await this.rateLimiter.checkLimit(service)
    
    if (!allowed) {
      const resetTime = this.rateLimiter.formatResetTime(resetIn!)
      throw new Error(`Rate limit exceeded for ${service}. Resets in ${resetTime}. Consider using a different model.`)
    }
    
    if (remaining < 10 && this.verbose) {
      this.log(`Warning: Only ${remaining} requests remaining for ${service}`, 'warn')
    }
    
    this.log(`Using ${model} for chat (${remaining} requests remaining)`, 'debug')

    // Add system prompt based on model if prompt variables are provided
    if (options.promptVariables && !options.systemPrompt) {
      const systemPrompt = SystemPrompts.getPromptForModel(model, options.promptVariables)
      messages = [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system')
      ]
    }

    try {
      let result: string
      
      switch (model) {
        case 'v0':
          result = await this.chatWithV0(messages, options)
          break
        
        case 'gpt-4':
        case 'gpt-4-turbo':
        case 'gpt-3.5-turbo':
        case 'o3-mini':
          result = await this.chatWithOpenAI(messages, options)
          break
        
        case 'claude-3-opus':
        case 'claude-3-sonnet':
        case 'claude-3-haiku':
        case 'claude-sonnet-4':
          result = await this.chatWithClaude(messages, options)
          break
        
        default:
          throw new Error(`Unsupported model: ${model}`)
      }
      
      // Increment rate limit counter on success
      await this.rateLimiter.increment(service)
      
      return result
    } catch (error) {
      // Don't increment rate limit on error
      throw error
    }
  }

  private async chatWithV0(messages: ChatMessage[], options: ChatOptions): Promise<string> {
    if (!this.v0ApiKey) {
      throw new Error('V0 API key not configured')
    }

    // V0 expects a specific format with image support
    const v0Messages = messages.map(msg => {
      if (msg.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            { type: 'image_url', image_url: { url: msg.imageUrl } }
          ]
        }
      }
      return { role: msg.role, content: msg.content }
    })

    const response = await fetch('https://api.v0.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.v0ApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'v0-1.0-md',
        messages: v0Messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`V0 API error: ${response.status} - ${errorText}`)
    }

    const result: any = await response.json()
    return result.choices[0].message.content
  }

  private async chatWithOpenAI(messages: ChatMessage[], options: ChatOptions): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured')
    }

    const model = options.model === 'gpt-4' ? 'gpt-4' : 
                  options.model === 'gpt-4-turbo' ? 'gpt-4-turbo-preview' : 
                  options.model === 'o3-mini' ? 'gpt-4o-mini' :
                  'gpt-3.5-turbo'

    // Convert messages to OpenAI format
    const openaiMessages: any[] = messages.map(msg => {
      if (msg.imageUrl && msg.role === 'user') {
        return {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: msg.content },
            { type: 'image_url' as const, image_url: { url: msg.imageUrl } }
          ]
        }
      }
      return { role: msg.role as 'system' | 'user' | 'assistant', content: msg.content }
    })

    const completion = await this.openai.chat.completions.create({
      model,
      messages: openaiMessages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    })

    return completion.choices[0]?.message?.content || ''
  }

  private async chatWithClaude(messages: ChatMessage[], options: ChatOptions): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured')
    }

    const model = options.model === 'claude-3-opus' ? 'claude-3-opus-20240229' :
                  options.model === 'claude-3-sonnet' ? 'claude-3-sonnet-20240229' :
                  options.model === 'claude-sonnet-4' ? 'claude-3-5-sonnet-20241022' :
                  'claude-3-haiku-20240307'

    // Extract system prompt if present
    const systemPrompt = messages.find(m => m.role === 'system')?.content || options.systemPrompt

    // Convert messages to Claude format (no system messages)
    const claudeMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => {
        if (msg.imageUrl && msg.imageUrl.startsWith('data:image')) {
          // Extract base64 data from data URL
          const base64Match = msg.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
          if (base64Match) {
            return {
              role: msg.role as 'user' | 'assistant',
              content: [
                { type: 'text' as const, text: msg.content },
                { 
                  type: 'image' as const, 
                  source: {
                    type: 'base64' as const,
                    media_type: `image/${base64Match[1]}` as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                    data: base64Match[2]
                  }
                }
              ]
            }
          }
        }
        return { role: msg.role as 'user' | 'assistant', content: msg.content }
      })

    const message = await this.anthropic.messages.create({
      model,
      messages: claudeMessages,
      system: systemPrompt,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    })

    return message.content[0].type === 'text' ? message.content[0].text : ''
  }

  async isModelAvailable(model: AIModel): Promise<boolean> {
    switch (model) {
      case 'v0':
        return !!this.v0ApiKey
      
      case 'gpt-4':
      case 'gpt-4-turbo':
      case 'gpt-3.5-turbo':
      case 'o3-mini':
        return !!this.openai
      
      case 'claude-3-opus':
      case 'claude-3-sonnet':
      case 'claude-3-haiku':
      case 'claude-sonnet-4':
        return !!this.anthropic
      
      default:
        return false
    }
  }

  private getServiceForModel(model: AIModel): 'v0' | 'openai' | 'anthropic' {
    switch (model) {
      case 'v0':
        return 'v0'
      case 'gpt-4':
      case 'gpt-4-turbo':
      case 'gpt-3.5-turbo':
      case 'o3-mini':
        return 'openai'
      case 'claude-3-opus':
      case 'claude-3-sonnet':
      case 'claude-3-haiku':
      case 'claude-sonnet-4':
        return 'anthropic'
      default:
        return 'v0'
    }
  }

  getAvailableModels(): AIModel[] {
    const models: AIModel[] = []
    
    if (this.v0ApiKey) models.push('v0')
    if (this.openai) {
      models.push('gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o3-mini')
    }
    if (this.anthropic) {
      models.push('claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-sonnet-4')
    }
    
    return models
  }

  getModelCapabilities(model: AIModel): { supportsImages: boolean, maxTokens: number } {
    switch (model) {
      case 'v0':
        return { supportsImages: true, maxTokens: 4096 }
      
      case 'gpt-4':
      case 'gpt-4-turbo':
        return { supportsImages: true, maxTokens: 128000 }
      
      case 'o3-mini':
        return { supportsImages: true, maxTokens: 128000 }
      
      case 'gpt-3.5-turbo':
        return { supportsImages: false, maxTokens: 16385 }
      
      case 'claude-3-opus':
      case 'claude-3-sonnet':
      case 'claude-3-haiku':
      case 'claude-sonnet-4':
        return { supportsImages: true, maxTokens: 200000 }
      
      default:
        return { supportsImages: false, maxTokens: 4096 }
    }
  }
}

export default MultiModelAIService