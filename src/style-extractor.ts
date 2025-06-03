import { Page } from 'puppeteer';

export interface ExtractedStyle {
  x: number;
  y: number;
  element: {
    tagName: string;
    className: string;
    id: string;
  };
  computed: {
    // Colors
    backgroundColor: string;
    color: string;
    borderColor: string;
    borderTopColor: string;
    borderRightColor: string;
    borderBottomColor: string;
    borderLeftColor: string;
    
    // Typography
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    letterSpacing: string;
    textAlign: string;
    
    // Spacing
    padding: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    margin: string;
    marginTop: string;
    marginRight: string;
    marginBottom: string;
    marginLeft: string;
    
    // Borders
    borderRadius: string;
    borderTopLeftRadius: string;
    borderTopRightRadius: string;
    borderBottomRightRadius: string;
    borderBottomLeftRadius: string;
    borderWidth: string;
    borderStyle: string;
    
    // Effects
    boxShadow: string;
    opacity: string;
    
    // Layout
    display: string;
    position: string;
    width: string;
    height: string;
  };
}

export interface DesignTokens {
  colors: {
    primary: Set<string>;
    secondary: Set<string>;
    background: Set<string>;
    text: Set<string>;
    border: Set<string>;
  };
  typography: {
    fontFamilies: Set<string>;
    fontSizes: Set<string>;
    fontWeights: Set<string>;
    lineHeights: Set<string>;
  };
  spacing: {
    padding: Set<string>;
    margin: Set<string>;
  };
  borders: {
    radius: Set<string>;
    width: Set<string>;
  };
  effects: {
    shadows: Set<string>;
  };
}

export class StyleExtractor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Extract computed styles from a specific coordinate
   */
  async extractStyleAtPoint(x: number, y: number): Promise<ExtractedStyle | null> {
    try {
      const extractedData = await this.page.evaluate((x, y) => {
        const element = document.elementFromPoint(x, y);
        if (!element) return null;

        const computed = window.getComputedStyle(element);
        
        // Helper to get all border colors
        const getBorderColors = () => {
          const top = computed.getPropertyValue('border-top-color');
          const right = computed.getPropertyValue('border-right-color');
          const bottom = computed.getPropertyValue('border-bottom-color');
          const left = computed.getPropertyValue('border-left-color');
          
          // If all are the same, return a single value
          if (top === right && right === bottom && bottom === left) {
            return top;
          }
          return `${top} ${right} ${bottom} ${left}`;
        };

        return {
          element: {
            tagName: element.tagName.toLowerCase(),
            className: element.className || '',
            id: element.id || ''
          },
          computed: {
            // Colors
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            borderColor: getBorderColors(),
            borderTopColor: computed.borderTopColor,
            borderRightColor: computed.borderRightColor,
            borderBottomColor: computed.borderBottomColor,
            borderLeftColor: computed.borderLeftColor,
            
            // Typography
            fontFamily: computed.fontFamily,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            lineHeight: computed.lineHeight,
            letterSpacing: computed.letterSpacing,
            textAlign: computed.textAlign,
            
            // Spacing
            padding: computed.padding,
            paddingTop: computed.paddingTop,
            paddingRight: computed.paddingRight,
            paddingBottom: computed.paddingBottom,
            paddingLeft: computed.paddingLeft,
            margin: computed.margin,
            marginTop: computed.marginTop,
            marginRight: computed.marginRight,
            marginBottom: computed.marginBottom,
            marginLeft: computed.marginLeft,
            
            // Borders
            borderRadius: computed.borderRadius,
            borderTopLeftRadius: computed.borderTopLeftRadius,
            borderTopRightRadius: computed.borderTopRightRadius,
            borderBottomRightRadius: computed.borderBottomRightRadius,
            borderBottomLeftRadius: computed.borderBottomLeftRadius,
            borderWidth: computed.borderWidth,
            borderStyle: computed.borderStyle,
            
            // Effects
            boxShadow: computed.boxShadow,
            opacity: computed.opacity,
            
            // Layout
            display: computed.display,
            position: computed.position,
            width: computed.width,
            height: computed.height
          }
        };
      }, x, y);

      if (!extractedData) return null;

      return {
        x,
        y,
        ...extractedData
      };
    } catch (error) {
      console.error(`Error extracting style at point (${x}, ${y}):`, error);
      return null;
    }
  }

  /**
   * Extract styles from multiple points
   */
  async extractStylesFromPoints(points: Array<{x: number, y: number}>): Promise<ExtractedStyle[]> {
    const results: ExtractedStyle[] = [];
    
    for (const point of points) {
      const style = await this.extractStyleAtPoint(point.x, point.y);
      if (style) {
        results.push(style);
      }
    }
    
    return results;
  }

  /**
   * Extract styles from a grid pattern across the page
   */
  async extractStylesFromGrid(gridSize: number = 10): Promise<ExtractedStyle[]> {
    const viewport = await this.page.viewport();
    if (!viewport) throw new Error('No viewport defined');

    const points: Array<{x: number, y: number}> = [];
    const stepX = viewport.width / gridSize;
    const stepY = viewport.height / gridSize;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        points.push({
          x: Math.round(stepX * i + stepX / 2),
          y: Math.round(stepY * j + stepY / 2)
        });
      }
    }

    return this.extractStylesFromPoints(points);
  }

  /**
   * Create design tokens from extracted styles
   */
  createDesignTokens(styles: ExtractedStyle[]): DesignTokens {
    const tokens: DesignTokens = {
      colors: {
        primary: new Set(),
        secondary: new Set(),
        background: new Set(),
        text: new Set(),
        border: new Set()
      },
      typography: {
        fontFamilies: new Set(),
        fontSizes: new Set(),
        fontWeights: new Set(),
        lineHeights: new Set()
      },
      spacing: {
        padding: new Set(),
        margin: new Set()
      },
      borders: {
        radius: new Set(),
        width: new Set()
      },
      effects: {
        shadows: new Set()
      }
    };

    for (const style of styles) {
      const { computed } = style;

      // Colors
      if (computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        tokens.colors.background.add(computed.backgroundColor);
      }
      if (computed.color) {
        tokens.colors.text.add(computed.color);
      }
      if (computed.borderColor && computed.borderColor !== 'rgba(0, 0, 0, 0)') {
        tokens.colors.border.add(computed.borderColor);
      }

      // Typography
      if (computed.fontFamily) {
        tokens.typography.fontFamilies.add(computed.fontFamily);
      }
      if (computed.fontSize) {
        tokens.typography.fontSizes.add(computed.fontSize);
      }
      if (computed.fontWeight) {
        tokens.typography.fontWeights.add(computed.fontWeight);
      }
      if (computed.lineHeight && computed.lineHeight !== 'normal') {
        tokens.typography.lineHeights.add(computed.lineHeight);
      }

      // Spacing
      ['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
        const paddingKey = `padding${side}` as keyof typeof computed;
        const marginKey = `margin${side}` as keyof typeof computed;
        
        if (computed[paddingKey] && computed[paddingKey] !== '0px') {
          tokens.spacing.padding.add(computed[paddingKey]);
        }
        if (computed[marginKey] && computed[marginKey] !== '0px') {
          tokens.spacing.margin.add(computed[marginKey]);
        }
      });

      // Borders
      if (computed.borderRadius && computed.borderRadius !== '0px') {
        tokens.borders.radius.add(computed.borderRadius);
      }
      if (computed.borderWidth && computed.borderWidth !== '0px') {
        tokens.borders.width.add(computed.borderWidth);
      }

      // Effects
      if (computed.boxShadow && computed.boxShadow !== 'none') {
        tokens.effects.shadows.add(computed.boxShadow);
      }
    }

    return tokens;
  }

  /**
   * Export styles as CSS variables
   */
  exportAsCSSVariables(tokens: DesignTokens): string {
    let css = ':root {\n';

    // Colors
    const colorCategories = ['background', 'text', 'border'] as const;
    colorCategories.forEach(category => {
      const colors = Array.from(tokens.colors[category]);
      colors.forEach((color, index) => {
        css += `  --color-${category}-${index + 1}: ${color};\n`;
      });
    });

    // Typography
    Array.from(tokens.typography.fontFamilies).forEach((font, index) => {
      css += `  --font-family-${index + 1}: ${font};\n`;
    });
    Array.from(tokens.typography.fontSizes).forEach((size, index) => {
      css += `  --font-size-${index + 1}: ${size};\n`;
    });
    Array.from(tokens.typography.fontWeights).forEach((weight, index) => {
      css += `  --font-weight-${index + 1}: ${weight};\n`;
    });

    // Spacing
    Array.from(tokens.spacing.padding).forEach((value, index) => {
      css += `  --spacing-padding-${index + 1}: ${value};\n`;
    });
    Array.from(tokens.spacing.margin).forEach((value, index) => {
      css += `  --spacing-margin-${index + 1}: ${value};\n`;
    });

    // Borders
    Array.from(tokens.borders.radius).forEach((value, index) => {
      css += `  --border-radius-${index + 1}: ${value};\n`;
    });

    // Effects
    Array.from(tokens.effects.shadows).forEach((value, index) => {
      css += `  --shadow-${index + 1}: ${value};\n`;
    });

    css += '}';
    return css;
  }

  /**
   * Export styles as Tailwind config
   */
  exportAsTailwindConfig(tokens: DesignTokens): string {
    const config = {
      theme: {
        extend: {
          colors: {
            background: {} as Record<string, string>,
            text: {} as Record<string, string>,
            border: {} as Record<string, string>
          },
          fontFamily: {} as Record<string, string[]>,
          fontSize: {} as Record<string, string>,
          fontWeight: {} as Record<string, string>,
          spacing: {} as Record<string, string>,
          borderRadius: {} as Record<string, string>,
          boxShadow: {} as Record<string, string>
        }
      }
    };

    // Colors
    Array.from(tokens.colors.background).forEach((color, index) => {
      config.theme.extend.colors.background[`${index + 1}`] = color;
    });
    Array.from(tokens.colors.text).forEach((color, index) => {
      config.theme.extend.colors.text[`${index + 1}`] = color;
    });
    Array.from(tokens.colors.border).forEach((color, index) => {
      config.theme.extend.colors.border[`${index + 1}`] = color;
    });

    // Typography
    Array.from(tokens.typography.fontFamilies).forEach((font, index) => {
      config.theme.extend.fontFamily[`custom-${index + 1}`] = font.split(',').map(f => f.trim());
    });
    Array.from(tokens.typography.fontSizes).forEach((size, index) => {
      config.theme.extend.fontSize[`custom-${index + 1}`] = size;
    });
    Array.from(tokens.typography.fontWeights).forEach((weight, index) => {
      config.theme.extend.fontWeight[`custom-${index + 1}`] = weight;
    });

    // Spacing
    const allSpacing = new Set([...tokens.spacing.padding, ...tokens.spacing.margin]);
    Array.from(allSpacing).forEach((value, index) => {
      config.theme.extend.spacing[`custom-${index + 1}`] = value;
    });

    // Border radius
    Array.from(tokens.borders.radius).forEach((value, index) => {
      config.theme.extend.borderRadius[`custom-${index + 1}`] = value;
    });

    // Shadows
    Array.from(tokens.effects.shadows).forEach((value, index) => {
      config.theme.extend.boxShadow[`custom-${index + 1}`] = value;
    });

    return `module.exports = ${JSON.stringify(config, null, 2)}`;
  }

  /**
   * Export styles as JSON
   */
  exportAsJSON(styles: ExtractedStyle[], tokens: DesignTokens): string {
    return JSON.stringify({
      extractedStyles: styles,
      designTokens: {
        colors: {
          background: Array.from(tokens.colors.background),
          text: Array.from(tokens.colors.text),
          border: Array.from(tokens.colors.border)
        },
        typography: {
          fontFamilies: Array.from(tokens.typography.fontFamilies),
          fontSizes: Array.from(tokens.typography.fontSizes),
          fontWeights: Array.from(tokens.typography.fontWeights),
          lineHeights: Array.from(tokens.typography.lineHeights)
        },
        spacing: {
          padding: Array.from(tokens.spacing.padding),
          margin: Array.from(tokens.spacing.margin)
        },
        borders: {
          radius: Array.from(tokens.borders.radius),
          width: Array.from(tokens.borders.width)
        },
        effects: {
          shadows: Array.from(tokens.effects.shadows)
        }
      }
    }, null, 2);
  }
}