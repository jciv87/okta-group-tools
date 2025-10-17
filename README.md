# Okta Group Tools

A suite of CLI tools for managing Okta group memberships and group rules.

## Tools

### Okta Membership Wizard
Interactive CLI for managing Okta access control with three workflows:
- **Group Rule Assignments** - Modify dynamic group rules (handles immutable rules via recreation)
- **Direct User Group Assignments** - Grant/revoke temporary access
- **Manifest-based Access Revocation** - Safely reset user permissions to previous state

### Features
- Automatic backups before rule modifications
- Manifest generation for all access changes (enables rollback)
- Automatic rollback on failures
- Rate limit handling
- Bulk operations from text files

## Setup

```bash
./group_tools_setup.sh
```

Or manually:
```bash
npm install
cp .env.example .env
# Edit .env with your Okta credentials
```

## Configuration

Create a `.env` file:
```
OKTA_DOMAIN=your-domain.okta.com
OKTA_API_TOKEN=your-api-token
```

## Usage

```bash
node okta_membership_wizard.js
```

## Project Structure

```
├── okta_membership_wizard.js  # Main interactive tool
├── bulk_load.js               # Bulk operations
├── diagnose_okta.js           # Diagnostics
├── services/                  # API service layers
├── utils/                     # Shared utilities
├── logs/                      # Operation logs (gitignored)
├── backups/                   # Rule backups (gitignored)
└── manifests/                 # Access manifests (gitignored)
```

## License

MIT
