import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export interface ChunkInfo {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  chunkIndex: number;
  totalChunks: number;
}

export interface ProcessedImage {
  originalPath: string;
  chunks: ChunkInfo[];
  metadata: {
    originalWidth: number;
    originalHeight: number;
    needsSplitting: boolean;
  };
}

export class ImagePreprocessor {
  private readonly MAX_HEIGHT = 2000;
  private readonly CHUNK_HEIGHT = 1500;
  private readonly OVERLAP = 200;
  private readonly MAX_API_WIDTH = 1920;
  private readonly MAX_API_HEIGHT = 1080;

  async preprocessImage(imagePath: string): Promise<ProcessedImage[]> {
    const metadata = await sharp(imagePath).metadata();
    const { width = 0, height = 0 } = metadata;

    const result: ProcessedImage = {
      originalPath: imagePath,
      chunks: [],
      metadata: {
        originalWidth: width,
        originalHeight: height,
        needsSplitting: height > this.MAX_HEIGHT
      }
    };

    if (height <= this.MAX_HEIGHT) {
      // Single image, just optimize for API
      const optimizedPath = await this.optimizeForAPI(imagePath);
      result.chunks = [{
        path: optimizedPath,
        x: 0,
        y: 0,
        width,
        height,
        chunkIndex: 0,
        totalChunks: 1
      }];
    } else {
      // Split into chunks
      result.chunks = await this.splitIntoChunks(imagePath);
    }

    return [result];
  }

  async splitIntoChunks(imagePath: string): Promise<ChunkInfo[]> {
    const metadata = await sharp(imagePath).metadata();
    const { width = 0, height = 0 } = metadata;

    const chunks: ChunkInfo[] = [];
    const effectiveHeight = this.CHUNK_HEIGHT - this.OVERLAP;
    const totalChunks = Math.ceil((height - this.OVERLAP) / effectiveHeight);

    for (let i = 0; i < totalChunks; i++) {
      const y = i * effectiveHeight;
      const chunkHeight = Math.min(this.CHUNK_HEIGHT, height - y);
      
      if (chunkHeight <= 0) break;

      const chunkPath = await this.createChunk(imagePath, 0, y, width, chunkHeight, i);
      const optimizedPath = await this.optimizeForAPI(chunkPath);

      chunks.push({
        path: optimizedPath,
        x: 0,
        y,
        width,
        height: chunkHeight,
        chunkIndex: i,
        totalChunks
      });

      // Clean up intermediate chunk file if different from optimized
      if (chunkPath !== optimizedPath) {
        await fs.unlink(chunkPath).catch(() => {});
      }
    }

    return chunks;
  }

  async optimizeForAPI(imagePath: string): Promise<string> {
    const metadata = await sharp(imagePath).metadata();
    const { width = 0, height = 0 } = metadata;

    // Check if resize is needed
    if (width <= this.MAX_API_WIDTH && height <= this.MAX_API_HEIGHT) {
      return imagePath;
    }

    const aspectRatio = width / height;
    let newWidth = width;
    let newHeight = height;

    if (width > this.MAX_API_WIDTH) {
      newWidth = this.MAX_API_WIDTH;
      newHeight = Math.round(newWidth / aspectRatio);
    }

    if (newHeight > this.MAX_API_HEIGHT) {
      newHeight = this.MAX_API_HEIGHT;
      newWidth = Math.round(newHeight * aspectRatio);
    }

    const optimizedPath = this.generateOptimizedPath(imagePath);
    
    await sharp(imagePath)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toFile(optimizedPath);

    return optimizedPath;
  }

  private async createChunk(
    imagePath: string,
    x: number,
    y: number,
    width: number,
    height: number,
    chunkIndex: number
  ): Promise<string> {
    const chunkPath = this.generateChunkPath(imagePath, chunkIndex);
    
    await sharp(imagePath)
      .extract({ left: x, top: y, width, height })
      .png()
      .toFile(chunkPath);

    return chunkPath;
  }

  private generateChunkPath(originalPath: string, chunkIndex: number): string {
    const ext = path.extname(originalPath);
    const base = path.basename(originalPath, ext);
    const dir = path.dirname(originalPath);
    return path.join(dir, `${base}_chunk_${chunkIndex}.png`);
  }

  private generateOptimizedPath(originalPath: string): string {
    const ext = path.extname(originalPath);
    const base = path.basename(originalPath, ext);
    const dir = path.dirname(originalPath);
    return path.join(dir, `${base}_optimized.png`);
  }

  async cleanup(processedImages: ProcessedImage[]): Promise<void> {
    for (const processed of processedImages) {
      for (const chunk of processed.chunks) {
        if (chunk.path !== processed.originalPath) {
          await fs.unlink(chunk.path).catch(() => {});
        }
      }
    }
  }
}