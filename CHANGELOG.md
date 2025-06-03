# Changelog

## [3.3.0] - 2025-02-06

### Added
- **Auto-review on startup**: Running `v0-review {url}` now automatically performs the review
- **Screenshot persistence**: Screenshots are saved to a temp folder for later reference
- **API key setup flow**: If no API keys are configured, users are prompted to enter them
- **Improved progress tracking**: Shows detailed progress steps during review
- **Smart screenshot reuse**: Interactive mode can use previously captured screenshots

### Changed
- Default behavior: Direct URL argument triggers immediate review instead of interactive mode
- After auto-review, the CLI enters interactive mode for follow-up questions
- `/review` command in interactive mode now uses saved screenshots when available
- Model list updated to include o3-mini and claude-sonnet-4

### Fixed
- API key configuration is now checked before attempting any operations
- Temp folders are properly cleaned up on exit
- Better error messages when no API keys are configured

### Technical Details
- Added `temp-manager.ts` for managing temporary screenshot storage
- Added `api-key-setup.ts` for interactive API key configuration
- Modified CLI flow to support auto-review workflow
- Screenshots are stored in OS temp directory under `v0-ui-reviewer/session-{timestamp}/`