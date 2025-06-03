import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import boxen from 'boxen'
import open from 'open'
import { io, Socket } from 'socket.io-client'

export class SandboxLauncher {
  private nextProcess: ChildProcess | null = null
  private wsProcess: ChildProcess | null = null
  private socket: Socket | null = null
  private sandboxPath: string
  
  constructor() {
    this.sandboxPath = path.join(process.cwd(), 'sandbox')
  }
  
  async launch(): Promise<void> {
    const spinner = ora('Checking sandbox environment...').start()
    
    try {
      // Check if sandbox exists
      const sandboxExists = await this.checkSandboxExists()
      
      if (!sandboxExists) {
        spinner.fail('Sandbox not found')
        console.log(chalk.yellow('\nThe sandbox directory was not found.'))
        console.log(chalk.cyan('Please ensure the sandbox is set up in your project.'))
        process.exit(1)
      }
      
      // Check if dependencies are installed
      spinner.text = 'Checking dependencies...'
      const depsInstalled = await this.checkDependencies()
      
      if (!depsInstalled) {
        spinner.text = 'Installing dependencies...'
        await this.installDependencies()
      }
      
      spinner.succeed('Sandbox environment ready')
      
      // Display sandbox info
      console.log(boxen(
        `🚀 ${chalk.bold('V0 UI Reviewer Sandbox')}\n\n` +
        `📱 Preview URL: ${chalk.cyan('http://localhost:3001')}\n` +
        `🔌 WebSocket: ${chalk.cyan('ws://localhost:3002')}\n` +
        `📁 Location: ${chalk.gray(this.sandboxPath)}\n\n` +
        `${chalk.yellow('Features:')}\n` +
        `• Side-by-side design comparison\n` +
        `• Live style updates via WebSocket\n` +
        `• Hot module reload\n` +
        `• Pre-built UI components`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan'
        }
      ))
      
      // Start the sandbox
      console.log(chalk.cyan('\n🚀 Starting sandbox servers...\n'))
      
      // Start WebSocket server first
      await this.startWebSocketServer()
      
      // Wait a bit for WebSocket to be ready
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Start Next.js dev server
      await this.startNextServer()
      
      // Open browser after a short delay
      setTimeout(() => {
        open('http://localhost:3001')
      }, 3000)
      
      // Set up cleanup handlers
      this.setupCleanupHandlers()
      
      // Keep the process running
      console.log(chalk.green('\n✅ Sandbox is running!'))
      console.log(chalk.gray('Press Ctrl+C to stop\n'))
      
    } catch (error) {
      spinner.fail('Failed to launch sandbox')
      console.error(chalk.red('Error:'), error)
      this.cleanup()
      process.exit(1)
    }
  }
  
  private async checkSandboxExists(): Promise<boolean> {
    try {
      await fs.access(this.sandboxPath)
      return true
    } catch {
      return false
    }
  }
  
  private async checkDependencies(): Promise<boolean> {
    try {
      const nodeModulesPath = path.join(this.sandboxPath, 'node_modules')
      await fs.access(nodeModulesPath)
      return true
    } catch {
      return false
    }
  }
  
  private async installDependencies(): Promise<void> {
    return new Promise((resolve, reject) => {
      const install = spawn('npm', ['install'], {
        cwd: this.sandboxPath,
        stdio: 'inherit',
        shell: true
      })
      
      install.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`npm install failed with code ${code}`))
        }
      })
      
      install.on('error', reject)
    })
  }
  
  private async startWebSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsProcess = spawn('npm', ['run', 'ws'], {
        cwd: this.sandboxPath,
        stdio: 'pipe',
        shell: true
      })
      
      this.wsProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        if (output.includes('WebSocket server running')) {
          console.log(chalk.green('✓ WebSocket server started on port 3002'))
          resolve()
        }
      })
      
      this.wsProcess.stderr?.on('data', (data) => {
        console.error(chalk.red('WebSocket Error:'), data.toString())
      })
      
      this.wsProcess.on('error', (error) => {
        console.error(chalk.red('Failed to start WebSocket server:'), error)
        reject(error)
      })
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('WebSocket server failed to start in time'))
      }, 10000)
    })
  }
  
  private async startNextServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.nextProcess = spawn('npm', ['run', 'dev'], {
        cwd: this.sandboxPath,
        stdio: 'pipe',
        shell: true
      })
      
      let resolved = false
      
      this.nextProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        process.stdout.write(output)
        
        if (!resolved && output.includes('Ready')) {
          resolved = true
          console.log(chalk.green('\n✓ Next.js server started on http://localhost:3001'))
          resolve()
        }
      })
      
      this.nextProcess.stderr?.on('data', (data) => {
        process.stderr.write(data)
      })
      
      this.nextProcess.on('error', (error) => {
        console.error(chalk.red('Failed to start Next.js server:'), error)
        reject(error)
      })
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (!resolved) {
          reject(new Error('Next.js server failed to start in time'))
        }
      }, 30000)
    })
  }
  
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      console.log(chalk.yellow('\n\n🛑 Shutting down sandbox...'))
      this.cleanup()
      process.exit(0)
    }
    
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  }
  
  private cleanup(): void {
    if (this.nextProcess) {
      this.nextProcess.kill('SIGTERM')
      this.nextProcess = null
    }
    
    if (this.wsProcess) {
      this.wsProcess.kill('SIGTERM')
      this.wsProcess = null
    }
    
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
  
  // Method to send style updates to the sandbox
  async sendStyleUpdate(selector: string, styles: Record<string, string>, component?: string): Promise<void> {
    if (!this.socket) {
      this.socket = io('http://localhost:3002')
    }
    
    this.socket.emit('style-update', {
      selector,
      styles,
      component,
      timestamp: Date.now()
    })
  }
  
  // Method to reset all styles
  async resetStyles(): Promise<void> {
    if (!this.socket) {
      this.socket = io('http://localhost:3002')
    }
    
    this.socket.emit('style-reset')
  }
}