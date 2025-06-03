import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

export interface StyleTokenData {
  json: string
  css: string
  tailwind: string
  extractedStyles?: any[]
  designTokens?: any
}

export interface SessionData {
  lastUrl?: string
  lastScreenshot?: string
  screenshots?: Array<{
    url: string
    path: string
    timestamp: string
  }>
  hasStyles?: boolean
  stylePath?: string
  styleFormats?: string[]
  analysis?: any
}

export class TempManager {
  private tempDir: string
  private sessionId: string
  
  constructor() {
    this.sessionId = `v0-review-${Date.now()}`
    this.tempDir = path.join(os.tmpdir(), 'v0-ui-reviewer', this.sessionId)
  }
  
  async init(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true })
  }
  
  getTempDir(): string {
    return this.tempDir
  }
  
  getScreenshotPath(url: string): string {
    // Create a safe filename from URL
    const safeName = url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .substring(0, 100)
    
    return path.join(this.tempDir, `screenshot-${safeName}-${Date.now()}.png`)
  }
  
  async saveScreenshotInfo(url: string, screenshotPath: string): Promise<void> {
    const infoPath = path.join(this.tempDir, 'session.json')
    
    let sessionData: SessionData = {}
    try {
      const existing = await fs.readFile(infoPath, 'utf-8')
      sessionData = JSON.parse(existing)
    } catch {
      // File doesn't exist yet
    }
    
    sessionData.lastUrl = url
    sessionData.lastScreenshot = screenshotPath
    sessionData.screenshots = sessionData.screenshots || []
    sessionData.screenshots.push({
      url,
      path: screenshotPath,
      timestamp: new Date().toISOString()
    })
    
    await fs.writeFile(infoPath, JSON.stringify(sessionData, null, 2))
  }
  
  async saveStyleTokens(url: string, tokens: StyleTokenData): Promise<void> {
    const stylePath = path.join(this.tempDir, 'styles')
    await fs.mkdir(stylePath, { recursive: true })
    
    // Save each format in a separate file
    await fs.writeFile(path.join(stylePath, 'tokens.json'), tokens.json)
    await fs.writeFile(path.join(stylePath, 'tokens.css'), tokens.css)
    await fs.writeFile(path.join(stylePath, 'tailwind.config.js'), tokens.tailwind)
    
    // Save raw extracted data if available
    if (tokens.extractedStyles) {
      await fs.writeFile(path.join(stylePath, 'extracted-styles.json'), JSON.stringify(tokens.extractedStyles, null, 2))
    }
    if (tokens.designTokens) {
      await fs.writeFile(path.join(stylePath, 'design-tokens.json'), JSON.stringify(tokens.designTokens, null, 2))
    }
    
    // Update session data
    const infoPath = path.join(this.tempDir, 'session.json')
    let sessionData: SessionData = {}
    try {
      const existing = await fs.readFile(infoPath, 'utf-8')
      sessionData = JSON.parse(existing)
    } catch {
      // File doesn't exist yet
    }
    
    sessionData.hasStyles = true
    sessionData.stylePath = stylePath
    sessionData.styleFormats = ['json', 'css', 'tailwind']
    
    await fs.writeFile(infoPath, JSON.stringify(sessionData, null, 2))
  }
  
  async saveAnalysis(analysis: any): Promise<void> {
    const analysisPath = path.join(this.tempDir, 'analysis.json')
    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2))
    
    // Update session data
    const infoPath = path.join(this.tempDir, 'session.json')
    let sessionData: SessionData = {}
    try {
      const existing = await fs.readFile(infoPath, 'utf-8')
      sessionData = JSON.parse(existing)
    } catch {
      // File doesn't exist yet
    }
    
    sessionData.analysis = analysisPath
    await fs.writeFile(infoPath, JSON.stringify(sessionData, null, 2))
  }
  
  async getLastScreenshot(): Promise<{ url: string; path: string } | null> {
    try {
      const infoPath = path.join(this.tempDir, 'session.json')
      const data = JSON.parse(await fs.readFile(infoPath, 'utf-8'))
      
      if (data.lastScreenshot && data.lastUrl) {
        // Check if file still exists
        await fs.access(data.lastScreenshot)
        return { url: data.lastUrl, path: data.lastScreenshot }
      }
    } catch {
      // No session data or file doesn't exist
    }
    
    return null
  }
  
  async getSessionData(): Promise<SessionData> {
    try {
      const infoPath = path.join(this.tempDir, 'session.json')
      const data = await fs.readFile(infoPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return {}
    }
  }
  
  async getStyleTokens(format: 'json' | 'css' | 'tailwind'): Promise<string | null> {
    const sessionData = await this.getSessionData()
    if (!sessionData.stylePath) return null
    
    try {
      const filePath = path.join(sessionData.stylePath, 
        format === 'json' ? 'tokens.json' : 
        format === 'css' ? 'tokens.css' : 
        'tailwind.config.js'
      )
      return await fs.readFile(filePath, 'utf-8')
    } catch {
      return null
    }
  }
  
  async getAnalysis(): Promise<any | null> {
    const sessionData = await this.getSessionData()
    if (!sessionData.analysis) return null
    
    try {
      const data = await fs.readFile(sessionData.analysis, 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
  
  displayInfo(verbose: boolean = false): void {
    if (verbose) {
      console.log(chalk.gray(`📁 Temp folder: ${this.tempDir}`))
    }
  }
}

// Global instance for the session
let globalTempManager: TempManager | null = null

export function getTempManager(): TempManager {
  if (!globalTempManager) {
    globalTempManager = new TempManager()
  }
  return globalTempManager
}

export async function cleanupTempManager(): Promise<void> {
  if (globalTempManager) {
    await globalTempManager.cleanup()
    globalTempManager = null
  }
}