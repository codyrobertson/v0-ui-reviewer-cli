import inquirer from 'inquirer'
import chalk from 'chalk'
import boxen from 'boxen'
import ora from 'ora'
import { V0UIReviewerCLI } from './index.js'
import { logger } from './logger.js'
import { configManager } from './config.js'
import path from 'path'

export interface InteractiveSession {
  reviewer: V0UIReviewerCLI
  history: Array<{
    type: 'url' | 'screenshot'
    input: string
    output?: string
    timestamp: Date
  }>
}

export async function runInteractiveMode(): Promise<void> {
  console.clear()
  
  console.log(boxen(
    `🎨 ${chalk.bold('V0 UI/UX Reviewer - Interactive Mode')}\n\n` +
    `Review multiple URLs or screenshots in one session.\n` +
    `Type ${chalk.cyan('help')} for commands or ${chalk.cyan('exit')} to quit.`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ))

  const apiKey = configManager.getApiKey()
  if (!apiKey) {
    logger.error('No API key found. Run setup first: v0-review --setup')
    process.exit(1)
  }

  const reviewer = new V0UIReviewerCLI(apiKey)
  const session: InteractiveSession = {
    reviewer,
    history: []
  }

  let running = true
  while (running) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🌐 Review a URL', value: 'url' },
          { name: '📷 Review a screenshot', value: 'screenshot' },
          { name: '📋 View session history', value: 'history' },
          { name: '⚙️  Change settings', value: 'settings' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ])

    switch (action) {
      case 'url':
        await reviewURLInteractive(session)
        break
      case 'screenshot':
        await reviewScreenshotInteractive(session)
        break
      case 'history':
        displayHistory(session)
        break
      case 'settings':
        await changeSettingsInteractive()
        break
      case 'exit':
        running = false
        break
    }
  }

  console.log(chalk.green('\n👋 Thanks for using V0 UI/UX Reviewer!'))
}

async function reviewURLInteractive(session: InteractiveSession): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter URL to review:',
      validate: (input) => {
        try {
          new URL(input)
          return true
        } catch {
          return 'Please enter a valid URL'
        }
      }
    },
    {
      type: 'list',
      name: 'device',
      message: 'Device type:',
      choices: [
        { name: 'Desktop (1920x1080)', value: 'desktop' },
        { name: 'Mobile (375x667)', value: 'mobile' }
      ],
      default: configManager.get('defaultDevice') || 'desktop'
    },
    {
      type: 'confirm',
      name: 'fullPage',
      message: 'Capture full page?',
      default: configManager.get('defaultFullPage') !== false
    },
    {
      type: 'confirm',
      name: 'showImage',
      message: 'Display screenshot in terminal?',
      default: configManager.get('defaultShowImage') !== false
    },
    {
      type: 'input',
      name: 'context',
      message: 'Additional context (optional):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'saveReport',
      message: 'Save analysis report?',
      default: true
    }
  ])

  const spinner = ora('Starting review...').start()
  
  try {
    const startTime = Date.now()
    
    let outputPath: string | undefined
    if (answers.saveReport) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const domain = new URL(answers.url).hostname.replace(/\./g, '-')
      outputPath = path.join(
        configManager.get('outputDirectory') || process.cwd(),
        `v0-review-${domain}-${timestamp}.md`
      )
    }

    spinner.text = 'Reviewing URL...'
    const analysis = await session.reviewer.reviewURL(answers.url, {
      context: answers.context || undefined,
      mobile: answers.device === 'mobile',
      fullPage: answers.fullPage,
      showImage: answers.showImage,
      outputPath
    })

    spinner.succeed(`Review completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)

    if (outputPath) {
      await session.reviewer.saveAnalysis(analysis, outputPath)
      console.log(chalk.green(`\n📄 Report saved: ${outputPath}`))
    }

    // Add to history
    session.history.push({
      type: 'url',
      input: answers.url,
      output: outputPath,
      timestamp: new Date()
    })

    // Show preview
    console.log(chalk.yellow('\n📋 Analysis Preview:'))
    console.log(chalk.gray('─'.repeat(60)))
    console.log(analysis.componentBreakdown.substring(0, 300) + '...')
    console.log(chalk.gray('─'.repeat(60)))

    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ])

  } catch (error) {
    spinner.fail('Review failed')
    logger.error(error instanceof Error ? error.message : String(error))
  }
}

async function reviewScreenshotInteractive(session: InteractiveSession): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'screenshot',
      message: 'Enter path to screenshot:',
      validate: async (input) => {
        const fs = await import('fs')
        try {
          if (!input) return 'Please enter a file path'
          await fs.promises.access(input)
          return true
        } catch {
          return 'File not found'
        }
      }
    },
    {
      type: 'confirm',
      name: 'showImage',
      message: 'Display screenshot in terminal?',
      default: configManager.get('defaultShowImage') !== false
    },
    {
      type: 'input',
      name: 'context',
      message: 'Additional context (optional):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'saveReport',
      message: 'Save analysis report?',
      default: true
    }
  ])

  const spinner = ora('Starting review...').start()
  
  try {
    const startTime = Date.now()
    
    let outputPath: string | undefined
    if (answers.saveReport) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = path.basename(answers.screenshot, path.extname(answers.screenshot))
      outputPath = path.join(
        configManager.get('outputDirectory') || process.cwd(),
        `v0-review-${filename}-${timestamp}.md`
      )
    }

    spinner.text = 'Analyzing screenshot...'
    const analysis = await session.reviewer.reviewScreenshot(answers.screenshot, {
      context: answers.context || undefined,
      showImage: answers.showImage
    })

    spinner.succeed(`Review completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)

    if (outputPath) {
      await session.reviewer.saveAnalysis(analysis, outputPath)
      console.log(chalk.green(`\n📄 Report saved: ${outputPath}`))
    }

    // Add to history
    session.history.push({
      type: 'screenshot',
      input: answers.screenshot,
      output: outputPath,
      timestamp: new Date()
    })

    // Show preview
    console.log(chalk.yellow('\n📋 Analysis Preview:'))
    console.log(chalk.gray('─'.repeat(60)))
    console.log(analysis.componentBreakdown.substring(0, 300) + '...')
    console.log(chalk.gray('─'.repeat(60)))

    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ])

  } catch (error) {
    spinner.fail('Review failed')
    logger.error(error instanceof Error ? error.message : String(error))
  }
}

function displayHistory(session: InteractiveSession): void {
  console.clear()
  console.log(boxen(
    `📋 ${chalk.bold('Session History')}\n\n` +
    `Total reviews: ${session.history.length}`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'blue'
    }
  ))

  if (session.history.length === 0) {
    console.log(chalk.gray('No reviews yet in this session.'))
  } else {
    session.history.forEach((item, index) => {
      console.log(`\n${chalk.bold(`${index + 1}. ${item.type === 'url' ? '🌐' : '📷'} ${item.type.toUpperCase()}`)}`)
      console.log(`   Input: ${chalk.cyan(item.input)}`)
      if (item.output) {
        console.log(`   Report: ${chalk.green(item.output)}`)
      }
      console.log(`   Time: ${chalk.gray(item.timestamp.toLocaleString())}`)
    })
  }

  console.log('')
}

async function changeSettingsInteractive(): Promise<void> {
  const currentConfig = configManager.getAll()
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'setting',
      message: 'Which setting would you like to change?',
      choices: [
        { name: `Timeout: ${currentConfig.timeout}ms`, value: 'timeout' },
        { name: `Default Device: ${currentConfig.defaultDevice}`, value: 'defaultDevice' },
        { name: `Full Page: ${currentConfig.defaultFullPage}`, value: 'defaultFullPage' },
        { name: `Show Images: ${currentConfig.defaultShowImage}`, value: 'defaultShowImage' },
        { name: `Log Level: ${currentConfig.logLevel}`, value: 'logLevel' },
        { name: `Output Directory: ${currentConfig.outputDirectory}`, value: 'outputDirectory' },
        { name: '← Back', value: 'back' }
      ]
    }
  ])

  if (answers.setting === 'back') return

  switch (answers.setting) {
    case 'timeout':
      const { timeout } = await inquirer.prompt([{
        type: 'number',
        name: 'timeout',
        message: 'New timeout value (ms):',
        default: currentConfig.timeout,
        validate: (input) => (input && input > 0 && input <= 300000) || 'Must be between 1 and 300000'
      }])
      configManager.set('timeout', timeout)
      break

    case 'defaultDevice':
      const { device } = await inquirer.prompt([{
        type: 'list',
        name: 'device',
        message: 'Default device:',
        choices: ['desktop', 'mobile'],
        default: currentConfig.defaultDevice
      }])
      configManager.set('defaultDevice', device)
      break

    case 'defaultFullPage':
      const { fullPage } = await inquirer.prompt([{
        type: 'confirm',
        name: 'fullPage',
        message: 'Capture full page by default?',
        default: currentConfig.defaultFullPage
      }])
      configManager.set('defaultFullPage', fullPage)
      break

    case 'defaultShowImage':
      const { showImage } = await inquirer.prompt([{
        type: 'confirm',
        name: 'showImage',
        message: 'Show images in terminal by default?',
        default: currentConfig.defaultShowImage
      }])
      configManager.set('defaultShowImage', showImage)
      break

    case 'logLevel':
      const { logLevel } = await inquirer.prompt([{
        type: 'list',
        name: 'logLevel',
        message: 'Log level:',
        choices: ['error', 'warn', 'info', 'debug'],
        default: currentConfig.logLevel
      }])
      configManager.set('logLevel', logLevel)
      break

    case 'outputDirectory':
      const { outputDirectory } = await inquirer.prompt([{
        type: 'input',
        name: 'outputDirectory',
        message: 'Output directory:',
        default: currentConfig.outputDirectory
      }])
      configManager.set('outputDirectory', outputDirectory)
      break
  }

  console.log(chalk.green('✅ Setting updated successfully!'))
}