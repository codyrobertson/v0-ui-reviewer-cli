import chalk from 'chalk'
import inquirer from 'inquirer'
import { configManager } from './config.js'
import { MultiModelAIService } from './ai-service.js'

export async function checkAndSetupAPIKeys(): Promise<boolean> {
  const aiService = new MultiModelAIService()
  const availableModels = aiService.getAvailableModels()
  
  // Check if we have at least one API key configured
  if (availableModels.length > 0) {
    return true
  }
  
  console.log(chalk.yellow('\n⚠️  No API keys configured!'))
  console.log(chalk.blue('Let\'s set up your API keys to get started.\n'))
  
  console.log(chalk.gray('You need at least one of these:'))
  console.log(chalk.gray('• V0 API key (from https://v0.dev)'))
  console.log(chalk.gray('• OpenAI API key (from https://platform.openai.com)'))
  console.log(chalk.gray('• Anthropic API key (from https://console.anthropic.com)\n'))
  
  const { setupNow } = await inquirer.prompt([{
    type: 'confirm',
    name: 'setupNow',
    message: 'Would you like to set up API keys now?',
    default: true
  }])
  
  if (!setupNow) {
    console.log(chalk.red('\n❌ Cannot proceed without API keys.'))
    console.log(chalk.gray('Run "v0-review --setup" to configure them later.'))
    return false
  }
  
  // Quick setup for API keys
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'v0ApiKey',
      message: 'V0 API key (press Enter to skip):',
      validate: (input: string) => {
        if (!input) return true // Allow skipping
        return input.startsWith('v0_') || 'V0 API keys should start with "v0_"'
      }
    },
    {
      type: 'input',
      name: 'openaiApiKey',
      message: 'OpenAI API key (press Enter to skip):',
      validate: (input: string) => {
        if (!input) return true // Allow skipping
        return input.startsWith('sk-') || 'OpenAI API keys should start with "sk-"'
      }
    },
    {
      type: 'input',
      name: 'anthropicApiKey',
      message: 'Anthropic API key (press Enter to skip):',
      validate: (input: string) => {
        if (!input) return true // Allow skipping
        return input.startsWith('sk-ant-') || 'Anthropic API keys should start with "sk-ant-"'
      }
    }
  ])
  
  // Save any provided keys
  let keysSet = false
  
  if (answers.v0ApiKey) {
    configManager.set('apiKey', answers.v0ApiKey)
    keysSet = true
  }
  
  if (answers.openaiApiKey) {
    configManager.set('openaiApiKey', answers.openaiApiKey)
    keysSet = true
  }
  
  if (answers.anthropicApiKey) {
    configManager.set('anthropicApiKey', answers.anthropicApiKey)
    keysSet = true
  }
  
  if (!keysSet) {
    console.log(chalk.red('\n❌ No API keys were provided.'))
    console.log(chalk.gray('At least one API key is required to use v0-review.'))
    return false
  }
  
  console.log(chalk.green('\n✅ API keys saved successfully!'))
  
  // Show how to export them as environment variables
  console.log(chalk.blue('\n💡 To use these keys in other terminals, export them:'))
  console.log(chalk.gray('# Add these to your ~/.bashrc, ~/.zshrc, or ~/.profile:\n'))
  
  if (answers.v0ApiKey) {
    console.log(chalk.cyan(`export V0_API_KEY="${answers.v0ApiKey}"`))
  }
  if (answers.openaiApiKey) {
    console.log(chalk.cyan(`export OPENAI_API_KEY="${answers.openaiApiKey}"`))
  }
  if (answers.anthropicApiKey) {
    console.log(chalk.cyan(`export ANTHROPIC_API_KEY="${answers.anthropicApiKey}"`))
  }
  
  console.log('')
  
  return true
}