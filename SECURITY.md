# Security

## Reporting Issues

If you find a security vulnerability, please **don't open a public issue**. Instead:
- Use GitHub's private vulnerability reporting, or
- Email me directly (check my GitHub profile)

I'll do my best to respond promptly, but I'm a solo maintainer with a day job.

## Use at Your Own Risk

This tool manages production access control. You are responsible for:
- Testing in non-production environments first
- Understanding what each operation does
- Securing your API tokens
- Following your organization's security policies

## Best Practices

**Protect Your API Token:**
- Never commit `.env` files
- Use tokens with minimum required permissions
- Rotate tokens regularly

**Before Running:**
- Run `npm run preflight` to validate setup
- Review impact summaries carefully
- Have a rollback plan

**After Running:**
- Review logs for unexpected behavior
- Keep manifests for audit trail
- Monitor Okta system logs

## What This Tool Does

- Reads/writes Okta group rules
- Adds/removes users from groups
- Updates user profile attributes
- Creates backups and manifests
- Logs all operations

All operations require explicit confirmation. But mistakes can still happen. Test thoroughly.

## Known Limitations

- Requires admin-level Okta API access
- No automated testing (yet)
- Limited error recovery in some edge cases
- Logs may contain user IDs and group names

## License

MIT License - see LICENSE file. No warranty, express or implied.
