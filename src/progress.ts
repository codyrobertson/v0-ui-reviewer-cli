import cliProgress from 'cli-progress'
import chalk from 'chalk'

export interface ProgressStep {
  name: string
  weight: number
}

export class EnhancedProgressBar {
  private multibar: cliProgress.MultiBar
  private bars: Map<string, cliProgress.SingleBar> = new Map()
  private mainBar: cliProgress.SingleBar | null = null
  private steps: ProgressStep[]
  private currentStepIndex: number = 0
  private totalWeight: number = 0

  constructor(steps: ProgressStep[]) {
    this.steps = [...steps] // Make a copy to allow modifications
    this.totalWeight = steps.reduce((sum, step) => sum + step.weight, 0)
    
    this.multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: ' {task} │{bar}│ {percentage}% │ {message}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      stopOnComplete: true
    }, cliProgress.Presets.shades_grey)
  }

  start(): void {
    // Create main progress bar
    this.mainBar = this.multibar.create(100, 0, {
      task: chalk.cyan('Overall Progress'),
      message: 'Starting...'
    })
  }

  startStep(stepName: string, message: string = ''): cliProgress.SingleBar {
    const bar = this.multibar.create(100, 0, {
      task: chalk.yellow(stepName.padEnd(20)),
      message
    })
    this.bars.set(stepName, bar)
    return bar
  }

  updateStep(stepName: string, progress: number, message?: string): void {
    const bar = this.bars.get(stepName)
    if (bar) {
      bar.update(progress, message ? { message } : undefined)
    }
  }

  completeStep(stepName: string, message: string = 'Complete'): void {
    const bar = this.bars.get(stepName)
    if (bar) {
      bar.update(100, { message: chalk.green(message) })
      bar.stop()
    }
    
    // Update main progress
    if (this.mainBar && this.currentStepIndex < this.steps.length) {
      const completedWeight = this.steps
        .slice(0, this.currentStepIndex + 1)
        .reduce((sum, step) => sum + step.weight, 0)
      const progress = Math.round((completedWeight / this.totalWeight) * 100)
      this.mainBar.update(progress, {
        message: `Step ${this.currentStepIndex + 1}/${this.steps.length} complete`
      })
      this.currentStepIndex++
    }
  }

  addStep(stepName: string, weight: number = 10): void {
    this.steps.push({ name: stepName, weight })
    this.totalWeight += weight
    // Start the step immediately
    this.startStep(stepName)
  }

  stop(): void {
    if (this.mainBar) {
      this.mainBar.update(100, { message: chalk.green('All tasks complete!') })
    }
    this.multibar.stop()
  }

  error(stepName: string, error: string): void {
    const bar = this.bars.get(stepName)
    if (bar) {
      bar.update(0, { message: chalk.red(`Error: ${error}`) })
      bar.stop()
    }
    this.multibar.stop()
  }
}

// Progress bars for different operations
export const reviewProgressSteps: ProgressStep[] = [
  { name: 'Browser Launch', weight: 10 },
  { name: 'Page Load', weight: 25 },
  { name: 'Screenshot Capture', weight: 15 },
  { name: 'Image Processing', weight: 10 },
  { name: 'API Analysis', weight: 35 },
  { name: 'Report Generation', weight: 5 }
]

export const screenshotProgressSteps: ProgressStep[] = [
  { name: 'Image Validation', weight: 10 },
  { name: 'Image Processing', weight: 20 },
  { name: 'API Analysis', weight: 60 },
  { name: 'Report Generation', weight: 10 }
]