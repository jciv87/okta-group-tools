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
- GUI: Update department for 50 users = 50 manual edits
- This tool: Query available attributes, paste user list, set value once, done

## What It Does

Four tools for different access patterns:

### 1. Group Rule Management
Modifies Okta group rules that automatically assign users to groups based on conditions (e.g., department, location, role).

**What it handles:**
- Direct rule updates (when rules are mutable)
- Automatic rule recreation (when rules are locked/immutable)
- Bulk group assignments to rules
- Safe cutover with automatic rollback on failure

**Use cases:**
- Adding AWS access groups to an engineering rule
- Removing deprecated groups from contractor rules
- Restructuring access patterns across departments

### 2. Direct User Access
Grants or revokes group memberships for individual users - perfect for temporary access or one-off changes.

**What it handles:**
- Add users to multiple groups at once
- Remove users from multiple groups at once
- Automatic manifest generation for every change
- Interactive or file-based group selection

**Use cases:**
- Granting temporary elevated access for incidents
- Onboarding contractors with specific group sets
- Quick access grants that bypass rule conditions

### 3. Access Reset
Restores a user to their exact previous state using a manifest file - the "undo button" for access changes.

**What it handles:**
- Browse recent manifests by user and timestamp
- Preview what will be added/removed
- Reverse any previous access change operation
- Perfect for cleaning up after incidents or contractor offboarding

**Use cases:**
- Removing temporary access after incident resolution
- Offboarding contractors (revert to pre-onboarding state)
- Fixing mistakes from incorrect access grants

### 4. Bulk Profile Updates
Updates profile attributes for multiple users at once - eliminates repetitive GUI clicking.

**What it handles:**
- Queries Okta schema to show available attributes (standard and custom)
- Categorizes attributes for easy selection
- Set any profile attribute (boolean, string, number)
- Process multiple users in one operation
- Detailed success/failure reporting
- Confirmation with full impact summary

**Use cases:**
- Bulk updating department assignments
- Marking users as contractors (`contractor: true`)
- Setting manager relationships across teams
- Updating custom flags for access control logic

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Okta Group Tools                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Wizard     │  │   Profile    │  │  Bulk Load   │ │
│  │ (Interactive)│  │   Updater    │  │   (Script)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                  │         │
│         └─────────────────┼──────────────────┘         │
│                           │                            │
│                  ┌────────▼────────┐                   │
│                  │  Okta API Layer │                   │
│                  │  (axios + auth) │                   │
│                  └────────┬────────┘                   │
│                           │                            │
│         ┌─────────────────┼─────────────────┐         │
│         │                 │                 │         │
│    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐    │
│    │  Logs   │      │ Backups │      │Manifests│    │
│    │(winston)│      │  (JSON) │      │ (JSON)  │    │
│    └─────────┘      └─────────┘      └─────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Safety Mechanisms

**Before Execution:**
1. **Preflight checks** - Validates Node version, dependencies, .env config, and Okta connectivity
2. **Impact summaries** - Shows exactly what will change, how many users/groups affected
3. **Explicit confirmation** - Requires user approval before any changes

**During Execution:**
4. **Automatic backups** - Rule modifications create timestamped JSON backups
5. **Manifest generation** - User access changes generate rollback manifests
6. **Progress tracking** - Spinners and status updates for long operations
7. **Error handling** - Graceful failures with detailed error messages

**After Execution:**
8. **Structured logging** - All operations logged to `logs/okta-wizard.log` with timestamps
9. **Backup retention** - Rule backups stored in `backups/` directory
10. **Manifest storage** - Access manifests stored in `manifests/` directory

### Immutable Rule Handling

When Okta locks a rule (makes it immutable), the GUI shows an error. This tool handles it automatically:

```
1. Detect immutable rule (API returns error on update attempt)
2. Offer to recreate the rule with changes
3. Stage new rule (INACTIVE) with updated group assignments
4. User reviews staged rule
5. Cutover: Deactivate old → Activate new
6. If cutover fails: Automatic rollback (reactivate old rule)
7. Cleanup: Rename new rule → Delete old rule
```

This multi-step process ensures zero downtime and safe rollback if anything goes wrong.

### Manifest-Based Rollback

Every user access change generates a manifest:

```json
{
  "generatedAt": "2025-10-17T12:00:00.000Z",
  "operator": "joe.costanzo",
  "user": {
    "id": "00u1234567890",
    "login": "john.doe@company.com"
  },
  "actions": {
    "added": ["00g111", "00g222"],
    "removed": ["00g333"]
  }
}
```

The reset workflow reverses these actions:
- Groups in `added` → removed from user
- Groups in `removed` → added back to user

This creates a perfect "undo" for any access change operation.

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

**Verify your setup:**
```bash
npm run preflight
```

This checks Node version, dependencies, configuration, and tests your Okta connection.

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

## Safety Features

This tool manages production access control. Multiple safety mechanisms are built in:

**Before Execution:**
- Preflight checks validate configuration
- All changes are previewed with impact summaries
- Explicit confirmation required before applying changes

**During Execution:**
- Automatic backups created before rule modifications
- Manifests generated for all user access changes
- Progress tracking with detailed logging

**After Execution:**
- Timestamped logs in `logs/` directory
- Rule backups in `backups/` directory
- Access manifests in `manifests/` directory (enable rollback)

**Best Practices:**
- Run `npm run preflight` before first use
- Review impact summaries carefully before confirming
- Keep manifests for audit trail and rollback capability
- Test with non-critical users/groups first

## Project Structure

```
├── okta_membership_wizard.js     # Main interactive tool
├── bulk_update_user_profile.sh   # Bulk profile attribute updates
├── bulk_load.js                  # Bulk group operations
├── preflight.js                  # Setup validation
├── diagnose_okta.js              # Diagnostics
├── services/                     # API service layers
├── utils/                        # Shared utilities
├── logs/                         # Operation logs (gitignored)
├── backups/                      # Rule backups (gitignored)
├── manifests/                    # Access manifests (gitignored)
└── docs/                         # UX analysis and design docs
```

## License

MIT
