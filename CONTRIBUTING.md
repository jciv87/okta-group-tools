# Contributing to Okta Group Tools

Thank you for considering contributing! This tool is built for the Okta admin community, and we welcome improvements.

## How to Contribute

### Reporting Bugs
1. Check existing [issues](https://github.com/jciv87/okta-group-tools/issues) first
2. Use the bug report template
3. Include:
   - Your environment (OS, Node version)
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs (redact sensitive info)

### Suggesting Features
1. Open an issue with the feature request template
2. Describe the problem it solves
3. Explain how it fits the tool's philosophy (safety, auditability, bulk operations)

### Submitting Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Test thoroughly (especially with safety mechanisms)
5. Update documentation (README, inline comments)
6. Commit with clear messages
7. Push and open a pull request

## Development Guidelines

### Code Style
- Use clear variable names
- Add comments for complex logic
- Follow existing patterns (inquirer prompts, chalk colors, ora spinners)
- Keep functions focused and small

### Safety First
This tool manages production access. Every change must:
- Show impact summaries before execution
- Require explicit confirmation
- Generate logs/backups/manifests
- Handle errors gracefully
- Support rollback where possible

### Testing
Before submitting:
- Run `npm run preflight` to validate setup
- Test with non-production Okta org if possible
- Verify error handling (network failures, API errors, invalid input)
- Check that logs/backups/manifests are generated correctly

## Questions?
Open an issue or discussion. We're here to help!
