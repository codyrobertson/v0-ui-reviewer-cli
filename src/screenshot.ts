import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from './logger.js'
import chalk from 'chalk'
import type { Page, PuppeteerLifeCycleEvent } from 'puppeteer'

// Configure puppeteer-extra with stealth plugin
puppeteer.use(StealthPlugin())

export interface ScreenshotOptions {
  fullPage?: boolean
  viewportWidth?: number
  viewportHeight?: number
  outputPath?: string
  mobile?: boolean
  timeout?: number
  verbose?: boolean
  retries?: number
  onProgress?: (step: string, percent: number, message?: string) => void
  extractStyles?: boolean
  stylePoints?: Array<{x: number, y: number}>
}

export interface RetryStrategy {
  name: string
  waitTime: number
  browserArgs?: string[]
  waitUntil?: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[]
}

const DEFAULT_RETRY_STRATEGIES: RetryStrategy[] = [
  {
    name: 'Standard',
    waitTime: 2000,
    waitUntil: 'networkidle0'
  },
  {
    name: 'Quick DOM',
    waitTime: 5000,
    waitUntil: 'domcontentloaded'
  },
  {
    name: 'Extended Wait',
    waitTime: 10000,
    waitUntil: ['domcontentloaded', 'networkidle2']
  },
  {
    name: 'Minimal',
    waitTime: 3000,
    waitUntil: 'load',
    browserArgs: ['--disable-images', '--disable-javascript']
  }
]

export class EnhancedScreenshotCapture {
  private verbose: boolean

  constructor(verbose: boolean = false) {
    this.verbose = verbose
  }

  private log(message: string, level: 'info' | 'debug' | 'warn' | 'error' = 'info') {
    if (this.verbose || level === 'error' || level === 'warn') {
      logger[level](message)
    }
  }

  async captureWithRetry(url: string, options: ScreenshotOptions = {}): Promise<string> {
    const {
      retries = 3,
      onProgress
    } = options

    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      const strategy = DEFAULT_RETRY_STRATEGIES[Math.min(attempt, DEFAULT_RETRY_STRATEGIES.length - 1)]
      
      try {
        console.log(chalk.gray(`🔄 Attempt ${attempt + 1}/${retries + 1} using ${strategy.name} strategy`))
        onProgress?.('Screenshot Capture', (attempt / (retries + 1)) * 30, `Trying ${strategy.name} strategy...`)
        
        const result = await this.captureScreenshot(url, {
          ...options,
          strategy
        })
        
        onProgress?.('Screenshot Capture', 100, 'Screenshot captured successfully')
        return result
      } catch (error) {
        lastError = error as Error
        console.log(chalk.red(`❌ Attempt ${attempt + 1} failed: ${lastError.message}`))
        
        if (attempt < retries) {
          const waitTime = (attempt + 1) * 2000 // Progressive backoff
          console.log(chalk.gray(`⏳ Waiting ${waitTime}ms before retry...`))
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    throw new Error(`Failed to capture screenshot after ${retries + 1} attempts. Last error: ${lastError?.message}`)
  }

  private async captureScreenshot(url: string, options: ScreenshotOptions & { strategy?: RetryStrategy } = {}): Promise<string> {
    const {
      fullPage = true,
      viewportWidth = 1920,
      viewportHeight = 1080,
      outputPath,
      mobile = false,
      timeout = 60000,
      onProgress,
      strategy = DEFAULT_RETRY_STRATEGIES[0]
    } = options

    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      ...(strategy.browserArgs || [])
    ]

    this.log('Launching browser with stealth mode...', 'debug')
    
    const browser = await puppeteer.launch({
      headless: true,
      args: browserArgs,
      executablePath: puppeteer.executablePath(),
      timeout: 60000
    })

    try {
      const page = await browser.newPage()
      
      // Enhanced stealth configuration
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      })

      // Override navigator properties
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        })
        
        // Add chrome object
        if (!(window as any).chrome) {
          (window as any).chrome = {
            runtime: {}
          }
        }
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query
        window.navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'denied' } as PermissionStatus) :
            originalQuery(parameters)
        )
      })

      // Set viewport
      await page.setViewport({
        width: mobile ? 375 : viewportWidth,
        height: mobile ? 667 : viewportHeight,
        deviceScaleFactor: mobile ? 2 : 1,
        isMobile: mobile,
        hasTouch: mobile
      })

      this.log(`Navigating to ${url} with ${strategy.name} strategy...`, 'debug')
      
      // Navigate with strategy-specific wait conditions
      await page.goto(url, {
        waitUntil: strategy.waitUntil,
        timeout
      })

      // Additional wait time for dynamic content
      if (strategy.waitTime > 0) {
        this.log(`Waiting ${strategy.waitTime}ms for dynamic content...`, 'debug')
        await new Promise(resolve => setTimeout(resolve, strategy.waitTime))
      }

      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0
          const distance = 100
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight
            window.scrollBy(0, distance)
            totalHeight += distance

            if (totalHeight >= scrollHeight) {
              clearInterval(timer)
              window.scrollTo(0, 0) // Scroll back to top
              setTimeout(resolve, 1000) // Wait for any final renders
            }
          }, 100)
        })
      })

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const domain = new URL(url).hostname.replace(/\./g, '-')
      const filename = outputPath || `v0-review-${domain}-${timestamp}.png`
      
      // Ensure output directory exists
      const outputDir = path.dirname(path.resolve(filename))
      await fs.mkdir(outputDir, { recursive: true })
      
      const screenshotPath = path.resolve(filename)

      this.log('Capturing screenshot...', 'debug')
      
      // Capture screenshot with enhanced options
      await page.screenshot({
        path: screenshotPath,
        fullPage,
        type: 'png',
        captureBeyondViewport: true,
        optimizeForSpeed: false
      })

      this.log(`Screenshot saved to ${screenshotPath}`, 'debug')
      
      return screenshotPath

    } finally {
      await browser.close()
    }
  }
}

export default EnhancedScreenshotCapture