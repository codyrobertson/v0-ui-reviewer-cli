import chalk from 'chalk'
import readline from 'readline'
import { V0UIReviewerCLI } from './index.js'
import { MultiModelAIService, AIModel } from './ai-service.js'
import { configManager } from './config.js'
import { promises as fs } from 'fs'
import path from 'path'
import { getTempManager } from './temp-manager.js'
import { ModelFallback } from './model-fallback.js'

interface SessionState {
  mode: 'remote' | 'local'
  currentUrl?: string
  currentPath?: string
  lastScreenshot?: string
  model: AIModel
  reviewer: V0UIReviewerCLI
  aiService: MultiModelAIService
  verbose: boolean
  isReviewing: boolean
}

export class SimpleInteractiveSession {
  private rl: readline.Interface
  private state: SessionState
  private isProcessing = false

  constructor(reviewer: V0UIReviewerCLI, options: { verbose?: boolean, initialUrl?: string } = {}) {
    this.state = {
      mode: 'remote',
      model: configManager.get('defaultAIModel') || 'v0',
      reviewer,
      aiService: new MultiModelAIService({ verbose: options.verbose }),
      verbose: options.verbose || false,
      isReviewing: false,
      currentUrl: options.initialUrl ? (options.initialUrl.startsWith('http') ? options.initialUrl : `https://${options.initialUrl}`) : undefined
    }

    // Create readline interface with custom prompt
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      terminal: true
    })

    // Handle line input
    this.rl.on('line', async (line) => {
      if (this.isProcessing) return
      
      this.isProcessing = true
      await this.handleInput(line.trim())
      this.isProcessing = false
      
      // Update and show prompt
      this.rl.setPrompt(this.getPrompt())
      this.rl.prompt()
    })

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nExiting... (press Ctrl+C again to force quit)'))
      this.cleanup()
      process.exit(0)
    })
  }

  private getPrompt(): string {
    const mode = this.state.mode === 'remote' ? '🌐' : '📁'
    const location = this.state.mode === 'remote' 
      ? (this.state.currentUrl || 'no url set')
      : path.basename(this.state.currentPath || process.cwd())
    const model = chalk.gray(`[${this.state.model}]`)
    
    return `${mode} ${chalk.cyan(location)} ${model} › `
  }

  private async handleInput(input: string) {
    if (!input) return

    // Handle commands
    if (input.startsWith('/')) {
      await this.handleCommand(input)
    } else {
      // Natural chat about the current context
      await this.chat(input)
    }
  }

  private async handleCommand(input: string) {
    const [cmd, ...args] = input.split(' ')
    const arg = args.join(' ').trim()

    switch (cmd) {
      case '/help':
      case '/?':
        this.showHelp()
        break

      case '/url':
        if (!arg) {
          console.log(chalk.yellow('Current URL:'), this.state.currentUrl || 'none')
          console.log(chalk.gray('Usage: /url <website-url>'))
        } else {
          this.state.currentUrl = arg.startsWith('http') ? arg : `https://${arg}`
          console.log(chalk.green('✓'), `URL set to: ${this.state.currentUrl}`)
          console.log(chalk.gray('Now run /review to analyze it'))
        }
        break

      case '/review':
      case '/r':
        await this.review()
        break
        
      case '/code':
      case '/codegen':
        await this.generateCode(arg)
        break
        
      case '/styles':
      case '/extract':
        await this.extractStyles()
        break

      case '/model':
      case '/m':
        if (!arg) {
          await this.showModels()
        } else {
          await this.setModel(arg)
        }
        break

      case '/verbose':
      case '/v':
        this.state.verbose = !this.state.verbose
        console.log(chalk.yellow('Verbose mode:'), this.state.verbose ? 'ON' : 'OFF')
        break

      case '/local':
        this.state.mode = 'local'
        this.state.currentPath = process.cwd()
        console.log(chalk.green('✓'), 'Switched to local mode')
        console.log(chalk.gray('Current directory:'), this.state.currentPath)
        break

      case '/remote':
        this.state.mode = 'remote'
        console.log(chalk.green('✓'), 'Switched to remote mode')
        if (this.state.currentUrl) {
          console.log(chalk.gray('Current URL:'), this.state.currentUrl)
        }
        break

      case '/clear':
      case '/c':
        console.clear()
        this.showHeader()
        break

      case '/exit':
      case '/quit':
      case '/q':
        this.cleanup()
        process.exit(0)
        break

      default:
        console.log(chalk.red('Unknown command:'), cmd)
        console.log(chalk.gray('Type /help for available commands'))
    }
  }

  private async review() {
    if (this.state.isReviewing) {
      console.log(chalk.yellow('⏳ Review already in progress...'))
      return
    }

    this.state.isReviewing = true
    
    try {
      // Check if we have a saved screenshot and analysis from initial review
      const tempManager = getTempManager()
      const sessionData = await tempManager.getSessionData()
      const lastScreenshot = await tempManager.getLastScreenshot()
      
      // Check if we have a complete analysis stored
      const storedAnalysis = await tempManager.getAnalysis()
      
      if (storedAnalysis && lastScreenshot && lastScreenshot.url === this.state.currentUrl) {
        // We have everything stored! Just show it
        console.log(chalk.green('\n✅ Using cached analysis (screenshot + styles already extracted)'))
        console.log(chalk.gray(`📁 Temp dir: ${tempManager.getTempDir()}`))
        console.log(chalk.gray(`📷 Screenshot: ${path.basename(lastScreenshot.path)}`))
        console.log(chalk.gray(`🎨 Styles: ${sessionData.hasStyles ? 'Available' : 'Not extracted'}`))
        console.log(chalk.gray(`🤖 Model: ${this.state.model}`))
        
        this.state.lastScreenshot = lastScreenshot.path
        
        // Show results from stored analysis
        console.log(chalk.green('\n✅ Review complete!\n'))
        
        if (!this.state.verbose) {
          // Show summary only
          console.log(chalk.bold('Quick Summary:'))
          const lines = storedAnalysis.componentBreakdown.split('\n').slice(0, 5)
          console.log(lines.join('\n') + '...\n')
          console.log(chalk.gray('Use /verbose and /review again for full analysis'))
        } else {
          // Show full analysis
          console.log(storedAnalysis.componentBreakdown)
          console.log('\n' + storedAnalysis.heuristicAudit)
          console.log('\n' + storedAnalysis.recommendations)
        }
        
        console.log(chalk.blue('\n💡 You can now:'))
        console.log(chalk.gray('  • Chat about the design'))
        console.log(chalk.gray('  • /code - Generate React/Tailwind components'))
        console.log(chalk.gray('  • /styles - View extracted design tokens'))
        
        return
      }
      
      if (lastScreenshot && lastScreenshot.url === this.state.currentUrl) {
        // Use saved screenshot but re-analyze
        console.log(chalk.blue('\n🔄 Re-analyzing saved screenshot...'))
        console.log(chalk.gray(`📁 Temp dir: ${tempManager.getTempDir()}`))
        console.log(chalk.gray(`📷 Using: ${path.basename(lastScreenshot.path)}`))
        console.log(chalk.gray(`🤖 Model: ${this.state.model}`))
        
        const result = await this.state.reviewer.reviewScreenshot(lastScreenshot.path, {
          model: this.state.model,
          verbose: this.state.verbose,
          showImage: true,
          context: `URL: ${lastScreenshot.url}`
        })
        
        this.state.lastScreenshot = result.screenshot
        
        // Show results
        console.log(chalk.green('\n✅ Review complete!\n'))
        
        if (!this.state.verbose) {
          // Show summary only
          console.log(chalk.bold('Quick Summary:'))
          const lines = result.componentBreakdown.split('\n').slice(0, 5)
          console.log(lines.join('\n') + '...\n')
          console.log(chalk.gray('Use /verbose and /review again for full analysis'))
        } else {
          // Show full analysis
          console.log(result.componentBreakdown)
          console.log('\n' + result.heuristicAudit)
          console.log('\n' + result.recommendations)
        }
      } else if (this.state.mode === 'remote' && this.state.currentUrl) {
        // No saved screenshot, capture new one
        console.log(chalk.blue('\n🔄 Capturing and reviewing...'))
        
        const result = await this.state.reviewer.reviewURL(this.state.currentUrl!, {
          model: this.state.model,
          verbose: this.state.verbose,
          showImage: true
        })

        this.state.lastScreenshot = result.screenshot
        
        // Show results
        console.log(chalk.green('\n✅ Review complete!\n'))
        
        if (!this.state.verbose) {
          // Show summary only
          console.log(chalk.bold('Quick Summary:'))
          const lines = result.componentBreakdown.split('\n').slice(0, 5)
          console.log(lines.join('\n') + '...\n')
          console.log(chalk.gray('Use /verbose and /review again for full analysis'))
        } else {
          // Show full analysis
          console.log(result.componentBreakdown)
          console.log('\n' + result.heuristicAudit)
          console.log('\n' + result.recommendations)
        }
      } else {
        console.log(chalk.yellow('Local mode analysis coming soon...'))
      }
    } catch (error) {
      console.log(chalk.red('❌ Review failed:'), error instanceof Error ? error.message : error)
      
      // Suggest fallback models
      if (error instanceof Error) {
        const availableModels = this.state.aiService.getAvailableModels()
        ModelFallback.suggestFallback(error, this.state.model, availableModels)
      }
    } finally {
      this.state.isReviewing = false
    }
  }

  private async chat(message: string) {
    if (!this.state.lastScreenshot && this.state.mode === 'remote') {
      console.log(chalk.yellow('💡 Run /review first to analyze the website'))
      return
    }

    try {
      const context = this.state.mode === 'remote' 
        ? `Discussing the UI/UX of ${this.state.currentUrl}`
        : `Discussing the project in ${this.state.currentPath}`

      console.log(chalk.gray('Thinking...'))
      
      const response = await this.state.aiService.chat([
        { role: 'system', content: context },
        { role: 'user', content: message }
      ], {
        model: this.state.model,
        temperature: 0.7
      })

      // Clear thinking message
      process.stdout.write('\r\x1b[K')
      console.log(response)
    } catch (error) {
      console.log(chalk.red('❌ Chat error:'), error instanceof Error ? error.message : error)
    }
  }

  private async showModels() {
    console.log(chalk.bold('\n📊 Available AI Models:\n'))
    
    const models = [
      { id: 'v0', name: 'V0 UI/UX Expert', desc: 'Specialized for UI/UX analysis' },
      { id: 'gpt-4', name: 'GPT-4', desc: 'OpenAI\'s most capable model' },
      { id: 'o3-mini', name: 'O3 Mini', desc: 'Fast and efficient' },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', desc: 'Anthropic\'s latest model' }
    ]

    for (const model of models) {
      const available = await this.state.aiService.isModelAvailable(model.id as AIModel)
      const current = this.state.model === model.id ? chalk.green(' (current)') : ''
      const status = available ? chalk.green('✓') : chalk.red('✗')
      
      console.log(`  ${status} ${chalk.bold(model.id)}${current}`)
      console.log(`     ${chalk.gray(model.desc)}\n`)
    }

    if (this.state.model) {
      console.log(chalk.gray('Change with: /model <model-id>'))
    }
  }

  private async setModel(modelId: string) {
    const validModels = ['v0', 'gpt-4', 'o3-mini', 'claude-sonnet-4', 'claude-3-opus', 'claude-3-sonnet']
    
    if (!validModels.includes(modelId)) {
      console.log(chalk.red('❌ Invalid model:'), modelId)
      console.log(chalk.gray('Valid models:'), validModels.join(', '))
      return
    }

    const available = await this.state.aiService.isModelAvailable(modelId as AIModel)
    if (!available) {
      console.log(chalk.red('❌ Model not available:'), modelId)
      console.log(chalk.gray('Check your API keys with: v0-review --setup'))
      return
    }

    this.state.model = modelId as AIModel
    console.log(chalk.green('✓'), `Model changed to: ${modelId}`)
  }

  private async generateCode(component?: string) {
    if (!this.state.lastScreenshot) {
      console.log(chalk.yellow('💡 Run /review first to analyze the website'))
      return
    }
    
    try {
      console.log(chalk.gray('Generating code...'))
      
      const prompt = component 
        ? `Generate React/Tailwind code for the ${component} component from the screenshot`
        : `Generate React/Tailwind code for the main components visible in the screenshot`
      
      // Read image and convert to base64
      const imageBuffer = await fs.readFile(this.state.lastScreenshot)
      const imageBase64 = imageBuffer.toString('base64')
      
      const response = await this.state.aiService.chat([
        { role: 'system', content: 'You are a React/Tailwind expert. Generate clean, reusable component code.' },
        { role: 'user', content: prompt, imageUrl: `data:image/png;base64,${imageBase64}` }
      ], {
        model: this.state.model,
        temperature: 0.3
      })
      
      console.log('\n' + response)
    } catch (error) {
      console.log(chalk.red('❌ Code generation failed:'), error instanceof Error ? error.message : error)
    }
  }
  
  private async extractStyles() {
    const tempManager = getTempManager()
    const sessionData = await tempManager.getSessionData()
    
    if (!sessionData.hasStyles) {
      console.log(chalk.yellow('💡 Run /review first - styles are extracted automatically during review'))
      return
    }
    
    try {
      console.log(chalk.blue('\n🎨 Extracted Design Tokens'))
      console.log(chalk.gray(`📁 Location: ${tempManager.getTempDir()}/styles/`))
      
      // Show available formats
      const formats = ['json', 'css', 'tailwind'] as const
      
      for (const format of formats) {
        const tokens = await tempManager.getStyleTokens(format)
        if (tokens) {
          const filename = format === 'json' ? 'tokens.json' : format === 'css' ? 'tokens.css' : 'tailwind.config.js'
          console.log(chalk.green(`\n✅ ${format.toUpperCase()} (${filename}):`))
          
          // Show preview
          const lines = tokens.split('\n')
          const preview = lines.slice(0, 8).join('\n')
          console.log(chalk.gray(preview))
          if (lines.length > 8) {
            console.log(chalk.gray(`... (${lines.length - 8} more lines)`))
          }
        }
      }
      
      console.log(chalk.cyan('\n📝 To use in code generation, just run /code - styles are automatically included!'))
      
    } catch (error) {
      console.log(chalk.red('❌ Style display failed:'), error instanceof Error ? error.message : error)
    }
  }

  private showHelp() {
    console.log(chalk.bold('\n🎨 V0-Review Commands\n'))
    
    const commands = [
      { cmd: '/url <website>', desc: 'Set website to review', example: '/url tacolabs.ai' },
      { cmd: '/review', desc: 'Analyze website + extract styles automatically', alias: '/r' },
      { cmd: '/code [component]', desc: 'Generate React/Tailwind code with extracted styles', example: '/code navbar' },
      { cmd: '/styles', desc: 'View extracted design tokens (auto-extracted during review)', alias: '/extract' },
      { cmd: '/model [id]', desc: 'Show/change AI model', alias: '/m' },
      { cmd: '/verbose', desc: 'Toggle detailed output', alias: '/v' },
      { cmd: '/local', desc: 'Switch to local mode' },
      { cmd: '/remote', desc: 'Switch to remote mode' },
      { cmd: '/clear', desc: 'Clear screen', alias: '/c' },
      { cmd: '/help', desc: 'Show this help', alias: '/?' },
      { cmd: '/exit', desc: 'Exit the program', alias: '/q' }
    ]

    commands.forEach(({ cmd, desc, alias, example }) => {
      const cmdText = chalk.cyan(cmd.padEnd(20))
      const aliasText = alias ? chalk.gray(` (${alias})`) : ''
      console.log(`  ${cmdText} ${desc}${aliasText}`)
      if (example) {
        console.log(chalk.gray(`  ${''.padEnd(20)} Example: ${example}\n`))
      }
    })

    console.log(chalk.gray('\n💡 Streamlined Workflow:'))
    console.log(chalk.gray('  1. /review extracts styles automatically in background'))
    console.log(chalk.gray('  2. Chat about design or /code for instant generation'))
    console.log(chalk.gray('  3. All data stored for immediate use\n'))
  }

  private showHeader() {
    console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║        V0-Review Interactive           ║
║      UI/UX Analysis Assistant          ║
╚════════════════════════════════════════╝
`))
    console.log(chalk.gray('Type /help for commands\n'))
  }

  private cleanup() {
    this.rl.close()
  }

  async start() {
    console.clear()
    this.showHeader()

    // Quick start guide
    console.log(chalk.yellow('Quick Start (Everything Automated):'))
    console.log('  1. Set a URL:    ' + chalk.cyan('/url tacolabs.ai'))
    console.log('  2. One command:  ' + chalk.cyan('/review') + chalk.gray(' (captures + analyzes + extracts styles)'))
    console.log('  3. Instant use:  ' + chalk.cyan('chat') + chalk.gray(' or ') + chalk.cyan('/code') + chalk.gray(' - all data ready!\n'))

    // Show if URL was pre-set
    if (this.state.currentUrl) {
      console.log(chalk.green('✓'), `URL set to: ${this.state.currentUrl}`)
    }

    // Update prompt after setting URL
    this.rl.setPrompt(this.getPrompt())
    this.rl.prompt()
  }
}

export async function runSimpleInteractiveMode(options: { verbose?: boolean, initialUrl?: string } = {}) {
  const apiKey = configManager.getApiKey()
  if (!apiKey) {
    console.error(chalk.red('No API key found. Run: v0-review --setup'))
    process.exit(1)
  }

  const reviewer = new V0UIReviewerCLI(apiKey, { verbose: options.verbose })
  const session = new SimpleInteractiveSession(reviewer, options)
  await session.start()
}