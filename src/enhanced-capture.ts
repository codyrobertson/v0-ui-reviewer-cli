import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { promises as fs } from 'fs'
import path from 'path'
import { StyleExtractor, ExtractedStyle, DesignTokens } from './style-extractor.js'
import { logger } from './logger.js'
import type { Page, Browser, PuppeteerLifeCycleEvent } from 'puppeteer'

// Configure puppeteer-extra with stealth plugin
puppeteer.use(StealthPlugin())

export interface EnhancedCaptureOptions {
  url: string
  fullPage?: boolean
  viewportWidth?: number
  viewportHeight?: number
  outputPath?: string
  mobile?: boolean
  timeout?: number
  verbose?: boolean
  extractStyles?: boolean
  stylePoints?: Array<{x: number, y: number}>
  styleGridSize?: number
  onProgress?: (step: string, percent: number, message?: string) => void
}

export interface CaptureResult {
  screenshotPath: string
  extractedStyles?: ExtractedStyle[]
  designTokens?: DesignTokens
}

export class EnhancedCapture {
  private verbose: boolean

  constructor(verbose: boolean = false) {
    this.verbose = verbose
  }

  private log(message: string, level: 'info' | 'debug' | 'warn' | 'error' = 'info') {
    if (this.verbose || level === 'error' || level === 'warn') {
      logger[level](message)
    }
  }

  async captureWithStyles(options: EnhancedCaptureOptions): Promise<CaptureResult> {
    const {
      url,
      fullPage = true,
      viewportWidth = 1920,
      viewportHeight = 1080,
      outputPath,
      mobile = false,
      timeout = 60000,
      extractStyles = false,
      stylePoints,
      styleGridSize = 10,
      onProgress
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
      '--disable-blink-features=AutomationControlled'
    ]

    this.log('Launching browser with stealth mode...', 'debug')
    onProgress?.('Browser Launch', 10, 'Starting browser...')
    
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

      this.log(`Navigating to ${url}...`, 'debug')
      onProgress?.('Navigation', 20, 'Loading page...')
      
      try {
        // Navigate with comprehensive wait conditions
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout
        })
      } catch (error) {
        // If networkidle0 times out, try with a less strict condition
        this.log('Initial navigation timed out, trying with relaxed conditions...', 'warn')
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout
        })
        // Give extra time for content to load
        await new Promise(resolve => setTimeout(resolve, 5000))
      }

      // Wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000))
      onProgress?.('Navigation', 40, 'Page loaded')

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

      onProgress?.('Screenshot', 50, 'Capturing screenshot...')

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
      onProgress?.('Screenshot', 70, 'Screenshot captured')

      // Extract styles if requested
      let extractedStyles: ExtractedStyle[] | undefined
      let designTokens: DesignTokens | undefined

      if (extractStyles) {
        onProgress?.('Style Extraction', 80, 'Extracting styles...')
        this.log('Extracting styles from page...', 'debug')

        const styleExtractor = new StyleExtractor(page)

        if (stylePoints && stylePoints.length > 0) {
          // Extract from specific points
          extractedStyles = await styleExtractor.extractStylesFromPoints(stylePoints)
        } else {
          // Extract from grid
          extractedStyles = await styleExtractor.extractStylesFromGrid(styleGridSize)
        }

        // Create design tokens
        designTokens = styleExtractor.createDesignTokens(extractedStyles)
        
        this.log(`Extracted ${extractedStyles.length} style samples`, 'debug')
        onProgress?.('Style Extraction', 100, 'Styles extracted')
      }

      return {
        screenshotPath,
        extractedStyles,
        designTokens
      }

    } finally {
      await browser.close()
    }
  }

  /**
   * Extract styles from an existing screenshot URL
   */
  async extractStylesFromURL(url: string, options: {
    points?: Array<{x: number, y: number}>,
    gridSize?: number,
    mobile?: boolean,
    timeout?: number
  } = {}): Promise<{ extractedStyles: ExtractedStyle[], designTokens: DesignTokens }> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()
      
      // Set viewport
      await page.setViewport({
        width: options.mobile ? 375 : 1920,
        height: options.mobile ? 667 : 1080,
        deviceScaleFactor: options.mobile ? 2 : 1,
        isMobile: options.mobile || false,
        hasTouch: options.mobile || false
      })

      await page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: options.timeout || 30000 
      })

      // Wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000))

      const styleExtractor = new StyleExtractor(page)

      let extractedStyles: ExtractedStyle[]
      if (options.points && options.points.length > 0) {
        extractedStyles = await styleExtractor.extractStylesFromPoints(options.points)
      } else {
        extractedStyles = await styleExtractor.extractStylesFromGrid(options.gridSize || 10)
      }

      const designTokens = styleExtractor.createDesignTokens(extractedStyles)

      return {
        extractedStyles,
        designTokens
      }

    } finally {
      await browser.close()
    }
  }
}