import winston from 'winston'
import chalk from 'chalk'
import { configManager } from './config.js'

const { format } = winston

// Custom format for CLI output
const cliFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  let output = ''
  
  // Skip timestamp for info level to keep output clean
  if (level !== 'info') {
    output += chalk.gray(`[${timestamp}] `)
  }
  
  // Colorize level
  switch (level) {
    case 'error':
      output += chalk.red(`❌ ${message}`)
      break
    case 'warn':
      output += chalk.yellow(`⚠️  ${message}`)
      break
    case 'info':
      output += message // Info messages are already formatted
      break
    case 'debug':
      output += chalk.gray(`🔍 ${message}`)
      break
    default:
      output += message
  }
  
  // Add metadata if present (but skip if it's an error object being weirdly serialized)
  if (Object.keys(metadata).length > 0 && !metadata['0']) {
    // Special handling for error metadata
    if (metadata.stack && metadata.message) {
      // It's an error object, just show the stack
      if (level === 'debug') {
        output += '\n' + chalk.gray(metadata.stack)
      }
    } else {
      output += '\n' + chalk.gray(JSON.stringify(metadata, null, 2))
    }
  }
  
  return output
})

// Create logger instance
const logger = winston.createLogger({
  level: configManager.get('logLevel') || 'info',
  format: format.combine(
    format.timestamp({ format: 'HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    cliFormat
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
})

// Also save logs to file in debug mode
if (configManager.get('logLevel') === 'debug') {
  logger.add(new winston.transports.File({
    filename: 'v0-ui-reviewer-debug.log',
    format: format.combine(
      format.timestamp(),
      format.json()
    )
  }))
}

export { logger }