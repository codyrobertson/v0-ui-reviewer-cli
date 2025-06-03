# 🎨 V0 UI/UX Expert Reviewer CLI v3.0

A powerful AI-driven CLI tool that provides instant UI/UX analysis, design token extraction, and code generation for any website. Supports multiple AI models (v0, GPT-4, Claude, O3) with automatic fallback, smart caching, and a seamless workflow.

## ✨ Key Features

### 🚀 **Seamless One-Command Workflow**
```bash
v0-review tacolabs.ai
# Automatically: Screenshots → Analysis → Style Extraction → Ready!
```

### 🤖 **Multi-Model AI Support**
- **v0**: Specialized UI/UX analysis
- **GPT-4/O3-mini**: General purpose analysis  
- **Claude 3**: Detailed design critique
- Automatic fallback when APIs are down

### 🎨 **Automatic Style Extraction**
- Extracts design tokens during review
- Generates CSS variables, Tailwind config, and JSON
- No extra commands needed

### 💻 **Instant Code Generation**
- Generate React/Tailwind components
- Uses extracted design tokens automatically
- Component-specific generation: `/code navbar`

### ⚡ **Smart Caching**
- Reuses screenshots and analysis
- Instant results on subsequent reviews
- Background style processing

## 🎬 Demo

```bash
$ v0-review tacolabs.ai

🎨 V0 UI/UX Expert Review
📱 Device: Desktop (1920x1080)
🌐 URL: https://tacolabs.ai
📸 Mode: Full Page

📸 Capturing desktop screenshot...
🔄 Attempt 1/4 using Standard strategy
✅ Screenshot captured: 1920x6896px
🎨 Extracting design tokens...
✅ Extracted 150 style samples

🤖 Analyzing UI/UX...
✅ Review complete!

💬 Entering interactive mode...
Your screenshot has been saved and can be reviewed with /review

🌐 https://tacolabs.ai [o3-mini] › /code navbar

Generating code...

```jsx
import React from 'react';

const Navbar = () => {
  return (
    <nav className="bg-gray-900 text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="text-2xl font-bold">TacoLabs</div>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-gray-300">Features</a>
          <a href="#about" className="hover:text-gray-300">About</a>
          <a href="#contact" className="hover:text-gray-300">Contact</a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
```

🌐 https://tacolabs.ai [o3-mini] › /styles

🎨 Extracted Design Tokens
📁 Location: /tmp/v0-ui-reviewer/v0-review-xxx/styles/

✅ JSON (tokens.json):
{
  "colors": {
    "primary": "#1a73e8",
    "background": "#ffffff",
    "text": "#202124",
    ...
  }
}
... (142 more lines)

✅ CSS (tokens.css):
:root {
  --color-primary: #1a73e8;
  --color-background: #ffffff;
  --color-text: #202124;
  ...
}
... (98 more lines)
```
- 🛡️ **Anti-Bot Detection** - Puppeteer-extra stealth plugin for reliable captures
- 🔄 **Smart Retry Logic** - Multiple strategies for challenging websites
- 🎨 **Advanced Style Extraction** - Extract computed CSS styles and design tokens from any website
- 📊 **Verbose Mode Control** - Clean output by default, detailed logs on demand
- 🎯 **Point-based Style Sampling** - Extract styles from specific coordinates
- 🏗️ **Design System Generation** - Export as CSS variables, Tailwind config, or JSON
- 🚀 **Live Preview Sandbox** - Instant preview of design changes with hot reload

## 🚀 Quick Start

### Installation

```bash
npm install -g v0-ui-reviewer
```

### Configuration

Run the interactive setup wizard:

```bash
v0-review --setup
```

Or set environment variables:

```bash
export V0_API_KEY="your-v0-api-key"
export OPENAI_API_KEY="your-openai-key"      # Optional
export ANTHROPIC_API_KEY="your-claude-key"   # Optional
```

### Basic Usage

```bash
# Review a website
v0-review --url https://example.com

# Review and start design chat
v0-review --url https://example.com --chat

# Use a specific AI model for chat
v0-review --url https://example.com --chat --model gpt-4

# Review with mobile viewport
v0-review --url https://example.com --mobile

# Interactive mode for continuous reviews
v0-review --interactive
```

## 📖 Commands & Options

### Main Command: `v0-review`

```bash
v0-review [options]
```

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `-u, --url <url>` | URL to review | `--url https://example.com` |
| `-s, --screenshot <path>` | Review existing screenshot | `--screenshot ./image.png` |
| `-c, --context <text>` | Additional context | `--context "E-commerce checkout"` |
| `-p, --prompt <text>` | Custom prompt | `--prompt "Focus on accessibility"` |
| `-m, --mobile` | Mobile viewport (375x667) | `--mobile` |
| `--no-full-page` | Viewport only | `--no-full-page` |
| `-o, --output <path>` | Save analysis | `--output report.md` |
| `--no-show-image` | Skip image display | `--no-show-image` |
| `-v, --verbose` | Verbose output | `--verbose` |
| `--chat` | Start design chat | `--chat` |
| `--model <model>` | AI model for chat | `--model claude-3-opus` |
| `-i, --interactive` | Interactive mode | `--interactive` |
| `-b, --batch <file>` | Batch review | `--batch urls.txt` |
| `--setup` | Run setup wizard | `--setup` |
| `--extract-styles` | Extract design tokens | `--extract-styles` |
| `--style-output <path>` | Style output path | `--style-output tokens.css` |
| `--style-format <fmt>` | Style format | `--style-format css` |

### Alias: `v0ui`

```bash
v0ui --url https://example.com --chat
```

## 💬 Interactive Design Chat

The new design chat feature allows you to have conversations about your UI with AI models:

```bash
v0-review --url https://example.com --chat
```

### Chat Commands

| Command | Description |
|---------|-------------|
| `/model` | Switch between AI models |
| `/analyze` | Perform detailed UI/UX analysis |
| `/tokens` | Extract design tokens |
| `/save [file]` | Save conversation |
| `/help` | Show available commands |
| `/exit` | End chat session |

### Supported AI Models

- **v0** - Specialized UI/UX expert (default)
- **gpt-4** - OpenAI's most capable model
- **gpt-4-turbo** - Faster GPT-4 variant
- **gpt-3.5-turbo** - Fast and cost-effective
- **claude-3-opus** - Anthropic's most capable
- **claude-3-sonnet** - Balanced performance
- **claude-3-haiku** - Fast and efficient

## 🖼️ Enhanced Terminal Display

### High-Resolution Display
- Uses terminal-kit for better image quality
- Automatic resolution optimization
- Smooth scaling with Sharp library

### Interactive Image Viewing
- **CMD+R** (Mac) or **Ctrl+R** - Toggle expanded view
- **ESC** - Exit expanded view
- Automatic aspect ratio preservation

## 🛡️ Advanced Screenshot Capture

### Anti-Bot Detection
- Puppeteer-extra stealth plugin
- Human-like browser behavior
- Bypasses common bot detection

### Smart Retry Strategies
1. **Standard** - Network idle detection
2. **Quick DOM** - Fast content loaded
3. **Extended Wait** - For dynamic content
4. **Minimal** - Fallback mode

### Verbose Mode
```bash
# See detailed logs only when needed
v0-review --url https://example.com --verbose
```

## 🎨 Style Extraction & Design Tokens

### Extract Styles During Review

```bash
# Extract styles alongside UI/UX review
v0-review --url https://example.com --extract-styles

# Specify output format
v0-review --url https://example.com --extract-styles --style-format css --style-output tokens.css
```

### Standalone Style Extraction

```bash
# Extract as JSON (default)
v0-review extract https://example.com

# Extract as CSS variables
v0-review extract https://example.com -f css -o styles.css

# Extract as Tailwind config
v0-review extract https://example.com -f tailwind -o tailwind.config.js

# Extract from specific points
v0-review extract https://example.com -p "100,200;500,300"

# Extract from denser grid
v0-review extract https://example.com -g 20
```

### What Gets Extracted

- **Colors** - Background, text, borders with all computed values
- **Typography** - Font families, sizes, weights, line heights
- **Spacing** - All padding and margin values
- **Borders** - Radius, width, styles
- **Effects** - Box shadows, opacity
- **Layout** - Display, position, dimensions

### Export Formats

1. **JSON** - Complete extracted data with design tokens
2. **CSS Variables** - Ready-to-use CSS custom properties
3. **Tailwind Config** - Extend your Tailwind theme

See [STYLE-EXTRACTION.md](./STYLE-EXTRACTION.md) for detailed documentation.

## 🚀 Live Preview Sandbox

### Launch the Design Sandbox

```bash
# Start the live preview environment
v0-review sandbox
```

This launches a Next.js application with:
- **Side-by-side comparison** - View original and modified designs
- **Live style updates** - Changes apply instantly via WebSocket
- **Pre-built components** - Buttons, cards, forms for testing
- **Hot module reload** - See changes without refresh
- **Design token injection** - Apply extracted styles dynamically

### Sandbox Features

1. **Real-time Preview**
   - WebSocket connection for instant updates
   - No page refresh needed
   - Visual feedback for applied changes

2. **Component Showcase**
   - Common UI patterns pre-built
   - Responsive layouts
   - Dark mode support

3. **Integration Ready**
   - API endpoint for style updates
   - Compatible with style extraction
   - Export modified designs

### Using with Style Extraction

```bash
# Extract styles and preview changes
v0-review extract https://example.com --output tokens.json
v0-review sandbox

# The sandbox will display at http://localhost:3001
```

## 📝 Usage Examples

### 1. Multi-Model Design Review

```bash
# Start with v0's UI expertise
v0-review --url https://stripe.com --output initial-review.md

# Then chat with GPT-4 for broader perspective
v0-review --screenshot v0-review-stripe-com-*.png --chat --model gpt-4
```

### 2. Design System Audit

```bash
v0-review --url https://app.example.com --chat
# In chat:
# You: /analyze
# You: /tokens
# You: Extract all button styles and create a design system component
# You: /save design-system-audit.md
```

### 3. Accessibility Deep Dive

```bash
v0-review --url https://example.com \
  --context "Government website must meet WCAG AAA" \
  --prompt "Perform comprehensive accessibility audit" \
  --chat --model claude-3-opus
```

### 4. Iterative Design Improvement

```bash
# Initial review
v0-review --url https://staging.example.com --output v1-review.md

# After implementing changes
v0-review --url https://staging.example.com --output v2-review.md --chat
# Compare and discuss improvements in chat
```

### 5. Batch Analysis with Follow-up

```bash
# Review competitor sites
v0-review --batch competitors.txt --mobile

# Then deep dive on interesting findings
v0-review --screenshot interesting-finding.png --chat
```

## 🔧 Configuration

### Setup Wizard Options

The setup wizard (`v0-review --setup`) configures:

1. **API Keys**
   - v0.dev API key (required)
   - OpenAI API key (optional)
   - Anthropic API key (optional)

2. **Defaults**
   - Timeout for page loading
   - Default device (desktop/mobile)
   - Full page vs viewport capture
   - Terminal image display
   - Default AI model for chat

3. **Advanced**
   - Logging level
   - Output directory
   - Multi-model preferences

### Configuration File

Settings saved to: `~/.config/configstore/v0-ui-reviewer.json`

```json
{
  "apiKey": "v0_key",
  "openaiApiKey": "sk-...",
  "anthropicApiKey": "sk-ant-...",
  "defaultAIModel": "v0",
  "timeout": 30000,
  "defaultDevice": "desktop",
  "defaultFullPage": true,
  "defaultShowImage": true,
  "logLevel": "info"
}
```

## 🎯 What You Get

### From v0 Analysis

1. **Component Breakdown** - Complete UI inventory
2. **Heuristic & WCAG Audit** - Violations with impact/effort matrix
3. **Recommendations** - Quick wins, redesigns, accessibility fixes
4. **Code Samples** - React/Tailwind implementations
5. **A/B Test Ideas** - Data-driven improvement hypotheses

### From Design Chat

- **Contextual Feedback** - Ask specific questions
- **Iterative Refinement** - Build on previous suggestions
- **Code Generation** - Get implementation help
- **Design Tokens** - Extract reusable values
- **Comparative Analysis** - Discuss trade-offs

## ⚡ Performance & Limits

### API Limits
- **v0**: 200 requests/day (free tier)
- **OpenAI**: Based on your plan
- **Anthropic**: Based on your plan

### Performance Tips
- Use `--verbose` only when debugging
- Cache screenshots for repeated analysis
- Batch similar requests together
- Use appropriate models for tasks

## 🛠️ Development

### Local Development

```bash
# Clone repository
git clone https://github.com/your-username/v0-ui-reviewer-cli
cd v0-ui-reviewer-cli

# Install dependencies
npm install

# Build project
npm run build

# Test locally
npm run dev -- --help
```

### Project Structure

```
src/
├── cli.ts                    # CLI interface
├── index.ts                  # Core reviewer class  
├── screenshot.ts             # Enhanced capture with stealth
├── enhanced-image-display.ts # High-res terminal display
├── ai-service.ts            # Multi-model AI integration
├── design-chat.ts           # Interactive chat system
├── config.ts                # Configuration management
├── setup.ts                 # Setup wizard
├── logger.ts                # Logging system
└── types/                   # TypeScript definitions
```

## 🔧 Troubleshooting

### Common Issues

**"Failed to capture screenshot after retries"**
- Site has strong anti-bot protection
- Try `--verbose` to see retry attempts
- Use `--no-full-page` for faster capture
- Manually screenshot and use `--screenshot`

**"No AI models configured"**
- Run `v0-review --setup`
- Or set environment variables
- At minimum, V0_API_KEY is required

**"CMD+R not working"**
- Varies by terminal emulator
- Try Ctrl+R on Windows/Linux
- ESC always exits expanded view

**"Images showing as blocks (▄▄▄▄) instead of actual images"**
- Your terminal doesn't support inline image display
- Use iTerm2, Kitty, or a Sixel-compatible terminal
- Or use `--no-show-image` flag and open screenshots directly
- The tool will now show helpful suggestions when ASCII fallback is used

**"413 - Request Entity Too Large" API errors**
- Large screenshots exceed API size limits
- Images are now automatically resized if needed (max 1920x1080, 1.5MB)
- Use `--verbose` to see when resizing occurs
- Original screenshots are preserved, only API calls use resized versions

**Installation Issues**
```bash
# macOS
brew install libvips  # For Sharp

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y chromium-browser
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests if applicable
4. Submit a pull request

## 🙏 Acknowledgments

- [v0.dev](https://v0.dev) - UI/UX analysis API
- [OpenAI](https://openai.com) - GPT models
- [Anthropic](https://anthropic.com) - Claude models
- [Puppeteer](https://pptr.dev/) - Web automation
- [puppeteer-extra](https://github.com/berstend/puppeteer-extra) - Stealth plugin
- [terminal-kit](https://github.com/cronvel/terminal-kit) - Enhanced display

---

Made with ❤️ by [Cody](https://github.com/your-username)