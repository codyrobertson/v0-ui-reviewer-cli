# 🎨 V0 UI/UX Reviewer CLI - Example Usage

This file demonstrates various ways to use the v0 UI/UX reviewer CLI tool.

## 🚀 Quick Examples

### 1. Basic Website Analysis

```bash
# Analyze any website
v0-review --url https://stripe.com

# Mobile view analysis
v0-review --url https://airbnb.com --mobile

# Save detailed report
v0-review --url https://github.com --output github-analysis.md
```

### 2. E-commerce Site Analysis

```bash
# Analyze checkout flows
v0-review --url https://shop.tesla.com/cart --context "Electric vehicle checkout experience"

# Compare mobile vs desktop
v0-review --url https://amazon.com --mobile --output amazon-mobile.md
v0-review --url https://amazon.com --output amazon-desktop.md
```

### 3. SaaS Dashboard Analysis

```bash
# Analyze B2B dashboards
v0-review --url https://app.notion.so \
  --context "Note-taking and productivity SaaS" \
  --output notion-dashboard-review.md
```

### 4. Design System Analysis

```bash
# Custom prompt for design system evaluation
v0-review --url https://primer.style \
  --prompt "Analyze this design system documentation. Focus on component consistency, documentation quality, and developer experience. Evaluate: 1) Navigation and findability 2) Code examples and live demos 3) Design token presentation 4) Mobile responsiveness of documentation"
```

## 📱 Mobile-First Analysis

```bash
# Mobile e-commerce checkout
v0-review --url https://shop.spotify.com/cart --mobile --context "Music streaming service merchandise store"

# Mobile banking app
v0-review --url https://chase.com/mobile --mobile --context "Mobile banking experience"
```

## 🔄 Batch Processing Examples

### Competitive Analysis

Create `competitors.txt`:
```
# Competitor analysis - Note-taking apps
https://notion.so
https://obsidian.md
https://roamresearch.com
https://craft.do
```

Run batch analysis:
```bash
v0-review --batch competitors.txt --context "Note-taking app competitive analysis" --output competitor-analysis
```

### Design System Documentation

Create `design-systems.txt`:
```
# Design system documentation sites
https://primer.style
https://material.io
https://ant.design
https://chakra-ui.com
https://mantine.dev
```

```bash
v0-review --batch design-systems.txt --context "Design system documentation" --mobile
```

## 🎯 Specialized Analysis Examples

### 1. Accessibility-Focused Review

```bash
v0-review --url https://webaim.org \
  --prompt "Conduct a comprehensive accessibility audit focusing on: 1) WCAG 2.2 compliance 2) Keyboard navigation 3) Screen reader compatibility 4) Color contrast ratios 5) Focus management 6) Alternative text for images 7) Form accessibility. Provide specific ARIA improvements and testing recommendations."
```

### 2. Conversion Optimization Review

```bash
v0-review --url https://landing-page-example.com \
  --context "SaaS landing page for project management tool" \
  --prompt "Analyze this landing page for conversion optimization. Focus on: 1) Above-the-fold messaging clarity 2) Trust signals and social proof 3) CTA prominence and positioning 4) Value proposition communication 5) Friction points in signup flow 6) Mobile conversion experience. Suggest A/B test ideas for improving conversion rates."
```

### 3. E-commerce UX Review

```bash
v0-review --url https://store.example.com/product/123 \
  --prompt "Evaluate this product page for e-commerce best practices: 1) Product imagery and zoom functionality 2) Reviews and ratings display 3) Add to cart flow 4) Product information hierarchy 5) Cross-selling opportunities 6) Mobile shopping experience 7) Trust badges and security indicators. Recommend improvements for reducing cart abandonment."
```

### 4. Developer Documentation Analysis

```bash
v0-review --url https://docs.api-example.com \
  --context "REST API documentation for developers" \
  --prompt "Analyze this API documentation from a developer experience perspective: 1) Getting started flow 2) Code example quality and variety 3) Navigation and search functionality 4) API reference completeness 5) Interactive testing capabilities 6) Error handling documentation. Focus on reducing time-to-first-API-call."
```

## 📊 Advanced Workflow Examples

### 1. Before/After Design Comparison

```bash
# Capture current state
v0-review --url https://app.example.com/old-design --output before-redesign.md

# After implementing changes
v0-review --url https://app.example.com/new-design --output after-redesign.md

# Compare the two reports manually or use diff tools
```

### 2. Multi-Device Analysis

```bash
# Desktop analysis
v0-review --url https://responsive-site.com --output desktop-analysis.md

# Mobile analysis  
v0-review --url https://responsive-site.com --mobile --output mobile-analysis.md

# Tablet-like analysis (using custom viewport)
v0-review --url https://responsive-site.com --no-full-page --output tablet-analysis.md
```

### 3. User Journey Analysis

Create `user-journey.txt`:
```
# Complete user onboarding journey
https://app.example.com/signup
https://app.example.com/onboarding/step1
https://app.example.com/onboarding/step2
https://app.example.com/dashboard
```

```bash
v0-review --batch user-journey.txt --context "New user onboarding flow for project management SaaS"
```

## 🖼️ Screenshot Analysis Examples

### 1. Analyze Design Mockups

```bash
# Analyze Figma exports or design mockups
v0-review --screenshot ./designs/checkout-flow-v2.png \
  --context "New checkout flow design for subscription service" \
  --output checkout-design-review.md
```

### 2. Analyze Competitor Screenshots

```bash
# When you can't access competitor sites directly
v0-review --screenshot ./competitor-screenshots/competitor-dashboard.png \
  --context "Competitor analysis - CRM dashboard interface"
```

### 3. Historical Design Analysis

```bash
# Analyze old designs or archived versions
v0-review --screenshot ./archive/homepage-2020.png \
  --context "Homepage design from 2020 - evaluating evolution"
```

## 🎨 Creative Prompts for Different Industries

### Fintech/Banking

```bash
v0-review --url https://bank-example.com \
  --prompt "Evaluate this financial services interface for trust, security perception, and regulatory compliance. Focus on: 1) Security indicators and trust signals 2) Data privacy messaging 3) Transaction flow clarity 4) Error prevention in financial forms 5) Accessibility for diverse user abilities 6) Mobile banking experience quality."
```

### Healthcare

```bash
v0-review --url https://health-app.com \
  --prompt "Analyze this healthcare interface for patient experience and HIPAA considerations: 1) Privacy and confidentiality indicators 2) Medical information hierarchy 3) Appointment booking flow 4) Emergency contact accessibility 5) Multi-generational usability 6) Stress-reduction design elements."
```

### Education

```bash
v0-review --url https://learning-platform.com \
  --prompt "Evaluate this educational platform for learning effectiveness: 1) Content organization and progression 2) Engagement and motivation elements 3) Accessibility for different learning styles 4) Mobile learning experience 5) Progress tracking visibility 6) Social learning features integration."
```

### Real Estate

```bash
v0-review --url https://property-site.com \
  --prompt "Analyze this real estate platform for property discovery and decision-making: 1) Search and filtering effectiveness 2) Property information presentation 3) Photo gallery and virtual tour integration 4) Comparison tools usability 5) Contact and inquiry flows 6) Mobile property browsing experience."
```

## 🔍 Debugging and Troubleshooting

### Verbose Output for Debugging

```bash
# See detailed logs and timing information
v0-review --url https://slow-loading-site.com --verbose
```

### Skip Image Display for CI/CD

```bash
# For automated workflows where image display isn't needed
v0-review --url https://example.com --no-show-image --output ci-analysis.md
```

### Custom Screenshot Settings

```bash
# Viewport-only capture for faster analysis
v0-review --url https://complex-site.com --no-full-page

# Mobile viewport with viewport-only capture
v0-review --url https://mobile-site.com --mobile --no-full-page
```

## 📈 Integration Examples

### 1. Git Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
# Analyze staging environment before commits

if [[ "$BRANCH" == "main" ]]; then
  echo "Running UI/UX analysis on staging..."
  v0-review --url https://staging.yourapp.com --output "reports/pre-commit-$(date +%Y%m%d).md"
fi
```

### 2. CI/CD Pipeline Integration

```yaml
# GitHub Actions example
- name: UI/UX Analysis
  run: |
    npm install -g @cody/v0-ui-reviewer
    v0-review --url ${{ env.STAGING_URL }} --no-show-image --output ui-analysis.md
    
- name: Upload Analysis Report
  uses: actions/upload-artifact@v3
  with:
    name: ui-analysis-report
    path: ui-analysis.md
```

### 3. Slack Integration

```bash
#!/bin/bash
# Generate analysis and post to Slack

v0-review --url https://app.example.com --output latest-analysis.md

# Extract key insights and post to Slack
KEY_ISSUES=$(grep -A 5 "🔴" latest-analysis.md | head -10)
curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"UI/UX Analysis Complete:\\n$KEY_ISSUES\"}" \
  $SLACK_WEBHOOK_URL
```

## 🎯 Pro Tips

1. **Use Specific Context**: The more context you provide, the more relevant the analysis
2. **Save Screenshots**: Use `--output` to save screenshots for future reference
3. **Batch Similar Sites**: Group competitors or similar pages for consistent analysis
4. **Custom Prompts**: Tailor prompts for your specific industry or use case
5. **Rate Limiting**: Be mindful of API limits when doing batch processing
6. **Version Control Reports**: Track analysis reports in git to see improvement over time

---

These examples should give you a comprehensive understanding of how to leverage the v0 UI/UX reviewer CLI for various scenarios and use cases!