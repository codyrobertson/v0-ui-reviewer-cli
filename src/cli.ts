#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import ora, { Ora } from 'ora'
import boxen from 'boxen'
import { V0UIReviewerCLI } from './index.js'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { configManager } from './config.js'
import { logger } from './logger.js'
import { checkFirstRun, runInteractiveSetup } from './setup.js'
import { runInteractiveMode } from './interactive.js'
import { runInteractiveV2Mode } from './interactive-v2.js'
import { runSimpleInteractiveMode } from './interactive-v3.js'
import { EnhancedProgressBar, reviewProgressSteps, screenshotProgressSteps } from './progress.js'
import { startDesignChat } from './design-chat.js'
import { AIModel } from './ai-service.js'
import { SandboxLauncher } from './sandbox-launcher.js'
import { StyleExtractor, ExtractedStyle } from './style-extractor.js'
import { getTempManager, cleanupTempManager } from './temp-manager.js'
import { checkAndSetupAPIKeys } from './api-key-setup.js'

// Load environment variables
dotenv.config()

interface CLIOptions {
  url?: string
  screenshot?: string
  context?: string
  prompt?: string
  mobile?: boolean
  fullPage?: boolean
  output?: string
  showImage?: boolean
  verbose?: boolean
  apiKey?: string
  batch?: string
  setup?: boolean
  interactive?: boolean
  chat?: boolean
  model?: string
  extractStyles?: boolean
  styleOutput?: string
  styleFormat?: string
}

const program = new Command()

program
  .name('v0-review')
  .description('AI-powered UI/UX expert reviewer using v0 API with terminal image display')
  .version('3.2.0')
  .argument('[url]', 'URL to review (optional)')
  .hook('preAction', async (thisCommand, actionCommand) => {
    // Check for first run before any action except setup
    if (!actionCommand.opts().setup && !actionCommand.parent?.args[0]?.startsWith('sandbox') && await checkFirstRun()) {
      await runInteractiveSetup()
      process.exit(0)
    }
  })

program
  .option('-u, --url <url>', 'URL to review')
  .option('-s, --screenshot <path>', 'Path to existing screenshot to review')
  .option('-c, --context <text>', 'Additional context for the review')
  .option('-p, --prompt <text>', 'Custom prompt (overrides default expert prompt)')
  .option('-m, --mobile', 'Capture mobile screenshot (375x667)', false)
  .option('--no-full-page', 'Capture viewport only (not full page)')
  .option('-o, --output <path>', 'Output path for analysis markdown file')
  .option('--no-show-image', 'Skip displaying image in terminal')
  .option('-v, --verbose', 'Verbose output', false)
  .option('--api-key <key>', 'v0 API key (or set V0_API_KEY env var)')
  .option('-b, --batch <file>', 'Batch review URLs from file (one per line)')
  .option('--setup', 'Run interactive setup')
  .option('-i, --interactive', 'Interactive mode for continuous reviews')
  .option('--chat', 'Start interactive design chat after review')
  .option('--model <model>', 'AI model to use: v0, gpt-4, gpt-4-turbo, gpt-3.5-turbo, claude-3-opus, claude-3-sonnet, claude-3-haiku')
  .option('--extract-styles', 'Extract design tokens during review')
  .option('--style-output <path>', 'Output path for extracted styles')
  .option('--style-format <format>', 'Style output format: json, css, tailwind (default: json)')

// Add sandbox subcommand
program
  .command('sandbox')
  .description('Launch the design sandbox for live preview')
  .action(async () => {
    const launcher = new SandboxLauncher();
    await launcher.launch();
  });

// Add extract subcommand
program
  .command('extract <url>')
  .description('Extract design tokens from a website')
  .option('-o, --output <path>', 'Output path for design tokens')
  .option('-f, --format <format>', 'Output format: json, css, tailwind (default: json)')
  .option('-p, --points <points>', 'Specific x,y coordinates to extract (e.g. "100,200;300,400")')
  .option('-g, --grid <size>', 'Extract from grid pattern (default: 10)')
  .option('-m, --mobile', 'Use mobile viewport', false)
  .option('--full-page', 'Capture full page', true)
  .action(async (url: string, options: { 
    output?: string, 
    format?: string,
    points?: string,
    grid?: string,
    mobile?: boolean,
    fullPage?: boolean 
  }) => {
    const spinner = ora('Initializing style extractor...').start();
    
    try {
      // Launch Puppeteer
      const puppeteer = (await import('puppeteer')).default;
      spinner.text = 'Launching browser...';
      
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({
        width: options.mobile ? 375 : 1920,
        height: options.mobile ? 667 : 1080,
        deviceScaleFactor: options.mobile ? 2 : 1,
        isMobile: options.mobile || false,
        hasTouch: options.mobile || false
      });
      
      spinner.text = `Navigating to ${chalk.cyan(url)}...`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Initialize style extractor
      const extractor = new StyleExtractor(page);
      
      spinner.text = 'Extracting styles...';
      
      let extractedStyles: ExtractedStyle[] = [];
      
      if (options.points) {
        // Extract from specific points
        const points = options.points.split(';').map(p => {
          const [x, y] = p.split(',').map(Number);
          return { x, y };
        });
        extractedStyles = await extractor.extractStylesFromPoints(points);
      } else {
        // Extract from grid
        const gridSize = parseInt(options.grid || '10', 10);
        extractedStyles = await extractor.extractStylesFromGrid(gridSize);
      }
      
      // Create design tokens
      const tokens = extractor.createDesignTokens(extractedStyles);
      
      // Determine output format and path
      const format = options.format || 'json';
      const defaultExt = format === 'css' ? '.css' : format === 'tailwind' ? '.js' : '.json';
      const outputPath = options.output || `design-tokens${defaultExt}`;
      
      // Generate output based on format
      let output: string;
      switch (format) {
        case 'css':
          output = extractor.exportAsCSSVariables(tokens);
          break;
        case 'tailwind':
          output = extractor.exportAsTailwindConfig(tokens);
          break;
        default:
          output = extractor.exportAsJSON(extractedStyles, tokens);
      }
      
      // Save output
      await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
      await fs.writeFile(outputPath, output, 'utf-8');
      
      await browser.close();
      
      spinner.succeed('Design tokens extracted successfully');
      console.log(chalk.green(`✓ Tokens saved to: ${outputPath}`));
      
      // Show preview
      console.log(chalk.yellow('\n📋 Token Summary:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.cyan('Colors:'));
      console.log(`  • Backgrounds: ${tokens.colors.background.size}`);
      console.log(`  • Text: ${tokens.colors.text.size}`);
      console.log(`  • Borders: ${tokens.colors.border.size}`);
      console.log(chalk.cyan('Typography:'));
      console.log(`  • Font families: ${tokens.typography.fontFamilies.size}`);
      console.log(`  • Font sizes: ${tokens.typography.fontSizes.size}`);
      console.log(chalk.cyan('Spacing:'));
      console.log(`  • Padding values: ${tokens.spacing.padding.size}`);
      console.log(`  • Margin values: ${tokens.spacing.margin.size}`);
      console.log(chalk.gray('─'.repeat(60)));
      
      if (format === 'json') {
        console.log(chalk.blue('💡 Tip: Use --format css or --format tailwind for ready-to-use configs'));
      }
      
    } catch (error) {
      spinner.fail('Failed to extract design tokens');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.action(async (url: string | undefined, options: CLIOptions) => {
  try {
    // Handle setup command
    if (options.setup) {
      await runInteractiveSetup()
      return
    }

    // Check for API keys first
    const hasAPIKeys = await checkAndSetupAPIKeys()
    if (!hasAPIKeys) {
      process.exit(1)
    }

    // Initialize temp manager
    const tempManager = getTempManager()
    await tempManager.init()
    
    // Set up logging
    if (options.verbose) {
      logger.level = 'debug'
      tempManager.displayInfo(true)
    }

    // If URL is provided as argument, do auto-review
    if (url && !options.interactive) {
      // Ensure URL has protocol
      options.url = url.startsWith('http') ? url : `https://${url}`
      const spinner = ora('Initializing v0 UI/UX reviewer...').start()
      spinner.succeed('v0 UI/UX reviewer initialized')
      await handleURLReview(new V0UIReviewerCLI(configManager.getApiKey(), {
        timeout: configManager.get('timeout'),
        verbose: options.verbose
      }), options, spinner)
      
      // After review, enter interactive mode
      await runSimpleInteractiveMode({ 
        verbose: options.verbose, 
        initialUrl: options.url,
        initialModel: options.model as AIModel
      })
      return
    }

    // Handle interactive mode
    if (options.interactive) {
      await runSimpleInteractiveMode({ verbose: options.verbose, initialUrl: url })
      return
    }

    const spinner = ora('Initializing v0 UI/UX reviewer...').start()
    
    // If no inputs provided, enter interactive mode
    if (!options.url && !options.screenshot && !options.batch) {
      spinner.stop()
      await runSimpleInteractiveMode({ verbose: options.verbose, initialUrl: url })
      return
    }

    if (options.url && options.screenshot) {
      spinner.fail('Error: Cannot use both --url and --screenshot options')
      process.exit(1)
    }

    // Validate model if specified
    const validModels = ['v0', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o3-mini', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-sonnet-4']
    if (options.model && !validModels.includes(options.model)) {
      spinner.fail(`Invalid model: ${options.model}`)
      console.log(chalk.yellow('\nValid models:'))
      console.log(validModels.map(m => `  • ${m}`).join('\n'))
      process.exit(1)
    }

    // Get API key from options, config, or environment
    const apiKey = options.apiKey || configManager.getApiKey()
    if (!apiKey && (!options.model || options.model === 'v0')) {
      spinner.fail('No API key found')
      logger.error('Please set V0_API_KEY environment variable or run: v0-review --setup')
      process.exit(1)
    }

    // Initialize reviewer with timeout from config and verbose flag
    const reviewer = new V0UIReviewerCLI(apiKey, {
      timeout: configManager.get('timeout'),
      verbose: options.verbose
    })
    spinner.succeed('v0 UI/UX reviewer initialized')

    if (options.batch) {
      await handleBatchReview(reviewer, options, spinner)
    } else if (options.url) {
      await handleURLReview(reviewer, options, spinner)
    } else if (options.screenshot) {
      await handleScreenshotReview(reviewer, options, spinner)
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('Navigation timeout')) {
      logger.error('The website took too long to load (exceeded 60 seconds)')
      console.log(chalk.yellow('\n💡 Tips for slow-loading sites:'))
      console.log(chalk.gray('  • Try running the command again - temporary network issues may resolve'))
      console.log(chalk.gray('  • Some sites have aggressive bot protection that slows loading'))
      console.log(chalk.gray('  • Consider using --no-full-page to capture just the viewport'))
      console.log(chalk.gray('  • If the site requires authentication, capture a screenshot manually and use --screenshot'))
    } else {
      logger.error('Fatal error:', error instanceof Error ? error.message : String(error))
    }
    
    if (options.verbose && error instanceof Error) {
      logger.debug(error.stack || '')
    }
    process.exit(1)
  }
})

async function handleURLReview(reviewer: V0UIReviewerCLI, options: CLIOptions, spinner: Ora) {
  const startTime = Date.now()
  const tempManager = getTempManager()
  
  // Check if this might be a slow-loading site
  const url = options.url!
  const knownSlowSites = ['tacolabs.ai', 'vercel.app', 'netlify.app', 'cloudflare']
  const mightBeSlowSite = knownSlowSites.some(site => url.includes(site))
  
  console.log(boxen(
    `🎨 ${chalk.bold('V0 UI/UX Expert Review')}\n\n` +
    `📱 Device: ${options.mobile ? 'Mobile (375x667)' : 'Desktop (1920x1080)'}\n` +
    `🌐 URL: ${chalk.cyan(url)}\n` +
    `📸 Mode: ${options.fullPage !== false ? 'Full Page' : 'Viewport Only'}` +
    (mightBeSlowSite ? `\n⏱️  ${chalk.yellow('Note: This site may take longer to load')}` : ''),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ))

  spinner.stop() // Stop the initial spinner
  const progress = new EnhancedProgressBar(reviewProgressSteps)
  progress.start()

  try {
    // Handle style extraction if requested
    let styleTokensPath: string | undefined
    
    if (options.extractStyles) {
      progress.addStep('Style Extraction', 0)
    }
    
    const analysis = await reviewer.reviewURL(options.url!, {
      context: options.context,
      customPrompt: options.prompt,
      mobile: options.mobile,
      fullPage: options.fullPage !== false,
      showImage: options.showImage !== false,
      verbose: options.verbose,
      model: options.model as AIModel,
      deepDive: options.verbose,
      extractStyles: true, // Always extract styles for seamless experience
      styleOutputPath: options.styleOutput,
      styleFormat: options.styleFormat as 'json' | 'css' | 'tailwind' | undefined,
      onProgress: (step: string, percent: number, message?: string) => {
        progress.updateStep(step, percent, message)
        if (percent === 100) {
          progress.completeStep(step)
        }
      }
    })

    progress.stop()

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  
  // Save analysis if output path specified
  if (options.output) {
    await reviewer.saveAnalysis(analysis, options.output)
    console.log(chalk.green(`✅ Analysis saved to: ${options.output}`))
  }
  
  // Save style tokens if extracted
  if (options.extractStyles && analysis.designTokens) {
    const format = options.styleFormat || 'json'
    const ext = format === 'css' ? '.css' : format === 'tailwind' ? '.js' : '.json'
    styleTokensPath = options.styleOutput || `design-tokens-${new Date().toISOString().slice(0,10)}${ext}`
    
    await fs.writeFile(styleTokensPath, analysis.designTokens, 'utf-8')
    console.log(chalk.green(`🎨 Design tokens saved to: ${styleTokensPath}`))
  }

  // Display summary
  console.log(boxen(
    `✨ ${chalk.bold.green('Review Complete!')}\n\n` +
    `⏱️  Duration: ${duration}s\n` +
    `📷 Screenshot: ${path.basename(analysis.screenshot!)}\n` +
    `${options.output ? `📄 Report: ${path.basename(options.output)}` : ''}` +
    `${styleTokensPath ? `\n🎨 Styles: ${path.basename(styleTokensPath)}` : ''}`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green'
    }
  ))

  // Display quick preview of analysis
  if (!options.output) {
    console.log(chalk.yellow('\n📋 Quick Preview:'))
    console.log(chalk.gray('─'.repeat(60)))
    console.log(analysis.componentBreakdown.substring(0, 200) + '...')
    console.log(chalk.gray('─'.repeat(60)))
    console.log(chalk.blue('💡 Tip: Use --output to save the full analysis as markdown'))
  }
  
  // Display style extraction tip
  if (!options.extractStyles) {
    console.log(chalk.blue('💡 Tip: Use --extract-styles to extract design tokens'))
  }
  } catch (error) {
    progress.error('API Analysis', error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

async function handleScreenshotReview(reviewer: V0UIReviewerCLI, options: CLIOptions, spinner: Ora) {
  const startTime = Date.now()
  
  console.log(boxen(
    `🎨 ${chalk.bold('V0 UI/UX Expert Review')}\n\n` +
    `📷 Screenshot: ${chalk.cyan(options.screenshot!)}\n` +
    `🤖 Model: ${chalk.green(options.model || 'v0')}`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ))

  spinner.stop() // Stop the initial spinner
  const progress = new EnhancedProgressBar(screenshotProgressSteps)
  progress.start()

  try {
    const analysis = await reviewer.reviewScreenshot(options.screenshot!, {
      context: options.context,
      customPrompt: options.prompt,
      showImage: options.showImage !== false,
      verbose: options.verbose,
      model: options.model as AIModel,
      deepDive: options.verbose,
      onProgress: (step: string, percent: number, message?: string) => {
        progress.updateStep(step, percent, message)
        if (percent === 100) {
          progress.completeStep(step)
        }
      }
    })

    progress.stop()

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  
  // Save analysis if output path specified
  if (options.output) {
    await reviewer.saveAnalysis(analysis, options.output)
    console.log(chalk.green(`✅ Analysis saved to: ${options.output}`))
  }

  // Display summary
  console.log(boxen(
    `✨ ${chalk.bold.green('Review Complete!')}\n\n` +
    `⏱️  Duration: ${duration}s\n` +
    `📷 Screenshot: ${path.basename(analysis.screenshot!)}\n` +
    `${options.output ? `📄 Report: ${path.basename(options.output)}` : ''}`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green'
    }
  ))

  // Start design chat if requested
  if (options.chat && analysis.screenshot) {
    console.log(chalk.cyan('\n🎨 Starting interactive design chat...\n'))
    await startDesignChat(analysis.screenshot, {
      initialAnalysis: analysis.componentBreakdown + '\n\n' + analysis.heuristicAudit,
      model: options.model as AIModel,
      verbose: options.verbose
    })
  }
  } catch (error) {
    progress.error('API Analysis', error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

async function handleBatchReview(reviewer: V0UIReviewerCLI, options: CLIOptions, spinner: Ora) {
  try {
    const urlsFile = await fs.readFile(options.batch!, 'utf-8')
    const urls = urlsFile.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))

    if (urls.length === 0) {
      throw new Error(`No valid URLs found in ${options.batch}`)
    }

    console.log(boxen(
      `🎨 ${chalk.bold('V0 UI/UX Batch Review')}\n\n` +
      `📁 URLs File: ${chalk.cyan(options.batch!)}\n` +
      `📊 Total URLs: ${urls.length}\n` +
      `📱 Device: ${options.mobile ? 'Mobile' : 'Desktop'}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ))

    const startTime = Date.now()
    let completed = 0
    let failed = 0

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      const urlSpinner = ora(`[${i + 1}/${urls.length}] Reviewing: ${url}`).start()

      try {
        const outputPath = options.output 
          ? options.output.replace(/\.md$/, `-${i + 1}.md`)
          : `batch-review-${i + 1}-${Date.now()}.md`

        const analysis = await reviewer.reviewURL(url, {
          context: options.context,
          customPrompt: options.prompt,
          mobile: options.mobile,
          fullPage: options.fullPage !== false,
          outputPath,
          showImage: false, // Skip image display in batch mode
          verbose: false
        })

        await reviewer.saveAnalysis(analysis, outputPath)
        urlSpinner.succeed(`[${i + 1}/${urls.length}] ✅ ${url} → ${path.basename(outputPath)}`)
        completed++

        // Rate limiting - wait 3 seconds between requests
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000))
        }

      } catch (error) {
        urlSpinner.fail(`[${i + 1}/${urls.length}] ❌ ${url} - ${error instanceof Error ? error.message : String(error)}`)
        failed++
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(boxen(
      `✨ ${chalk.bold.green('Batch Review Complete!')}\n\n` +
      `⏱️  Total Duration: ${duration}s\n` +
      `✅ Completed: ${completed}/${urls.length}\n` +
      `❌ Failed: ${failed}/${urls.length}\n` +
      `📁 Reports saved to current directory`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    ))

  } catch (error) {
    throw new Error(`Failed to read batch file: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Add help examples
program.on('--help', () => {
  console.log('')
  console.log('Examples:')
  console.log('  $ v0-review --url https://example.com')
  console.log('  $ v0-review --url https://example.com --mobile --output analysis.md')
  console.log('  $ v0-review --screenshot ./ui-screenshot.png --context "E-commerce checkout"')
  console.log('  $ v0-review --batch ./urls.txt --mobile')
  console.log('  $ v0-review --interactive    # Start interactive mode')
  console.log('  $ v0-review --setup          # Run setup wizard')
  console.log('  $ v0-review --url https://example.com --chat  # Review and start design chat')
  console.log('  $ v0-review --screenshot ./design.png --chat --model gpt-4')
  console.log('')
  console.log('Style Extraction:')
  console.log('  $ v0-review --url https://example.com --extract-styles')
  console.log('  $ v0-review --url https://example.com --extract-styles --style-format css')
  console.log('  $ v0-review --url https://example.com --extract-styles --style-output tokens.css --style-format css')
  console.log('')
  console.log('Design System Tools:')
  console.log('  $ v0-review extract https://example.com  # Extract design tokens from website')
  console.log('  $ v0-review extract https://example.com -o tokens.json')
  console.log('  $ v0-review extract https://example.com -f css -o styles.css')
  console.log('  $ v0-review extract https://example.com -f tailwind -o tailwind.config.js')
  console.log('  $ v0-review extract https://example.com -p "100,200;300,400"  # Extract from specific points')
  console.log('  $ v0-review extract https://example.com -g 20  # Extract from 20x20 grid')
  console.log('  $ v0-review sandbox                      # Launch live preview sandbox')
  console.log('')
  console.log('Environment Variables:')
  console.log('  V0_API_KEY    Your v0.dev API key (get one at https://v0.dev)')
  console.log('')
  console.log('Configuration:')
  console.log('  First run will prompt for setup, or use --setup')
  console.log('  Config saved in ~/.config/configstore/v0-ui-reviewer.json')
  console.log('')
  console.log('Batch File Format:')
  console.log('  # Comments start with #')
  console.log('  https://example.com')
  console.log('  https://another-site.com')
  console.log('')
})

// Handle process cleanup
process.on('SIGINT', async () => {
  console.log('\n\n👋 Exiting v0-ui-reviewer...')
  await cleanupTempManager()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await cleanupTempManager()
  process.exit(0)
})

process.on('exit', async () => {
  await cleanupTempManager()
})

// Parse command line arguments
program.parse()