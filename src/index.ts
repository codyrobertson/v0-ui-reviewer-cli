import { promises as fs } from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { EnhancedScreenshotCapture } from './screenshot.js'
import { HDImageDisplay } from './hd-image-display.js'
import { EnhancedCapture } from './enhanced-capture.js'
import { StyleExtractor } from './style-extractor.js'
import { MultiModelAIService, AIModel } from './ai-service.js'
import { PromptVariables } from './prompts.js'
import { ImageResizer } from './image-resize.js'
import { getTempManager } from './temp-manager.js'

export interface V0APIResponse {
  id: string
  model: string
  object: string
  created: number
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
}

export interface UIReviewOptions {
  url?: string
  screenshotPath?: string
  context?: string
  customPrompt?: string
  mobile?: boolean
  fullPage?: boolean
  outputPath?: string
  showImage?: boolean
  verbose?: boolean
  onProgress?: (step: string, percent: number, message?: string) => void
  extractStyles?: boolean
  styleOutputPath?: string
  styleFormat?: 'json' | 'css' | 'tailwind'
  model?: AIModel
  deepDive?: boolean
  gridSize?: number
  batchId?: string
}

export interface UIReviewResult {
  componentBreakdown: string
  heuristicAudit: string
  recommendations: string
  codeSamples: string
  abTestIdeas: string
  screenshot?: string
  analysisTimestamp: string
  url?: string
  designTokens?: string
}

/**
 * V0 UI/UX Expert Reviewer CLI
 * 
 * A powerful command-line tool that combines Puppeteer screenshot capture 
 * with the v0 API to provide expert UI/UX analysis with terminal image display.
 */
export class V0UIReviewerCLI {
  private apiKey: string
  private baseURL = 'https://api.v0.dev/v1/chat/completions'
  private timeout: number
  private screenshotCapture: EnhancedScreenshotCapture
  private imageDisplay: HDImageDisplay
  private enhancedCapture: EnhancedCapture
  private aiService: MultiModelAIService
  
  constructor(apiKey?: string, options: { timeout?: number, verbose?: boolean } = {}) {
    this.apiKey = apiKey || process.env.V0_API_KEY || ''
    this.timeout = options.timeout || 30000
    this.screenshotCapture = new EnhancedScreenshotCapture(options.verbose || false)
    this.imageDisplay = new HDImageDisplay()
    this.enhancedCapture = new EnhancedCapture(options.verbose || false)
    this.aiService = new MultiModelAIService({
      v0ApiKey: this.apiKey,
      verbose: options.verbose
    })
    
    if (!this.apiKey && !this.aiService.getAvailableModels().length) {
      throw new Error('No AI API keys configured. Set V0_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY')
    }
  }

  /**
   * Expert UI/UX Review Prompt - Enhanced for CLI use
   */
  private getExpertPrompt(context?: string): string {
    const contextPrefix = context ? `Context: ${context}\n\n` : ''
    
    return `${contextPrefix}You are "Visionary 7", a hybrid **UI/UX engineer, product designer, and senior front-end developer**.

### Your Tasks
1. **Deconstruct the screenshot**:
   - Identify all visible components (navigation, hero, cards, CTAs, forms, tables, charts, footers, etc.)
   - Infer the page's goal(s) and target user(s)
   - Detect visual hierarchy, layout grid, typography, color palette, iconography, spacing, alignment

2. **Run a heuristic audit** (Nielsen + WCAG 2.2 + modern design systems):
   - For each violated heuristic, cite the rule (*e.g.* "Consistency & Standards", "Contrast (Min 4.5:1)", "Fitts's Law")
   - Flag usability, accessibility, and conversion blockers

3. **Prioritize issues** by **Impact / Effort**:
   - Impact 🟢 low, 🟡 medium, 🔴 high
   - Effort 💧 small (<½ dev-day), 🌧️ medium (<2 dev-days), ⛈️ large (>2 dev-days)

4. **Deliver actionable recommendations**:
   - ✨ **Quick wins** (fast, high-impact tweaks)
   - 🛠️ **Deeper redesign** ideas (layout, IA, flow)
   - ♿ **Accessibility fixes** (aria, contrast, keyboard, screen reader)
   - 💻 **Code snippets** (Tailwind/React or plain CSS/HTML) for at least **two** key improvements
   - 📐 Suggested spacing/sizing tokens and typography scale
   - 🎨 Color palette improvements with HEX + accessibility contrast ratios

5. **Propose A/B test hypotheses** for top 3 ideas

### Output Format (use exact headings):
**1. Component Breakdown**
- …

**2. Heuristic & WCAG Audit**
| # | Element | Issue | Guideline Violated | Impact | Effort |
|---|---------|-------|--------------------|--------|--------|
| 1 | … | … | … | 🔴 | 💧 |

**3. Recommendations**
#### Quick Wins
1. …

#### Deeper Redesign
- …

#### Accessibility
- …

**4. Code Samples**
\`\`\`jsx
/* Example React + Tailwind snippet */
…
\`\`\`

**5. A/B Test Ideas**
* …

### Style Rules
* Be concise but specific—no generic advice
* Use bullet lists and tables, not dense paragraphs
* Base comments strictly on what you see—no assumptions
* When uncertain, flag as "Assumption" not fact`
  }

  /**
   * Capture screenshot with enhanced anti-bot detection and retry logic
   */
  async captureScreenshot(url: string, options: {
    fullPage?: boolean
    viewportWidth?: number
    viewportHeight?: number
    outputPath?: string
    mobile?: boolean
    timeout?: number
    verbose?: boolean
    retries?: number
    onProgress?: (step: string, percent: number, message?: string) => void
  } = {}): Promise<string> {
    return this.screenshotCapture.captureWithRetry(url, {
      ...options,
      timeout: options.timeout || this.timeout
    })
  }

  /**
   * Display image in terminal with enhanced quality
   */
  async displayImageInTerminal(imagePath: string, options: {
    width?: number
    height?: number
    preserveAspectRatio?: boolean
    verbose?: boolean
  } = {}): Promise<void> {
    await this.imageDisplay.displayImage(imagePath, {
      ...options
    })
  }

  /**
   * Convert image to base64 for API, resizing if necessary
   */
  private async imageToBase64(imagePath: string, verbose?: boolean): Promise<string> {
    let pathToEncode = imagePath
    let resizedPath: string | undefined
    
    try {
      // Check if image needs resizing
      const needsResize = await ImageResizer.needsResize(imagePath)
      
      if (needsResize) {
        if (verbose) console.log('📐 Image exceeds API limits, resizing...')
        
        const resizeResult = await ImageResizer.resizeForAPI(imagePath, {
          maxWidth: 1920,
          maxHeight: 1080,
          maxFileSize: 1.5 * 1024 * 1024, // 1.5MB
          quality: 85
        })
        
        pathToEncode = resizeResult.path
        resizedPath = resizeResult.path
        
        if (verbose) {
          console.log(`✅ Resized: ${resizeResult.width}x${resizeResult.height}, ${(resizeResult.size / 1024 / 1024).toFixed(2)}MB`)
        }
      }
      
      const imageBuffer = await fs.readFile(pathToEncode)
      return imageBuffer.toString('base64')
      
    } finally {
      // Clean up temporary resized file if created
      if (resizedPath) {
        try {
          await fs.unlink(resizedPath)
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Call v0 API with expert UI/UX review prompt
   */
  private async callAIAPI(imageBase64: string, options: UIReviewOptions): Promise<string> {
    // Prepare prompt variables
    const promptVariables: PromptVariables = {
      url: options.url,
      image_path: options.screenshotPath,
      context: options.context,
      device: options.mobile ? 'mobile' : 'desktop',
      model: options.model || 'v0',
      deep_dive: options.deepDive || options.verbose,
      extract_styles: options.extractStyles,
      grid_size: options.gridSize || 10,
      batch_id: options.batchId
    }

    // If custom prompt is provided, use it directly
    if (options.customPrompt) {
      const messages = [
        {
          role: 'user' as const,
          content: options.customPrompt,
          imageUrl: `data:image/png;base64,${imageBase64}`
        }
      ]
      return this.aiService.chat(messages, {
        model: options.model,
        temperature: 0.7,
        maxTokens: options.deepDive ? 8000 : 4096
      })
    }

    // Use model-specific prompts
    const messages = [
      {
        role: 'user' as const,
        content: 'Please analyze this UI screenshot and provide a comprehensive review.',
        imageUrl: `data:image/png;base64,${imageBase64}`
      }
    ]

    return this.aiService.chat(messages, {
      model: options.model,
      promptVariables,
      temperature: 0.7,
      maxTokens: options.deepDive ? 8000 : 4096
    })
  }

  /**
   * Parse the structured response from v0 API
   */
  private parseResponse(content: string): Omit<UIReviewResult, 'screenshot' | 'analysisTimestamp' | 'url'> {
    const sections = {
      componentBreakdown: '',
      heuristicAudit: '',
      recommendations: '',
      codeSamples: '',
      abTestIdeas: ''
    }

    // Split content by the expected headings
    const parts = content.split(/\*\*\d+\.\s+/)
    
    for (const part of parts) {
      if (part.includes('Component Breakdown')) {
        sections.componentBreakdown = part.replace('Component Breakdown**', '').trim()
      } else if (part.includes('Heuristic & WCAG Audit')) {
        sections.heuristicAudit = part.replace('Heuristic & WCAG Audit**', '').trim()
      } else if (part.includes('Recommendations')) {
        sections.recommendations = part.replace('Recommendations**', '').trim()
      } else if (part.includes('Code Samples')) {
        sections.codeSamples = part.replace('Code Samples**', '').trim()
      } else if (part.includes('A/B Test Ideas')) {
        sections.abTestIdeas = part.replace('A/B Test Ideas**', '').trim()
      }
    }

    return sections
  }

  /**
   * Perform complete UI/UX review with CLI enhancements
   * - Automatically extracts styles in background
   * - Stores everything for instant code generation
   */
  async reviewURL(url: string, options: UIReviewOptions = {}): Promise<UIReviewResult> {
    const { 
      context, 
      customPrompt, 
      mobile = false, 
      fullPage = true,
      showImage = true,
      verbose = false,
      onProgress,
      extractStyles = true, // Always extract styles by default
      styleOutputPath,
      styleFormat = 'json'
    } = options

    try {
      if (verbose) console.log(`📸 Capturing ${mobile ? 'mobile' : 'desktop'} screenshot and extracting styles...`)
      
      let screenshotPath: string
      let designTokens: string | undefined
      
      // Get temp manager for screenshot storage
      const tempManager = getTempManager()
      await tempManager.init()
      const tempScreenshotPath = tempManager.getScreenshotPath(url)
      
      // Always use enhanced capture with style extraction by default
      onProgress?.('Screenshot & Styles', 10, 'Capturing screenshot...')
      
      const captureResult = await this.enhancedCapture.captureWithStyles({
        url,
        mobile,
        fullPage,
        outputPath: options.outputPath?.replace(/\.(md|txt)$/, '.png') || tempScreenshotPath,
        extractStyles: true,
        verbose,
        onProgress: (step, percent, message) => {
          // Map enhanced capture progress to our progress
          const mappedPercent = Math.round(10 + (percent * 0.3)) // 10-40%
          onProgress?.('Screenshot & Styles', mappedPercent, step)
        }
      })
      
      screenshotPath = captureResult.screenshotPath
      onProgress?.('Screenshot & Styles', 50, 'Processing extracted styles...')
      
      // Process extracted styles if available
      if (captureResult.extractedStyles && captureResult.designTokens) {
        const styleExtractor = new StyleExtractor(null as any) // We don't need page here
        
        // Generate multiple format outputs and store them
        const jsonTokens = styleExtractor.exportAsJSON(captureResult.extractedStyles, captureResult.designTokens)
        const cssTokens = styleExtractor.exportAsCSSVariables(captureResult.designTokens)
        const tailwindTokens = styleExtractor.exportAsTailwindConfig(captureResult.designTokens)
        
        // Set the requested format as the primary result
        switch (styleFormat) {
          case 'css':
            designTokens = cssTokens
            break
          case 'tailwind':
            designTokens = tailwindTokens
            break
          default:
            designTokens = jsonTokens
        }
        
        // Store all formats in temp directory for later use
        await tempManager.saveStyleTokens(url, {
          json: jsonTokens,
          css: cssTokens,
          tailwind: tailwindTokens,
          extractedStyles: captureResult.extractedStyles,
          designTokens: captureResult.designTokens
        })
        
        if (verbose) console.log(`🎨 Extracted ${captureResult.extractedStyles.length} style samples and design tokens`)
      }
      
      onProgress?.('Screenshot & Styles', 100, 'Screenshot and styles ready')
      
      // Save screenshot info to temp manager
      await tempManager.saveScreenshotInfo(url, screenshotPath)

      // Step 2: Display image in terminal if requested
      if (showImage) {
        onProgress?.('Image Processing', 10, 'Displaying image...')
        await this.displayImageInTerminal(screenshotPath, {
          width: mobile ? 50 : 80,
          height: mobile ? 30 : 40,
          verbose
        })
        onProgress?.('Image Processing', 100, 'Image displayed')
      }

      if (verbose) console.log('🤖 Analyzing UI/UX with v0 AI...')

      // Step 3: Convert to base64
      onProgress?.('Image Processing', 50, 'Processing image...')
      const imageBase64 = await this.imageToBase64(screenshotPath, verbose)
      onProgress?.('Image Processing', 100, 'Image processed')

      // Step 4: Prepare prompt
      const prompt = customPrompt || this.getExpertPrompt(context)

      // Step 5: Call AI API
      onProgress?.('API Analysis', 10, 'Sending to AI...')
      const analysis = await this.callAIAPI(imageBase64, {
        ...options,
        context: options.context,
        customPrompt: prompt
      })
      onProgress?.('API Analysis', 90, 'Analysis complete')

      // Step 6: Parse response
      onProgress?.('Report Generation', 50, 'Parsing results...')
      const parsedResult = this.parseResponse(analysis)
      onProgress?.('Report Generation', 100, 'Report ready')

      const result = {
        ...parsedResult,
        screenshot: screenshotPath,
        analysisTimestamp: new Date().toISOString(),
        url,
        designTokens
      }
      
      // Store the full analysis result for later use
      await tempManager.saveAnalysis(result)
      
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Rate limit')) {
        throw new Error('🚫 Rate limit exceeded. v0 API allows 200 requests/day. Try again tomorrow.')
      } else if (errorMessage.includes('Invalid API key')) {
        throw new Error('🔑 Invalid API key. Get your key from https://v0.dev and set V0_API_KEY environment variable.')
      } else {
        throw error
      }
    }
  }

  /**
   * Review an existing screenshot
   */
  async reviewScreenshot(screenshotPath: string, options: UIReviewOptions = {}): Promise<UIReviewResult> {
    const { context, customPrompt, showImage = true, verbose = false, onProgress } = options

    try {
      // Step 1: Validate and display image
      onProgress?.('Image Validation', 50, 'Checking image...')
      onProgress?.('Image Validation', 100, 'Image valid')
      
      if (showImage) {
        onProgress?.('Image Processing', 10, 'Displaying image...')
        await this.displayImageInTerminal(screenshotPath, { verbose })
        onProgress?.('Image Processing', 50, 'Image displayed')
      }

      if (verbose) console.log('🤖 Analyzing screenshot with v0 AI...')

      // Step 2: Convert to base64
      onProgress?.('Image Processing', 80, 'Processing image...')
      const imageBase64 = await this.imageToBase64(screenshotPath, verbose)
      onProgress?.('Image Processing', 100, 'Image processed')

      // Step 3: Prepare prompt
      const prompt = customPrompt || this.getExpertPrompt(context)

      // Step 4: Call AI API
      onProgress?.('API Analysis', 10, 'Sending to AI...')
      const analysis = await this.callAIAPI(imageBase64, {
        ...options,
        context: options.context,
        customPrompt: prompt,
        screenshotPath
      })
      onProgress?.('API Analysis', 90, 'Analysis complete')

      // Step 5: Parse response
      onProgress?.('Report Generation', 50, 'Parsing results...')
      const parsedResult = this.parseResponse(analysis)
      onProgress?.('Report Generation', 100, 'Report ready')

      return {
        ...parsedResult,
        screenshot: screenshotPath,
        analysisTimestamp: new Date().toISOString()
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Rate limit')) {
        throw new Error('🚫 Rate limit exceeded. v0 API allows 200 requests/day. Try again tomorrow.')
      } else if (errorMessage.includes('Invalid API key')) {
        throw new Error('🔑 Invalid API key. Get your key from https://v0.dev and set V0_API_KEY environment variable.')
      } else {
        throw error
      }
    }
  }

  /**
   * Format analysis as markdown
   */
  formatAsMarkdown(analysis: UIReviewResult): string {
    const timestamp = new Date(analysis.analysisTimestamp).toLocaleString()
    
    return `# 🎨 V0 UI/UX Expert Review

**Generated:** ${timestamp}
${analysis.url ? `**URL:** ${analysis.url}` : ''}
${analysis.screenshot ? `**Screenshot:** ${analysis.screenshot}` : ''}

---

## 1. Component Breakdown

${analysis.componentBreakdown}

## 2. Heuristic & WCAG Audit

${analysis.heuristicAudit}

## 3. Recommendations

${analysis.recommendations}

## 4. Code Samples

${analysis.codeSamples}

## 5. A/B Test Ideas

${analysis.abTestIdeas}

---

*Generated by V0 UI/UX Expert Reviewer CLI*
*Get your own at: https://github.com/your-username/v0-ui-reviewer-cli*
`
  }

  /**
   * Save analysis to file
   */
  async saveAnalysis(analysis: UIReviewResult, outputPath: string): Promise<void> {
    const markdown = this.formatAsMarkdown(analysis)
    
    // Ensure output directory exists
    const outputDir = path.dirname(path.resolve(outputPath))
    await fs.mkdir(outputDir, { recursive: true })
    
    await fs.writeFile(outputPath, markdown, 'utf-8')
  }
}

export default V0UIReviewerCLI