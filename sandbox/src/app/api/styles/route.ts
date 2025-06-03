import { NextRequest, NextResponse } from 'next/server'

interface StyleUpdate {
  selector: string
  styles: Record<string, string>
  component?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: StyleUpdate = await request.json()
    
    // Validate the request
    if (!body.selector || !body.styles) {
      return NextResponse.json(
        { error: 'Invalid request: selector and styles are required' },
        { status: 400 }
      )
    }

    // In a real implementation, this would broadcast to connected WebSocket clients
    // For now, we'll just return success
    console.log('Received style update:', body)

    return NextResponse.json({
      success: true,
      message: 'Style update received',
      data: body
    })
  } catch (error) {
    console.error('Error processing style update:', error)
    return NextResponse.json(
      { error: 'Failed to process style update' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Style update API is running',
    endpoints: {
      POST: '/api/styles - Submit style updates',
    }
  })
}