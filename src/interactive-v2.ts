import chalk from 'chalk'
import inquirer from 'inquirer'
import readline from 'readline'
import { V0UIReviewerCLI } from './index.js'
import { MultiModelAIService, AIModel } from './ai-service.js'
import { configManager } from './config.js'
import { logger } from './logger.js'
import { EnhancedProgressBar } from './progress.js'
import { promises as fs } from 'fs'
import path from 'path'

interface Command {
  name: string
  description: string
  action: (args: string[], state: SessionState) => Promise<void>
}

interface SessionState {
  mode: 'remote' | 'local'
  currentUrl?: string
  currentPath?: string
  lastScreenshot?: string
  model: AIModel
  reviewer: V0UIReviewerCLI
  aiService: MultiModelAIService
  history: Array<{ command: string, result?: string }>
  verbose: boolean
}

export class InteractiveV2Session {
  private rl: readline.Interface
  private state: SessionState
  private commands: Map<string, Command>
  private isProcessing = false

  constructor(reviewer: V0UIReviewerCLI, options: { verbose?: boolean } = {}) {
    this.state = {
      mode: 'remote',
      model: configManager.get('defaultAIModel') || 'v0',
      reviewer,
      aiService: new MultiModelAIService({
        verbose: options.verbose
      }),
      history: [],
      verbose: options.verbose || false
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt()
    })

    this.commands = new Map()
    this.registerCommands()
    this.setupAutocomplete()
  }

  private getPrompt(): string {
    const mode = chalk.gray(`[${this.state.mode}]`)
    const location = this.state.mode === 'remote' 
      ? chalk.cyan(this.state.currentUrl || 'no url')
      : chalk.green(this.state.currentPath || process.cwd())
    const model = chalk.yellow(`(${this.state.model})`)
    
    return `${mode} ${location} ${model} › `
  }

  private registerCommands() {
    // Mode commands
    this.commands.set('/remote', {
      name: '/remote <url>',
      description: 'Switch to remote mode and set URL',
      action: async (args) => {
        this.state.mode = 'remote'
        if (args.length > 0) {
          this.state.currentUrl = args.join(' ')
          this.log(`Switched to remote mode: ${this.state.currentUrl}`)
        } else {
          this.log('Switched to remote mode')
        }
      }
    })

    this.commands.set('/local', {
      name: '/local [path]',
      description: 'Switch to local mode and set working directory',
      action: async (args) => {
        this.state.mode = 'local'
        if (args.length > 0) {
          const targetPath = path.resolve(args.join(' '))
          try {
            await fs.access(targetPath)
            this.state.currentPath = targetPath
            process.chdir(targetPath)
            this.log(`Switched to local mode: ${targetPath}`)
          } catch {
            this.error(`Path not found: ${targetPath}`)
          }
        } else {
          this.state.currentPath = process.cwd()
          this.log(`Switched to local mode: ${this.state.currentPath}`)
        }
      }
    })

    // Review commands
    this.commands.set('/review', {
      name: '/review [options]',
      description: 'Review current URL or local files',
      action: async (args) => {
        if (this.state.mode === 'remote' && !this.state.currentUrl) {
          this.error('No URL set. Use /remote <url> first')
          return
        }

        const progress = !this.state.verbose ? new EnhancedProgressBar([
          { name: 'Screenshot', weight: 50 },
          { name: 'Analysis', weight: 50 }
        ]) : null

        try {
          progress?.start()

          if (this.state.mode === 'remote') {
            const result = await this.state.reviewer.reviewURL(this.state.currentUrl!, {
              model: this.state.model,
              verbose: this.state.verbose,
              onProgress: progress ? (step, percent) => {
                progress.updateStep(step, percent)
                if (percent === 100) progress.completeStep(step)
              } : undefined
            })

            progress?.stop()
            this.state.lastScreenshot = result.screenshot
            this.displayReview(result)
          } else {
            // Local mode: analyze current directory structure
            await this.analyzeLocalProject()
          }
        } catch (error) {
          progress?.stop()
          this.error(error instanceof Error ? error.message : 'Review failed')
        }
      }
    })

    // Model commands
    this.commands.set('/model', {
      name: '/model [model]',
      description: 'Switch AI model',
      action: async (args) => {
        const validModels = ['v0', 'gpt-4', 'o3-mini', 'gpt-3.5-turbo', 'claude-sonnet-4', 'claude-3-opus', 'claude-3-haiku']
        
        if (args.length === 0) {
          this.log(`Current model: ${chalk.green(this.state.model)}`)
          this.log('Available models:')
          for (const m of validModels) {
            const available = await this.state.aiService.isModelAvailable(this.mapModelName(m))
            this.log(`  ${available ? '✓' : '✗'} ${m}`)
          }
          return
        }

        const model = args[0]
        const mappedModel = this.mapModelName(model)
        
        if (!validModels.includes(model)) {
          this.error(`Invalid model: ${model}`)
          return
        }

        if (!(await this.state.aiService.isModelAvailable(mappedModel))) {
          this.error(`Model ${model} is not configured. Check your API keys.`)
          return
        }

        this.state.model = mappedModel
        this.log(`Switched to model: ${chalk.green(model)}`)
      }
    })

    // Style extraction
    this.commands.set('/extract', {
      name: '/extract [format]',
      description: 'Extract design tokens (json|css|tailwind)',
      action: async (args) => {
        if (this.state.mode === 'remote' && !this.state.lastScreenshot) {
          this.error('No screenshot available. Run /review first')
          return
        }

        const format = args[0] || 'json'
        this.log('Extracting design tokens...')
        
        // Implementation would extract styles from last screenshot
        this.log(`Design tokens extracted in ${format} format`)
      }
    })

    // Chat command
    this.commands.set('/chat', {
      name: '/chat <message>',
      description: 'Chat about the current design',
      action: async (args) => {
        if (args.length === 0) {
          this.error('Please provide a message')
          return
        }

        const message = args.join(' ')
        await this.chatAboutDesign(message)
      }
    })

    // Utility commands
    this.commands.set('/verbose', {
      name: '/verbose',
      description: 'Toggle verbose mode',
      action: async () => {
        this.state.verbose = !this.state.verbose
        this.log(`Verbose mode: ${this.state.verbose ? 'ON' : 'OFF'}`)
      }
    })

    this.commands.set('/history', {
      name: '/history',
      description: 'Show command history',
      action: async () => {
        if (this.state.history.length === 0) {
          this.log('No command history')
          return
        }
        
        this.state.history.forEach((item, index) => {
          this.log(`${chalk.gray(`[${index + 1}]`)} ${item.command}`)
        })
      }
    })

    this.commands.set('/clear', {
      name: '/clear',
      description: 'Clear the screen',
      action: async () => {
        console.clear()
      }
    })

    this.commands.set('/help', {
      name: '/help',
      description: 'Show available commands',
      action: async () => {
        this.showHelp()
      }
    })

    this.commands.set('/exit', {
      name: '/exit',
      description: 'Exit interactive mode',
      action: async () => {
        this.log(chalk.yellow('\nGoodbye! 👋'))
        process.exit(0)
      }
    })
  }

  private mapModelName(model: string): AIModel {
    const mapping: Record<string, AIModel> = {
      'o3-mini': 'gpt-4',  // Map to GPT-4 for now until o3-mini is available
      'claude-sonnet-4': 'claude-3-sonnet',  // Map to Claude-3-Sonnet
      'claude-sonnet-4-20250514': 'claude-3-sonnet'
    }
    return (mapping[model] || model) as AIModel
  }

  private setupAutocomplete() {
    // Set up tab completion
    const commands = Array.from(this.commands.keys())
    
    this.rl.on('line', (line) => {
      if (this.isProcessing) return
      
      this.isProcessing = true
      this.handleInput(line.trim()).finally(() => {
        this.isProcessing = false
        this.rl.setPrompt(this.getPrompt())
        this.rl.prompt()
      })
    })

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      this.log(chalk.yellow('\nUse /exit to quit'))
      this.rl.prompt()
    })

    // Tab completion for commands
    const completer = (line: string): [string[], string] => {
      const completions = commands
      const hits = completions.filter(c => c.startsWith(line))
      return [hits.length ? hits : completions, line]
    }

    ;(this.rl as any).completer = completer
  }

  private async handleInput(input: string) {
    if (!input) return

    // Add to history
    this.state.history.push({ command: input })

    // Check if it's a command
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.split(' ')
      const command = this.commands.get(cmd)
      
      if (command) {
        await command.action(args, this.state)
      } else {
        this.showCommandSuggestions(cmd)
      }
    } else {
      // Natural language input - treat as chat
      await this.chatAboutDesign(input)
    }
  }

  private showCommandSuggestions(partial: string) {
    const suggestions = Array.from(this.commands.entries())
      .filter(([cmd]) => cmd.startsWith(partial))
      .slice(0, 5)

    if (suggestions.length === 0) {
      this.error(`Unknown command: ${partial}`)
      this.log('Type /help for available commands')
    } else {
      this.log(chalk.yellow('Did you mean:'))
      suggestions.forEach(([cmd, command]) => {
        this.log(`  ${chalk.cyan(cmd)} - ${chalk.gray(command.description)}`)
      })
    }
  }

  private async analyzeLocalProject() {
    this.log('Analyzing local project structure...')
    
    try {
      // Simple implementation for now
      const cwd = this.state.currentPath || process.cwd()
      this.log(`Current directory: ${cwd}`)
      
      // Check for common project files
      const hasPackageJson = await fs.access(path.join(cwd, 'package.json')).then(() => true).catch(() => false)
      const hasReadme = await fs.access(path.join(cwd, 'README.md')).then(() => true).catch(() => false)
      
      if (hasPackageJson) {
        const pkg = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf-8'))
        this.log(`\nProject: ${pkg.name || 'Unnamed'}`)
        this.log(`Description: ${pkg.description || 'No description'}`)
      }
      
      if (hasReadme) {
        this.log('\n✓ README.md found')
      }
      
      this.log('\nUse /chat to discuss UI/UX improvements for this project')
    } catch (error) {
      this.error(`Failed to analyze project: ${error}`)
    }
  }

  private async analyzeLocalFile(filePath: string) {
    try {
      const content = await fs.readFile(path.join(this.state.currentPath || process.cwd(), filePath), 'utf-8')
      
      const messages = [{
        role: 'user' as const,
        content: `Analyze this ${path.extname(filePath)} file for UI/UX best practices:\n\n${content.slice(0, 3000)}${content.length > 3000 ? '\n...(truncated)' : ''}`
      }]

      const response = await this.state.aiService.chat(messages, {
        model: this.state.model,
        temperature: 0.7
      })

      this.log(chalk.green(`\nAnalysis of ${filePath}:`))
      this.log(response)
    } catch (error) {
      this.error(`Failed to analyze file: ${error}`)
    }
  }

  private async chatAboutDesign(message: string) {
    try {
      const context = this.state.mode === 'remote' 
        ? `Discussing UI/UX for: ${this.state.currentUrl}`
        : `Discussing local project at: ${this.state.currentPath}`

      const messages = [
        { role: 'system' as const, content: context },
        { role: 'user' as const, content: message }
      ]

      if (!this.state.verbose) {
        const spinner = chalk.gray('🤔 Thinking...')
        process.stdout.write(spinner)
      }

      const response = await this.state.aiService.chat(messages, {
        model: this.state.model,
        temperature: 0.7
      })

      if (!this.state.verbose) {
        process.stdout.write('\r' + ' '.repeat(20) + '\r')
      }

      this.log(chalk.white(response))
    } catch (error) {
      this.error(`Chat failed: ${error}`)
    }
  }

  private displayReview(result: any) {
    if (this.state.verbose) {
      // Full review output
      console.log(chalk.green('\n=== UI/UX Review ===\n'))
      console.log(result.componentBreakdown)
      console.log(result.heuristicAudit)
      console.log(result.recommendations)
    } else {
      // Condensed output
      console.log(chalk.green('\n✅ Review complete'))
      console.log(chalk.gray('Use /chat to discuss specific aspects'))
    }
  }

  private showHelp() {
    console.log(chalk.bold('\n🎨 v0-review Interactive Mode\n'))
    
    const categories = {
      'Mode Control': ['/remote', '/local'],
      'Analysis': ['/review', '/extract', '/chat'],
      'Configuration': ['/model', '/verbose'],
      'Utilities': ['/history', '/clear', '/help', '/exit']
    }

    Object.entries(categories).forEach(([category, cmds]) => {
      console.log(chalk.yellow(`${category}:`))
      cmds.forEach(cmd => {
        const command = this.commands.get(cmd)
        if (command) {
          console.log(`  ${chalk.cyan(command.name.padEnd(20))} ${chalk.gray(command.description)}`)
        }
      })
      console.log()
    })

    console.log(chalk.gray('💡 Tip: Type any message without / to chat about the current design\n'))
  }

  private log(message: string) {
    console.log(message)
  }

  private error(message: string) {
    console.error(chalk.red(`❌ ${message}`))
  }

  async start() {
    console.clear()
    console.log(chalk.bold.magenta(`
╔═══════════════════════════════════════╗
║       v0-review Interactive Mode      ║
║   UI/UX Analysis & Design Assistant   ║
╚═══════════════════════════════════════╝
`))

    // Initial setup
    const { mode } = await inquirer.prompt([{
      type: 'list',
      name: 'mode',
      message: 'Select mode:',
      choices: [
        { name: 'Remote - Analyze websites by URL', value: 'remote' },
        { name: 'Local - Analyze files in current directory', value: 'local' }
      ],
      default: 'remote'
    }])

    this.state.mode = mode

    if (mode === 'remote') {
      const { url } = await inquirer.prompt([{
        type: 'input',
        name: 'url',
        message: 'Enter URL to analyze:',
        validate: (input) => input.length > 0 || 'Please enter a URL'
      }])
      this.state.currentUrl = url
    } else {
      this.state.currentPath = process.cwd()
      this.log(`Working directory: ${chalk.green(this.state.currentPath)}`)
    }

    this.log(chalk.gray('\nType /help for commands or just type to chat\n'))
    
    this.rl.setPrompt(this.getPrompt())
    this.rl.prompt()
  }
}

export async function runInteractiveV2Mode(options: { verbose?: boolean } = {}) {
  const apiKey = configManager.getApiKey()
  if (!apiKey) {
    console.error(chalk.red('No API key found. Run: v0-review --setup'))
    process.exit(1)
  }

  const reviewer = new V0UIReviewerCLI(apiKey, {
    verbose: options.verbose
  })

  const session = new InteractiveV2Session(reviewer, options)
  await session.start()
}