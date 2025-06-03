# V0 UI Reviewer Sandbox

A Next.js-based live preview environment for the V0 UI Reviewer CLI that enables instant visualization of design changes.

## Overview

The sandbox provides a real-time preview environment where you can:
- View original and modified designs side-by-side
- Apply style changes instantly via WebSocket
- Test design tokens on pre-built UI components
- Export modified designs

## Architecture

```
sandbox/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── page.tsx           # Main preview page
│   │   ├── layout.tsx         # Root layout
│   │   └── api/               # API endpoints
│   │       └── styles/        # Style update endpoint
│   ├── components/
│   │   ├── preview-panel.tsx  # Main preview UI
│   │   ├── style-injector.tsx # WebSocket client
│   │   └── ui/               # shadcn/ui components
│   └── websocket-server.ts    # WebSocket server
├── package.json
└── README.md
```

## Getting Started

### Install Dependencies

```bash
cd sandbox
npm install
```

### Start the Sandbox

```bash
# Start both Next.js and WebSocket servers
npm run dev:all

# Or run them separately:
npm run dev  # Next.js on port 3001
npm run ws   # WebSocket on port 3002
```

### Access the Preview

Open http://localhost:3001 in your browser.

## Features

### 1. Side-by-Side Comparison

The main view shows original and modified designs side by side, making it easy to see the impact of style changes.

### 2. Live Style Updates

Connect to the WebSocket server to push style updates:

```javascript
// Example WebSocket client
const socket = io('http://localhost:3002');

socket.emit('style-update', {
  selector: '.button',
  styles: {
    'background-color': '#3b82f6',
    'border-radius': '8px'
  },
  component: 'Button'
});
```

### 3. API Endpoint

Send style updates via HTTP:

```bash
curl -X POST http://localhost:3001/api/styles \
  -H "Content-Type: application/json" \
  -d '{
    "selector": ".card",
    "styles": {
      "box-shadow": "0 4px 6px rgba(0, 0, 0, 0.1)"
    }
  }'
```

### 4. Pre-built Components

The sandbox includes common UI patterns:
- Buttons (all variants)
- Form elements (inputs, labels, textareas)
- Cards with various layouts
- Typography samples

## Integration with CLI

The sandbox is designed to work seamlessly with the V0 UI Reviewer CLI:

```bash
# Launch sandbox from CLI
v0-review sandbox

# Extract styles and preview
v0-review extract https://example.com --output tokens.json
# Then apply tokens in the sandbox
```

## WebSocket Events

### Client → Server

- `style-update`: Apply new styles
  ```json
  {
    "selector": "string",
    "styles": { "property": "value" },
    "component": "optional-string"
  }
  ```

- `style-reset`: Clear all applied styles

### Server → Client

- `style-update`: Broadcast style changes to all clients
- `style-reset`: Broadcast reset command

## Customization

### Adding New Components

1. Create component in `src/components/`
2. Import in `preview-panel.tsx`
3. Add to `ComponentShowcase`

### Modifying Styles

Global styles are in `src/app/globals.css` using CSS variables for theming.

### Extending the API

Add new routes in `src/app/api/` following Next.js App Router conventions.

## Development

### Hot Module Reload

Both the Next.js app and components support HMR for rapid development.

### TypeScript

Full TypeScript support with strict mode enabled.

### Tailwind CSS

Tailwind is pre-configured with custom theme extensions.

## Troubleshooting

### Port Conflicts

If ports 3001 or 3002 are in use:

1. Update `package.json` scripts
2. Update WebSocket connection in `style-injector.tsx`
3. Update `websocket-server.ts` PORT variable

### WebSocket Connection Issues

- Ensure both servers are running
- Check browser console for connection errors
- Verify CORS settings in `websocket-server.ts`

### Style Not Applying

- Check selector specificity
- Verify the modified-preview wrapper is present
- Look for console errors

## Future Enhancements

- [ ] Persist style changes across sessions
- [ ] Export modified CSS/Tailwind configs
- [ ] Visual style editor UI
- [ ] Component library expansion
- [ ] Dark mode toggle
- [ ] Responsive preview sizes