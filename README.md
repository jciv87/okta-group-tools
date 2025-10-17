# Okta Group Tools

**CLI automation for Okta access management that solves problems the GUI can't.**

## Why This Exists

The Okta GUI is fine for one-off changes. This tool exists for everything else:

### Problems It Solves

**1. Immutable Rules Are Locked**
- GUI: "This rule cannot be modified" → You're stuck
- This tool: Automatically recreates the rule with your changes, handles cutover, rolls back on failure

**2. No Undo Button**
- GUI: Made a mistake? Manually reverse 50 group assignments
- This tool: Every change generates a manifest. One command restores previous state.

**3. Bulk Operations Are Painful**
- GUI: Adding 30 groups to a rule = 30 clicks
- This tool: Select from checklist or load from text file

**4. No Audit Trail**
- GUI: Who had access before this change? Good luck.
- This tool: Timestamped manifests show exactly what changed, when, and by whom

**5. Temporary Access Is Manual**
- GUI: Remember to remove that contractor's access in 2 weeks
- This tool: Grant access → generates manifest → revoke using manifest when done

**6. Profile Updates Are Repetitive**
- GUI: Update custom attribute for 50 users = 50 manual edits
- This tool: Paste user list, set attribute once, done

## What It Does

Four tools for different access patterns:

**Group Rule Management** - Modify dynamic rules (even locked ones), bulk group assignments  
**Direct User Access** - Grant/revoke temporary access with automatic manifest generation  
**Access Reset** - Restore user to previous state using manifest (perfect for incidents/contractors)  
**Bulk Profile Updates** - Update custom profile attributes for multiple users at once

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

**Interactive Wizard:**
```bash
node okta_membership_wizard.js
# or
npm run wizard
```

**Bulk Profile Updates:**
```bash
./bulk_update_user_profile.sh
# or
npm run profile-update
```

### Bulk Loading Groups from File

When prompted to add groups, you can select "From a text file" and provide a file with one group name per line:

```
Engineering-Team-Alpha
DevOps-Production-Access
Security-Audit-ReadOnly
```

See `groups.txt.example` for reference. Group names must match exactly as they appear in Okta.

## Project Structure

```
├── okta_membership_wizard.js     # Main interactive tool
├── bulk_update_user_profile.sh   # Bulk profile attribute updates
├── bulk_load.js                  # Bulk group operations
├── diagnose_okta.js              # Diagnostics
├── services/                     # API service layers
├── utils/                        # Shared utilities
├── logs/                         # Operation logs (gitignored)
├── backups/                      # Rule backups (gitignored)
└── manifests/                    # Access manifests (gitignored)
```

## License

MIT
