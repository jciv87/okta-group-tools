# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.4] - 2025-10-17

### Added
- Preflight check script for setup validation
- Manifest browser in reset workflow (no more typing paths)
- Bulk profile updater queries Okta schema and categorizes attributes
- Comprehensive safety warnings and impact summaries
- UX analysis documentation in `docs/` folder

### Fixed
- Step numbering consistency across all workflows
- Context-aware language ("remove from rule" vs "remove from user")
- Immutable rule recreation now renames before activation (can't rename active rules)

### Changed
- Bulk profile updater now shows both standard and custom attributes
- Improved error messages and user guidance

## [7.0.0] - 2025-10-17

### Added
- Initial public release
- Group rule management with immutable rule handling
- Direct user access grants/revocations
- Manifest-based access reset
- Bulk profile attribute updates
- Automatic backups and manifest generation
- Comprehensive logging with Winston

### Security
- All operations require explicit confirmation
- Impact summaries before changes
- Automatic rollback on failures
- Audit trail via manifests and logs

## Future Releases

See [UX_IMPROVEMENTS.md](docs/UX_IMPROVEMENTS.md) for planned enhancements.
