import { execSync, exec } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import chalk from 'chalk'
import sharp from 'sharp'
import terminalImage from 'terminal-image'

export interface HDImageDisplayOptions {
  width?: number
  height?: number
  preserveAspectRatio?: boolean
  verbose?: boolean
  forceMethod?: 'kitty' | 'iterm2' | 'sixel' | 'ascii'
}

export class HDImageDisplay {
  private terminalType: 'kitty' | 'iterm2' | 'sixel' | 'ascii' | null = null
  
  constructor() {
    this.detectTerminal()
  }

  private detectTerminal() {
    const term = process.env.TERM || ''
    const termProgram = process.env.TERM_PROGRAM || ''
    
    if (term.includes('kitty') || process.env.KITTY_WINDOW_ID) {
      this.terminalType = 'kitty'
    } else if (termProgram === 'iTerm.app') {
      this.terminalType = 'iterm2'
    } else if (this.checkSixelSupport()) {
      this.terminalType = 'sixel'
    } else {
      this.terminalType = 'ascii'
    }
  }

  private checkSixelSupport(): boolean {
    try {
      // Check if img2sixel is available
      execSync('which img2sixel', { stdio: 'ignore' })
      // Check terminal capabilities
      const terminfo = process.env.TERM || ''
      return terminfo.includes('sixel') || terminfo.includes('xterm')
    } catch {
      return false
    }
  }

  async displayImage(imagePath: string, options: HDImageDisplayOptions = {}): Promise<void> {
    const {
      width = process.stdout.columns - 4,
      height = Math.floor(process.stdout.rows * 0.7),
      preserveAspectRatio = true,
      verbose = false,
      forceMethod
    } = options

    try {
      await fs.access(imagePath)

      const metadata = await sharp(imagePath).metadata()
      
      console.log(chalk.gray(`\n📷 Screenshot: ${path.basename(imagePath)}`))
      console.log(chalk.gray(`📐 Dimensions: ${metadata.width}x${metadata.height}px`))

      const method = forceMethod || this.terminalType
      
      if (method === 'ascii' || verbose) {
        console.log(chalk.gray(`🖼️  Display method: ${method}`))
      }

      switch (method) {
        case 'kitty':
          await this.displayKitty(imagePath, { width, height })
          break
        case 'iterm2':
          await this.displayITerm2(imagePath, { width, height })
          break
        case 'sixel':
          await this.displaySixel(imagePath, { width, height })
          break
        default:
          await this.displayASCII(imagePath, { width, height, preserveAspectRatio })
      }

      if (!verbose) {
        console.log(chalk.gray('─'.repeat(Math.min(width, process.stdout.columns - 1)) + '\n'))
      }

    } catch (error) {
      if (verbose) {
        console.warn(chalk.yellow(`⚠️  Could not display image: ${error instanceof Error ? error.message : String(error)}`))
      }
      console.log(chalk.blue(`📁 Screenshot saved: ${imagePath}\n`))
    }
  }

  private async displayKitty(imagePath: string, options: { width: number; height: number }): Promise<void> {
    try {
      // Use kitty's icat kitten for best quality
      const { width, height } = options
      const cols = Math.min(width, process.stdout.columns)
      const rows = Math.min(height, process.stdout.rows - 4)
      
      // Calculate pixel dimensions (assuming 8x16 cell size)
      const pixelWidth = cols * 8
      const pixelHeight = rows * 16
      
      execSync(`kitty +kitten icat --place=${pixelWidth}x${pixelHeight}@0x0 --scale-up "${imagePath}"`, {
        stdio: 'inherit'
      })
    } catch (error) {
      // Fallback to inline protocol
      await this.displayKittyInline(imagePath)
    }
  }

  private async displayKittyInline(imagePath: string): Promise<void> {
    const data = await fs.readFile(imagePath)
    const base64 = data.toString('base64')
    
    // Kitty graphics protocol
    const chunks = []
    const chunkSize = 4096
    
    for (let i = 0; i < base64.length; i += chunkSize) {
      const chunk = base64.slice(i, i + chunkSize)
      const isLast = i + chunkSize >= base64.length
      const control = isLast ? 'm=0' : 'm=1'
      chunks.push(`\x1b_Gf=100,t=d,${control};${chunk}\x1b\\`)
    }
    
    process.stdout.write(chunks.join(''))
    process.stdout.write('\n')
  }

  private async displayITerm2(imagePath: string, options: { width: number; height: number }): Promise<void> {
    const data = await fs.readFile(imagePath)
    const base64 = data.toString('base64')
    const name = Buffer.from(path.basename(imagePath)).toString('base64')
    
    // iTerm2 inline images protocol
    const sequence = `\x1b]1337;File=name=${name};inline=1;width=${options.width};height=${options.height};preserveAspectRatio=1:${base64}\x07`
    
    process.stdout.write(sequence)
    process.stdout.write('\n')
  }

  private async displaySixel(imagePath: string, options: { width: number; height: number }): Promise<void> {
    try {
      // Calculate pixel dimensions
      const pixelWidth = Math.min(options.width * 8, 1920)
      const pixelHeight = Math.min(options.height * 16, 1080)
      
      // Use img2sixel with 24-bit color if available
      const sixelCmd = `img2sixel -w ${pixelWidth} -h ${pixelHeight} "${imagePath}"`
      
      execSync(sixelCmd, { stdio: 'inherit' })
    } catch (error) {
      // Fallback to ASCII
      await this.displayASCII(imagePath, { ...options, preserveAspectRatio: true })
    }
  }

  private async displayASCII(imagePath: string, options: {
    width: number
    height: number
    preserveAspectRatio: boolean
  }): Promise<void> {
    try {
      // For terminals without graphics support, resize for performance
      const maxWidth = Math.min(options.width, 120)
      const maxHeight = Math.min(options.height, 60)
      
      // Resize image for better terminal display
      const resized = await sharp(imagePath)
        .resize(maxWidth * 4, maxHeight * 8, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer()
      
      // Use terminal-image for ASCII art
      const image = await terminalImage.buffer(resized, {
        width: maxWidth,
        height: maxHeight,
        preserveAspectRatio: options.preserveAspectRatio
      })
      
      console.log('\n' + image)
    } catch (error) {
      // If terminal-image fails, show a simple message
      console.log(chalk.yellow('\n⚠️  Terminal does not support inline image display'))
      console.log(chalk.blue('💡 For better image display:'))
      console.log(chalk.gray('   • Use iTerm2, Kitty, or a Sixel-compatible terminal'))
      console.log(chalk.gray('   • Or open the screenshot file directly'))
    }
  }

  // Helper to show images inline in Node/TS
  static async showImage(file: string): Promise<void> {
    const display = new HDImageDisplay()
    await display.displayImage(file, { verbose: false })
  }
}

export default HDImageDisplay