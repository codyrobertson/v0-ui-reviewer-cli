import inquirer from 'inquirer'
import chalk from 'chalk'
import boxen from 'boxen'
import ora from 'ora'
import { configManager, V0Config } from './config.js'
import { V0UIReviewerCLI } from './index.js'
import { logger } from './logger.js'

export async function runInteractiveSetup(): Promise<void> {
  console.clear()
  
  console.log(boxen(
    `🎨 ${chalk.bold('V0 UI/UX Reviewer - Setup Wizard')}\n\n` +
    `Welcome! Let's configure your v0 UI/UX reviewer.`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ))

  // Get current config
  const currentConfig = configManager.getAll()
  
  // Prompt for configuration
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your v0.dev API key:',
      default: currentConfig.apiKey || process.env.V0_API_KEY,
      validate: async (input) => {
        if (!input) return 'API key is required'
        
        // Test the API key
        const spinner = ora('Validating API key...').start()
        try {
          const reviewer = new V0UIReviewerCLI(input)
          // Make a minimal test request
          const response = await fetch('https://api.v0.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${input}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'v0-1.0-md',
              messages: [{ role: 'user', content: 'test' }],
              max_tokens: 1
            })
          })
          
          spinner.stop()
          
          if (response.status === 401) {
            return chalk.red('Invalid API key. Get your key from https://v0.dev')
          } else if (response.status === 429) {
            spinner.succeed('API key is valid (rate limit reached, but key works)')
            return true
          } else if (response.ok) {
            spinner.succeed('API key validated successfully')
            return true
          } else {
            return chalk.red(`API validation failed: ${response.status}`)
          }
        } catch (error) {
          spinner.fail()
          return chalk.red(`Failed to validate API key: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    },
    {
      type: 'number',
      name: 'timeout',
      message: 'Default timeout for page loading (ms):',
      default: currentConfig.timeout || 30000,
      validate: (input) => (input && input > 0 && input <= 300000) || 'Timeout must be between 1 and 300000 ms'
    },
    {
      type: 'list',
      name: 'defaultDevice',
      message: 'Default device type:',
      choices: [
        { name: 'Desktop (1920x1080)', value: 'desktop' },
        { name: 'Mobile (375x667)', value: 'mobile' }
      ],
      default: currentConfig.defaultDevice || 'desktop'
    },
    {
      type: 'confirm',
      name: 'defaultFullPage',
      message: 'Capture full page screenshots by default?',
      default: currentConfig.defaultFullPage !== false
    },
    {
      type: 'confirm',
      name: 'defaultShowImage',
      message: 'Display screenshots in terminal by default?',
      default: currentConfig.defaultShowImage !== false
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Logging level:',
      choices: [
        { name: 'Error only', value: 'error' },
        { name: 'Warnings and errors', value: 'warn' },
        { name: 'Info (default)', value: 'info' },
        { name: 'Debug (verbose)', value: 'debug' }
      ],
      default: currentConfig.logLevel || 'info'
    },
    {
      type: 'input',
      name: 'outputDirectory',
      message: 'Default output directory for reports:',
      default: currentConfig.outputDirectory || process.cwd(),
      filter: (input) => input.trim(),
      validate: async (input) => {
        if (!input) return 'Output directory is required'
        // Check if directory exists or can be created
        try {
          if (!input) return 'Output directory is required'
          const fs = await import('fs')
          const path = await import('path')
          const resolvedPath = path.resolve(input)
          const stats = await fs.promises.stat(resolvedPath).catch(() => null)
          if (stats && !stats.isDirectory()) {
            return 'Path exists but is not a directory'
          }
          return true
        } catch {
          return true // Directory will be created if it doesn't exist
        }
      }
    },
    {
      type: 'confirm',
      name: 'configureAdditionalModels',
      message: 'Would you like to configure additional AI models (OpenAI, Claude)?',
      default: false
    },
    {
      type: 'password',
      name: 'openaiApiKey',
      message: 'Enter your OpenAI API key (optional):',
      default: currentConfig.openaiApiKey || process.env.OPENAI_API_KEY,
      when: (answers) => answers.configureAdditionalModels,
      filter: (input) => input.trim() || undefined
    },
    {
      type: 'password',
      name: 'anthropicApiKey',
      message: 'Enter your Anthropic (Claude) API key (optional):',
      default: currentConfig.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      when: (answers) => answers.configureAdditionalModels,
      filter: (input) => input.trim() || undefined
    },
    {
      type: 'list',
      name: 'defaultAIModel',
      message: 'Default AI model for design chat:',
      choices: (answers) => {
        const choices = [{ name: 'v0 (UI/UX Expert)', value: 'v0' }]
        if (answers.openaiApiKey) {
          choices.push(
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
          )
        }
        if (answers.anthropicApiKey) {
          choices.push(
            { name: 'Claude 3 Opus', value: 'claude-3-opus' },
            { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
            { name: 'Claude 3 Haiku', value: 'claude-3-haiku' }
          )
        }
        return choices
      },
      default: currentConfig.defaultAIModel || 'v0',
      when: (answers) => answers.configureAdditionalModels
    }
  ])

  // Save configuration
  const spinner = ora('Saving configuration...').start()
  try {
    await configManager.ensureConfigDirectory()
    configManager.setAll(answers as V0Config)
    spinner.succeed('Configuration saved successfully')
    
    console.log(boxen(
      `✅ ${chalk.bold.green('Setup Complete!')}\n\n` +
      `Configuration saved to:\n${chalk.cyan(configManager.getConfigPath())}\n\n` +
      `You can now use the v0 reviewer:\n` +
      `${chalk.yellow('v0-review --url https://example.com')}\n` +
      `${chalk.yellow('v0-review --screenshot ./image.png')}\n\n` +
      `Run ${chalk.cyan('v0-review --help')} for more options.`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    ))
  } catch (error) {
    spinner.fail('Failed to save configuration')
    logger.error('Setup failed:', error)
    process.exit(1)
  }
}

export async function checkFirstRun(): Promise<boolean> {
  if (configManager.isFirstRun()) {
    console.log(boxen(
      `👋 ${chalk.bold('Welcome to V0 UI/UX Reviewer!')}\n\n` +
      `It looks like this is your first time using the tool.\n` +
      `Would you like to run the setup wizard?`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    ))
    
    const { runSetup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runSetup',
        message: 'Run setup wizard?',
        default: true
      }
    ])
    
    return runSetup
  }
  
  return false
}