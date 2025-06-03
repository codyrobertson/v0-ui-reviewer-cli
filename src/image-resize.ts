import sharp from 'sharp'
import { promises as fs } from 'fs'

export interface ImageResizeOptions {
  maxWidth?: number
  maxHeight?: number
  maxFileSize?: number // in bytes
  quality?: number
}

export class ImageResizer {
  /**
   * Resize image to fit within limits while maintaining aspect ratio
   */
  static async resizeForAPI(
    imagePath: string,
    options: ImageResizeOptions = {}
  ): Promise<{ path: string; width: number; height: number; size: number }> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      maxFileSize = 1.5 * 1024 * 1024, // 1.5MB
      quality = 85
    } = options

    const metadata = await sharp(imagePath).metadata()
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not get image dimensions')
    }

    // Calculate scale to fit within max dimensions
    const widthScale = metadata.width > maxWidth ? maxWidth / metadata.width : 1
    const heightScale = metadata.height > maxHeight ? maxHeight / metadata.height : 1
    const scale = Math.min(widthScale, heightScale)

    const newWidth = Math.round(metadata.width * scale)
    const newHeight = Math.round(metadata.height * scale)

    // Create resized image
    let resizedBuffer = await sharp(imagePath)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer()

    // If still too large, reduce quality
    let currentQuality = quality
    while (resizedBuffer.length > maxFileSize && currentQuality > 20) {
      currentQuality -= 10
      resizedBuffer = await sharp(imagePath)
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: currentQuality })
        .toBuffer()
    }

    // Save to temporary file
    const tempPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '-resized.jpg')
    await fs.writeFile(tempPath, resizedBuffer)

    return {
      path: tempPath,
      width: newWidth,
      height: newHeight,
      size: resizedBuffer.length
    }
  }

  /**
   * Check if image needs resizing
   */
  static async needsResize(imagePath: string, maxFileSize = 1.5 * 1024 * 1024): Promise<boolean> {
    const stats = await fs.stat(imagePath)
    const metadata = await sharp(imagePath).metadata()
    
    return stats.size > maxFileSize || 
           (metadata.width ? metadata.width > 1920 : false) || 
           (metadata.height ? metadata.height > 1080 : false)
  }
}