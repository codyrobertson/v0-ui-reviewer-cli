import terminalKit from 'terminal-kit'
import sharp from 'sharp'
import { promises as fs } from 'fs'
import path from 'path'
import sizeOf from 'image-size'
import terminalImage from 'terminal-image'
import { logger } from './logger.js'

const term = terminalKit.terminal as any

export interface ImageDisplayOptions {
  width?: number
  height?: number
  preserveAspectRatio?: boolean
  highQuality?: boolean
  verbose?: boolean
}

export class EnhancedImageDisplay {
  private isExpanded: boolean = false
  private currentImagePath: string | null = null
  private keyListenerActive: boolean = false

  constructor() {
    // Terminal-kit initialization happens automatically
  }

  async displayImage(imagePath: string, options: ImageDisplayOptions = {}): Promise<void> {
    const {
      width = 80,
      height = 40,
      preserveAspectRatio = true,
      highQuality = true,
      verbose = false
    } = options

    try {
      // Check if image exists
      await fs.access(imagePath)
      this.currentImagePath = imagePath

      // Get image dimensions
      const dimensions = sizeOf(imagePath)
      if (!dimensions.width || !dimensions.height) {
        throw new Error('Could not determine image dimensions')
      }

      console.log(`\n📷 Screenshot: ${path.basename(imagePath)}`)
      console.log(`📐 Dimensions: ${dimensions.width}x${dimensions.height}px`)
      console.log('\x1b[90m💡 Press CMD+R to toggle expanded view\x1b[0m\n')

      if (highQuality) {
        await this.displayHighQualityImage(imagePath, { width, height, preserveAspectRatio })
      } else {
        await this.displayStandardImage(imagePath, { width, height, preserveAspectRatio })
      }

      // Setup keyboard listener for CMD+R
      if (!this.keyListenerActive) {
        this.setupKeyboardListener()
      }

    } catch (error) {
      if (verbose) {
        logger.warn(`Could not display image: ${error instanceof Error ? error.message : String(error)}`)
      }
      console.log(`📁 Screenshot saved: ${imagePath}`)
    }
  }

  private async displayHighQualityImage(imagePath: string, options: {
    width: number
    height: number
    preserveAspectRatio: boolean
  }): Promise<void> {
    const { width, height, preserveAspectRatio } = options

    // Calculate display dimensions
    const termWidth = Math.min(width, term.width - 4)
    const termHeight = Math.min(height, term.height - 10)

    try {
      // Use sharp to resize image for better quality
      const resizedImageBuffer = await sharp(imagePath)
        .resize(termWidth * 2, termHeight * 4, {
          fit: preserveAspectRatio ? 'inside' : 'fill',
          kernel: sharp.kernel.lanczos3
        })
        .png()
        .toBuffer()

      // Save temporary resized image
      const tempPath = path.join(path.dirname(imagePath), `.temp-${path.basename(imagePath)}`)
      await fs.writeFile(tempPath, resizedImageBuffer)

      // Display using terminal-kit's advanced image display
      await term.drawImage(tempPath, {
        shrink: {
          width: termWidth,
          height: termHeight
        }
      })

      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {})

      // Move cursor below image
      term.moveTo(1, termHeight + 5)
      
    } catch (error) {
      // Fallback to standard display
      await this.displayStandardImage(imagePath, options)
    }
  }

  private async displayStandardImage(imagePath: string, options: {
    width: number
    height: number
    preserveAspectRatio: boolean
  }): Promise<void> {
    const { width, height, preserveAspectRatio } = options

    const terminalImg = await terminalImage.file(imagePath, {
      width: preserveAspectRatio ? Math.min(width, process.stdout.columns - 4) : width,
      height: preserveAspectRatio ? Math.min(height, process.stdout.rows - 10) : height,
      preserveAspectRatio
    })

    console.log(terminalImg)
    console.log('\n' + '─'.repeat(process.stdout.columns - 1))
  }

  private setupKeyboardListener(): void {
    this.keyListenerActive = true

    // Enable raw mode for keyboard input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.setEncoding('utf8')

      process.stdin.on('data', async (key: string) => {
        // CMD+R detection (varies by platform)
        const isCmdR = (
          key === '\x12' || // Ctrl+R
          (process.platform === 'darwin' && key === '\x1b[82;5u') // CMD+R on macOS
        )

        if (isCmdR && this.currentImagePath) {
          await this.toggleExpandedView()
        }

        // ESC to exit expanded view
        if (key === '\x1b' && this.isExpanded) {
          await this.toggleExpandedView()
        }

        // Ctrl+C to exit
        if (key === '\x03') {
          this.cleanup()
          process.exit(0)
        }
      })
    }
  }

  private async toggleExpandedView(): Promise<void> {
    if (!this.currentImagePath) return

    this.isExpanded = !this.isExpanded

    if (this.isExpanded) {
      // Clear screen and display full-size image
      term.clear()
      term.moveTo(1, 1)
      term.bold.cyan('🖼️  Expanded View - Press ESC or CMD+R to exit\n\n')

      await this.displayHighQualityImage(this.currentImagePath, {
        width: term.width - 2,
        height: term.height - 4,
        preserveAspectRatio: true
      })
    } else {
      // Return to normal view
      term.clear()
      term.moveTo(1, 1)
      
      // Redisplay at normal size
      await this.displayImage(this.currentImagePath, {
        width: 80,
        height: 40,
        highQuality: true
      })
    }
  }

  cleanup(): void {
    if (process.stdin.isTTY && this.keyListenerActive) {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      this.keyListenerActive = false
    }
  }
}

export default EnhancedImageDisplay