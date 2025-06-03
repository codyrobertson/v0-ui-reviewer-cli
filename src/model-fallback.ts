import { AIModel } from './ai-service.js'
import chalk from 'chalk'

export class ModelFallback {
  private static readonly fallbackOrder: AIModel[] = [
    'v0',
    'gpt-4-turbo',
    'claude-sonnet-4',
    'gpt-4',
    'claude-3-sonnet',
    'o3-mini',
    'claude-3-haiku'
  ]
  
  static getNextModel(currentModel: AIModel, availableModels: AIModel[]): AIModel | null {
    // Find current model index
    const currentIndex = this.fallbackOrder.indexOf(currentModel)
    
    // Try models after the current one in the fallback order
    for (let i = currentIndex + 1; i < this.fallbackOrder.length; i++) {
      const nextModel = this.fallbackOrder[i]
      if (availableModels.includes(nextModel)) {
        return nextModel
      }
    }
    
    // If no models found after current, try from beginning (excluding current)
    for (let i = 0; i < currentIndex; i++) {
      const nextModel = this.fallbackOrder[i]
      if (availableModels.includes(nextModel)) {
        return nextModel
      }
    }
    
    return null
  }
  
  static suggestFallback(error: Error, currentModel: AIModel, availableModels: AIModel[]): void {
    const nextModel = this.getNextModel(currentModel, availableModels)
    
    if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      console.log(chalk.yellow('\n💡 The API server seems to be having issues.'))
    } else if (error.message.includes('Rate limit')) {
      console.log(chalk.yellow('\n💡 Rate limit reached for this model.'))
    } else if (error.message.includes('401') || error.message.includes('403')) {
      console.log(chalk.yellow('\n💡 Authentication issue with this model.'))
    }
    
    if (nextModel) {
      console.log(chalk.blue(`💡 Try using a different model: /model ${nextModel}`))
    } else if (availableModels.length === 0) {
      console.log(chalk.red('❌ No API keys configured. Run: v0-review --setup'))
    } else {
      console.log(chalk.gray('💡 All available models have been exhausted.'))
    }
  }
}