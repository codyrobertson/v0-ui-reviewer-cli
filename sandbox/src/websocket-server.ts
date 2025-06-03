import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })

  socket.on('style-update', (data) => {
    console.log('Broadcasting style update:', data)
    io.emit('style-update', data)
  })

  socket.on('style-reset', () => {
    console.log('Broadcasting style reset')
    io.emit('style-reset')
  })
})

const PORT = process.env.WS_PORT || 3002
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})