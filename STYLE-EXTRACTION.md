# Style Extraction Feature

The v0-ui-reviewer CLI now includes powerful style extraction capabilities that allow you to extract design tokens and computed CSS styles directly from any website.

## Features

- **Extract computed CSS styles** from specific x,y coordinates
- **Generate design tokens** from extracted styles
- **Export in multiple formats**: JSON, CSS Variables, Tailwind Config
- **Grid-based extraction** for comprehensive style analysis
- **Point-based extraction** for targeted style sampling

## Usage Examples

### 1. Extract Design Tokens (Standalone Command)

```bash
# Extract design tokens as JSON (default)
v0-review extract https://example.com

# Extract as CSS variables
v0-review extract https://example.com -f css -o styles.css

# Extract as Tailwind config
v0-review extract https://example.com -f tailwind -o tailwind.config.js

# Extract from specific points
v0-review extract https://example.com -p "100,200;500,300;800,400"

# Extract from a denser grid (20x20 instead of default 10x10)
v0-review extract https://example.com -g 20

# Mobile viewport extraction
v0-review extract https://example.com -m
```

### 2. Extract Styles During Review

```bash
# Basic review with style extraction
v0-review --url https://example.com --extract-styles

# Specify output format and path
v0-review --url https://example.com --extract-styles --style-format css --style-output tokens.css

# Mobile review with style extraction
v0-review --url https://example.com --mobile --extract-styles
```

## Extracted Style Properties

The style extractor captures comprehensive computed styles including:

### Colors
- Background colors
- Text colors
- Border colors (all sides)

### Typography
- Font families
- Font sizes
- Font weights
- Line heights
- Letter spacing
- Text alignment

### Spacing
- Padding (all sides)
- Margin (all sides)

### Borders
- Border radius (all corners)
- Border width
- Border style

### Effects
- Box shadows
- Opacity

### Layout
- Display properties
- Position
- Width & Height

## Output Formats

### 1. JSON Format
```json
{
  "extractedStyles": [...],
  "designTokens": {
    "colors": {
      "background": ["#ffffff", "#f5f5f5"],
      "text": ["#333333", "#666666"],
      "border": ["#e0e0e0"]
    },
    "typography": {
      "fontFamilies": ["Arial, sans-serif"],
      "fontSizes": ["16px", "24px", "32px"]
    },
    "spacing": {
      "padding": ["8px", "16px", "24px"],
      "margin": ["0px", "16px", "32px"]
    }
  }
}
```

### 2. CSS Variables
```css
:root {
  --color-background-1: #ffffff;
  --color-background-2: #f5f5f5;
  --color-text-1: #333333;
  --color-text-2: #666666;
  --font-family-1: Arial, sans-serif;
  --font-size-1: 16px;
  --font-size-2: 24px;
  --spacing-padding-1: 8px;
  --spacing-padding-2: 16px;
  --border-radius-1: 4px;
  --shadow-1: 0 2px 4px rgba(0,0,0,0.1);
}
```

### 3. Tailwind Config
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        background: {
          '1': '#ffffff',
          '2': '#f5f5f5'
        },
        text: {
          '1': '#333333',
          '2': '#666666'
        }
      },
      fontFamily: {
        'custom-1': ['Arial', 'sans-serif']
      },
      fontSize: {
        'custom-1': '16px',
        'custom-2': '24px'
      },
      spacing: {
        'custom-1': '8px',
        'custom-2': '16px'
      }
    }
  }
}
```

## Integration with Design Workflow

1. **Design System Creation**: Extract tokens from existing sites to bootstrap your design system
2. **Style Auditing**: Analyze style consistency across pages
3. **Migration Helper**: Extract styles when migrating or redesigning sites
4. **Component Library**: Generate token-based component styles

## Tips

- Use grid extraction (`-g`) for comprehensive analysis
- Use point extraction (`-p`) for specific component styles
- Combine with the review feature for both UX analysis and style extraction
- Export as CSS variables for easy integration with existing projects
- Export as Tailwind config for utility-first CSS frameworks

## Advanced Usage

### Extracting Specific Component Styles
```bash
# Extract styles from header area (approximate coordinates)
v0-review extract https://example.com -p "0,50;500,50;1000,50"

# Extract button styles (if you know button locations)
v0-review extract https://example.com -p "100,300;250,300;400,300"
```

### Comparing Styles Across Pages
```bash
# Extract from multiple pages and compare
v0-review extract https://example.com/home -o home-tokens.json
v0-review extract https://example.com/about -o about-tokens.json
v0-review extract https://example.com/contact -o contact-tokens.json
```

### Building a Complete Design System
```bash
# 1. Extract tokens
v0-review extract https://example.com -f json -o tokens.json

# 2. Generate CSS variables
v0-review extract https://example.com -f css -o variables.css

# 3. Generate Tailwind config
v0-review extract https://example.com -f tailwind -o tailwind.config.js

# 4. Review the UI for context
v0-review --url https://example.com --extract-styles -o review.md
```