# Security Policy

## Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please email the maintainers directly or use GitHub's private vulnerability reporting feature.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Best Practices

### API Token Management
- **Never commit** `.env` files or API tokens to git
- Use environment variables or secure secret management
- Rotate tokens regularly
- Use tokens with minimum required permissions

### Access Control
- Review impact summaries carefully before confirming changes
- Keep manifests for audit trail
- Test with non-production orgs first
- Limit who has access to run these tools

### Data Protection
- Logs may contain user IDs and group names (not credentials)
- Manifests contain user/group mappings
- Backups contain rule configurations
- Store these files securely and follow your org's data retention policies

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 7.x     | :white_check_mark: |
| < 7.0   | :x:                |

## Known Security Considerations

1. **API Token Scope**: This tool requires admin-level Okta API access. Tokens should be protected accordingly.
2. **Audit Logging**: All operations are logged to `logs/okta-wizard.log`. Review regularly.
3. **Manifest Storage**: Manifests contain access change history. Treat as sensitive data.
4. **Network Security**: All API calls use HTTPS. Ensure your network doesn't intercept/modify traffic.

## Responsible Disclosure

We follow responsible disclosure practices:
- Security issues are fixed privately before public disclosure
- Credit given to reporters (unless they prefer anonymity)
- CVEs assigned for significant vulnerabilities
