# v0-ui-reviewer CLI Enhancements

This document describes the enhanced features added to the v0-ui-reviewer CLI tool.

## 🚀 New Features

### 1. Interactive Setup Mode (`--setup`)

First-time users can now run an interactive setup wizard that:
- Validates and stores API keys
- Configures default settings (timeout, device type, output directory)
- Tests API connectivity
- Saves configuration to `~/.config/configstore/v0-ui-reviewer.json`

```bash
v0-review --setup
```

### 2. Enhanced Error Handling & Timeout Configuration

- Configurable timeout for page loading (default: 30s, max: 5min)
- Better error messages for common issues (rate limits, invalid API keys)
- Graceful handling of network failures
- Timeout configuration persisted in config file

### 3. Structured Logging with Winston

- Multiple log levels: error, warn, info, debug
- Clean CLI-friendly output formatting
- Debug mode saves detailed logs to file
- Verbose mode can be enabled with `-v` flag

### 4. Enhanced Progress Bars

Real-time progress tracking for each action:
- **URL Reviews**: Browser Launch → Page Load → Screenshot → Image Processing → API Analysis → Report Generation
- **Screenshot Reviews**: Image Validation → Processing → API Analysis → Report Generation
- Multi-bar display shows overall progress and individual step progress
- Visual feedback with emojis and colors

### 5. Interactive Mode (`--interactive`)

Continuous review mode for multiple URLs/screenshots:
- Review multiple items without restarting
- Session history tracking
- On-the-fly configuration changes
- Batch operations within interactive session

```bash
v0-review --interactive
```

## 📦 New Dependencies

- `winston` - Structured logging
- `configstore` - Persistent configuration storage
- `inquirer` - Interactive prompts
- `cli-progress` - Enhanced progress bars
- `dotenv` - Environment variable support

## 🔧 Configuration Management

The tool now supports three levels of configuration:
1. **Environment Variables** (`.env` file or system)
2. **Persistent Config** (stored in `~/.config/configstore/`)
3. **CLI Arguments** (highest priority)

### Configuration Options

- `apiKey` - v0.dev API key
- `timeout` - Page load timeout (ms)
- `defaultDevice` - desktop or mobile
- `defaultFullPage` - Capture full page by default
- `defaultShowImage` - Display screenshots in terminal
- `logLevel` - Logging verbosity
- `outputDirectory` - Default directory for reports

## 🎯 Usage Examples

### First-Time Setup
```bash
# Run interactive setup on first use
v0-review --setup
```

### Interactive Mode
```bash
# Start interactive session
v0-review --interactive
```

### With Progress Tracking
```bash
# Review with verbose progress
v0-review --url https://example.com -v
```

### Using Saved Configuration
```bash
# Uses saved defaults from setup
v0-review --url https://example.com
```

## 🔄 Backward Compatibility

All existing CLI options and functionality remain unchanged. The enhancements are additive and don't break existing workflows.

## 🐛 Error Handling Improvements

- Clear error messages for missing API keys
- Helpful suggestions for common issues
- Rate limit warnings with retry guidance
- Network timeout handling with configurable limits

## 📊 Progress Callback System

The internal API now supports progress callbacks for integration:

```typescript
await reviewer.reviewURL(url, {
  onProgress: (step, percent, message) => {
    console.log(`${step}: ${percent}% - ${message}`)
  }
})
```