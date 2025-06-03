import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import boxen from 'boxen'
import { MultiModelAIService, AIModel, ChatMessage } from './ai-service.js'
import { V0UIReviewerCLI } from './index.js'
import { configManager } from './config.js'
import { logger } from './logger.js'
import path from 'path'
import { promises as fs } from 'fs'

export interface DesignChatOptions {
  screenshotPath: string
  initialAnalysis?: string
  model?: AIModel
  verbose?: boolean
}

export class DesignChatSession {
  private aiService: MultiModelAIService
  private v0Reviewer: V0UIReviewerCLI
  private messages: ChatMessage[] = []
  private screenshotPath: string
  private screenshotBase64?: string
  private currentModel: AIModel
  private verbose: boolean

  constructor(options: DesignChatOptions) {
    this.screenshotPath = options.screenshotPath
    this.verbose = options.verbose || false
    
    // Initialize AI service
    this.aiService = new MultiModelAIService({ verbose: this.verbose })
    
    // Initialize V0 reviewer for UI/UX expertise
    const v0ApiKey = configManager.getApiKey()
    if (!v0ApiKey) {
      throw new Error('V0 API key is required for design chat')
    }
    this.v0Reviewer = new V0UIReviewerCLI(v0ApiKey, { verbose: this.verbose })
    
    // Set default model
    const availableModels = this.aiService.getAvailableModels()
    this.currentModel = options.model || configManager.get('defaultAIModel') || availableModels[0] || 'v0'
    
    // Initialize conversation with context
    if (options.initialAnalysis) {
      this.messages.push({
        role: 'system',
        content: `You are an AI design assistant helping to improve UI/UX. Here's the initial analysis of the design:\n\n${options.initialAnalysis}`
      })
    } else {
      this.messages.push({
        role: 'system',
        content: 'You are an AI design assistant helping to improve UI/UX. You have access to a screenshot of the current design and can provide specific, actionable feedback.'
      })
    }
  }

  async start(): Promise<void> {
    console.clear()
    
    // Display header
    console.log(boxen(
      `🎨 ${chalk.bold('Interactive Design Chat')}\n\n` +
      `📷 Screenshot: ${chalk.cyan(path.basename(this.screenshotPath))}\n` +
      `🤖 AI Model: ${chalk.green(this.currentModel)}\n` +
      `💬 Type your questions or design requests\n` +
      `📝 Commands: /model, /analyze, /tokens, /save, /exit`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ))

    // Load screenshot as base64
    await this.loadScreenshot()

    // Start chat loop
    await this.chatLoop()
  }

  private async loadScreenshot(): Promise<void> {
    const imageBuffer = await fs.readFile(this.screenshotPath)
    this.screenshotBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`
  }

  private async chatLoop(): Promise<void> {
    while (true) {
      const { input } = await inquirer.prompt({
        type: 'input',
        name: 'input',
        message: chalk.green('You:')
      })

      if (!input.trim()) continue

      // Handle commands
      if (input.startsWith('/')) {
        const handled = await this.handleCommand(input)
        if (handled === 'exit') break
        continue
      }

      // Regular chat
      await this.processChat(input)
    }
  }

  private async handleCommand(command: string): Promise<string | void> {
    const [cmd, ...args] = command.split(' ')

    switch (cmd) {
      case '/exit':
      case '/quit':
        console.log(chalk.yellow('\n👋 Ending design chat session...\n'))
        return 'exit'

      case '/model':
        await this.switchModel()
        break

      case '/analyze':
        await this.performDetailedAnalysis()
        break

      case '/tokens':
        await this.extractDesignTokens()
        break

      case '/save':
        await this.saveConversation(args[0])
        break

      case '/help':
        this.showHelp()
        break

      default:
        console.log(chalk.red(`Unknown command: ${cmd}`))
        this.showHelp()
    }
  }

  private showHelp(): void {
    console.log(boxen(
      chalk.bold('Available Commands:\n\n') +
      '/model     - Switch AI model\n' +
      '/analyze   - Perform detailed UI/UX analysis\n' +
      '/tokens    - Extract design tokens (colors, fonts, spacing)\n' +
      '/save [file] - Save conversation to file\n' +
      '/exit      - End chat session\n' +
      '/help      - Show this help',
      {
        padding: 1,
        borderStyle: 'single',
        borderColor: 'gray'
      }
    ))
  }

  private async switchModel(): Promise<void> {
    const availableModels = this.aiService.getAvailableModels()
    
    if (availableModels.length === 0) {
      console.log(chalk.red('No AI models configured. Please set API keys.'))
      return
    }

    const { model } = await inquirer.prompt([{
      type: 'list',
      name: 'model',
      message: 'Select AI model:',
      choices: availableModels.map(m => ({
        name: `${m} ${m === this.currentModel ? '(current)' : ''}`,
        value: m
      }))
    }])

    this.currentModel = model
    console.log(chalk.green(`✅ Switched to ${model}`))
  }

  private async performDetailedAnalysis(): Promise<void> {
    const spinner = ora('Performing detailed UI/UX analysis...').start()

    try {
      // Use V0 for expert UI/UX analysis
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'Please provide a detailed UI/UX analysis of this design, including component breakdown, accessibility issues, and specific improvement recommendations.',
          imageUrl: this.screenshotBase64
        }
      ]

      const analysis = await this.aiService.chat(messages, {
        model: 'v0',
        temperature: 0.7
      })

      spinner.succeed('Analysis complete')

      console.log(boxen(
        chalk.bold('🔍 Detailed UI/UX Analysis\n\n') +
        analysis,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'blue'
        }
      ))

      // Add to conversation history
      this.messages.push(
        { role: 'user', content: 'Perform detailed UI/UX analysis' },
        { role: 'assistant', content: analysis }
      )

    } catch (error) {
      spinner.fail('Analysis failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  private async extractDesignTokens(): Promise<void> {
    const spinner = ora('Extracting design tokens...').start()

    try {
      const prompt = `Analyze this UI screenshot and extract the following design tokens:

1. **Color Palette**: List all colors used with their HEX values and usage (primary, secondary, background, text, etc.)
2. **Typography**: Font families, sizes, weights, and line heights for different text elements
3. **Spacing**: Common spacing values (margins, paddings) in pixels
4. **Border Radius**: Corner radius values used
5. **Shadows**: Box shadow definitions
6. **Grid/Layout**: Column widths, gaps, breakpoints if visible

Format the output as structured data that could be used in a design system.`

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: prompt,
          imageUrl: this.screenshotBase64
        }
      ]

      const tokens = await this.aiService.chat(messages, {
        model: this.currentModel,
        temperature: 0.3 // Lower temperature for more consistent extraction
      })

      spinner.succeed('Design tokens extracted')

      console.log(boxen(
        chalk.bold('🎨 Design Tokens\n\n') +
        tokens,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'magenta'
        }
      ))

      // Add to conversation history
      this.messages.push(
        { role: 'user', content: 'Extract design tokens' },
        { role: 'assistant', content: tokens }
      )

    } catch (error) {
      spinner.fail('Token extraction failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  private async processChat(input: string): Promise<void> {
    const spinner = ora('Thinking...').start()

    try {
      // Add user message
      this.messages.push({
        role: 'user',
        content: input
      })

      // Include screenshot in the conversation for models that support it
      const modelCapabilities = this.aiService.getModelCapabilities(this.currentModel)
      const messagesWithImage = [...this.messages]
      
      if (modelCapabilities.supportsImages && this.screenshotBase64) {
        // Add image to the last user message
        messagesWithImage[messagesWithImage.length - 1].imageUrl = this.screenshotBase64
      }

      // Get AI response
      const response = await this.aiService.chat(messagesWithImage, {
        model: this.currentModel,
        temperature: 0.7
      })

      spinner.stop()

      // Display response
      console.log(chalk.blue('\nAI:'), response, '\n')

      // Add to history
      this.messages.push({
        role: 'assistant',
        content: response
      })

    } catch (error) {
      spinner.fail('Failed to get response')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  private async saveConversation(filename?: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outputPath = filename || `design-chat-${timestamp}.md`

    try {
      const content = this.formatConversationAsMarkdown()
      await fs.writeFile(outputPath, content, 'utf-8')
      console.log(chalk.green(`✅ Conversation saved to: ${outputPath}`))
    } catch (error) {
      console.error(chalk.red(`Failed to save conversation: ${error instanceof Error ? error.message : 'Unknown error'}`))
    }
  }

  private formatConversationAsMarkdown(): string {
    const timestamp = new Date().toLocaleString()
    
    let markdown = `# Design Chat Session

**Date:** ${timestamp}
**Screenshot:** ${this.screenshotPath}
**AI Model:** ${this.currentModel}

---

## Conversation

`

    for (const msg of this.messages) {
      if (msg.role === 'system') continue
      
      const prefix = msg.role === 'user' ? '### 👤 User' : '### 🤖 AI'
      markdown += `${prefix}\n\n${msg.content}\n\n`
    }

    markdown += `\n---\n\n*Generated by V0 UI/UX Reviewer - Design Chat*`
    
    return markdown
  }
}

export async function startDesignChat(screenshotPath: string, options: {
  initialAnalysis?: string
  model?: AIModel
  verbose?: boolean
} = {}): Promise<void> {
  try {
    const session = new DesignChatSession({
      screenshotPath,
      ...options
    })
    
    await session.start()
  } catch (error) {
    logger.error('Design chat error:', error instanceof Error ? error.message : String(error))
    throw error
  }
}