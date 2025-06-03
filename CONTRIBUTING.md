# Contributing to V0 UI/UX Reviewer CLI

Thanks for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/v0-ui-reviewer-cli.git
   cd v0-ui-reviewer-cli
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## Development

- `npm run dev` - Run in development mode
- `npm run build` - Build the TypeScript project
- `npm test` - Run tests

## Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Test locally:
   ```bash
   npm run build
   node dist/cli.js --help
   ```
4. Commit with descriptive message:
   ```bash
   git commit -m "feat: add awesome feature"
   ```

## Commit Convention

We use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/tooling changes

## Pull Request Process

1. Ensure your branch is up to date with main
2. Push your branch and create a PR
3. Fill out the PR template
4. Wait for review

## Code Style

- Use TypeScript
- Follow existing patterns
- Add types for new features
- Keep functions focused and small

## Testing

- Add tests for new features
- Ensure existing tests pass
- Test with different terminals

## Questions?

Open an issue or reach out in discussions!