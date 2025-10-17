# Changelog

## [1.0.0] - 2025-10-17

Initial public release. I built this for my own work and decided to share it.

**What it does:**
- Manages Okta group rules (including immutable ones)
- Grants/revokes user access with manifest generation
- Resets user access to previous state
- Bulk updates user profile attributes

**Safety features:**
- Impact summaries before changes
- Explicit confirmation required
- Automatic backups and manifests
- Detailed logging

**Known issues:**
- No automated tests yet
- Limited error recovery in edge cases
- Documentation could be better

Use at your own risk. Test in non-production first.

---

See [docs/UX_IMPROVEMENTS.md](docs/UX_IMPROVEMENTS.md) for ideas I'm considering.
