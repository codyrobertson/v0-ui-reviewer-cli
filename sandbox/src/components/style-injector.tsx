"use client"

import { useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"

interface StyleUpdate {
  selector: string
  styles: Record<string, string>
  component?: string
  timestamp: number
}

export function StyleInjector() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [styleUpdates, setStyleUpdates] = useState<StyleUpdate[]>([])

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io('http://localhost:3002', {
      transports: ['websocket'],
    })

    socketInstance.on('connect', () => {
      console.log('Connected to style update server')
      setConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from style update server')
      setConnected(false)
    })

    socketInstance.on('style-update', (update: StyleUpdate) => {
      console.log('Received style update:', update)
      setStyleUpdates(prev => [...prev, { ...update, timestamp: Date.now() }])
    })

    socketInstance.on('style-reset', () => {
      console.log('Resetting all styles')
      setStyleUpdates([])
      // Remove all injected styles
      document.querySelectorAll('[data-style-injector]').forEach(el => el.remove())
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.close()
    }
  }, [])

  useEffect(() => {
    // Apply style updates
    styleUpdates.forEach((update) => {
      const styleId = `style-injector-${update.timestamp}`
      let styleElement = document.getElementById(styleId) as HTMLStyleElement
      
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        styleElement.setAttribute('data-style-injector', 'true')
        document.head.appendChild(styleElement)
      }

      const cssText = Object.entries(update.styles)
        .map(([prop, value]) => `${prop}: ${value};`)
        .join(' ')
      
      // Apply to modified preview only
      styleElement.textContent = `.modified-preview ${update.selector} { ${cssText} }`
    })
  }, [styleUpdates])

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
        connected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}>
        {connected ? '🟢 Live' : '🔴 Disconnected'}
      </div>
    </div>
  )
}