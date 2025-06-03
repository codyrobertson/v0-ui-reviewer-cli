import terminalImage from 'terminal-image'
import { promises as fs } from 'fs'
import path from 'path'
import chalk from 'chalk'
import sharp from 'sharp'

export interface SimpleImageDisplayOptions {
  width?: number
  height?: number
  preserveAspectRatio?: boolean
  verbose?: boolean
}

export class SimpleImageDisplay {
  async displayImage(imagePath: string, options: SimpleImageDisplayOptions = {}): Promise<void> {
    const {
      width = Math.min(80, process.stdout.columns - 4),
      height = Math.min(40, Math.floor(process.stdout.rows * 0.6)),
      preserveAspectRatio = true,
      verbose = false
    } = options

    try {
      // Check if image exists
      await fs.access(imagePath)

      // Get image info
      const metadata = await sharp(imagePath).metadata()
      
      console.log(chalk.gray(`\n📷 Screenshot: ${path.basename(imagePath)}`))
      console.log(chalk.gray(`📐 Dimensions: ${metadata.width}x${metadata.height}px`))
      
      // For very large images, resize first to avoid memory issues
      let imageBuffer: Buffer
      if (metadata.width! > 2000 || metadata.height! > 2000) {
        if (verbose) console.log(chalk.gray('🔄 Resizing large image for display...'))
        
        imageBuffer = await sharp(imagePath)
          .resize(1920, 1080, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toBuffer()
      } else {
        imageBuffer = await fs.readFile(imagePath)
      }

      // Display the image
      const image = await terminalImage.buffer(imageBuffer, {
        width,
        height,
        preserveAspectRatio
      })

      console.log('\n' + image)
      console.log(chalk.gray('─'.repeat(Math.min(width, process.stdout.columns - 1)) + '\n'))

    } catch (error) {
      if (verbose) {
        console.warn(chalk.yellow(`⚠️  Could not display image in terminal: ${error instanceof Error ? error.message : String(error)}`))
      }
      console.log(chalk.blue(`📁 Screenshot saved: ${imagePath}\n`))
    }
  }
}

export default SimpleImageDisplay